import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — suspend (§3.3 lanzar desde otras zonas): Rift Bolt (TSP 176, {2}{R}
// sorcery, Suspend 1—{R}) en la mano inicial (mazo apilado con
// skipInitShuffling: la carta va primero => primer robo). Turno propio: tierra
// + clic en Rift Bolt. El motor expone la habilidad de suspend como
// SpecialAction de la mano (SuspendAbility, Zone.HAND) y con un único maná
// disponible es la ÚNICA acción jugable de la carta => HumanPlayer activa la
// special action directamente (suppressAbilityPicker: no hay picker). Se paga
// {R} (PLAY_MANA) y SuspendExileEffect exilia la carta con 1 contador de
// tiempo en la zona "Suspended cards of <jugador>". Captura: Rift Bolt en
// exile propio con contador de tiempo >= 1 (sin cheatSetup: el orden del mazo
// basta y evita la carrera del cheat).
function makeSuspendDriver() {
  return {
    name: 'suspend',
    outFile: 'suspend.json',
    deck: {
      name: 'Mage Web suspend rec',
      cards: [
        { cardName: 'Rift Bolt', setCode: 'TSP', cardNumber: '176', amount: 1 },
        { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 59 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    _suspended: false,
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
      // El UUID de la carta en mano resuelve la special action de suspend
      // (SuspendAbility es la única jugable con 1 maná). El pago {R} lo hace el
      // handler por defecto de PLAY_MANA (giro una Montaña sin voltear).
      if (!this._suspended && ctx.cardInHand('Rift Bolt') && ctx.untappedMana() >= 1) {
        this._suspended = true
        ctx.log('onSelect: clic en Rift Bolt (special action de suspend)')
        ctx.playCardByName('Rift Bolt')
        return
      }
      ctx.pass()
    },
    // Defensivo: si el motor enseñara el picker (p.ej. también pagable {2}{R}),
    // elegir la habilidad de suspend por texto. Con 1 maná no debería llegar.
    onChooseAbility(opts, ctx) {
      ctx.log('onChooseAbility suspend:', JSON.stringify(opts).slice(0, 300))
      const suspend = (opts ?? []).find((o) => /suspend/i.test(String(o?.label ?? '')))
      if (suspend) return suspend.value ?? suspend.id
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const exile = me?.exile ?? {}
      const vals = Array.isArray(exile) ? exile : Object.values(exile)
      return vals.some(
        (c) =>
          /rift bolt/i.test(String(c?.name ?? '')) &&
          (c?.counters ?? []).some((k) => /time/i.test(String(k?.name ?? '')) && Number(k?.count ?? 0) >= 1),
      )
    },
  }
}

export const drivers = { suspend: makeSuspendDriver }

export const meta = {
  mechanic: 'suspend',
  kind: 'game',
  assert: 'hasSuspend',
  note: 'Rift Bolt (TSP 176, {2}{R}, Suspend 1—{R}) suspendido en el turno propio: clic en la carta en mano resuelve la SpecialAction de suspend (única acción jugable con 1 maná; sin picker), se paga {R} y la carta va al exilio propio con 1 contador de tiempo (zona "Suspended cards of <jugador>"; el PlayerView.exile agrega todas las zonas de exilio del dueño). Mazo apilado con skipInitShuffling (Rift Bolt primero) — sin cheatSetup. Captura: Rift Bolt en me.exile con counters time>=1 (CardView de no-permanente sí serializa counters). La resolución gratis (upkeep siguiente: quitar el contador y lanzarlo sin pagar) se dispara después, pero el frame de la suspensión es el que firma la mecánica.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeSuspendDriver())
}
