import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — phasing vía cheatSetup + Reality Ripple real (§3.9): Reality Ripple
// ({1}{U} instant: "Target artifact, creature, or land phases out") lanzado
// sobre un Runeclaw Bear propio. El hechizo no puede adjuntarse con
// cheatSetup (no es un aura) así que se lanza de verdad desde la mano: T1
// tierra → cheat raw (Oso + Isla propia, con la main aparcada) → clic en
// Reality Ripple (responde al SELECT aparcado) → GAME_TARGET al Oso → {1}{U}
// girando las dos Islas → el permanente sale de fase y sigue en el battlefield
// con phasedIn:false (PhasedOutEffect pone el flag en el propio permanente; el
// PlayerView serializa todos los permanentes, filtra la UI web).
//
// Patrón de cast con la main aparcada copiado de must-block (el cheatSetup
// auto-pasa el SELECT pendiente y cerraría la fase antes de poder lanzar).
function makePhasingDriver() {
  return {
    name: 'phasing',
    outFile: 'phasing.json',
    deck: {
      name: 'Mage Web phasing rec',
      cards: [
        // Arriba de la biblioteca: con skipInitShuffling entra en la mano inicial.
        { cardName: 'Reality Ripple', setCode: 'MIR', cardNumber: '87' },
        { cardName: 'Island', setCode: 'iko', cardNumber: '271', amount: 59 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    _chainStarted: false,
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
      // Regla P1: el cheat va tras ≥1 acción normal (la tierra del T1).
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra')
          return
        }
      }
      // Cheat raw: NO auto-pasa el SELECT pendiente, la main queda abierta para
      // lanzar Reality Ripple (la acción responde al SELECT aparcado).
      if (!this._chainStarted) {
        this._chainStarted = true
        const myId = gv.myPlayerId ?? me.playerId ?? me.id
        ctx.log('onSelect: cheat raw (Runeclaw Bear + Isla) con la main aparcada')
        void ctx
          .send('cheatSetup', {
            gameId: ctx.gameId,
            playerId: myId,
            zones: { battlefield: ['Runeclaw Bear', 'Island'] },
          })
          .then((r) => {
            ctx.log('onSelect: cheat →', JSON.stringify(r)?.slice(0, 120))
            if (!r?.ok) {
              this._chainStarted = false
              ctx.pass()
              return
            }
            if (!this._cast && ctx.cardInHand('Reality Ripple')) {
              this._cast = true
              ctx.log('onSelect: lanzo Reality Ripple (responde al SELECT aparcado)')
              ctx.playCardByName('Reality Ripple')
            } else {
              ctx.pass()
            }
          })
        return
      }
      // Reintento del cast (si el de la cadena no salió y la vista viva ya
      // confirma el Oso en el campo).
      if (!this._cast && ctx.cardInHand('Reality Ripple') && ctx.findOnBattlefield('Runeclaw Bear')) {
        this._cast = true
        ctx.log('onSelect: lanzo Reality Ripple sobre el Oso')
        ctx.playCardByName('Reality Ripple')
        return
      }
      ctx.pass()
    },
    // Objetivo de Reality Ripple: nuestro Oso. El descarte de limpieza también
    // llega como GAME_TARGET ("Select a card to discard") y nunca debe
    // responderse con un permanente del campo (rechazo en bucle).
    onTarget(ctx, question) {
      if (/discard/i.test(String(question ?? ''))) return ctx.cardInHand('Island')
      const bear = ctx.findOnBattlefield('Runeclaw Bear')
      if (bear) {
        ctx.log('onTarget: Reality Ripple → Oso')
        return bear
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      return Object.values(me?.battlefield ?? {}).some(
        (c) => /runeclaw bear/i.test(c?.name ?? '') && c?.phasedIn === false,
      )
    },
  }
}

export const drivers = { phasing: makePhasingDriver }

export const meta = {
  mechanic: 'phasing',
  kind: 'game',
  assert: 'hasPhasing',
  note: 'Reality Ripple ({1}{U}: "Target artifact, creature, or land phases out", 1 copia arriba del mazo con skipInitShuffling) lanzado de verdad desde la mano sobre un Runeclaw Bear propio (el hechizo no es un aura: el cheatSetup no puede lanzarlo). T1: tierra → cheat raw (Oso + Isla al campo propio) con la main aparcada → clic en Reality Ripple (responde al SELECT aparcado) → GAME_TARGET al Oso → {1}{U} con las dos Islas. Captura: el Oso sigue en me.battlefield con phasedIn:false (el objeto permanece en la zona, la vista lo marca fuera de fase; BoardZone.tsx lo filtra con p.phasedIn !== false). Driver phasing con cheatSetup + cast real.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makePhasingDriver())
}
