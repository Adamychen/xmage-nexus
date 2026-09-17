import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — objetivo dentro de una pila (cementerio/exilio/biblioteca) via
// PileOverlay (§3.4/§3.8, gap encontrado en real: PileOverlay nunca recibía
// targetIds/onTargetClick, a diferencia de mano/campo/zona de mando — commit
// 8290f779a45). Todos los drivers de cementerio existentes (escape, foretell,
// suspend, jump-start...) prueban LANZAR una carta desde esas zonas
// (cross-zone playables); ninguno prueba apuntar a una carta que YA está
// reposando ahí con un efecto de otra fuente, que es exactamente el path que
// estaba roto. Reanimate ({B} sorcery, "Put target creature card from a
// graveyard onto the battlefield under your control. You lose life equal to
// its mana value.") cheateada a la mano + Grizzly Bears cheateado al propio
// cementerio: el GAME_TARGET llega con el id del Grizzly en el cementerio
// como único objetivo legal — justo el id que el jugador tendría que clicar
// dentro del PileOverlay abierto.
function makeReanimateDriver() {
  return {
    name: 'reanimate',
    outFile: 'reanimate.json',
    deck: {
      name: 'Mage Web reanimate rec',
      cards: [{ cardName: 'Swamp', setCode: 'LEA', cardNumber: '286', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
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
        ctx.log('onSelect: cheatSetup (Reanimate a la mano + Grizzly Bears al propio cementerio)')
        void ctx.cheatSetup({ hand: ['Reanimate'], graveyard: ['Grizzly Bears'] })
        return
      }
      if (!this._cast && ctx.cardInHand('Reanimate') && ctx.cardInGraveyard('Grizzly Bears') && ctx.untappedMana() >= 1) {
        this._cast = true
        ctx.log('onSelect: lanzo Reanimate (objetivo: Grizzly Bears en el propio cementerio)')
        ctx.playCardByName('Reanimate')
        return
      }
      ctx.pass()
    },
    onPlayMana(ctx) {
      const bf = Object.values(ctx.me?.battlefield ?? {})
      const swamp = bf.find((c) => !c.tapped && /swamp/i.test(c?.name ?? ''))
      if (swamp) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: swamp.id })
        ctx.log('onPlayMana: giro', swamp.name)
      }
    },
    // El único caso que nos interesa: el objetivo del GAME_TARGET es el
    // Grizzly Bears que reposa en el cementerio propio (mismo id que abriría
    // el PileOverlay). Cualquier otra pregunta (p.ej. descarte de limpieza) se
    // resuelve trivialmente para no bloquear la partida.
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      const grizzly = ctx.cardInGraveyard('Grizzly Bears')
      const raw = data?.options?.possibleTargets ?? data?.targets
      const ids = Array.isArray(raw) ? raw.map(String) : Object.keys(raw ?? {})
      if (grizzly && ids.includes(String(grizzly))) {
        ctx.log('onTarget: Grizzly Bears del cementerio es objetivo legal → lo elijo')
        return grizzly
      }
      if (/discard/i.test(q)) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const notReanimate = Object.keys(hand).find((id) => !/reanimate/i.test(hand[id]?.name ?? ''))
        ctx.log('onTarget: descarte de limpieza → carta que no sea Reanimate')
        return notReanimate ?? Object.keys(hand)[0]
      }
      return ids[0]
    },
    // Invariante: Grizzly Bears bajo nuestro control en el campo, fuera del
    // cementerio, y vida propia reducida por su mana value (20 - 2 = 18) — un
    // hardcast normal de Grizzly Bears no baja la vida.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const onBattlefield = Object.values(me?.battlefield ?? {}).some((c) => /grizzly bears/i.test(c?.name ?? ''))
      const stillInGraveyard = Object.values(me?.graveyard ?? {}).some((c) => /grizzly bears/i.test(c?.name ?? ''))
      return onBattlefield && !stillInGraveyard && Number(me?.life) <= 18
    },
  }
}

export const drivers = { reanimate: makeReanimateDriver }

export const meta = {
  mechanic: 'reanimate',
  kind: 'game',
  assert: 'hasReanimateTarget',
  note: 'Objetivo dentro de una pila (cementerio) — el gap real que dejó pasar el bug de PileOverlay (commit 8290f779a45: la pila nunca recibía targetIds/onTargetClick). Reanimate ({B}) cheateada a la mano + Grizzly Bears cheateado al propio cementerio: el GAME_TARGET llega con el id del Grizzly en el cementerio como objetivo legal (el mismo id que el jugador clicaría dentro del PileOverlay abierto), a diferencia de todos los demás drivers de cementerio (escape/foretell/suspend/jump-start) que solo prueban LANZAR desde ahí. Captura: Grizzly Bears bajo control propio en el campo, fuera del cementerio, vida 20→18 (mana value 2) — la prueba de que entró por Reanimate y no por hardcast. Driver reanimate con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeReanimateDriver())
}
