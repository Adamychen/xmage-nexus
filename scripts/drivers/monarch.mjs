import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Monarch (§3.10: "Monarch, initiative/dungeon, the ring, emblemas") vía
// cheatSetup + lanzamiento real: Palace Sentinels (CN2 19, {3}{W} 2/4 Human
// Soldier; EntersBattlefieldTriggeredAbility → BecomesMonarchSourceEffect
// → game.setMonarchId, que además añade la Designation Monarch — la primera
// del juego). Mazo de 60 Llanuras: T1 tierra (acción normal previa al cheat) +
// cheatSetup (Palace Sentinels a la MANO + 3 Llanuras al campo = 4 manás para
// {3}{W}) y se lanza; el ETB no pide ninguna decisión (trigger sin objetivos).
//
// Este driver es también SONDA DE CONTRATO (§3.10): el estado de monarca SÍ
// viaja al view aunque GameState.monarchId no tenga campo propio en GameView ni
// en el nivel superior del DTO; PlayerView lo proyecta como
// players[].monarch:boolean (PlayerView.java:154
// "player.getId().equals(game.getMonarchId())"). HALLAZGO: players[]
// .designationNames queda VACÍO — la Designation Monarch es GLOBAL (GameState
// .designations vía state.addDesignation, GameImpl.setMonarchId) y PlayerView
// solo serializa las designations DEL JUGADOR (City's Blessing, Speed…), así
// que el monarca NO debe detectarse por designationNames.
function makeMonarchDriver() {
  return {
    name: 'monarch',
    outFile: 'monarch.json',
    deck: {
      name: 'Mage Web monarch rec',
      cards: [{ cardName: 'Plains', setCode: 'm20', cardNumber: '261', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _cast: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Tierra por turno: acción normal previa al cheat y evita el descarte de
      // limpieza.
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra T', turn)
          return
        }
      }
      // Regla P1: el cheat va tras ≥1 acción normal (la tierra del T1).
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Palace Sentinels a la mano + 3 Llanuras al campo)')
        void ctx.cheatSetup({ hand: ['Palace Sentinels'], battlefield: ['Plains', 'Plains', 'Plains'] })
        return
      }
      // Lanzamiento real {3}{W}: 4 Llanuras sin girar (la del T1 + las 3 del
      // cheat) y pila vacía (sorcery-speed implícito: criatura en main propio).
      const stackEmpty = Object.keys(gv?.stack ?? {}).length === 0
      if (!this._cast && ctx.cardInHand('Palace Sentinels') && ctx.untappedMana() >= 4 && stackEmpty) {
        this._cast = true
        ctx.log('onSelect: lanzo Palace Sentinels')
        ctx.playCardByName('Palace Sentinels')
        return
      }
      ctx.pass()
    },
    // Pago {3}{W}: cuatro Llanuras sin girar, una por GAME_PLAY_MANA.
    onPlayMana(ctx, m) {
      const bf = Object.values(ctx.me?.battlefield ?? {}).filter((c) => !c.tapped)
      const plains = bf.find((c) => /plains/i.test(String(c?.name ?? c?.displayName ?? '')))
      const pick = plains ?? bf.find((c) => (c.cardTypes ?? []).includes('LAND'))
      if (pick) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: pick.id })
        ctx.log('onPlayMana: giro', pick.name, String(m?.data?.message ?? '').slice(0, 40))
      }
    },
    // Invariante: soy el monarca en el view (players[].monarch === true) con
    // Palace Sentinels ya en mi campo y la pila vacía (el trigger del ETB ya
    // resolvió).
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      const sentinels = Object.values(me.battlefield ?? {}).some((c) =>
        /palace sentinels/i.test(String(c?.name ?? c?.displayName ?? '')),
      )
      const stackEmpty = Object.keys(gv?.stack ?? {}).length === 0
      return me.monarch === true && sentinels && stackEmpty
    },
  }
}

export const drivers = { monarch: makeMonarchDriver }

export const meta = {
  mechanic: 'monarch',
  kind: 'game',
  assert: 'hasMonarch',
  note: 'Palace Sentinels (CN2 19, {3}{W}: ETB "you become the monarch") lanzada de verdad vía cheatSetup (carta a la mano + 3 Llanuras al campo; 4 manás exactos) contra el SIM pasivo; el ETB no abre ninguna decisión (0 GAME_TARGET en la run). SONDA DE CONTRATO: el monarca SÍ viaja al view aunque GameState.monarchId no tenga campo propio — GameView no tiene monarchId/monarch de nivel superior; PlayerView lo proyecta como players[].monarch:boolean ("player.getId().equals(game.getMonarchId())", PlayerView.java:154). HALLAZGO: players[].designationNames NO sirve para el monarca (quedó []): Monarch es una Designation GLOBAL de GameState (state.addDesignation desde GameImpl.setMonarchId) y PlayerView solo serializa las designations del jugador (City\'s Blessing, Speed…). Sin gap engine→view: la fuente de verdad del cliente es players[].monarch. Invariante del frame: me.monarch===true, Palace Sentinels en mi battlefield y pila vacía. Driver monarch con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeMonarchDriver())
}
