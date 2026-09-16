import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — §3.10 "Monarch, initiative/dungeon, the ring, emblemas" (faltaba la
// iniciativa). Vía cheatSetup + lanzamiento real: White Plume Adventurer
// (CLB 49, {2}{W} 3/3 Orc Cleric) — "When White Plume Adventurer enters the
// battlefield, you take the initiative" (TakeTheInitiativeEffect →
// GameImpl.takeInitiative: addDesignation(new Initiative(), ...) al GameState +
// setInitiativeId + TOOK_INITIATIVE). Ese trigger dispara a su vez
// InitiativeVentureTriggeredAbility → ventureIntoDungeon(playerId, true) →
// UndercityDungeon: la primera sala (Secret Entrance) se entra sin elegir y su
// RoomTriggeredAbility pide la búsqueda de una tierra básica (GAME_TARGET) —
// el driver la responde. Mazo de 60 Llanuras: T1 tierra (acción normal previa
// al cheat) + cheatSetup (White Plume a la MANO + 2 Llanuras al campo = 3
// manás para {2}{W}) y se lanza.
//
// HALLAZGO CLAVE (contrato): la iniciativa SÍ viaja como campo estructurado
// players[].initiative:boolean — PlayerView.java:60/155
// ("this.initiative = player.getId().equals(game.getInitiativeId())"), ya
// modelado en el contrato web (types.generated.ts:70). designationNames NO
// sirve (mismo caso que Monarch): PlayerView.java:156 itera
// player.getDesignations() (designations DEL JUGADOR de PlayerImpl) mientras
// que takeInitiative hace GameState.addDesignation → la Designation Initiative
// es GLOBAL y queda fuera de designationNames. El dungeon vive además en
// commandList como DungeonView (PlayerView.java:122-126, name "Undercity").
function makeInitiativeDriver() {
  return {
    name: 'initiative',
    outFile: 'initiative.json',
    deck: {
      name: 'Mage Web initiative rec',
      cards: [{ cardName: 'Plains', setCode: 'm20', cardNumber: '261', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    _cheated: false,
    _cast: false,
    _searched: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Tierra por turno: acción normal previa al cheat (regla P1) y evita el
      // descarte de limpieza.
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra T', turn)
          return
        }
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (White Plume a la mano + 2 Llanuras al campo)')
        void ctx.cheatSetup({ hand: ['White Plume Adventurer'], battlefield: ['Plains', 'Plains'] })
        return
      }
      // Lanzamiento real {2}{W}: 3 Llanuras sin girar y pila vacía (main propio).
      const stackEmpty = Object.keys(gv?.stack ?? {}).length === 0
      if (!this._cast && ctx.cardInHand('White Plume Adventurer') && ctx.untappedMana() >= 3 && stackEmpty) {
        this._cast = true
        ctx.log('onSelect: lanzo White Plume Adventurer (tomo la iniciativa)')
        ctx.playCardByName('White Plume Adventurer')
        return
      }
      ctx.pass()
    },
    // Pago {2}{W}: Llanuras sin girar, una por GAME_PLAY_MANA.
    onPlayMana(ctx) {
      const plains = Object.values(ctx.me?.battlefield ?? {}).find(
        (c) => !c.tapped && /plains/i.test(String(c?.name ?? c?.displayName ?? '')),
      )
      if (plains) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: plains.id })
        ctx.log('onPlayMana: giro', plains.name)
      }
    },
    // Único objetivo de la run: la búsqueda de tierra básica que abre la sala
    // Secret Entrance del Undercity (SearchLibraryPutInHandEffect). Como en
    // energy/may-trigger, los ids vienen en data.options.possibleTargets.
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      const pt = data?.options?.possibleTargets ?? data?.targets ?? []
      const ids = Array.isArray(pt)
        ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : Object.keys(pt ?? {})
      if (/discard/i.test(q)) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const first = Object.keys(hand)[0] ?? ids[0]
        ctx.log('onTarget: descarte de limpieza')
        return first
      }
      if (ids[0]) {
        this._searched = true
        ctx.log('onTarget: tierra básica del Secret Entrance (Undercity)')
        return ids[0]
      }
      return undefined
    },
    // Invariante: soy quien tiene la iniciativa en el view
    // (players[].initiative === true), White Plume Adventurer ya en mi campo,
    // el AVENTURAMIENTO ya resuelto (dungeon en commandList + búsqueda del
    // Secret Entrance respondida) y la pila vacía. OJO (visto en vivo
    // 2026-09-16): el primer frame con initiative=true y pila vacía llega
    // ANTES de que el trigger de venture del Undercity se apile/resuelva (el
    // TOOK_INITIATIVE se dispara durante la resolución del ETB y los triggers
    // se apilan después) — sin exigir el dungeon+la búsqueda se captura un
    // estado a medias (commandList vacío, sin la tierra buscada).
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      const wpa = Object.values(me.battlefield ?? {}).some((c) =>
        /white plume adventurer/i.test(String(c?.name ?? c?.displayName ?? '')),
      )
      const stackEmpty = Object.keys(gv?.stack ?? {}).length === 0
      const cmds = Object.values(me.commandList ?? {})
      const dungeon = cmds.some((c) => /undercity/i.test(String(c?.name ?? '')))
      return me.initiative === true && wpa && stackEmpty && dungeon && this._searched === true
    },
  }
}

export const drivers = { initiative: makeInitiativeDriver }

export const meta = {
  mechanic: 'initiative',
  kind: 'game',
  assert: 'hasInitiative',
  note: 'White Plume Adventurer (CLB 49, {2}{W}: ETB "you take the initiative") lanzada de verdad vía cheatSetup (carta a la mano + 2 Llanuras al campo; 3 manás exactos) contra el SIM pasivo. HALLAZGO: la iniciativa SÍ tiene campo estructurado en el view — players[].initiative:boolean (PlayerView.java:60/155, "player.getId().equals(game.getInitiativeId())"), ya modelado en types.generated.ts; players[].designationNames sigue vacío para designations GLOBALES de GameState como Initiative/Monarch (PlayerView.java:156 itera player.getDesignations()). El trigger de iniciativa ventura al Undercity y abre la sala Secret Entrance (búsqueda de tierra básica respondida por GAME_TARGET "Select a basic land card"); el dungeon viaja además en commandList como DungeonView (PlayerView.java:122-126, name "Undercity", rules[0] "(Currently in Secret Entrance)"). Invariante del frame: me.initiative===true, White Plume Adventurer en mi battlefield, Undercity en commandList, pila vacía. Driver initiative con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeInitiativeDriver())
}
