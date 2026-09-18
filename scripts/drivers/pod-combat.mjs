import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Combate en pod (§3.6/§3.11 "Combate multijugador (varios defensores)"):
// mesa Free For All de 4 (1 humano + 3 SIM) con un Grizzly propio cheateado.
// Al declarar el atacante con 3 defensores posibles el motor construye un
// TargetDefender ("Select a player, planeswalker, o battle to attack") y el
// driver elige al ÚLTIMO SIM — no al primero/primer-no-activo, que es
// precisamente el atajo que usa el overlay de flechas para el preview
// (`CombatArrowsOverlay`: `players.find(p => p.playerId !== activePlayerId)`)
// y el que fallaría en pod si el defensor elegido no es el primero.
//
// CAUSA RAÍZ del "GAME_TARGET que nunca llega" (bisecada 2026-09-17 en
// `Combat.java:getAttackablePlayers` + `HumanPlayer.selectDefender`): el
// default de MatchOptions es `attackOption = LEFT`, así que en FFA
// `getDefenders()` solo contiene al vecino de la izquierda (size 1) y
// `selectDefender` declara el ataque SIN preguntar defensor. Hay que crear la
// mesa con `attackOption: 'MULTIPLE'` (soporte nuevo en rec-lib.mjs) para que
// los 3 SIM entren en `getDefenders()` y salga el TargetDefender.
//
// La captura exige el grupo de combate con `defenderId` = el SIM elegido y
// nuestro Grizzly como atacante. El replay e2e aserta la flecha REAL del
// overlay (`g.arrow-group.arrow-attack[data-arrow-from=<grizzly>][data-arrow-to=<sim>]`).
const SIM_DECK = {
  name: 'Mage Sim pod lands',
  cards: [
    { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 50 },
    { cardName: 'Island', setCode: 'iko', cardNumber: '263', amount: 50 },
  ],
  sideboard: [],
}

function makePodCombatDriver() {
  return {
    name: 'pod-combat',
    outFile: 'pod-combat.json',
    deck: {
      name: 'Mage Web pod-combat rec',
      cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
      sideboard: [],
    },
    playerTypes: ['HUMAN', 'SIM', 'SIM', 'SIM'],
    simDecks: [SIM_DECK, SIM_DECK, SIM_DECK],
    tableGameType: 'Free For All',
    gameType: 'Constructed - Pioneer',
    // Sin esto el motor usa LEFT (1 solo defensor legal) y no hay GAME_TARGET.
    attackOption: 'MULTIPLE',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _attackSentTurn: -1,
    _targetSim: null,
    sims(ctx) {
      return (ctx.gv?.players ?? []).filter((p) => !p?.controlled)
    },
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return

      if (gv.step === 'DECLARE_ATTACKERS' && me.isActive === true) {
        // El Grizzly cheateado entra sin mareo (`summoningSickness:false`),
        // pero el guardado evita declarar un ataque que el motor ignoraría.
        const grizzly = Object.entries(me.battlefield ?? {}).find(
          ([, c]) => /grizzly bears/i.test(c?.name ?? '') && c?.summoningSickness !== true,
        )
        if (!grizzly) {
          ctx.pass()
          return
        }
        const chosen = this._targetSim
        const declared =
          chosen !== null &&
          (gv.combat ?? []).some(
            (g) =>
              g.defenderId === chosen &&
              Object.values(g?.attackers ?? {}).some((c) => /grizzly bears/i.test(c?.name ?? '')),
          )
        if (declared) {
          // Cerrar la declaración con el botón ok (boolean false), NUNCA
          // 'special' con >1 defensor (abre otro target de "all attack").
          ctx.log('onSelect: ataque al último SIM declarado, confirmo (false)')
          ctx.pass()
          return
        }
        if (this._attackSentTurn !== gv.turn) {
          this._attackSentTurn = gv.turn
          ctx.log('onSelect: ataco con Grizzly; el defensor se elige en el GAME_TARGET')
          ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: grizzly[0] })
          return
        }
        ctx.pass()
        return
      }

      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
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
        ctx.log('onSelect: cheatSetup (Grizzly Bears al campo)')
        void ctx.cheatSetup({ battlefield: ['Grizzly Bears'] })
        return
      }
      ctx.pass()
    },
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) {
        const pt = data?.options?.possibleTargets ?? data?.targets ?? []
        const ids = Array.isArray(pt) ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean) : Object.keys(pt ?? {})
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        ctx.log('onTarget: descarte de limpieza')
        return Object.keys(hand)[0] ?? ids[0] ?? false
      }
      const pt = data?.options?.possibleTargets ?? data?.targets ?? []
      const candidates = Array.isArray(pt) ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean) : Object.keys(pt ?? {})
      const sims = this.sims(ctx)
      ctx.log('onTarget: q=', q, '| cands=', candidates.length, '| sims=', sims.map((p) => p?.name).join('/'))
      // El ÚLTIMO SIM: si la UI/el overlay asumiera "el primer no-activo", la
      // flecha apuntaría a otro jugador.
      const chosen = sims[sims.length - 1]
      const id = chosen?.playerId ?? chosen?.id
      if (/attack/i.test(q) && id) {
        this._targetSim = String(id)
        ctx.log('onTarget: defensor → último SIM', chosen?.name)
        return String(id)
      }
      return candidates[0] ?? undefined
    },
    captureWhen(gv) {
      const chosen = this._targetSim
      if (!chosen) return false
      return (gv.combat ?? []).some(
        (g) =>
          g?.defenderId === chosen &&
          Object.values(g?.attackers ?? {}).some((c) => /grizzly bears/i.test(c?.name ?? '')),
      )
    },
  }
}

export const drivers = { 'pod-combat': makePodCombatDriver }

export const meta = {
  mechanic: 'pod-combat',
  kind: 'game',
  assert: 'hasPodCombat',
  note: 'Combate multijugador con varios defensores: FFA de 4 (1 humano + 3 SIM, `playerTypes`/`simDecks` de rec-lib) con un Grizzly propio cheateado. HALLAZGO 2026-09-17: el GAME_TARGET del defensor no llegaba porque el default de MatchOptions es attackOption=LEFT (en FFA `Combat.getAttackablePlayers` deja 1 solo defensor y HumanPlayer.selectDefender declara sin preguntar); la mesa ahora se crea con `attackOption: MULTIPLE` (passthrough nuevo en rec-lib.mjs). Al declarar el atacante el motor pregunta el defensor (TargetDefender "Select a player, planeswalker, or battle to attack") y el driver elige al ÚLTIMO SIM; la captura exige el grupo de combate con defenderId = ese SIM. Es el caso que el preview del overlay (CombatArrowsOverlay, `players.find(p => p.playerId !== activePlayerId)`) no cubre en pod: el replay aserta la flecha real por `[data-arrow-from]`/`[data-arrow-to]`.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makePodCombatDriver())
}
