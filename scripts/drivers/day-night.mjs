import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — day/night §3.9 (fila "Transformar / DFC / day-night"; DFC ya estaba en
// dfc.json, falta el eje day/night). Carta: Reckless Stormseeker ({2}{R}, MIT)
// con DayboundAbility (../xmage-fork .../keyword/DayboundAbility.java): su
// DayboundEffect (ContinuousEffect PlayerEffects) aplica 702.145d "si es ni de
// día ni de noche, se hace de día" en cuanto el permanente está en el campo
// (cheatSetup directo al battlefield: criatura sin decisión "as it enters").
// Después, en el paso de destapado del turno del rival, UntapStep.handleDayNight
// (726.2a) ve que el jugador activo anterior (yo, T1) no lanzó hechizos → hace
// noche y transforma el permanente daybound (setDaytime → transform con
// ignoreDayNight=true) → Reckless Stormseeker pasa a Storm-Charged Slasher.
//
// HALLAZGO de protocolo (verificado en el fork 1.4.61): el flag day/night NO es
// un campo de GameView (GameState.hasDayNight/isDaytime no se serializan, y
// tampoco van en PlayerView.designationNames — la heurística del web
// MechanicsTray/PlayerInfoBar busca 'day'/'night' en designationNames, que aquí
// nunca llega). Lo que SÍ viaja en cada GameView es el texto del DayNightHint
// dentro del helper emblem: `myHelperEmblems` → CardView "Helper Emblem" con
// rules ["Day or night.","<br/><hintstart/>","It's currently day, active player
// has cast 0 spells this turn. It will become night next turn."] (o "...night
// ..."). Además el cambio se anuncia como inform ("It has become day/night",
// GameImpl.setDaytime → informPlayers → TableEvent.INFO → chat de partida, no
// como GAME_INFORM/campo) y el DFC se ve transformado (transformed:true +
// secondCardFace).
function makeDayNightDriver() {
  return {
    name: 'day-night',
    outFile: 'day-night.json',
    deck: {
      name: 'Mage Web day-night rec',
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
      // Tierra por turno: única acción normal del T1 (regla P1 del cheat) y,
      // a propósito, NINGÚN hechizo lanzado: CastSpellLastTurnWatcher debe ver
      // 0 hechizos del jugador activo anterior para que 726.2a haga noche.
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra (sin lanzar hechizos, 0 spells para 726.2a)')
          return
        }
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Reckless Stormseeker daybound al campo)')
        void ctx.cheatSetup({ battlefield: ['Reckless Stormseeker'] }).then((r) => {
          if (!r?.ok) this._cheated = false
        })
        return
      }
      ctx.pass()
    },
    onAsk(question, ctx) {
      if (/look at/i.test(String(question ?? ''))) return false
      return undefined
    },
    // Descarte de limpieza (si llega): una carta de la mano.
    onTarget(ctx, question, data) {
      if (/discard/i.test(String(question ?? ''))) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const first = Object.keys(hand)[0]
        if (first) return first
        const ids = Array.isArray(data?.targets) ? data.targets : Object.keys(data?.targets ?? {})
        if (ids.length > 0) return ids[0]
        return false
      }
      return undefined
    },
    // Invariante: Reckless Stormseeker transformado (Storm-Charged Slasher) Y el
    // helper emblem del DayNightHint diciendo que es de noche. Prueba doble:
    // estado day/night visible en `myHelperEmblems` + transform real del DFC.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const nightbound = Object.values(me?.battlefield ?? {}).some(
        (c) => c?.transformed === true && /storm-charged slasher/i.test(String(c?.name ?? '')),
      )
      const nightHint = Object.values(gv.myHelperEmblems ?? {}).some((e) =>
        (e?.rules ?? []).some((r) => /it's currently night/i.test(String(r))),
      )
      return nightbound && nightHint
    },
  }
}

export const drivers = { 'day-night': makeDayNightDriver }

export const meta = {
  mechanic: 'day-night',
  file: 'day-night.json',
  kind: 'game',
  assert: 'hasDayNight',
  note: 'Day/night vía Reckless Stormseeker (daybound, cheatSetup directo al campo): su DayboundEffect aplica 702.145d y el juego pasa de "ni de día ni de noche" a DÍA (dato en el helper emblem: rules "It\'s currently day, active player has cast 0 spells this turn..."); en el destapado del turno del SIM, UntapStep.handleDayNight (726.2a: 0 hechizos del activo anterior) hace NOCHE y transforma el daybound → Storm-Charged Slasher (transformed:true, secondCardFace Reckless Stormseeker) en el BEGINNING/UPKEEP del turno del SIM siguiente a mi turno (turn 2 o 3 según quién empiece; frame final: turn 2). HALLAZGO: el flag day/night NO es campo de GameView (GameState.hasDayNight/isDaytime no se serializan) ni viaja en PlayerView.designationNames (la heurística del web MechanicsTray/PlayerInfoBar/GameScreen no recibe nada en 1.4.61: no existe DesignationType day/night); la única evidencia estructurada en cada frame es el DayNightHint dentro de myHelperEmblems (CardView "Helper Emblem" con rules ["Day or night.","<br/><hintstart/>","It\'s currently day/night, active player has cast N spells this turn. It will [not] become day/night next turn."], verificado con REC_DUMP_EVENTS=1) y el permanente transformado; el texto "It has become day/night" de GameImpl.setDaytime → informPlayers va al chat de la partida (TableEvent.INFO → chatManager.broadcast, NO como GAME_INFORM ni campo). Captura: DFC transformado + hint "It\'s currently night" en myHelperEmblems. Driver day-night con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeDayNightDriver())
}
