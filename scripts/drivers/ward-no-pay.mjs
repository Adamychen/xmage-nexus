import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Ward / hexproof visible, caso "no pagar" (§3.4): Lightning Bolt al
// Thornfist Striker (3/3, Ward {1}) del rival, cheateado al campo enemigo.
// Hallazgo: Sythis, Harvest's Hand NO tiene Ward en este fork (su rules text
// es solo el trigger de encantamientos; el driver `ward` inline parte de una
// premisa falsa y su onAsk /ward/i no puede dispararse), así que se usa una
// carta con WardAbility real. Al targetear al Thornfist se dispara el trigger
// de Ward, que al resolver pregunta por chooseUse "Pay {1}?" (texto de
// CounterUnlessPaysEffect — NO contiene la palabra "ward"). Se responde false:
// por reglas (701.5a / Ward) el hechizo se contrarresta; el Bolt va al
// cementerio sin hacer daño y el Thornfist queda intacto (daño 0) con la vida
// del SIM en 20.
function makeWardNoPayDriver() {
  return {
    name: 'ward-no-pay',
    outFile: 'ward-no-pay.json',
    deck: {
      name: 'Mage Web ward-no-pay rec',
      cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    _cheated: false,
    _bothCheated: false,
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
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra')
          return
        }
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Bolt en mano, 2 Montañas) para mí')
        void ctx.cheatSetup({ hand: ['Lightning Bolt'], battlefield: ['Mountain', 'Mountain'] }).then(() => {
          this._needRivalCheat = true
          ctx.log('onSelect: cheat propio listo; el Thornfist se cheatea en el próximo main propio')
        })
        return
      }
      // Dos cheats para jugadores distintos no pueden ir casi simultáneos
      // (ConcurrentModificationException en el servidor) y el segundo debe
      // caer en NUESTRO turno (cheatear en turno ajeno congela la partida):
      // se lanza en el siguiente main propio, un turno o más después.
      if (this._needRivalCheat) {
        const rival = (gv.players ?? []).find((p) => !p?.controlled)
        const rid = rival?.playerId ?? rival?.id
        if (rid) {
          this._needRivalCheat = false
          ctx.log('onSelect: cheatSetup (Thornfist Striker) al rival')
          void ctx.cheatSetup({ battlefield: ['Thornfist Striker'] }, rid).then(() => {
            this._bothCheated = true
            ctx.log('onSelect: ambos cheats listos')
          })
        }
        return
      }
      const rival = (gv.players ?? []).find((p) => !p?.controlled)
      const wardGuy = Object.values(rival?.battlefield ?? {}).find((c) => /thornfist/i.test(c?.name ?? ''))
      // El lanzamiento no depende de que el segundo cheat llegue dentro del
      // mismo main: si la partida avanza de fase mientras tanto, se lanza en el
      // siguiente turno propio (Thornfist y Bolt ya presentes).
      if (!this._cast && this._bothCheated && ctx.cardInHand('Lightning Bolt') && wardGuy) {
        this._cast = true
        ctx.log('onSelect: lanzo Lightning Bolt al Thornfist Striker (Ward {1})')
        ctx.playCardByName('Lightning Bolt')
        return
      }
      ctx.pass()
    },
    onTarget(ctx, q) {
      // Descarte de limpieza obligatorio (jugamos de segundo: 8 cartas al
      // final del T2): hay que devolver una carta de la MANO; devolver el
      // permanente del campo provoca re-pregunta en bucle.
      if (/discard/i.test(String(q ?? ''))) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const ids = Object.keys(hand)
        const notBolt = ids.find((id) => !/lightning bolt/i.test(hand[id]?.name ?? ''))
        ctx.log('onTarget: descarte de limpieza → primera carta que no sea el Bolt')
        return notBolt ?? ids[0]
      }
      const rival = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
      const wardGuy = Object.values(rival?.battlefield ?? {}).find((c) => /thornfist/i.test(c?.name ?? ''))
      if (wardGuy) {
        ctx.log('onTarget: Bolt → Thornfist Striker (Ward)')
        return wardGuy.id
      }
      return undefined
    },
    // La pregunta del Ward es "Pay {1}?" (CounterUnlessPaysEffect.chooseUse),
    // sin la palabra Ward; se declina y el trigger contrarresta el Bolt.
    onAsk(q, ctx) {
      if (/^pay \{/i.test(String(q ?? ''))) {
        ctx.log('onAsk: NO pago el Ward →', String(q ?? '').slice(0, 60))
        return false
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const rival = (gv.players ?? []).find((p) => !p?.controlled)
      const wardGuy = Object.values(rival?.battlefield ?? {}).find((c) => /thornfist/i.test(c?.name ?? ''))
      const boltGy = Object.values(me?.graveyard ?? {}).some((c) => /lightning bolt/i.test(c?.name ?? ''))
      const stackEmpty = Object.keys(gv.stack ?? {}).length === 0
      return !!wardGuy && Number(wardGuy.damage ?? 0) === 0 && boltGy && stackEmpty && Number(rival?.life ?? 20) === 20
    },
  }
}

export const drivers = { 'ward-no-pay': makeWardNoPayDriver }

export const meta = {
  mechanic: 'ward-no-pay',
  kind: 'game',
  assert: 'hasWardCountered',
  note: "Ward sin pagar vía cheatSetup (§3.4): Lightning Bolt al Thornfist Striker (3/3, Ward {1}, sin ETB) cheateado al campo rival; el trigger de Ward pregunta con chooseUse 'Pay {1}?' (texto de CounterUnlessPaysEffect, sin la palabra 'ward' — el matcher /ward/ del driver inline `ward` nunca dispararía) y se responde false: por reglas el hechizo queda contrarrestado. Captura: Thornfist vivo y sin daño (damage 0), Lightning Bolt en el cementerio propio, pila vacía y vida del SIM 20. HALLAZGO: Sythis, Harvest's Hand NO tiene Ward en el fork (su rules es solo el trigger de encantamientos), por eso el driver `ward` existente en realidad mata a Sythis con daño normal; aquí se usa una carta con WardAbility auténtica. Driver ward-no-pay con cheatSetup.",
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeWardNoPayDriver())
}
