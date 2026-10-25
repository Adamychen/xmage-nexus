# Behaviour specs

How the web client must behave, and why. One file per area of the player's experience
(not per component: components get renamed and split, areas do not). Each decision is a
numbered rule linked to the tests that hold it, so a change that breaks a decision fails a
test that names the decision.

| File | Prefix | Area |
|---|---|---|
| `dialogs.md` | `DLG` | Dialogs, layers, keyboard inside dialogs, peeking at the board |
| `prompts.md` | `PRM` | Server prompts: which ones block, how picks are made, decision context |
| `targeting.md` | `TGT` | Choosing targets on the board: highlights, clicks, stack targets, arrows |
| `keyboard.md` | `KEY` | Game and screen shortcuts, when they stand down, where they are shown |
| `fx.md` | `FX` | Board animations: effects off, reduced motion, speed, timing, gallery entries |
| `hand.md` | `HND` | Your hand and opponents' hands: layout, playing, reordering, known cards |
| `combat.md` | `CMB` | Declaring attackers and blockers, combat arrows, damage assignment |
| `mana.md` | `MNA` | Paying costs: sources, pool, smart payment, X |
| `lobby.md` | `LBY` | Login, table list, creating and joining tables, waiting room, invites |
| `board.md` | `BRD` | Battlefield bands per kind, multiplayer seats, focusing one opponent's board |
| `settings.md` | `SET` | Player settings not owned by another area: card preview size |
| `decks.md` | `DCK` | Deck gallery, deck builder, stacks view |
| `appearance.md` | `APR` | Light and dark appearance, which surfaces stay dark, contrast in both |
| `accessibility.md` | `ACC` | Reduce Transparency, Increase Contrast, text and touch sizes, safe areas, phone login, hover |

Areas without a file yet are written the first time someone changes them (see `ROADMAP.md` §4.12).
Candidates: stack, game log and chat, draft, spectating.

## What goes where

| Doc | Holds | Example |
|---|---|---|
| `docs/specs/*.md` | **How it must behave** (a product decision that outlives the code) | "A required prompt has no cancel button" |
| `docs/lessons.md` | **Why something broke** (a technical trap) | "Alt keyup must be prevented too on Windows" |
| `docs/plans/*.md` | **How we got there** (a design for one piece of work) | Game animations plan |
| `web/INTERACTION_COVERAGE.md` | **What is covered** per server callback | `GAME_TARGET` row |
| commit message | The narrative of one change | |

When a plan is implemented, the decisions it settled move into a spec; the plan stays as history.

## Rule format

```md
### DLG-6 · A blocking prompt that covers the board shows how to see it
One paragraph: the behaviour, in terms a player would recognise.

- Why: the reason, ideally the incident or PR that taught it.
- Guard: `src/ui/Modal.test.tsx` · `e2e/learn.spec.ts`
```

- The heading is `### <PREFIX>-<n> · <title>`. Numbers are never reused: a retired rule keeps
  its number and says `Retired` in its body, with the reason.
- Each spec file declares its prefix on a line `` Prefix: `XXX` ``.
- `Guard:` lists the test files (relative to `web/`) whose tests carry the rule id, or
  `none yet (<reason>)` when nothing tests it today. An unguarded rule is still a rule: it
  tells the next person what the code is meant to do and where a test is missing.

## How a test points at a rule

The test title starts with the rule id and a colon:

```ts
it('DLG-2: runs onEscape only for the topmost modal', () => { … })
test('PRM-8: a target inside the graveyard rings the pile … @graveyard-target', …)
```

Several ids are separated by commas: `'DLG-2, DLG-5: …'`. Parameterised tests work the same way:
`it.each(cases)('HND-2: spreads %i cards', …)`.

## The guard

`web/src/specCoverage.test.ts` (part of `unit`) reads every spec and every test title under
`web/src`, `web/e2e` and `web/fixtures`, and fails when:

- a spec has no prefix, a malformed heading, a duplicate id or not exactly one `Guard:` line;
- a test names a rule that does not exist;
- the files a rule lists under `Guard:` differ from the files whose tests carry its id;
- a rule marked `none yet` is in fact carried by a test.

So deleting or renaming the only test of a rule, or adding a test without listing it, is a red
unit run that points at the decision involved.

## Changing a rule

A rule is changed on purpose, in the same commit as the code: edit the rule (and its `Why:`),
then the tests. If a test fails because of a rule and the rule is still right, the code is wrong.
