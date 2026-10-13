import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// Pins the ALTERNATION of the any-time top-card peek channel, which
// top-card-peek.json cannot show: it captures the first view carrying the
// "Top card of your library" group and exits.
//
// Engine rhythm (docs/lessons.md:20): `LookAtTopCardOfLibraryAnyTimeEffect`
// re-adds the group on every effect pass while `PlayerImpl.lookAtCards` fires
// an update that clears it right after sending — so the client sees the group
// alternate with empty views. `game/topCardPeek.ts` treats it as persistent
// state (remembers the last peeked card across empty views) instead of an
// event; this sequence is the wire proof that reading is correct, plus the
// stale check `LookedAt.add` accumulation would need: every WITH view must
// carry exactly ONE card under the title, and the peeked id must track the
// library (same library size → same id, changed library → changed id).
//
// Setup is the top-card-peek path verbatim (60 Islands, land, cheat Sphinx +
// 5 Islands to the battlefield, cast for real): after the first WITH view the
// recorder keeps passing priority and stores every consecutive view until the
// WITH → WITHOUT → WITH triple appears (same peek id on both WITH ends) or
// the window (14 views) runs out. Only the triple is dumped.
const PEEK_TITLE = 'Top card of your library'

function peekCardId(gv) {
  const group = (gv.lookedAt ?? []).find((g) => g?.name === PEEK_TITLE)
  if (!group) return null
  const cards = Object.values(group.cards ?? {})
  if (cards.length === 0) return null
  return cards[0]?.id ?? null
}

function makeTopCardPeekSequenceDriver() {
  return {
    name: 'top-card-peek-sequence',
    outFile: 'top-card-peek-sequence.json',
    deck: {
      name: 'Mage Web peek sequence',
      cards: [{ cardName: 'Island', setCode: 'iko', cardNumber: '271', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Modern',
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
          ctx.log('onSelect: land (normal action before the cheat)')
        } else ctx.pass()
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Sphinx to hand + 5 Islands to the battlefield for {4}{U}{U})')
        void ctx.cheatSetup({
          hand: ['Sphinx of Jwar Isle'],
          battlefield: ['Island', 'Island', 'Island', 'Island', 'Island'],
        })
        return
      }
      if (!this._cast && ctx.cardInHand('Sphinx of Jwar Isle') && ctx.untappedMana() >= 6) {
        this._cast = true
        ctx.log('onSelect: cast Sphinx of Jwar Isle from hand')
        ctx.playCardByName('Sphinx of Jwar Isle')
        return
      }
      ctx.pass()
    },
    captureSequence: {
      size: 14,
      startWhen(gv) {
        return peekCardId(gv) != null
      },
      findTriple(views) {
        // First WITH, first WITHOUT after it, first WITH after that. No id
        // linkage here on purpose: a draw step between the views legitimately
        // changes the peeked card, and the invariant sorts that out through
        // libraryCount (same library → same id, changed library → changed id).
        let i = views.findIndex((gv) => peekCardId(gv) != null)
        if (i < 0) return null
        let j = -1
        for (let n = i + 1; n < views.length; n++) {
          if (peekCardId(views[n]) == null) {
            j = n
            break
          }
        }
        if (j < 0) return null
        for (let k = j + 1; k < views.length; k++) {
          if (peekCardId(views[k]) != null) return [views[i], views[j], views[k]]
        }
        return null
      },
    },
  }
}

export const drivers = { 'top-card-peek-sequence': makeTopCardPeekSequenceDriver }

export const meta = {
  mechanic: 'top-card-peek-sequence',
  file: 'top-card-peek-sequence.json',
  kind: 'sequence',
  assert: 'hasTopCardPeekSequence',
  note: 'WITH → WITHOUT → WITH triple of consecutive views around the "Top card of your library" lookedAt group (Sphinx of Jwar Isle cast for real, same setup as top-card-peek.json): proves the group alternates with empty views on the wire (effect pass re-adds it, lookAtCards clears it after sending), so the client is right to keep it as persistent library-side state instead of an event. Stale pin: each WITH group holds exactly one SimpleCardView pointer, and the id tracks the library (same libraryCount on both WITH ends → same id, changed library → changed id), so LookedAt.add never accumulates a stale card under the title.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeTopCardPeekSequenceDriver())
}
