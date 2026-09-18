import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Multikicker (§3.2: "Kicker / multikicker / strive"): Everflowing
// Chalice {0} con Multikicker {2} ("You may pay an additional {2} any number of
// times as you cast this spell") entra al campo con un contador de carga por
// cada vez pagada (AddCountersSourceEffect + MultikickerCount). El motor
// pregunta REPETIDAMENTE "Pay N time(s) {2} ?" (KickerAbility
// .addOptionalAdditionalCosts, chooseUse) hasta que se declina.
//
// Montaje: 4 Bosques al campo (3 bastan para 2 kicks: {0} + 2×{2}) tras la
// tierra del turno. El driver responde SÍ a las preguntas 1 y 2 ("Pay 1 time
// {2} ?" / "Pay 2 times {2} ?") y NO a la 3ª ("Pay 3 times {2} ?").
function makeMultikickerDriver() {
  return {
    name: 'multikicker',
    outFile: 'multikicker.json',
    deck: {
      name: 'Mage Web multikicker rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
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
      if (!this._acted) {
        if (ctx.playLand()) {
          this._acted = true
          ctx.log('onSelect: tierra inicial')
        } else ctx.pass()
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Chalice en mano + 4 Bosques)')
        void ctx.cheatSetup({ hand: ['Everflowing Chalice'], battlefield: ['Forest', 'Forest', 'Forest', 'Forest'] })
        return
      }
      if (!this._cast && ctx.cardInHand('Everflowing Chalice') && ctx.untappedMana() >= 4) {
        this._cast = true
        ctx.log('onSelect: lanzo Everflowing Chalice')
        ctx.playCardByName('Everflowing Chalice')
        return
      }
      ctx.pass()
    },
    // "Pay 1 time Multikicker {2} ?" → SÍ; "Pay 2 times …" → SÍ; la 3ª (máx
    // pagable con 4 Bosques) → NO. canPay ya filtra las impagables, así que
    // responder por N mantiene el control exacto de la cuenta.
    onAsk(q, ctx) {
      const m = String(q ?? '').match(/Pay\s+(\d+)\s+times?/i)
      if (!m) return undefined
      const n = Number(m[1])
      ctx.log('onAsk: multikicker intento', n)
      return n <= 2
    },
    onPlayMana(ctx) {
      const forest = Object.values(ctx.me?.battlefield ?? {}).find((c) => !c.tapped && /forest/i.test(c?.name ?? ''))
      if (forest) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: forest.id })
        ctx.log('onPlayMana: giro', forest.name)
      }
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const chalice = Object.values(me?.battlefield ?? {}).find((c) =>
        /everflowing chalice/i.test(String(c?.name ?? '')),
      )
      if (!chalice) return false
      const counters = (chalice?.counters ?? []).some(
        (ct) => /charge/i.test(String(ct?.name ?? '')) && Number(ct?.count ?? 0) === 2,
      )
      return counters && Object.keys(gv.stack ?? {}).length === 0
    },
  }
}

export const drivers = { multikicker: makeMultikickerDriver }

export const meta = {
  mechanic: 'multikicker',
  kind: 'game',
  assert: 'hasMultikicker',
  note: 'Multikicker (Everflowing Chalice {0}, Multikicker {2}): el prompt del motor es REPETIDO y en modo chooseUse — "Pay 1 time {2} ?", "Pay 2 times {2} ?", … (KickerAbility.addOptionalAdditionalCosts; no es GAME_CHOOSE_CHOICE ni un GAME_GET_AMOUNT). El driver paga 2 kicks con 4 Bosques (se pregunta 1 y 2 → SÍ, 3 → NO; canPay filtra las impagables) y la carta entra con 2 contadores de carga (AddCountersSourceEffect + MultikickerCount). Captura: Chalice en el campo con {charge:2} y pila vacía.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeMultikickerDriver())
}
