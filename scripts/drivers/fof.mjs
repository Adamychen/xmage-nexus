import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — pilas (§3.7): Fact or Fiction {3}{U} (INV 55): "Reveal the top five
// cards of your library. An opponent separates those cards into two piles.
// Put one pile into your hand and the other into your graveyard."
// FactOrFiction.java usa RevealAndSeparatePilesEffect(5, OPPONENT, YOU,
// GRAVEYARD): el SIM (asiento SIM del proxy, HUMAN en el servidor) recibe el
// GAME_TARGET de separación (TargetCard 0..5, possibleTargets = las 5
// reveladas) y el CONTROLADOR recibe la elección de pila
// (Player.choosePile → GAME_CHOOSE_PILE con cardsView1/cardsView2 y
// cardsView[1|2] como CardsView). El cliente web responde
// sendPlayerBoolean(true=pile1, false=pile2).
//
// Reparto del SIM (RESUELTO 2026-09-16): su prompt de separación llega con
// cardsView1/options.possibleTargets (sobrecarga Cards de fireSelectTargetEvent)
// y SIN `targets`; antes SimPlayer.onTarget hacía cancel() → pile1 vacía (0/5).
// **Fix en SimPlayer**: con targets null elige una carta por sendPlayerUUID
// (menor UUID, determinista) y, cuando el servidor marca "Done" en
// UI.right.btn.text con elección previa, cierra con sendPlayerBoolean(false)
// (4 tests nuevos en SimPlayerTest). Re-grabado: pile1=[Grizzly Bears],
// pile2=[Mountain, Island, Forest, Runeclaw Bear]. Este driver, con
// onChoosePile, elige SIEMPRE la pila mayor para la mano.
//
// Mazo 60 Islas: T1 tierra + UN cheatSetup (FoF a la mano, 3 Islas al campo,
// top 5 sembrado con Grizzly Bears/Runeclaw Bear/Forest/Island/Mountain; el
// último queda arriba). FoF no pide objetivo al lanzarse; se pagan {3}{U}
// girando las Islas (onPlayMana). Invariante: FoF en el cementerio propio y
// las 4 reveladas no-Isla (Grizzly, Runeclaw, Forest, Mountain) exactamente
// una vez cada una entre mano y cementerio; la 5ª revelada (Island) es
// indistinguible de las Islas del mazo, así que se documenta como tal.
function makeFofDriver() {
  return {
    name: 'fof',
    outFile: 'fof.json',
    deck: {
      name: 'Mage Web fof rec',
      cards: [{ cardName: 'Island', setCode: 'iko', cardNumber: '265', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _acted: false,
    _cheated: false,
    _casting: false,
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
        ctx.log('onSelect: cheatSetup (FoF en mano, 3 Islas al campo, top 5 sembrado)')
        void ctx.cheatSetup({
          hand: ['Fact or Fiction'],
          battlefield: ['Island', 'Island', 'Island'],
          library: ['Grizzly Bears', 'Runeclaw Bear', 'Forest', 'Island', 'Mountain'],
        })
        return
      }
      // {3}{U}: hace falta la tierra del turno + las 3 Islas cheateadas.
      if (ctx.cardInHand('Fact or Fiction') && ctx.untappedMana() >= 4) {
        this._casting = true
        ctx.log('onSelect: lanzo Fact or Fiction (maná sin girar:', ctx.untappedMana(), ')')
        ctx.playCardByName('Fact or Fiction')
        return
      }
      ctx.pass()
    },
    // Descarte de limpieza (mano > 7 tras resolver FoF): primera carta.
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      const pt = data?.options?.possibleTargets ?? data?.targets ?? []
      const ids = Array.isArray(pt)
        ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : Object.keys(pt ?? {})
      if (/discard/i.test(q)) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const first = Object.keys(hand)[0] ?? ids[0]
        if (first) {
          ctx.log('onTarget: descarte de limpieza')
          return first
        }
        return ids[0]
      }
      return undefined
    },
    // Elección de pila del cliente web (booleano: true=pile1, false=pile2).
    // Determinista: la pila con más cartas va a la mano. Se registra el
    // reparto exacto del SIM (hallazgo del informe).
    onChoosePile(data, ctx) {
      const names = (view) => Object.values(view ?? {}).map((c) => String(c?.name ?? ''))
      const pile1 = names(data?.cardsView1)
      const pile2 = names(data?.cardsView2)
      ctx.log(`onChoosePile: pile1=[${pile1.join(', ')}] pile2=[${pile2.join(', ')}]`)
      const takeFirst = pile1.length >= pile2.length
      ctx.log(`onChoosePile: → ${takeFirst ? 'pile1' : 'pile2'} (la mayor, a la mano)`)
      return takeFirst
    },
    onPlayMana(ctx) {
      const bf = Object.values(ctx.me?.battlefield ?? {})
      const isle = bf.find((c) => !c.tapped && /island/i.test(c?.name ?? ''))
      if (isle) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: isle.id })
        ctx.log('onPlayMana: giro', isle.name)
      }
    },
    // Invariante: FoF en el cementerio propio y las 4 cartas reveladas con
    // nombre único (Grizzly Bears, Runeclaw Bear, Forest, Mountain)
    // exactamente una vez cada una entre mano y cementerio (la 5ª, Island,
    // no es distinguible de las 60 Islas del mazo).
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      const handNames = Object.values(gv.myHand ?? gv.hand ?? {}).map((c) => String(c?.name ?? ''))
      const gyNames = Object.values(me.graveyard ?? {}).map((c) => String(c?.name ?? ''))
      const has = (arr, n) => arr.some((x) => new RegExp(`^${n}$`, 'i').test(x))
      const count = (n) =>
        handNames.filter((x) => new RegExp(`^${n}$`, 'i').test(x)).length +
        gyNames.filter((x) => new RegExp(`^${n}$`, 'i').test(x)).length
      return has(gyNames, 'Fact or Fiction') && ['Grizzly Bears', 'Runeclaw Bear', 'Forest', 'Mountain'].every((n) => count(n) === 1)
    },
  }
}

export const drivers = { fof: makeFofDriver }

export const meta = {
  mechanic: 'fof',
  kind: 'game',
  assert: 'hasFactOrFiction',
  note: 'Fact or Fiction ({3}{U}) resuelto: el SIM (rival) separa con la sobrecarga `Cards` de fireSelectTargetEvent (`targets=null`, ids en `options.possibleTargets` y cierre con "Done" en `UI.right.btn.text`) — **fix de SimPlayer 2026-09-16**: elige carta por `sendPlayerUUID` (menor UUID) y cierra con `sendPlayerBoolean(false)`; antes hacía cancel() y dejaba pile1 vacía (0/5). El controlador recibe GAME_CHOOSE_PILE con cardsView1/cardsView2 y responde sendPlayerBoolean (true=pile1, false=pile2); this driver elige la pila mayor para la mano. Mazo 60 Islas con cheatSetup (FoF en mano, 3 Islas al campo, top 5 = Grizzly/Runeclaw/Forest/Island/Mountain). Frames re-grabado: pile1=[Grizzly Bears] al cementerio, pile2 (4 cartas) a la mano. Invariante: FoF en el cementerio propio y las 4 reveladas no-Isla exactamente una vez entre mano y cementerio (la revelada Island no se distingue de las del mazo).',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeFofDriver())
}
