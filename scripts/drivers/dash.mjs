import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — dash (§3.2 costes alternativos): Lightning Berserker (DTK 146, {R} 1/1,
// Dash {R}) en la mano inicial (mazo apilado con skipInitShuffling: la carta va
// primero => primer robo). Turno propio: tierra + clic en el Berserker; el
// motor abre el chooser de coste alternativo ("Cast with Dash alternative
// cost: {R}" vs "Cast with no alternative cost: {R}") como GAME_CHOOSE_CHOICE
// y se elige dash por texto. Al resolver entra con prisa (DashAbility →
// EntersBattlefieldAbility + DashedCondition) y ataca ese mismo turno (sin
// dash el 1/1 recién entrado no puede atacar: prisa impresa no tiene). Sin
// cheatSetup: el orden del mazo basta, así que no hay carrera del cheat.
function makeDashDriver() {
  return {
    name: 'dash',
    outFile: 'dash.json',
    deck: {
      name: 'Mage Web dash rec',
      cards: [
        { cardName: 'Lightning Berserker', setCode: 'DTK', cardNumber: '146', amount: 1 },
        { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 59 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    _cast: false,
    _attackedTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      // Declarar atacantes: el Berserker entra con prisa por dash y ataca el
      // mismo turno (mismo patrón de confirmación que combat/menace: UUID del
      // atacante + botón especial).
      if (gv.step === 'DECLARE_ATTACKERS' && me.isActive === true && this._cast && this._attackedTurn !== gv.turn) {
        const berserker = Object.values(me.battlefield ?? {}).find(
          (c) => /lightning berserker/i.test(c?.name ?? '') && !c.tapped,
        )
        if (!berserker) {
          ctx.log('onSelect: DECLARE_ATTACKERS sin Berserker jugable (¿sin prisa?), paso')
          ctx.pass()
          return
        }
        this._attackedTurn = gv.turn
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: berserker.id })
        ctx.log('onSelect: ataco con', berserker.name)
        setTimeout(() => {
          ctx.sendAction('sendPlayerString', { gameId: ctx.gameId, value: 'special' })
          ctx.log('onSelect: confirmar ataque (special)')
        }, 300)
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
          ctx.log('onSelect: tierra')
          return
        }
      }
      if (!this._cast && ctx.cardInHand('Lightning Berserker') && ctx.untappedMana() >= 1) {
        this._cast = true
        ctx.log('onSelect: lanzo Lightning Berserker (elegiré dash)')
        ctx.playCardByName('Lightning Berserker')
        return
      }
      ctx.pass()
    },
    // Coste alternativo: el chooser del motor es GAME_CHOOSE_CHOICE con
    // keyChoices ("Cast with Dash alternative cost: {R} ..." vs "Cast with no
    // alternative cost: {R}"). Se elige dash por texto (el valor devuelto es la
    // clave del item, que HumanPlayer resuelve con setChoiceByKey).
    onChooseChoice(opts, ctx) {
      ctx.log('onChooseChoice dash:', JSON.stringify(opts).slice(0, 300))
      const dash = (opts ?? []).find((o) => /dash/i.test(String(o?.label ?? '')))
      if (dash) return dash.value
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const berserker = Object.values(me?.battlefield ?? {}).find((c) => /lightning berserker/i.test(c?.name ?? ''))
      if (!berserker) return false
      for (const group of gv.combat ?? []) {
        const attackers = group?.attackers
        const ids = Array.isArray(attackers) ? attackers.map(String) : Object.keys(attackers ?? {})
        if (ids.some((id) => id === String(berserker.id))) return true
      }
      return false
    },
  }
}

export const drivers = { dash: makeDashDriver }

export const meta = {
  mechanic: 'dash',
  kind: 'game',
  assert: 'hasDash',
  note: 'Lightning Berserker (DTK 146, {R} 1/1, Dash {R}) lanzado por su coste de dash (chooser GAME_CHOOSE_CHOICE "Cast with Dash alternative cost: {R}" vs "Cast with no alternative cost: {R}"; se elige dash por texto) y atacando el mismo turno: entrar con prisa es la prueba del dash (la carta no tiene prisa impresa, así que un 1/1 recién entrado no podría ser atacante). Mazo apilado con skipInitShuffling (Berserker primero) — sin cheatSetup, sin carrera de cheat. Captura: combat con el Berserker como atacante (tapped) en gv.combat; su CardView lleva la regla Dash impresa.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeDashDriver())
}
