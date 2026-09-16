import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — mirar N y ordenar (§3.8), cierra el parcial de Brainstorm con Ponder.
// Ponder ({U}, M12): "Look at the top three cards of your library, then put
// them back in any order. You may shuffle. Draw a card."
// Ponder.java usa LookLibraryControllerEffect(3) → PutCards.TOP_ANY →
// PlayerImpl.putCardsOnTopOfLibrary(cards, ..., anyOrder=true): un TargetCard
// 1/1 (min=max=1, required, Zone.ALL) en bucle `while (cards.size() > 1)` con
// clearChosen() tras cada elección → DOS GAME_TARGET consecutivos (GAME_CHOOSE_
// CARDS_ORDER NO existe en este XMage) con las cartas miradas en cardsView1 y
// los uuid jugables en options.possibleTargets. Cada elección se mueve YA a la
// cima (moveObjectToLibrary toTop); al salir del bucle la carta NO elegida
// (la que queda con size==1) se mueve última a la cima → la NO elegida queda
// la más arriba. Con la cima sembrada [Grizzly, Forest, Plains] (el último de
// cheatSetup.library queda arriba: Plains), elegir Plains y luego Forest deja
// la cima [Grizzly, Forest, Plains] → Ponder roba Grizzly. Luego el ASK
// opcional "Shuffle your library?" (ShuffleLibrarySourceEffect(true)) se
// declina para conservar el orden y DrawCardSourceControllerEffect(1) roba.
//
// Prueba del orden (doble robo): T1 Ponder roba Grizzly; en el siguiente turno
// propio (T3; T2 es del SIM) el robo natural debe traer Forest. Invariante:
// Ponder en el cementerio propio + Grizzly Y Forest en la mano + Plains NO en
// la mano (solo es posible si la cima post-Ponder es [Grizzly, Forest, ...]).
function targetIds(data) {
  const pt = data?.options?.possibleTargets ?? data?.targets ?? []
  return Array.isArray(pt)
    ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
    : Object.keys(pt ?? {})
}

// Nombre de una carta del prompt: las cartas miradas van en cardsView1 (la
// biblioteca no se serializa en el gameView, así que no se pueden resolver
// contra myHand como en Brainstorm).
function nameFromViews(data, id) {
  const direct = data?.cardsView1?.[id]?.name
  if (direct) return String(direct)
  const cv2 = data?.cardsView2?.[id]?.name
  if (cv2) return String(cv2)
  const pt = data?.options?.possibleTargets
  if (pt && !Array.isArray(pt)) return String(pt[id]?.name ?? '')
  return ''
}

function makePonderDriver() {
  return {
    name: 'ponder',
    outFile: 'ponder.json',
    deck: {
      name: 'Mage Web ponder rec',
      cards: [{ cardName: 'Island', setCode: 'iko', cardNumber: '265', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _acted: false,
    _cheated: false,
    _casting: false,
    _orderPicks: 0,
    _loggedAfter: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el cheat va tras ≥1 acción normal (jugar la tierra).
      if (!this._acted) {
        if (ctx.playLand()) {
          this._acted = true
          ctx.log('onSelect: tierra inicial')
        } else ctx.pass()
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Ponder en mano; cima Plains/Forest/Grizzly)')
        void ctx.cheatSetup({ hand: ['Ponder'], library: ['Grizzly Bears', 'Forest', 'Plains'] })
        return
      }
      // Evidencia intermedia para el informe: la mano justo después de resolver
      // Ponder (debe ser 6 Islas + Grizzly).
      if (this._casting && !this._loggedAfter && !ctx.cardInHand('Ponder')) {
        this._loggedAfter = true
        const hand = Object.values(gv.myHand ?? gv.hand ?? {}).map((c) => c?.name ?? c?.displayName)
        ctx.log('onSelect: mano tras resolver Ponder =', hand.join(','))
      }
      if (ctx.cardInHand('Ponder')) {
        this._casting = true
        ctx.log('onSelect: lanzo Ponder')
        ctx.playCardByName('Ponder')
        return
      }
      ctx.pass()
    },
    // Los DOS GAME_TARGET de orden de LookLibraryControllerEffect llegan con
    // pregunta "... ORDER to put on the TOP of your library ..." y las cartas
    // miradas en cardsView1. Se elige en secuencia Plains, Forest; Grizzly
    // queda como no elegida y el motor la mueve la última a la cima.
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      const ids = targetIds(data)
      if (/discard/i.test(q)) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const first = Object.keys(hand)[0] ?? ids[0]
        if (first) {
          ctx.log('onTarget: descarte de limpieza')
          return first
        }
        return ids[0]
      }
      if (this._casting && this._orderPicks < 3) {
        const want = ['Plains', 'Forest', 'Grizzly Bears'][this._orderPicks]
        const id = ids.find((i) => nameFromViews(data, i).toLowerCase() === want.toLowerCase())
        if (id) {
          this._orderPicks += 1
          ctx.log(`onTarget: pongo ${want} (elección ${this._orderPicks}; la no elegida queda la más arriba)`)
          return id
        }
        ctx.log('onTarget: no encuentro', want, 'entre', ids.map((i) => nameFromViews(data, i)).join(','), 'q=', q)
      }
      return undefined
    },
    // ShuffleLibrarySourceEffect(true) → ASK "Shuffle your library?"; se dice
    // NO para que el orden de la cima se conserve.
    onAsk(question, ctx) {
      const q = String(question ?? '')
      if (/shuffle|barajar/i.test(q)) {
        ctx.log('onAsk: shuffle → NO')
        return false
      }
      return undefined
    },
    onPlayMana(ctx) {
      const bf = Object.values(ctx.me?.battlefield ?? {})
      const isle = bf.find((c) => !c.tapped && /island/i.test(c?.name ?? ''))
      if (isle) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: isle.id })
        ctx.log('onPlayMana: giro', isle.name)
      }
    },
    // Invariante: Ponder resuelto (cementerio), Grizzly (robada por Ponder en
    // T1) y Forest (robo natural de T3) en la mano, y Plains fuera de la mano.
    // Solo se cumple si la cima post-Ponder es [Grizzly, Forest, Plains].
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      const handNames = Object.values(gv.myHand ?? gv.hand ?? {}).map((c) => String(c?.name ?? ''))
      const gyNames = Object.values(me.graveyard ?? {}).map((c) => String(c?.name ?? ''))
      const has = (arr, n) => arr.some((x) => new RegExp(`^${n}$`, 'i').test(x))
      return (
        has(gyNames, 'Ponder') &&
        has(handNames, 'Grizzly Bears') &&
        has(handNames, 'Forest') &&
        !has(handNames, 'Plains')
      )
    },
  }
}

export const drivers = { ponder: makePonderDriver }

export const meta = {
  mechanic: 'ponder',
  kind: 'game',
  assert: 'hasPonder',
  note: 'Ponder ({U}) resuelto: el "put them back in any order" de LookLibraryControllerEffect(3)/PutCards.TOP_ANY NO es GAME_CHOOSE_CARDS_ORDER (método inexistente en este XMage) sino DOS GAME_TARGET 1/1 secuenciales (PlayerImpl.putCardsOnTopOfLibrary con bucle while cards.size()>1 y clearChosen; cada elección se mueve al instante a la cima y la carta NO elegida se mueve la última → queda la más arriba) con las 3 cartas miradas en cardsView1 y los uuid en options.possibleTargets; después un ASK "Shuffle your library?" (ShuffleLibrarySourceEffect(true)) y el robo. Prueba del orden por doble robo (cima sembrada por cheat: Plains/Forest/Grizzly): eligiendo Plains y luego Forest la cima queda Grizzly/Forest/Plains, Ponder roba Grizzly en T1 y el robo natural de T3 trae Forest; invariante: Ponder en el cementerio + Grizzly y Forest en mano + Plains NO en mano. Driver ponder con cheatSetup (Ponder en mano + 3 cartas sobre la biblioteca).',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makePonderDriver())
}
