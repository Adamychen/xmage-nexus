import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Ward / hexproof visible, caso "hexproof" (§3.4, lo que faltaba): Lightning
// Bolt contra un Slippery Bogle ({G/U} 1/1, HexproofAbility, sin ETB que pida
// decisión) colocado en el campo del RIVAL vía cheatSetup. La regla 702.11b
// impide ELEGIR al Bogle como objetivo de un hechizo del oponente: el
// GAME_TARGET del Bolt llega con possibleTargets SIN el id del Bogle (solo las
// dos caras) y el driver responde la cara del rival. El Bolt resuelve a la cara
// (20→17) con el Bogle vivo y sin daño: contraste directo con ward-no-pay (allí
// el hechizo sí se lanza al permanente y lo contrarresta el trigger de Ward).
// Cheats encadenados a ~800 ms (primero el mío: Bolt a la mano + Montaña extra;
// después el Bogle al rival), ambos en mi main propio (regla P1: nunca en turno
// ajeno). Si el segundo cheat cae fuera de mi turno, se difiere al siguiente
// main propio en vez de congelar la partida.
function makeHexproofDriver() {
  return {
    name: 'hexproof',
    outFile: 'hexproof.json',
    deck: {
      name: 'Mage Web hexproof rec',
      cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    _cheated: false,
    _cheatAt: 0,
    _needRivalCheat: false,
    _rivalTries: 0,
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
        ctx.log('onSelect: cheatSetup (Lightning Bolt a la mano + Montaña extra) para mí')
        void ctx.cheatSetup({ hand: ['Lightning Bolt'], battlefield: ['Mountain'] }).then((r) => {
          if (!r?.ok) {
            this._cheated = false
            return
          }
          this._cheatAt = Date.now()
          this._needRivalCheat = true
          ctx.log('onSelect: cheat propio listo; el Bogle se cheatea ~800 ms después')
        })
        return
      }
      const rival = (gv.players ?? []).find((p) => !p?.controlled)
      const rid = rival?.playerId ?? rival?.id
      // Dos cheats para jugadores distintos no pueden ir casi simultáneos
      // (ConcurrentModificationException en el servidor): ~800 ms de separación.
      // Y el segundo SOLO en mi main propio (cheatear en turno ajeno congela):
      // si el turno avanzó, se difiere al siguiente main mío.
      if (this._needRivalCheat && rid && Date.now() - this._cheatAt >= 800) {
        this._needRivalCheat = false
        this._rivalTries += 1
        ctx.log('onSelect: cheatSetup (Slippery Bogle) al campo rival, intento', this._rivalTries)
        void ctx.cheatSetup({ battlefield: ['Slippery Bogle'] }, rid).then((r) => {
          if (!r?.ok && this._rivalTries < 4) {
            this._needRivalCheat = true
            this._cheatAt = Date.now()
            ctx.log('onSelect: cheat del Bogle rechazado, reintento')
          }
        })
        return
      }
      const bogle = Object.values(rival?.battlefield ?? {}).find((c) => /slippery bogle/i.test(c?.name ?? ''))
      if (!this._cast && bogle && ctx.cardInHand('Lightning Bolt') && ctx.untappedMana() >= 1) {
        this._cast = true
        ctx.log('onSelect: lanzo Lightning Bolt (el Bogle NO debe ser objetivo elegible; responderé la cara del rival)')
        ctx.playCardByName('Lightning Bolt')
        return
      }
      ctx.pass()
    },
    // GAME_TARGET del Bolt: aquí se prueba la exclusión. Se registran los ids
    // posibles y si el Bogle aparece entre ellos; la respuesta es la cara del
    // rival para que el Bolt resuelva y el frame capture el resultado.
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const ids = Object.keys(hand)
        const notBolt = ids.find((id) => !/lightning bolt/i.test(hand[id]?.name ?? ''))
        ctx.log('onTarget: descarte de limpieza → carta que no sea el Bolt')
        return notBolt ?? ids[0]
      }
      const rival = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
      const rid = rival?.playerId ?? rival?.id
      try {
        const raw = data?.options?.possibleTargets ?? data?.targets
        const ids = Array.isArray(raw) ? raw.map(String) : Object.keys(raw ?? {})
        const bogleId = Object.values(rival?.battlefield ?? {}).find((c) => /slippery bogle/i.test(c?.name ?? ''))?.id
        ctx.log(
          'onTarget: possibleTargets=', JSON.stringify(ids),
          'bogleId=', String(bogleId),
          'bogleElegible=', bogleId ? ids.includes(String(bogleId)) : 'n/a',
        )
      } catch {}
      ctx.log('onTarget: respondo la cara del rival', rid)
      return rid
    },
    // Invariante: Bolt resuelto en el cementerio propio, pila vacía, Bogle del
    // rival vivo con daño 0 y su rules con Hexproof, y vida del SIM 17 (el Bolt
    // fue a la cara: el Bogle no era elegible).
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const rival = (gv.players ?? []).find((p) => !p?.controlled)
      const bogle = Object.values(rival?.battlefield ?? {}).find((c) => /slippery bogle/i.test(c?.name ?? ''))
      const boltGy = Object.values(me?.graveyard ?? {}).some((c) => /lightning bolt/i.test(c?.name ?? ''))
      const stackEmpty = Object.keys(gv.stack ?? {}).length === 0
      const hexproof = /hexproof/i.test(JSON.stringify(bogle?.rules ?? ''))
      return !!bogle && Number(bogle.damage ?? 0) === 0 && boltGy && stackEmpty && Number(rival?.life) === 17 && hexproof
    },
  }
}

export const drivers = { hexproof: makeHexproofDriver }

export const meta = {
  mechanic: 'hexproof',
  kind: 'game',
  assert: 'hasHexproof',
  note: 'Hexproof sin ward vía cheatSetup (§3.4, caso que faltaba): Slippery Bogle ({G/U} 1/1, HexproofAbility, sin ETB) al campo rival y Lightning Bolt propio. La regla 702.11b impide elegir al Bogle: el GAME_TARGET del lanzamiento llega con possibleTargets SIN su id (solo las dos caras del duelo) y el driver responde la cara del rival; el Bolt resuelve a la cara (SIM 20→17) y el Bogle queda vivo con damage 0 y su rules con el texto de Hexproof. Contraste con ward-no-pay: con Ward el hechizo SÍ se puede lanzar al permanente y el trigger lo contrarresta al no pagar; con hexproof el permanente ni siquiera es objetivo legal. Cheats encadenados a ~800 ms (Bolt+Montaña y luego Bogle al rival), ambos en main propio (regla P1); si el turno avanza antes del segundo, se difiere al siguiente main propio. Driver hexproof con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeHexproofDriver())
}
