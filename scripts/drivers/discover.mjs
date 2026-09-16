import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — §3.3 "Cascade / discover": falta discover.
// Trumpeting Carnosaur ({4}{R}{R}, 7/6 trample, DiscoverEffect(5) al entrar;
// EntersBattlefieldTriggeredAbility) en mano; 7 Montañas + la del turno al
// campo (8 ⇒ 6 maná) y biblioteca vía cheatSetup ['Giant Growth','Mountain']
// (el último queda ARRIBA → top = Mountain, debajo Giant Growth).
//
// Discover 5 (DiscoverEffect.getCard): exilia de la biblioteca hasta exiliar
// una carta NO tierra de MV ≤ 5 (Mountain=tierra → sigue; Giant Growth MV 1 →
// para), luego CardUtil.castSpellWithAttributesForFree → chooseUse "Cast spell
// without paying its mana cost (Giant Growth)?" (GAME_ASK) → SÍ → la carta se
// lanza gratis desde el exilio y las demás exiliadas van al fondo en orden
// aleatorio. Hallazgo (REC_DUMP_EVENTS): con un único objetivo legal (el
// Carnosaur; el SIM solo tiene tierras) el motor autoelegido el objetivo de
// Giant Growth SIN GAME_TARGET. Si se respondiera NO, la carta iría a la mano
// (rama else de doDiscover: moveCards(EXILED→HAND)); aquí se ejercita la rama
// de lanzar gratis. El onTarget queda como defensa por si el prompt aparece.
function makeDiscoverDriver() {
  return {
    name: 'discover',
    outFile: 'discover.json',
    deck: {
      name: 'Mage Web discover rec',
      cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
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
          ctx.log('onSelect: tierra')
          return
        }
      }
      // Regla P1: el cheat va tras ≥1 acción normal (la tierra del T1).
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Carnosaur en mano, 7 Montañas al campo, Giant Growth en la cima)')
        void ctx.cheatSetup({
          hand: ['Trumpeting Carnosaur'],
          battlefield: [
            'Mountain',
            'Mountain',
            'Mountain',
            'Mountain',
            'Mountain',
            'Mountain',
            'Mountain',
          ],
          library: ['Giant Growth', 'Mountain'],
        })
        return
      }
      if (!this._cast && ctx.cardInHand('Trumpeting Carnosaur') && ctx.untappedMana() >= 6) {
        this._cast = true
        ctx.log('onSelect: lanzo Trumpeting Carnosaur')
        ctx.playCardByName('Trumpeting Carnosaur')
        return
      }
      ctx.pass()
    },
    // Discover: lanzar la carta encontrada gratis SÍ (la pregunta es el
    // chooseUse "Cast spell without paying its mana cost (…)?").
    onAsk(q, ctx) {
      if (/cast spell|without paying/i.test(String(q ?? ''))) {
        ctx.log('onAsk: discover → lanzar gratis SÍ')
        return true
      }
      return undefined
    },
    // Objetivo de Giant Growth (lanzado desde el exilio): una criatura propia
    // (el Carnosaur); el descarte de limpieza coge la primera carta.
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) {
        const first = Object.keys(ctx.gv?.myHand ?? ctx.gv?.hand ?? {})[0]
        if (first) {
          ctx.log('onTarget: descarte de limpieza')
          return first
        }
        return undefined
      }
      const pt = data?.options?.possibleTargets ?? data?.targets ?? []
      const ids = Array.isArray(pt)
        ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : Object.keys(pt ?? {})
      if (ids[0]) {
        ctx.log('onTarget: objetivo de Giant Growth (possibleTargets=', ids.length, ')')
        return ids[0]
      }
      const carn = Object.values(ctx.me?.battlefield ?? {}).find((c) => /trumpeting carnosaur/i.test(String(c?.name ?? '')))
      if (carn) {
        ctx.log('onTarget: objetivo de Giant Growth (fallback Carnosaur)')
        return carn.id
      }
      return undefined
    },
    // Invariante: Carnosaur en el campo propio Y Giant Growth resuelto en el
    // cementerio (probado que la descubierta se lanzó gratis, no fue a la mano).
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const carn = Object.values(me?.battlefield ?? {}).some((c) => /trumpeting carnosaur/i.test(String(c?.name ?? '')))
      const gg = Object.values(me?.graveyard ?? {}).some((c) => /giant growth/i.test(String(c?.name ?? '')))
      return carn && gg
    },
  }
}

export const drivers = { discover: makeDiscoverDriver }

export const meta = {
  mechanic: 'discover',
  kind: 'game',
  assert: 'hasDiscover',
  note: 'Trumpeting Carnosaur ({4}{R}{R}, DiscoverEffect(5) al entrar) con 8 Montañas (tierra + 7 del cheat) y biblioteca cheatSetup ["Giant Growth","Mountain"] (el último queda arriba): discover exilia Mountain (tierra, sigue) y Giant Growth (MV 1 ≤ 5, para); la decisión llega como GAME_ASK chooseUse "Cast spell without paying its mana cost (Giant Growth)?" y con SÍ se lanza gratis desde el exilio (hallazgo: con el Carnosaur como único objetivo legal el motor lo autoelegido, sin GAME_TARGET en el dump); con NO la carta iría a la mano (rama else de DiscoverEffect.doDiscover) y las exiliadas restantes van al fondo (exile vacío en el frame). Captura: Carnosaur 10/9 en el battlefield propio (base 7/6 + el +3/+3 de Giant Growth, prueba de que se lanzó y resolvió) y Giant Growth en el cementerio. Driver discover con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeDiscoverDriver())
}
