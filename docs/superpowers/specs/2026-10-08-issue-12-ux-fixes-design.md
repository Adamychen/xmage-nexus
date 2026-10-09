# Issue #12 — UI/UX fixes (Wave A + B)

Date: 2026-10-08
Source: [Adamychen/xmage-nexus#12](https://github.com/Adamychen/xmage-nexus/issues/12) ("feedback")
Status: approved design, awaiting implementation plan

## Goal

Close 8 of the 11 items in issue #12 — items 1 (create-table dialog overflow), 3
(sickness indicator), 4 (per-phase "ding"), 7 (hand cost pips), 8 (duplicate P/T), 9
(deck editing from the create-table screen), 10 (import clarity) and 11 (feedback
category). Every change is CSS, a settings flag, or copy — no parser, protocol, proxy or
fork change.

Remaining for Wave C: item 2 (turn clarity), 5 (hand text) and 6 (play text).

## Out of scope (Wave C, separate spec)

- "See the text on all cards in hand / in play without hovering" (issue items 5 and 6).
  Cards are Scryfall `<img>`s rendered by `web/src/board/CardSlot.tsx:355`; there is no
  text-on-card mode at all. In play, legible text for 8+ permanents does not fit one
  screen, so this needs a real design decision (bigger cards + band panning vs. a
  rules-text strip under compact tiles vs. a persistent inspector) and, for the
  reporter's "hand on the left, board on the right" idea, a fourth board layout in
  `web/src/board/boardLayout.ts:4` — the hand is an absolutely positioned bottom bar
  (`web/src/board/HandBar.css:1-22`), so a vertical hand is new layout work.
- "Hard time telling whose turn it is" (issue item 2). Five turn indicators already
  coexist (`web/src/game/GameScreen.tsx:372` turn/phase strip, `PhaseBar.tsx:17`,
  `PlayerInfoBar.tsx:241-299` gold `is-turn` glow + priority ring, `TurnOrderRing.tsx`,
  `TurnRecapStrip.tsx:84`). Needs a design choice, not a bug fix.
- Browser-level zoom. The client has its own `uiScale` setting.

## Decisions

| Question | Decision |
|---|---|
| Slice | Wave A + B ship together; Wave C gets its own spec |
| New setting defaults | **Unchanged behaviour** — every flag defaults to today's rendering/sound, so no existing user and no e2e assertion shifts |
| Complaint 9 ("couldn't change my deck from that screen") | Cover both readings: add an **Edit deck** button on the Seats step *and* verify the select flow in the browser |
| Complaint 10 (import) | File picker becomes the primary CTA; format select reads as a detected answer. No parser change |
| Complaint 5 (ding) | Tri-state flag, not a deletion — `every-prompt` (default) / `on-gain` / `off` |

## Wave A

### A1. Create-table dialog clipping (issue item 1)

Four defects stack; together they produce "the menu is too large, I must scroll, and text
is cut off".

1. **`web/src/ui/DialogShell.css:49`** — `.dlg-lg` hardcodes `max-height: 90vh` while
   `.dlg-sm` and `.dlg-md` use the `--dlg-max-h` token (`styles.css:43-46`). Use the
   token so all three sizes agree.
2. **`web/src/lobby/CreateTableDialog.css:1-12`** — the legacy `.overlay` backdrop block
   is applied on top of `.dlg-backdrop` (via `legacyBackdropClass`, wired at
   `DialogShell.tsx:66`) and wins on CSS import order (`CreateTableDialog.tsx:12` is
   evaluated after `DialogShell.tsx:5`). Its `display: flex; align-items: center`
   overrides the `place-items: safe center` in `DialogShell.css:10-11`, which is exactly
   the "let the backdrop scroll instead of clipping the panel" fallback. **Remove
   `legacyBackdropClass="overlay"` from `CreateTableDialog.tsx:28` only** — the dialog
   then gets the pure `.dlg-backdrop` treatment.

   The `.overlay` block itself must **stay**: it is the only definition of that class in
   the codebase and `AppearanceSettingsModal.tsx:49` and `AvatarPickerModal.tsx:37` also
   pass `overlay`. Do not delete the `legacyBackdropClass` / `legacyPanelClass` props —
   25+ dialogs use them. (That those two dialogs depend on a class defined in
   `CreateTableDialog.css` is a pre-existing smell; out of scope.)
3. **`CreateTableDialog.css:165-171`** — `.create-table-body { max-height: 52vh;
   overflow-y: auto }` is a second scroll container inside an already scrolling panel.
   Remove `max-height` and `overflow-y`; the panel becomes the single scroll axis and the
   stepper/footer stay put.
4. **Text clipping** — `.wizard-step-text` (`:102-108`) gets `overflow: hidden;
   text-overflow: ellipsis`; `.wizard-connector` (`:110-115`) replaces its hardcoded
   `left: 58%; right: -42%` with a flex gap so a long step label cannot push it off;
   `select` inside the dialog (`styles.css:150-163`, `CreateTableDialog.css:190-199`)
   gets `text-overflow: ellipsis` so long deck/format names ellipsize instead of hard
   clipping; `CreateTable/SummaryStrip.tsx:18` drops the blind `.slice(0, 28)` on
   `compatibilityError` and puts the full string in the chip's `title`.

No behaviour change. Side effect to verify: `web/e2e/support/start-game.ts:182-187`
force-clicks the submit button to work around sub-pixel jitter from the `52vh` inner
scroll — that workaround may become unnecessary (check, do not assume).

### A2. Deck import clarity (issue item 10)

- `web/src/decks/ImportDeckDialog.tsx` source step: promote the file picker
  (`accept=".dck,.txt,.dec,.cod,.o8d,.dek,.mtga,.mwdeck,.draft,.json"`) to a primary
  button; move the textarea and the clipboard-paste button below an "or paste" divider.
  Drag-and-drop (`:290-300`) stays as is.
- Setup step: `data-testid="import-format-select"` (`:410-419`) gains a leading
  **auto-detect** pseudo-option whose label names the format `suggestFormat()`
  (`decks/importResolve.ts:34-42`) actually detected, so the control reads as a result
  rather than a question. Selected value and parser behaviour are unchanged.

### A3. Deck editing from the create-table screen (issue item 9)

> "I selected a default starter deck. Then I was unable to change my deck from that same
> screen. I had to start the table THEN change the deck."

Two readings, both cheap to cover. Reading 1 (he wanted to *edit the deck's contents*) is
the likely one: the deck `<select>` at `CreateTable/SeatsTab.tsx:41` re-enables the
moment `adoptStarterDecks` populates `availableDecks`, but there is no affordance to open
the builder from that screen.

- `CreateTableDialog` takes an optional `onEditDeck?: (deckId: string) => void`, passed
  through to `SeatsTab`. `LobbyScreen` (`web/src/lobby/LobbyScreen.tsx:52`, `:321`)
  already owns `deckBuilderId` and renders `<DeckBuilder deckId={deckBuilderId} />`, so
  it wires `onEditDeck={setDeckBuilderId}`.
- `SeatsTab` renders an **Edit deck** button next to the deck `<select>`, disabled while
  `form.myDeck` is null, calling `onEditDeck(deckRef(form.myDeck))`.
- **The wizard stays mounted** behind the builder rather than being unmounted: the form
  state lives inside `useCreateTableForm`, so unmounting would discard it. This means two
  stacked modals — `ui/Modal.tsx` has a z-index allocator (501-1999) and topmost-only
  Escape, which should cover it. **Verify with a screenshot** that the builder is usable
  over the wizard and that closing it returns to the wizard with the form intact. If
  nesting turns out to be broken, the fallback is to lift the form state to `LobbyScreen`
  — do not build that unless the screenshot shows a problem.
- Reading 2 (he wanted to pick a *different* deck) is a verification task, not a change:
  reproduce `availableDecks.length === 0` → add starters → change the select in fake mode
  and confirm it works. If it already does, no code.

### A4. Repo hygiene (issue item 11)

Add a `feedback` issue label and `.github/ISSUE_TEMPLATE/feedback.md`, then comment on
issue #12 pointing at the label and listing what Wave A+B closes.

## Wave B

### Settings plumbing (shared by B1-B3)

Per new field: `SettingsState` + default in `web/src/state/slices/settings.ts:10-73`, a
`normalizeX(value): X` guard living **next to the feature** (the established pattern —
`normalizeCardStyle` / `normalizeTapStyle` are exported from `web/src/board/compactCard.ts:12-14`
and imported by `persistence.ts:572`), persistence in `web/src/state/persistence.ts`, the
write path is already generic (`state/actions.ts:355-365`), UI in
`web/src/settings/sections.tsx` mirrored in `web/src/appearance/AppearanceSettingsModal.tsx`,
and the label in **all 9 locales** (`web/src/i18n/locales/{en,es,de,fr,it,pt,ru,ja,zhs}.ts`)
— missing keys are a compile error (`i18n/types.ts:11`) and a test failure
(`i18n/i18n.coverage.test.ts:107-135`).

`showHandCost`, `ptBadgeMode` and `sicknessStyle` belong to appearance and go in the
existing appearance concern (`AppearanceSettings`, all fields optional like `cardStyle?`);
`prioritySound` belongs to `AudioSettings` (`persistence.ts:516-546`, key
`mage-web-audio`) next to `soundEnabled` / `sfxVolume`.

Tri-state appearance settings use the `settings-cards` + `Button variant="ghost"` pattern
already used for `CARD_STYLES` and `TAP_STYLES` in `BoardSection`
(`web/src/settings/sections.tsx:143-170`), each card keyed `data-testid="settings-<key>-<value>"`.

| Setting | Type | Default | Effect |
|---|---|---|---|
| `showHandCost` | `boolean` | `true` | Render the printed-cost pips over hand cards |
| `ptBadgeMode` | `'always' \| 'changed' \| 'hidden'` | `'always'` | P/T badge on battlefield creatures |
| `sicknessStyle` | `'badge' \| 'veil'` | `'badge'` | Summoning-sickness indicator |
| `prioritySound` | `'every-prompt' \| 'on-gain' \| 'off'` | `'every-prompt'` | `priority` cue on `GAME_SELECT` |

### B1. Hand mana-cost pips (issue item 7)

`HandCardCost` (`web/src/board/HandBar.tsx:24-41`) is mounted unconditionally at
`:206`. One condition; no CSS change. `HandBar` reads settings via the existing
`useSettings()` selector.

### B2. P/T badge (issue item 8)

Tri-state rather than a boolean, because "always off" and "off unless changed" are both
reasonable asks. `ptTrend()` (`web/src/board/ptTrend.ts:26-31`) already computes the
comparison and the badge already ships `data-trend` colouring plus a `pt_base` tooltip
(`CardSlot.tsx:400-408`), so `'changed'` costs one clause at `CardSlot.tsx:246`:

```
showPtBadge = ptBadgeMode !== 'hidden'
              && isRealCreature && perm.power != null && perm.toughness != null
              && (ptBadgeMode === 'always' || pt.power !== 'same' || pt.toughness !== 'same')
```

Consequence to check: `hasCornerStat` (`CardSlot.tsx:249`) derives from `showPtBadge`,
so compact tiles lose their stat corner when P/T is unchanged.

### B3. Summoning sickness (issue item 3)

`'veil'` renders one extra `pointer-events: none` layer inside the existing card box: a
translucent wash plus a large centred hourglass — the classic XMage look. No DOM
restructure, works in both `cardStyle` values, reuses the existing `sicknessFloat`
keyframes and their existing `prefers-reduced-motion` off switch
(`CardSlot.css:200-206`, `:490-510`). Trigger condition is unchanged
(`CardSlot.tsx:226`: real creature, untapped, `summoningSickness === true`).

### B4. Per-phase priority "ding" (issue item 4)

`prompt_open` is **not** the culprit: `web/src/audio/promptSound.ts` dedupes by
signature (`method|gameId|title|message|mode|min|max|opts`), so an identical prompt is
silent. The ding is `web/src/audio/gameSoundDispatcher.ts:11-13`:

```ts
if (method === 'GAME_SELECT') { soundManager.play('priority', 'game') }
```

The server emits a `GAME_SELECT` per phase, so every phase change dings whether or not
anything happened. Lines 20-22 already implement the useful semantic — sound only when
priority actually arrives (`false → true`).

`prioritySound` gates both sites:

- `every-prompt` — today's behaviour, both fire.
- `on-gain` — lines 11-13 skipped; only the `false → true` transition chimes.
- `off` — neither fires.

UI: `Tabs variant="segmented"` from `web/src/ui/Tabs.tsx` (`TabsProps<T>` takes
`items: TabItem<T>[]`, `value: T`, `onChange: (id: T) => void`), in
`web/src/settings/SoundFxControls.tsx`, mirroring the `FX_SPEEDS` control at `:22-33`,
placed beside the master and SFX sliders and disabled while `soundEnabled` is false.
`dispatchGameSounds` receives the mode as a parameter (it is already called with the game
diff from `state/eventHandler.ts:162`); it must not read the store directly, so it stays
a pure function and testable without a store.

Residual risk to verify against a live game: if the server's prompt **title** varies by
phase, `prompt_open` still fires and the ding survives. Check one real game in
`node scripts/test.mjs self-test` before declaring item 5 closed.

## Testing

Unit (vitest):

- `DialogShell` — `.dlg-lg` resolves `--dlg-max-h`; `.create-table-body` is not a scroll
  container. These are the regression guards for CSS-only defects.
- `ImportDeckDialog` — file control is the primary CTA; the format select exposes an
  auto-detect option naming the detected format.
- `CardSlot` — `ptBadgeMode` truth table (3 modes × changed/unchanged P/T);
  `sicknessStyle='veil'` renders the overlay; `showHandCost={false}` omits
  `.hand-card-cost`.
- `gameSoundDispatcher` — one case per `prioritySound` value, asserting the number of
  `priority` plays for a phase change versus a priority gain.
- `SeatsTab` / `useCreateTableForm` — the Edit deck button opens the builder for the
  selected deck; the select is enabled and populated after `adoptStarterDecks`.

E2E (fake backend, no stack):

- `web/e2e/gallery.spec.ts` already renders `CreateTableDialog` through `#/gallery` at
  three resolutions — extend it so a clipped panel fails.
- A `@board` case that toggles `ptBadgeMode` and `showHandCost` in fake mode.

Unchanged by design: `callbackCoverage`, `mechanicsCoverage`, `engineViewCoverage`, the
recorded golden frames and the contract schema — no callback, field or frame changes. The
`java` layer is not in scope.

## Docs to update on landing

`site/content.json` (Create-Table wizard + import/export matrix rows), `ROADMAP.md` §4,
and a closing comment on issue #12. `web/INTERACTION_COVERAGE.md` only if a new server
callback appears — none does.

## Verification gate

`node scripts/test.mjs unit typecheck build i18n`, then
`npx playwright test gallery.spec.ts` in fake mode, then the full suite with the stack up
before the work is called done.