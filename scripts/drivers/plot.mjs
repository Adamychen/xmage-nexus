import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — §3.3 "Foretell / plot / exilio boca abajo": falta plot (Outlaws of
// Thunder Junction). Rictus Robber ({3}{B}, 4/3) con Plot {2}{B}: con 3 Swamps
// (la del turno + 2 del cheat) el hardcast NO es pagable (4 manás) y el plot SÍ
// ({2}{B}=3), así que el clic en la carta en mano activa la SpecialAction sin
// chooser (mismo patrón que foretell/suspend). El plot exilia la carta en la
// zona "Plots of <jugador>" (PlotAbility.doExileAndPlotCard), boca abajo para
// el rival (su PlayerView no incluye exilios ajenos): el dueño la ve en
// me.exile. Captura: la carta en me.exile + stack vacío tras pagar el coste
// (GAME_PLAY_MANA {B},{2},{1}) y resolver la SpecialAction. El lanzamiento
// gratis ({0}, PlotSpellAbility) se validó aparte en un turno posterior (ver
// meta.note).
function foundInExile(me, name) {
  const ex = me?.exile ?? {}
  const entries = Array.isArray(ex) ? ex.map((c) => [c?.id, c]) : Object.entries(ex)
  return entries.find(([, c]) => new RegExp(name, 'i').test(String(c?.name ?? c?.displayName ?? ''))) ?? null
}

function makePlotDriver() {
  return {
    name: 'plot',
    outFile: 'plot.json',
    deck: {
      name: 'Mage Web plot rec',
      cards: [{ cardName: 'Swamp', setCode: 'iko', cardNumber: '270', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _plotted: false,
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
          ctx.log('onSelect: tierra')
          return
        }
      }
      // Regla P1: el cheat va tras ≥1 acción normal (la tierra del T1).
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Rictus Robber en mano, 2 Swamps al campo)')
        void ctx.cheatSetup({ hand: ['Rictus Robber'], battlefield: ['Swamp', 'Swamp'] })
        return
      }
      // Plot: clic en la carta en mano con 3 Swamps (hardcast {3}{B} no
      // pagable → única acción jugable, sin picker).
      if (!this._plotted && ctx.cardInHand('Rictus Robber') && ctx.untappedMana() >= 3) {
        this._plotted = true
        ctx.log('onSelect: plot Rictus Robber ({2}{B})')
        ctx.playCardByName('Rictus Robber')
        return
      }
      ctx.pass()
    },
    // Por si el picker apareciera (hardcast vs plot): elegir plot.
    onChooseAbility(opts, ctx) {
      const f = (opts ?? []).find((o) => /plot/i.test(String(o?.label ?? '')))
      if (f) {
        ctx.log('onChooseAbility: plot')
        return f.value ?? f.id
      }
      return (opts ?? [])[0]?.value
    },
    // Defensa por si el clic sobre la carta exiliada dispara el lookAtFaceDown.
    onAsk(question, ctx) {
      if (/look at/i.test(String(question ?? ''))) {
        ctx.log('onAsk: "Look at …" → NO (lanzar/plot)')
        return false
      }
      return undefined
    },
    // Descarte de limpieza si hiciera falta (no debería: mano ≤ 7).
    onTarget(ctx, question, data) {
      if (/discard/i.test(String(question ?? ''))) {
        const first = Object.keys(ctx.gv?.myHand ?? ctx.gv?.hand ?? {})[0]
        if (first) {
          ctx.log('onTarget: descarte de limpieza')
          return first
        }
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const plotted = foundInExile(me, 'rictus robber')
      const stackEmpty = Object.keys(gv.stack ?? {}).length === 0
      return Boolean(plotted) && stackEmpty
    },
  }
}

export const drivers = { plot: makePlotDriver }

export const meta = {
  mechanic: 'plot',
  kind: 'game',
  assert: 'hasPlot',
  note: 'Rictus Robber ({3}{B}) con Plot {2}{B}: con 3 Swamps (tierra del turno + 2 cheatSetup) el hardcast de 4 NO es pagable y el plot de 3 SÍ → clic en la carta en mano = SpecialAction directa sin chooser (el coste se paga con GAME_PLAY_MANA normales: {B},{2},{1}). La carta queda en la zona de exilio "Plots of <jugador>" (PlotAbility.doExileAndPlotCard) y el dueño la ve en me.exile como CardView normal (name "Rictus Robber", faceDown:false, rules ["…","Plot {2}{B}"]; el rival no la ve: PlayerView solo lista exilios de owner == jugador de la vista), sin campo de zona "Plotted" en el frame. Captura: Rictus Robber en me.exile + stack vacío (plot recién resuelto, POSTCOMBAT_MAIN, 3 Swamps girados; el turno varía según quién empiece). Hallazgo (corrida exploratoria, en el turno propio siguiente al plot): clicar el UUID exiliado dispara GAME_CHOOSE_ABILITY con opción única "Cast Rictus Robber using Plot" (el picker NO se suprime) y lanza gratis: el frame resultante tiene Rictus Robber en la pila con TODAS las Swamps sin girar y manaPool 0 (PlotSpellAbility {0}, BASE_ALTERNATE de PlotAddSpellAbilityEffect). Driver plot con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makePlotDriver())
}
