import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// Variante de `slicer.mjs` por la rama contraria del mismo trigger: en el
// upkeep del SIM, "you may have that player gain control of Slicer... If you
// don't, convert it." El driver responde NO, así que Slicer se convierte a su
// cara trasera, un Equipo legendario que se acopla a una criatura del RIVAL.
//
// Motivo de la captura: la cara trasera NO es un Equipo sino un Vehículo con
// metal viviente ("As long as it's your turn, this Vehicle is also a
// creature"), y el motor lo refleja en los TIPOS: llega como `["ARTIFACT"]` en
// el turno del rival y como `["ARTIFACT","CREATURE"]` en el tuyo. Un tablero
// que coloca por `cardTypes` mueve la carta de banda en cada cambio de turno.
// Se graban las dos mitades del ciclo: `slicer-transformed.json` (turno del
// rival, sin CREATURE) y, con SLICER_TF_MY_TURN=1, `slicer-living-metal.json`
// (tu turno, con CREATURE).
const SLICER = 'Slicer, Hired Muscle'

function makeSlicerTransformedDriver() {
  return {
    name: 'slicer-transformed',
    outFile: process.env.SLICER_TF_MY_TURN === '1' ? 'slicer-living-metal.json' : 'slicer-transformed.json',
    deck: {
      name: 'Mage Web slicer tf rec',
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
    // Misma pregunta que en `slicer.mjs`, respuesta contraria: NO ceder → el
    // motor convierte Slicer. El texto llega con el placeholder sin resolver
    // ("gain control of {this}"), así que no se puede matchear por "slicer".
    onAsk(question, ctx) {
      const q = String(question ?? '')
      if (/each opponent's upkeep/i.test(q) && /gain control/i.test(q)) {
        ctx.log('onAsk: NO ceder → convertir Slicer |', q.slice(0, 120))
        return false
      }
      return undefined
    },
    captureWhen(gv) {
      for (const p of gv.players ?? []) {
        for (const c of Object.values(p?.battlefield ?? {})) {
          if (!/slicer/i.test(String(c?.name ?? ''))) continue
          if (c?.transformed !== true) continue
          const types = (c?.cardTypes ?? []).map((t) => String(t).toUpperCase())
          const isCreature = types.includes('CREATURE')
          // Metal viviente: la cara trasera es criatura SOLO en tu turno. Se
          // capturan las dos mitades del ciclo según MY_TURN.
          const wantCreature = process.env.SLICER_TF_MY_TURN === '1'
          if (isCreature === wantCreature) return true
        }
      }
      return false
    },
  }
}

export const drivers = { 'slicer-transformed': makeSlicerTransformedDriver }

export const meta = {
  mechanic: 'slicer-transformed',
  kind: 'game',
  assert: 'hasLivingMetalOffTurn',
  note: 'Rama contraria a slicer.json del mismo trigger (BeginningOfUpkeepTriggeredAbility OPPONENT): el driver responde NO al chooseUse, así que el motor convierte Slicer a su cara trasera en vez de cederlo. La cara trasera es "Slicer, High-Speed Antagonist", un Vehículo (ARTIFACT/VEHICLE) con metal viviente, y el motor publica el tipo CREATURE de forma CONDICIONAL al turno: `["ARTIFACT"]` en el turno del rival (este frame, turno 3) y `["ARTIFACT","CREATURE"]` en el tuyo (slicer-living-metal.json, turno 4). Fija que `cardTypes` es un valor volátil por turno, no una propiedad estable de la carta: cualquier colocación del tablero que dependa de él mueve la carta de sitio en cada cambio de turno. `attachedTo` es null en ambos: no interviene ningún adjunto.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeSlicerTransformedDriver())
}
