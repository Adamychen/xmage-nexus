import { runRecorder } from '../rec-lib.mjs'

// LEARN (Eyetwitch, muerte → learn): reproducir el informe "no puedo elegir
// Lessons del sideboard al aprender". Flujo del motor (LearnEffect):
//   1) chooseUse "Reveal a Lesson card you own from outside the game and put
//      it into your hand?"  → GAME_ASK (responder true)
//   2) WishEffect → controller.choose(Cards filtradas del sideboard) →
//      GAME_TARGET con options.possibleTargets = ids de las Lessons y
//      cardsView1 = CardViews de las Lessons (GameController.target).
// El driver responde el GAME_TARGET con el id de la Lesson y captura el
// estado cuando la Lesson ya está en la mano (si el flujo del servidor
// funciona). REC_DUMP_EVENTS=1 vuelca cada prompt para diagnosticar qué ve
// el cliente web (CardGrid: options = possibleTargets, cards = cardsView1).
const LESSON = 'Environmental Sciences'
const BOLT = 'Lightning Bolt'
const WITCH = 'Eyetwitch'

function makeLearnDriver() {
  return {
    name: 'learn',
    outFile: 'learn.json',
    deck: {
      name: 'Mage Web learn rec',
      cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
      sideboard: [{ cardName: LESSON, setCode: 'STX', cardNumber: '196', amount: 1 }],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    _cheated: false,
    _bolt: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      if (!this._cheated) {
        const turn = gv.turn ?? 0
        if (turn !== this._landTurn) {
          if (ctx.playLand()) {
            this._landTurn = turn
            ctx.log('onSelect: tierra')
            return
          }
        }
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Eyetwitch + 3 Mountains; Bolt en mano)')
        void ctx
          .cheatSetup({
            battlefield: [WITCH, 'Mountain', 'Mountain', 'Mountain'],
            hand: [BOLT],
          })
        return
      }
      // Matar la Eyetwitch con el Bolt (muerte → trigger learn)
      if (!this._bolt && ctx.cardInHand(BOLT) && ctx.findOnBattlefield(WITCH)) {
        this._bolt = true
        ctx.log('onSelect: lanzo', BOLT, 'a', WITCH)
        ctx.playCardByName(BOLT)
        return
      }
      ctx.pass()
    },
    onAsk(q) {
      // 1) chooseUse del LearnEffect — aceptar revelar la Lesson
      if (/lesson card/i.test(q)) return true
      return undefined
    },
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      // 2)chooser de Lessons del sideboard (WishEffect)
      const pt = data?.options?.possibleTargets ?? data?.targets ?? []
      const ids = Array.isArray(pt)
        ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : Object.keys(pt ?? {})
      if (/lesson/i.test(q)) {
        ctx.log('TARGET lesson?', JSON.stringify({
          q: q.slice(0, 120),
          idsCount: ids.length,
          ids,
          cardsView1: Object.values(data?.cardsView1 ?? {}).map((c) => c?.name ?? c?.displayName),
          optionKeys: Object.keys(data?.options ?? {}),
        }))
        if (ids.length > 0) return ids[0]
      }
      // Bolt: apuntar a la propia Eyetwitch
      const witch = ctx.findOnBattlefield(WITCH)
      if (witch) return witch
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      for (const c of Object.values(me?.hand ?? {})) {
        if (String(c?.name ?? '') === LESSON) return true
      }
      return false
    },
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  await runRecorder(makeLearnDriver())
}