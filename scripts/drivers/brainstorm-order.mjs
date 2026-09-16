import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — mirar N y ordenar (§3.8): Brainstorm ({U}: roba 3, luego pon 2 cartas
// de tu mano en la parte superior de tu biblioteca en cualquier orden).
// BrainstormEffect (Mage/src/.../common/BrainstormEffect.java) NO usa
// GAME_CHOOSE_CARDS_ORDER: itera 2 veces `new TargetCardInHand()` (min=1,
// max=1) con chooseTarget → DOS GAME_TARGET secuenciales "Select a card"
// (targetName = filter message "card"; sin pista de "on top"). Cada elección
// se mueve inmediatamente con moveCardToLibraryWithInfo(..., toTop=true), así
// que la SEGUNDA elegida queda la más arriba.
//
// El view no expone el contenido de la biblioteca, así que el orden se
// verifica encadenando un robo: se cheatea también Opt en mano. Tras resolver
// Brainstorm (mano neta +1), se lanza Opt: su scry se declina (deja la top
// arriba) y el robo siguiente debe dar la carta puesta en segundo lugar
// (Plains). Si el motor hubiera invertido el orden, Opt robaría Forest.
//
// Mazo: 60 Islas (posiciones irrelevantes). cheatSetup en el primer main
// propio (tras jugar la tierra): Brainstorm + Opt a la mano, una Isla al
// campo y 3 cartas conocidas ENCIMA de la biblioteca (la última de la lista
// queda arriba): Grizzly Bears, Forest, Plains → Brainstorm roba Plains,
// Forest, Grizzly Bears; se devuelven primero Forest y luego Plains.
function targetIds(data) {
  const pt = data?.options?.possibleTargets ?? data?.targets ?? []
  return Array.isArray(pt)
    ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
    : Object.keys(pt ?? {})
}

function makeBrainstormOrderDriver() {
  return {
    name: 'brainstorm-order',
    outFile: 'brainstorm-order.json',
    deck: {
      name: 'Mage Web brainstorm rec',
      cards: [{ cardName: 'Island', setCode: 'iko', cardNumber: '265', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _acted: false,
    _cheated: false,
    _brainstorming: false,
    _putBack: 0,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el cheat va tras ≥1 acción normal (ver counterspell).
      if (!this._acted) {
        if (ctx.playLand()) {
          this._acted = true
          ctx.log('onSelect: tierra inicial')
        } else ctx.pass()
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Brainstorm+Opt en mano, Isla al campo, top Grizzly Bears/Forest/Plains)')
        void ctx.cheatSetup({
          hand: ['Brainstorm', 'Opt'],
          battlefield: ['Island'],
          library: ['Grizzly Bears', 'Forest', 'Plains'],
        })
        return
      }
      if (ctx.cardInHand('Brainstorm')) {
        this._brainstorming = true
        ctx.log('onSelect: lanzo Brainstorm')
        ctx.playCardByName('Brainstorm')
        return
      }
      // El robo de Opt es la prueba del orden: debe traer Plains (la 2ª
      // devuelta, que queda arriba), no Forest (la 1ª, que queda debajo).
      if (this._putBack >= 2 && ctx.cardInHand('Opt')) {
        ctx.log('onSelect: lanzo Opt (comprueba el orden con el siguiente robo)')
        ctx.playCardByName('Opt')
        return
      }
      ctx.pass()
    },
    // Brainstorm: dos GAME_TARGET "Select a card" consecutivos (uno por carta
    // devuelta, TargetCardInHand 1/1). El primero devuelve Forest (queda
    // abajo), el segundo Plains (queda arriba). Opt: scry "PUT on the BOTTOM"
    // → declinar (false) deja la top arriba y el robo trae Plains.
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      const ids = targetIds(data)
      const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
      if (/discard/i.test(q)) {
        const first = Object.keys(hand)[0] ?? ids[0]
        if (first) {
          ctx.log('onTarget: descarte de limpieza')
          return first
        }
        return ids[0]
      }
      if (/scry|on the bottom/i.test(q)) {
        ctx.log('onTarget: scry de Opt → declino (deja Plains arriba)')
        return false
      }
      if (this._brainstorming && this._putBack < 2) {
        const want = this._putBack === 0 ? 'Forest' : 'Plains'
        const id = ids.find((i) => String(hand[i]?.name ?? '').toLowerCase() === want.toLowerCase())
        if (id) {
          this._putBack += 1
          ctx.log(`onTarget: pongo ${want} arriba (${this._putBack}/2)`)
          return id
        }
        ctx.log('onTarget: no encuentro', want, 'en possibleTargets')
      }
      return undefined
    },
    // Pago {U} explícito con Isla (durante el pago los flags isActive/
    // hasPriority de la vista no son fiables).
    onPlayMana(ctx, m) {
      const bf = Object.values(ctx.me?.battlefield ?? {})
      const isle = bf.find((c) => !c.tapped && /island/i.test(c?.name ?? ''))
      if (isle) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: isle.id })
        ctx.log('onPlayMana: giro', isle.name)
      }
    },
    // Invariante: Brainstorm y Opt en el cementerio (ambos resueltos) y la
    // mano contiene la carta devuelta en 2º lugar (Plains, robada por Opt) y
    // la nunca devuelta (Grizzly Bears), pero NO la devuelta 1ª (Forest, que
    // queda en la biblioteca). Si el orden se invirtiera, Opt robaría Forest.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      const handNames = Object.values(gv.myHand ?? gv.hand ?? {}).map((c) => String(c?.name ?? ''))
      const gyNames = Object.values(me.graveyard ?? {}).map((c) => String(c?.name ?? ''))
      const has = (arr, n) => arr.some((x) => new RegExp(`^${n}$`, 'i').test(x))
      return (
        has(gyNames, 'Brainstorm') &&
        has(gyNames, 'Opt') &&
        has(handNames, 'Plains') &&
        has(handNames, 'Grizzly Bears') &&
        !has(handNames, 'Forest') &&
        !has(gyNames, 'Forest')
      )
    },
  }
}

export const drivers = { 'brainstorm-order': makeBrainstormOrderDriver }

export const meta = {
  mechanic: 'brainstorm-order',
  kind: 'game',
  assert: 'hasBrainstorm',
  note: 'Brainstorm ({U}) resuelto: el "pon 2 cartas de tu mano arriba en cualquier orden" NO es GAME_CHOOSE_CARDS_ORDER sino DOS GAME_TARGET secuenciales "Select a card" (TargetCardInHand 1/1 dentro de un bucle de BrainstormEffect; cada elección se mueve al instante con moveCardToLibraryWithInfo, la 2ª queda arriba) y luego un tercer GAME_TARGET "Select up to one card to PUT on the BOTTOM (Scry)" al resolver Opt. Invariante: mano neta +1 (se roban 3, se devuelven 2) y el orden se prueba con el robo siguiente (Opt declina el scry y roba Plains, la 2ª devuelta; Forest, la 1ª, sigue en la biblioteca). Driver brainstorm-order con cheatSetup (3 cartas sembradas en la biblioteca por cheat).',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeBrainstormOrderDriver())
}
