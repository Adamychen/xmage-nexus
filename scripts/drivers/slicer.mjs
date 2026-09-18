import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Slicer, Hired Muscle (BOT 6/21, Transformers): DFC legendaria 3/4 con
// doble estocada y prisa. "At the beginning of each opponent's upkeep, you may
// have that player gain control of Slicer until end of turn. If you do, untap
// Slicer, goad it, and it can't be sacrificed this turn. If you don't, convert
// it." (SlicerHiredMuscleUpkeepEffect, BeginningOfUpkeepTriggeredAbility
// TargetController.OPPONENT + chooseUse del controlador).
//
// Montaje: mazo de 60 Mountains; T1 tierra (acción normal previa al cheat) +
// cheatSetup con Slicer al campo propio (sin coste ni decisión al entrar; no
// es un permanente con "as it enters"). Se pasa el turno y al llegar el upkeep
// del SIM el motor pregunta al controlador (GAME_ASK chooseUse) — el hook
// onAsk responde SÍ: el SIM gana el control hasta el fin del turno, Slicer se
// endereza y queda goadeada.
//
// Evidencia en el view: el control se refleja en la zona del view (el
// permanente con controllerId del SIM sale en SU battlefield) y el untap en
// tapped:false; el goad NO tiene campo (`goadingPlayers` no se serializa,
// gap aceptado) pero reached vía `rules` ("Goaded by <jugador> (must attack)",
// HintUtils ICON_REQUIRE) y cardIcon OTHER_HAS_RESTRICTIONS — mismo camino que
// goad.json. La captura exige Slicer en el campo del SIM con ese hint.
const SLICER = 'Slicer, Hired Muscle'

function makeSlicerDriver() {
  return {
    name: 'slicer',
    outFile: 'slicer.json',
    deck: {
      name: 'Mage Web slicer rec',
      cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
      // Regla P1: el cheat va tras ≥1 acción normal (la tierra del T1).
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup Slicer al campo propio')
        void ctx.cheatSetup({ battlefield: [SLICER] }).then((r) => {
          ctx.log('onSelect: cheat →', JSON.stringify(r))
        })
        return
      }
      ctx.pass()
    },
    // El trigger es del upkeep del oponente pero decide el CONTROLADOR (yo):
    // chooseUse → GAME_ASK. Se acepta ceder Slicer al SIM este turno. OJO: el
    // texto llega con el placeholder sin resolver ("gain control of {this}"),
    // no con el nombre de la carta — no matchear por "slicer".
    onAsk(question, ctx) {
      const q = String(question ?? '')
      if (/each opponent's upkeep/i.test(q) && /gain control/i.test(q)) {
        this._ceded = true
        ctx.log('onAsk: ceder Slicer al SIM → SÍ |', q.slice(0, 120))
        return true
      }
      return undefined
    },
    captureWhen(gv) {
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      for (const c of Object.values(sim?.battlefield ?? {})) {
        if (!/slicer/i.test(String(c?.name ?? ''))) continue
        const icons = Array.isArray(c?.cardIcons) ? c.cardIcons : []
        const hasGoadIcon = icons.some((i) => /goaded by/i.test(String(i?.hint ?? i?.text ?? '')))
        const hasGoadRule = (c?.rules ?? []).some((r) => /goaded by/i.test(String(r)))
        if (hasGoadIcon || hasGoadRule) return true
      }
      return false
    },
  }
}

export const drivers = { slicer: makeSlicerDriver }

export const meta = {
  mechanic: 'slicer',
  kind: 'game',
  assert: 'hasSlicerCeded',
  note: 'Slicer, Hired Muscle (BOT 6/21, Transformers; DFC 3/4 doble estocada + prisa) con cheatSetup al campo propio en el T1: en el upkeep del SIM su trigger (BeginningOfUpkeepTriggeredAbility OPPONENT) pregunta al CONTROLADOR "you may have that player gain control of Slicer until end of turn. If you do, untap Slicer, goad it, and it can\'t be sacrificed this turn. If you don\'t, convert it." y el driver responde SÍ (GAME_ASK chooseUse). Captura: Slicer en el battlefield del SIM (el view sigue al controlador real) desgirada (tapped:false por el untap) y con el hint de goad en `rules`/`cardIcons` (OTHER_HAS_RESTRICTIONS, "Goaded by <jugador> (must attack)" — mismo camino que goad.json; `goadingPlayers` no se serializa). Prueba el caso "ceder control de tu permanente al rival en SU upkeep" (dirección inversa a Threaten) sin campos nuevos del contrato.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeSlicerDriver())
}
