import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — elegir color y número (§3.7) vía cheatSetup, en un único frame: Story
// Circle y Sanctum Prelate, ambas {1}{W}{W} blancas, a la MANO y lanzadas de
// verdad (lanzarlas es lo que hace correr el chooser en el hilo GAME; el cheat
// solo coloca cartas sin decisión). Mazo todo Plains + 6 Plains cheateadas al
// campo en el mismo cheat (los permanentes cheateados entran sin mareo y sin
// pedir nada). HALLAZGO de protocolo (verificado en el fork 1.4.61): NO existe
// el callback GAME_CHOOSE_COLOR ni GAME_CHOOSE_NUMBER en ClientCallbackMethod;
// la elección de color es un GAME_CHOOSE_CHOICE normal con ChoiceColor
// (choices White/Blue/Black/Red/Green, keyChoices VACÍO → string mode, se
// responde sendPlayerString con el nombre EXACTO "Red"; HumanPlayer.choose usa
// setChoice, no setChoiceByKey) y la de número es un GAME_GET_AMOUNT (getAmount
// 0..MAX, se responde sendPlayerInteger 3). Ambas quedan visibles en el `rules`
// del permanente ("Chosen color: Red" vía ChooseColorEffect.addInfo; "Chosen
// Number: 3" vía ChooseNumberEffect.addInfo) — mismo patrón que pithing-needle
// y cavern.
function makeChoiceColorDriver() {
  return {
    name: 'choice-color',
    outFile: 'choice-color.json',
    deck: {
      name: 'Mage Web choice-color rec',
      cards: [{ cardName: 'Plains', setCode: 'iko', cardNumber: '270', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _circleCast: false,
    _colorDone: false,
    _prelateCast: false,
    _numDone: false,
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
          ctx.log('onSelect: tierra T', turn)
          return
        }
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Story Circle + Sanctum Prelate a la mano; 6 Plains al campo)')
        void ctx.cheatSetup({
          hand: ['Story Circle', 'Sanctum Prelate'],
          battlefield: ['Plains', 'Plains', 'Plains', 'Plains', 'Plains', 'Plains'],
        }).then((r) => {
          if (!r?.ok) this._cheated = false
        })
        return
      }
      const circleOnBf = !!ctx.findOnBattlefield('Story Circle')
      if (!this._circleCast && !circleOnBf && ctx.cardInHand('Story Circle') && ctx.untappedMana() >= 6) {
        this._circleCast = true
        ctx.log('onSelect: lanzo Story Circle ({1}{W}{W}) — as-enters pide COLOR')
        ctx.playCardByName('Story Circle')
        return
      }
      if (!this._prelateCast && this._colorDone && circleOnBf && ctx.cardInHand('Sanctum Prelate') && ctx.untappedMana() >= 3) {
        this._prelateCast = true
        ctx.log('onSelect: lanzo Sanctum Prelate ({1}{W}{W}) — as-enters pide NÚMERO')
        ctx.playCardByName('Sanctum Prelate')
        return
      }
      ctx.pass()
    },
    // ChoiceColor → GAME_CHOOSE_CHOICE string mode (keyChoices vacío ⇒ opts=[]):
    // se responde el nombre exacto del color; el servidor valida con
    // choices.contains(val) en ChoiceImpl.setChoice.
    onChooseChoice(opts, ctx) {
      ctx.log('onChooseChoice opts=', JSON.stringify(opts).slice(0, 200))
      if (this._colorDone) return undefined
      this._colorDone = true
      ctx.log('onChooseChoice: respondo "Red" (string mode; validado contra White/Blue/Black/Red/Green)')
      return 'Red'
    },
    // ChooseNumberEffect → GAME_GET_AMOUNT (getAmount(0, MAX, "Choose a number
    // (mana cost to restrict)")). Se responde con sendPlayerInteger.
    onTargetAmount(data, ctx) {
      ctx.log('onTargetAmount min=', data?.min, 'max=', data?.max, 'msg=', JSON.stringify(data?.message))
      if (this._numDone) return data?.min ?? 0
      this._numDone = true
      ctx.log('onTargetAmount: respondo 3')
      return 3
    },
    onTarget(ctx, question, data) {
      if (/discard/i.test(String(question ?? ''))) {
        const ids = Array.isArray(data?.targets) ? data.targets : Object.keys(data?.targets ?? {})
        if (ids.length > 0) return ids[0]
        return false
      }
      return undefined
    },
    // Invariante: ambos permanentes en mi campo con la elección aplicada y
    // visible en su rules ("Chosen color: Red" / "Chosen Number: 3") y pila vacía.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const bf = Object.values(me?.battlefield ?? {})
      const circle = bf.find((c) => /story circle/i.test(c?.name ?? ''))
      const prelate = bf.find((c) => /sanctum prelate/i.test(c?.name ?? ''))
      const circleRules = JSON.stringify(circle?.rules ?? '')
      const prelateRules = JSON.stringify(prelate?.rules ?? '')
      const stackEmpty = Object.keys(gv.stack ?? {}).length === 0
      return !!circle && /chosen color:\s*red/i.test(circleRules) && !!prelate && /chosen number:\s*3/i.test(prelateRules) && stackEmpty
    },
  }
}

export const drivers = { 'choice-color': makeChoiceColorDriver }

export const meta = {
  mechanic: 'choice-color',
  kind: 'game',
  assert: 'hasChoiceColorOrNumber',
  note: 'Elección de color Y de número en un mismo frame vía cheatSetup (§3.7): Story Circle y Sanctum Prelate (ambas {1}{W}{W}, white, sin ETB que pida decisión al cheatear; van a la MANO con 6 Plains al campo y se lanzan de verdad). HALLAZGO: en el fork 1.4.61 NO existen los callbacks GAME_CHOOSE_COLOR/GAME_CHOOSE_NUMBER (verificado en ClientCallbackMethod; el web solo los soporta como legado/fake): la elección de color llega como GAME_CHOOSE_CHOICE con ChoiceColor (choices White/Blue/Black/Red/Green, keyChoices VACÍO ⇒ string mode, se responde sendPlayerString "Red" y HumanPlayer la valida con setChoice) y la de número como GAME_GET_AMOUNT (getAmount(0, MAX, "Choose a number (mana cost to restrict)") ⇒ sendPlayerInteger 3). Captura: ambos permanentes en el battlefield propio con el rules visible "Chosen color: Red" (ChooseColorEffect.addInfo) y "Chosen Number: 3" (ChooseNumberEffect.addInfo) y pila vacía. Driver choice-color con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeChoiceColorDriver())
}
