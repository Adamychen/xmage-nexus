# Issue #12 UX Fixes (Wave A + B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close 8 of the 11 UI/UX complaints in issue #12 — create-table dialog clipping, deck-import clarity, editing a deck from the create-table screen, hand cost pips, duplicate P/T badges, the summoning-sickness indicator, the per-phase "ding", and a `feedback` issue category.

**Architecture:** No new subsystem. Every change is CSS, a settings field threaded through the existing persistence path, a rendering condition, or copy. `showHandCost` / `ptBadgeMode` / `sicknessStyle` ride the existing appearance concern (`AppearanceSettings`, localStorage key `mage-web-appearance`); `prioritySound` rides `AudioSettings` (key `mage-web-audio`) and is passed into `dispatchGameSounds` as a parameter so it stays a pure function.

**Tech Stack:** React 19 + TypeScript + Vite, vitest + @testing-library/react (jsdom), plain CSS with design tokens, Playwright (fake backend).

**Spec:** `docs/superpowers/specs/2026-10-08-issue-12-ux-fixes-design.md` — read it before starting; this plan implements it and does not restate it.

## Global Constraints

- **Do not commit.** `AGENTS.md`: "Do not commit unless explicitly requested." Every task ends with a verification step plus `git status --short` / `git diff --stat` reported to the user — never a `git commit`. If the user asks for commits mid-plan, commit per task with the message given in that task.
- **English only** for every artifact — code identifiers, test names, comments, i18n `en` copy. The only exceptions are the translation locales and quoted server output.
- **No comments in code** unless the user asks (`AGENTS.md`).
- **Every new user-facing string goes in all 9 locales** — `web/src/i18n/locales/{en,es,de,fr,it,pt,ru,ja,zhs}.ts`. A key added to `en.ts` is a compile error elsewhere (`web/src/i18n/types.ts:11`) and a test failure (`web/src/i18n/i18n.coverage.test.ts:107-135`). `es` must be 100% translated after the whitelist.
- **Every new setting defaults to today's behaviour.** No existing user's rendering, sound or stored blob may change. This is a spec decision, not a preference.
- **CSS only design tokens** (`var(--…)`), no raw colours or sizes — enforced by `web/src/ui/cssIntegrity.test.ts` and `web/src/ui/styleTokens.test.ts` against `web/src/ui/styleBaseline.json`. If a genuinely new token is needed, add it in the same task and regenerate the baseline with the command that task specifies.
- **Do not touch** `dist/`, `.run/`, `local-server/`, `node_modules/`, `target/`. There are pre-existing uncommitted changes in the tree (`web/src/board/commanders.ts`, `web/src/board/hintRegistry.ts`, `web/src/game/CommanderDamageMatrix.tsx`, `web/ENGINE_VIEW_TRIAGE.md`, `web/INTERACTION_COVERAGE.md`, `web/src/__fixtures__/gameViews.ts`, `web/src/board/PodBoard.test.tsx`, `web/src/board/commanders.test.tsx`, `docs/lessons.md`) — they are not yours, do not revert or `git add` them.
- **Tests:** `cd web && npx vitest run <path>` (config `web/vitest.config.ts`, include `src/**/*.test.ts`, `src/**/*.test.tsx`, `fixtures/**/*.test.ts`, environment `jsdom`). A test that asserts on CSS *text* must open with `// @vitest-environment node` (pattern: `web/src/ui/cssIntegrity.test.ts:1`).
- **Visual QA:** after any browser step, take a screenshot **and read the image file** (`AGENTS.md` default browser workflow). Tasks 1 and 3 require it.
- **Final gate before calling anything done:** `node scripts/test.mjs unit typecheck build i18n`, then `cd web && npx playwright test gallery.spec.ts` (fake backend, no stack needed), then the full `node scripts/test.mjs` with the stack up.

## Review Focus

Five input classes the spec implies but no task's happy-path test would otherwise catch. Each line names the test that pins it, in the task that owns the code.

1. **A pre-existing `mage-web-appearance` blob with none of the three new keys.** `loadAppearanceSettings()` must yield today's values, not `undefined`. → Task 4 Step 1.
2. **A hand-edited or corrupted stored value** (`{"ptBadgeMode":"sometimes"}`). `normalizePtBadgeMode` must never leak it into the UI. → Task 5 Step 1.
3. **A creature whose P/T is buffed and then returns to base.** The badge must disappear again in `'changed'` mode — no stale `data-trend="changed"`. → Task 5 Step 4.
4. **A tapped creature with `summoningSickness: true`.** The indicator stays hidden (`hasSummoningSickness` requires `!tapped`) in both styles — the veil must not appear on a tapped creature. → Task 6 Step 4.
5. **The same prompt signature arriving twice across a phase change.** `prompt_open` must stay silent (it dedupes by signature); only `priority` behaviour is gated by the flag. → already pinned by `web/src/audio/promptSound.test.ts:38`, run as a regression check in Task 7 Step 1; the new risk the flag introduces is *not* `prompt_open` but a stale `prioritySound` value, which Task 7 Step 1's per-mode cases cover.

---

### Task 1: Create-table dialog stops clipping

**Files:**
- Modify: `web/src/lobby/CreateTableDialog.tsx:28` (drop `legacyBackdropClass="overlay"`)
- Modify: `web/src/ui/DialogShell.css:49`
- Modify: `web/src/lobby/CreateTableDialog.css:102-115` (`.wizard-step-text`, `.wizard-connector`), `:165-174` (`.create-table-body`)
- Modify: `web/src/lobby/CreateTable/SummaryStrip.tsx:18`
- Modify: `web/src/styles.css:150-163`
- Test: `web/src/ui/DialogShell.overflow.test.ts` (new)
- Test: `web/e2e/gallery.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks need.

Context you need: the legacy `.overlay` block (`CreateTableDialog.css:1-12`) is applied on top of `.dlg-backdrop` via `legacyBackdropClass` and wins on CSS import order, overriding `place-items: safe center` (`DialogShell.css:10-11`) — the rule that lets the backdrop scroll instead of clipping the panel. **Do not delete the `.overlay` block**: it is the only definition of that class in the codebase and `web/src/appearance/AppearanceSettingsModal.tsx:49` and `web/src/lobby/AvatarPickerModal.tsx:37` also pass `overlay`. Do not remove the `legacyBackdropClass` / `legacyPanelClass` props — 25+ dialogs use them.

- [ ] **Step 1: Write the failing CSS-text guard**

Create `web/src/ui/DialogShell.overflow.test.ts`:

```ts
// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const shell = readFileSync(fileURLToPath(new URL('./DialogShell.css', import.meta.url)), 'utf8')
const create = readFileSync(fileURLToPath(new URL('../lobby/CreateTableDialog.css', import.meta.url)), 'utf8')

function rule(css: string, selector: string): string {
  const m = css.match(new RegExp(`(^|[,}\\s])${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`))
  return m ? m[2] : ''
}

describe('create-table dialog overflow', () => {
  it('caps the large dialog with the shared token, not a hardcoded 90vh', () => {
    expect(rule(shell, '.dlg-lg')).toContain('max-height: var(--dlg-max-h)')
  })

  it('keeps a single scroll axis: the panel body is not its own scroller', () => {
    expect(rule(create, '.create-table-body')).not.toContain('overflow-y: auto')
    expect(rule(create, '.create-table-body')).not.toContain('max-height: 52vh')
  })

  it('ellipsizes step labels instead of letting them overflow', () => {
    expect(rule(create, '.wizard-step-text')).toContain('text-overflow: ellipsis')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd web && npx vitest run src/ui/DialogShell.overflow.test.ts`
Expected: FAIL — `max-height: var(--dlg-max-h)` not found in `.dlg-lg`; `overflow-y: auto` found in `.create-table-body`; `text-overflow: ellipsis` not found in `.wizard-step-text`.

- [ ] **Step 3: Fix the dialog sizing**

In `web/src/ui/DialogShell.css:49` change `.dlg-lg { width: var(--dlg-width-lg); max-height: 90vh; }` to use `max-height: var(--dlg-max-h);` so it matches `.dlg-sm` / `.dlg-md`.

In `web/src/lobby/CreateTableDialog.css`, in the `.create-table-body` rule delete `max-height: 52vh;` and `overflow-y: auto;`. In `.wizard-step-text` add `overflow: hidden;` and `text-overflow: ellipsis;`. Replace the `.wizard-connector` `left: 58%; right: -42%` positioning with a flex gap on `.wizard-stepper` so a long label cannot push the connector off.

- [ ] **Step 4: Remove the legacy backdrop class from the create-table dialog only**

In `web/src/lobby/CreateTableDialog.tsx:28` delete the `legacyBackdropClass="overlay"` line. Leave `legacyPanelClass` and leave the `.overlay` CSS block alone.

- [ ] **Step 5: Fix text truncation in the dialog's selects and the summary chip**

In `web/src/styles.css`, inside the existing `select:not([multiple])` rule (`:150-163`), add `text-overflow: ellipsis;`. In `web/src/lobby/CreateTable/SummaryStrip.tsx:18`, replace `form.compatibilityError.slice(0, 28)` with the full `form.compatibilityError` as the chip's children and add `title={form.compatibilityError}`.

- [ ] **Step 6: Run the unit tests and verify they pass**

Run: `cd web && npx vitest run src/ui/DialogShell.overflow.test.ts src/ui/DialogShell.test.tsx src/lobby/CreateTableDialog.test.tsx src/ui/cssIntegrity.test.ts src/ui/styleTokens.test.ts`
Expected: PASS. If `styleTokens.test.ts` fails on a new token value, regenerate the baseline with the command its failure message prints rather than editing `styleBaseline.json` by hand.

- [ ] **Step 7: Screenshot the dialog and read it**

Run the fake backend, open `#/gallery`, select the `wizard` entry, and capture the create-table dialog at 1280×800. Read the PNG. Confirm: no clipped panel, one scrollbar not two, step labels not cut mid-word, long deck/format names ellipsize. Also capture at 1920×1080. If a long deck name still hard-clips, the select needs `min-width: 0` on its flex parent — fix and re-screenshot.

- [ ] **Step 8: Add the E2E guard**

In `web/e2e/gallery.spec.ts`, add a case in the wizard group asserting the panel is not clipped: the dialog's bounding box bottom must be within the viewport (`box.y + box.height <= viewport.height + 1`), at each of the spec's existing viewports. Reuse whatever viewport loop the file already has.

- [ ] **Step 9: Check whether the E2E submit workaround is now obsolete**

`web/e2e/support/start-game.ts:182-187` force-clicks the wizard's submit button to dodge sub-pixel jitter from the old `52vh` inner scroll. Remove the `force: true` and the `scrollIntoViewIfNeeded()` workaround, then run `cd web && npx playwright test e2e/deckvalidation.spec.ts` (or whichever spec drives `createTable()`). If it fails, restore the workaround and note in the task report that the jitter has another source.

- [ ] **Step 10: Report the diff**

Run `git status --short` and `git diff --stat`. Do not commit.

---

### Task 2: Deck import — file first, format reads as detected

**Files:**
- Modify: `web/src/decks/ImportDeckDialog.tsx:328-377` (source step), `:410-419` (format select)
- Modify: `web/src/decks/importResolve.ts` (only if the detected-format label needs a display name helper)
- Modify: `web/src/i18n/locales/*.ts` (9 files)
- Test: `web/src/decks/ImportDeckDialog.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing other tasks need.

Context: the format select already defaults to `suggestFormat()` (`web/src/decks/importResolve.ts:34-42`) — no parser or detection change. This task is presentation only.

- [ ] **Step 1: Write the failing tests**

Add to `web/src/decks/ImportDeckDialog.test.tsx`:

```tsx
it('offers the file picker as the primary source action', () => { /* open the import dialog,
  assert the file input's label button has the primary variant class */ })

it('names the detected format in the format select', () => { /* assert the auto-detect option's
  text contains the detected format label, not the word 'format' alone */ })
```

Use the file's existing render helpers and `data-testid`s. Keep `data-testid="import-format-select"` and `import-submit-btn` unchanged — `web/e2e/import-wizard.spec.ts` depends on them.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `cd web && npx vitest run src/decks/ImportDeckDialog.test.tsx`
Expected: FAIL on both new cases.

- [ ] **Step 3: Make the file picker primary**

In the source step, render the file-picker control as a `Button variant="primary"` (the dialog already imports `Button`), keep the existing `accept` list and the hidden `<input type="file">` and its `onChange` handler exactly as they are, and move the textarea plus the clipboard-paste button below a small "or paste" divider. Drag-and-drop (`:290-300`) is unchanged.

- [ ] **Step 4: Make the format select read as a detected answer**

In the setup step, prepend an option to the format select whose value is the current `suggestFormat()` result and whose label names that format, e.g. `t('decks','import_auto_detect',{ format })`. The select's value stays what it is today, so the chosen format and the parser are unchanged. The `PRINTING_LABEL` map at `:36-41` is the place to source a format's display name.

- [ ] **Step 5: Add the i18n keys to all 9 locales**

Add `import_auto_detect` (with a `{ format }` placeholder) and the divider label to `web/src/i18n/locales/en.ts` under the `decks` category, then to `es`, `de`, `fr`, `it`, `pt`, `ru`, `ja`, `zhs`. Translate the `es` copy; the other 7 may match `en` (the guard allows up to 500 untranslated keys) but prefer real translations.

- [ ] **Step 6: Run the tests and verify they pass**

Run: `cd web && npx vitest run src/decks/ImportDeckDialog.test.tsx src/i18n/i18n.coverage.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the i18n guard**

Run: `node scripts/i18n-coverage.mjs`
Expected: exit 0.

- [ ] **Step 8: Report the diff**

`git status --short` and `git diff --stat`. Do not commit.

---

### Task 3: Edit a deck from the create-table screen

**Files:**
- Modify: `web/src/lobby/CreateTableDialog.tsx` (prop type + pass-through)
- Modify: `web/src/lobby/CreateTable/SeatsTab.tsx:36-49`
- Modify: `web/src/lobby/LobbyScreen.tsx:52`, `:321`, `:390`
- Modify: `web/src/i18n/locales/*.ts` (9 files)
- Test: `web/src/lobby/CreateTableDialog.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `CreateTableDialog` gains an optional prop `onEditDeck?: (deckId: string) => void`; `SeatsTab` receives it as the same prop.

Context: `LobbyScreen` already owns `deckBuilderId` (`web/src/lobby/LobbyScreen.tsx:52`) and renders `<DeckBuilder deckId={deckBuilderId} onClose={...} />` at `:321`. The wizard's form state lives inside `useCreateTableForm`, so **the wizard must stay mounted** behind the builder — unmounting discards the form. That means two stacked modals; `web/src/ui/Modal.tsx` has a z-index allocator (501-1999) and topmost-only Escape, which is expected to cover it. Step 6 verifies it rather than assuming it.

- [ ] **Step 1: Write the failing test**

Add to `web/src/lobby/CreateTableDialog.test.tsx`:

```tsx
it('opens the deck builder for the selected deck without losing the wizard', () => { /* render
  CreateTableDialog with an onEditDeck spy, advance to the Seats step, select a deck, click the
  edit button, expect onEditDeck to have been called with that deck's deckRef, and expect the
  dialog to still be in the document */ })
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd web && npx vitest run src/lobby/CreateTableDialog.test.tsx`
Expected: FAIL — no edit affordance exists.

- [ ] **Step 3: Thread the prop**

Add `onEditDeck?: (deckId: string) => void` to `CreateTableDialog`'s props and pass it to `<SeatsTab form={form} onEditDeck={onEditDeck} />`. In `LobbyScreen.tsx`, pass `onEditDeck={(id) => setDeckBuilderId(id)}` to `<CreateTableDialog>`. Do not touch the `showCreate` state, so the wizard stays mounted.

- [ ] **Step 4: Add the button**

In `SeatsTab.tsx`, next to the deck `<select>` (`:36-49`), render a button labelled `t('lobby','create_edit_deck')`, `disabled={!form.myDeck}`, `data-testid="create-edit-deck"`, with `onClick={() => onEditDeck?.(deckRef(form.myDeck!))}`. `deckRef` is already imported in that file.

- [ ] **Step 5: Add the i18n key to all 9 locales**

Add `create_edit_deck` under the `lobby` category in all 9 locale files (`en` first; translate `es`).

- [ ] **Step 6: Run the tests, then verify the stacked modals in the browser**

Run: `cd web && npx vitest run src/lobby/CreateTableDialog.test.tsx src/lobby/CreateTable/StarterDecksOffer.test.tsx`
Expected: PASS.

Then in fake mode, with zero decks stored: open New table → Seats step → click the starter-decks button → click **Edit deck**. Screenshot and **read** the PNG. Confirm the builder is usable on top of the wizard and that closing it returns to the wizard with the form intact. **If nesting is broken** (builder unreachable, or Escape closing both), stop and report rather than improvising — the spec's stated fallback is to lift the form state into `LobbyScreen`, which is a larger change and needs the user's approval.

- [ ] **Step 7: Verify the second reading of the complaint**

In the same browser session, confirm the deck `<select>` is enabled and changes value after the starter decks are added. If it works, no code — record that in the task report.

- [ ] **Step 8: Report the diff**

`git status --short` and `git diff --stat`. Do not commit.

---

### Task 4: `showHandCost` — opt out of the hand cost pips

**Files:**
- Create: `web/src/board/cardOverlays.ts`
- Modify: `web/src/state/persistence.ts` (`AppearanceSettings`, `DEFAULT_APPEARANCE`, `loadAppearanceSettings`, `saveAppearanceSettings` — the block at `:574-627`)
- Modify: `web/src/state/slices/settings.ts:11-40` and `:49-73`
- Modify: `web/src/state/actions.ts:339-345` (`persistClientSettings` destructure + `saveAppearanceSettings` call)
- Modify: `web/src/board/HandBar.tsx:206`
- Modify: `web/src/settings/sections.tsx` (`BoardSection`)
- Modify: `web/src/i18n/locales/*.ts` (9 files)
- Test: `web/src/board/cardOverlays.test.ts` (new), `web/src/board/HandBar.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: for Tasks 5 and 6 — `web/src/board/cardOverlays.ts` exporting `normalizeShowHandCost(value: unknown): boolean`, and the settings field `showHandCost: boolean`. Both later tasks add their own `normalize*` to the same module and their own `AppearanceSettings` optional field.

Context: this task creates the module and the persistence pattern the next two tasks reuse, so do it exactly as written — do not inline the normalizer into `persistence.ts`. `normalizeCardStyle` / `normalizeTapStyle` (`web/src/board/compactCard.ts:12-14`) are the precedent: they live next to the feature and are imported by `persistence.ts:572`.

- [ ] **Step 1: Write the failing tests**

Create `web/src/board/cardOverlays.test.ts` covering the review-focus cases:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeShowHandCost } from './cardOverlays'

it('defaults to true for a missing or non-boolean value', () => {
  expect(normalizeShowHandCost(undefined)).toBe(true)
  expect(normalizeShowHandCost(null)).toBe(true)
  expect(normalizeShowHandCost('false')).toBe(true)
  expect(normalizeShowHandCost(0)).toBe(true)
})

it('keeps an explicit false', () => {
  expect(normalizeShowHandCost(false)).toBe(false)
})

it('keeps an explicit true', () => {
  expect(normalizeShowHandCost(true)).toBe(true)
})
```

Add to `web/src/board/HandBar.test.tsx`: a case rendering `HandBar` with `showHandCost={false}` that asserts `container.querySelector('.hand-card-cost')` is null, and one with the default asserting it is present.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `cd web && npx vitest run src/board/cardOverlays.test.ts src/board/HandBar.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Create the normalizers module**

Create `web/src/board/cardOverlays.ts`:

```ts
export function normalizeShowHandCost(value: unknown): boolean {
  return typeof value === 'boolean' ? value : true
}
```

Leave room for Tasks 5 and 6 to append `normalizePtBadgeMode` and `normalizeSicknessStyle` — do not pre-declare them.

- [ ] **Step 4: Thread the field through settings and persistence**

In `web/src/state/persistence.ts`, add `showHandCost?: boolean` to `AppearanceSettings`, `showHandCost: true` to `DEFAULT_APPEARANCE`, import `normalizeShowHandCost`, and include `showHandCost: normalizeShowHandCost(parsed.showHandCost)` in the object `loadAppearanceSettings` returns.

In `web/src/state/slices/settings.ts`, add `showHandCost: boolean` to `SettingsState` and `showHandCost: normalizeShowHandCost(loadAppearanceSettings().showHandCost)` to `initialSettings.settings` (alongside the existing `cardStyle` / `tapStyle` lines).

In `web/src/state/actions.ts`, add `showHandCost` to the `persistClientSettings` destructure and pass it in the `saveAppearanceSettings({...})` call.

- [ ] **Step 5: Make the HandBar condition**

`web/src/board/HandBar.tsx` currently has no settings import. Add `useSettings` from `../state/store`, call it, and wrap the existing `<HandCardCost card={card} pipSize={pipSize} />` at `:206` in `{showHandCost && (...)}`.

- [ ] **Step 6: Add the settings UI**

In `BoardSection` (`web/src/settings/sections.tsx`), add a `Toggle` labelled `t('lobby','hand_cost_show')` bound to `setSetting('showHandCost', next)`, mirroring the existing toggles in that file. Add `hand_cost_show` (and a `hand_cost_show_hint` if the neighbouring controls use hints) under the `lobby` category in all 9 locale files.

- [ ] **Step 7: Run the tests and verify they pass**

Run: `cd web && npx vitest run src/board/cardOverlays.test.ts src/board/HandBar.test.tsx src/state`
Expected: PASS.

- [ ] **Step 8: Report the diff**

`git status --short` and `git diff --stat`. Do not commit.

---

### Task 5: `ptBadgeMode` — hide the P/T badge unless it changed

**Files:**
- Modify: `web/src/board/cardOverlays.ts` (add the normalizer)
- Modify: `web/src/state/persistence.ts` (as Task 4)
- Modify: `web/src/state/slices/settings.ts` (as Task 4)
- Modify: `web/src/state/actions.ts:339-345`
- Modify: `web/src/board/CardSlot.tsx:246` and the `showPt` prop type at `:29-50`
- Modify: `web/src/board/BoardZone.tsx:366`, `:395`, `:417`
- Modify: `web/src/settings/sections.tsx` (`BoardSection`)
- Modify: `web/src/i18n/locales/*.ts` (9 files)
- Test: `web/src/board/cardOverlays.test.ts`, `web/src/board/CardSlot.test.tsx`

**Interfaces:**
- Consumes: `web/src/board/cardOverlays.ts` and the Task 4 persistence pattern.
- Produces: `normalizePtBadgeMode(value: unknown): PtBadgeMode` from `cardOverlays.ts`, and settings field `ptBadgeMode: PtBadgeMode`.

- [ ] **Step 1: Write the failing tests**

Extend `web/src/board/cardOverlays.test.ts`:

```ts
it('falls back to always for a missing or invalid mode', () => {
  expect(normalizePtBadgeMode(undefined)).toBe('always')
  expect(normalizePtBadgeMode('sometimes')).toBe('always')
  expect(normalizePtBadgeMode(7)).toBe('always')
})
it('keeps each valid mode', () => {
  expect(normalizePtBadgeMode('always')).toBe('always')
  expect(normalizePtBadgeMode('changed')).toBe('changed')
  expect(normalizePtBadgeMode('hidden')).toBe('hidden')
})
```

Add to `web/src/board/CardSlot.test.tsx` the truth table — 3 modes × a creature whose `power`/`toughness` match `originalPower`/`originalToughness` vs one that does not — asserting whether `.pt-badge` is present. Include the review-focus case: a card rendered once changed (badge present, `data-trend="changed"`) and then re-rendered at base values (badge absent). Use the file's existing permanent fixture helper; `originalPower` may be a number or an object with `cardValue` (`web/src/board/ptTrend.ts:11-16` handles both).

- [ ] **Step 2: Run the tests and verify they fail**

Run: `cd web && npx vitest run src/board/cardOverlays.test.ts src/board/CardSlot.test.tsx`
Expected: FAIL — the normalizer does not exist and the badge ignores any mode.

- [ ] **Step 3: Add the normalizer**

Append to `web/src/board/cardOverlays.ts`:

```ts
export type PtBadgeMode = 'always' | 'changed' | 'hidden'

export const PT_BADGE_MODES: readonly PtBadgeMode[] = ['always', 'changed', 'hidden']

export function normalizePtBadgeMode(value: unknown): PtBadgeMode {
  return PT_BADGE_MODES.includes(value as PtBadgeMode) ? (value as PtBadgeMode) : 'always'
}
```

- [ ] **Step 4: Thread the field**

Same four files as Task 4 Step 4: `AppearanceSettings` gains `ptBadgeMode?: PtBadgeMode` (default `'always'`), `SettingsState` gains `ptBadgeMode: PtBadgeMode`, `persistClientSettings` gains `ptBadgeMode`, and `CardSlot` reads it via `useSettings()`.

- [ ] **Step 5: Gate the badge**

Replace `web/src/board/CardSlot.tsx:246`:

```ts
const showPtBadge = showPt && isRealCreature && perm.power != null && perm.toughness != null
```

with the same expression plus `ptBadgeMode !== 'hidden'` and, when the mode is `'changed'`, `&& (pt.power !== 'same' || pt.toughness !== 'same')`.

`pt` is already computed at `:227` by `ptTrend(perm)`. The existing `data-trend` attribute and `pt_base` tooltip at `:400-408` need no change — in `'changed'` mode the badge only ever renders when it is `'changed'`.

- [ ] **Step 6: Add the settings UI**

In `BoardSection`, render the `settings-cards` + `Button variant="ghost"` pattern used for `CARD_STYLES` (`web/src/settings/sections.tsx:143-160`) with one card per `PT_BADGE_MODES` entry, `data-testid={`settings-pt-badge-${mode}`}`, labels `t('lobby', `pt_badge_${mode}`)` and descriptions `t('lobby', `pt_badge_${mode}_desc`)`. Add those 6 keys under `lobby` in all 9 locales.

- [ ] **Step 7: Check the compact-tile spacing consequence**

`hasCornerStat` (`web/src/board/CardSlot.tsx:249`) derives from `showPtBadge`, so compact tiles lose the stat corner when P/T is unchanged. Render a compact-style creature at base P/T in `'changed'` mode, screenshot it, **read** the PNG, and confirm the tile does not clip or shift. If it does, adjust the compact CSS in `web/src/board/CardSlot.css:982-989`.

- [ ] **Step 8: Run the tests and verify they pass**

Run: `cd web && npx vitest run src/board/cardOverlays.test.ts src/board/CardSlot.test.tsx src/board`
Expected: PASS.

- [ ] **Step 9: Report the diff**

`git status --short` and `git diff --stat`. Do not commit.

---

### Task 6: `sicknessStyle` — full-card veil instead of the corner clock

**Files:**
- Modify: `web/src/board/cardOverlays.ts` (add the normalizer)
- Modify: `web/src/state/persistence.ts`, `web/src/state/slices/settings.ts`, `web/src/state/actions.ts` (as Task 4)
- Modify: `web/src/board/CardSlot.tsx:226` and `:492-497`
- Modify: `web/src/board/CardSlot.css:490-510`
- Modify: `web/src/settings/sections.tsx` (`BoardSection`)
- Modify: `web/src/i18n/locales/*.ts` (9 files)
- Test: `web/src/board/cardOverlays.test.ts`, `web/src/board/CardSlot.test.tsx`

**Interfaces:**
- Consumes: `web/src/board/cardOverlays.ts` and the Task 4 persistence pattern.
- Produces: `normalizeSicknessStyle(value: unknown): SicknessStyle` from `cardOverlays.ts`, and settings field `sicknessStyle: SicknessStyle`.

- [ ] **Step 1: Write the failing tests**

Extend `cardOverlays.test.ts` with `normalizeSicknessStyle` cases: missing / `'hourglass'` / non-string → `'badge'`; `'badge'` and `'veil'` preserved.

Add to `CardSlot.test.tsx`:

```tsx
it('renders a corner badge by default', () => { /* expect .sickness-badge, not .sickness-veil */ })
it('renders a full-card veil when sicknessStyle is veil', () => { /* expect .sickness-veil
  covering the card box, and not .sickness-badge */ })
it('keeps the indicator hidden on a tapped sick creature in both styles', () => { /* tapped: true,
  summoningSickness: true — expect neither .sickness-badge nor .sickness-veil */ })
```

The third case is review focus #4 — `hasSummoningSickness` at `CardSlot.tsx:226` already requires `!tapped`; the test pins that the new style does not bypass it.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `cd web && npx vitest run src/board/cardOverlays.test.ts src/board/CardSlot.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Add the normalizer**

Append to `cardOverlays.ts`:

```ts
export type SicknessStyle = 'badge' | 'veil'

export const SICKNESS_STYLES: readonly SicknessStyle[] = ['badge', 'veil']

export function normalizeSicknessStyle(value: unknown): SicknessStyle {
  return SICKNESS_STYLES.includes(value as SicknessStyle) ? (value as SicknessStyle) : 'badge'
}
```

- [ ] **Step 4: Thread the field**

Same four files as Task 4 Step 4, with `sicknessStyle?: SicknessStyle` defaulting to `'badge'`.

- [ ] **Step 5: Render the veil**

In `CardSlot.tsx`, keep `hasSummoningSickness` (`:226`) exactly as it is. Change the render at `:492-497` so that `'badge'` keeps today's `.sickness-badge` markup and `'veil'` renders a sibling layer inside the same card box: `className="sickness-veil"`, `aria-hidden`, containing an `<Icon name="timer" />` at a large size. It must be `pointer-events: none` so the card stays draggable, clickable and targetable — the drag and targeting handlers are on the card, not on the badge.

- [ ] **Step 6: Style the veil**

Add `.sickness-veil` to `web/src/board/CardSlot.css`: absolutely positioned to fill the card, a translucent wash using an existing token (`--shade-*` / `--veil-*`), a large centred `Icon`, and the existing `sicknessFloat` keyframes so it animates like the badge. Honor the existing `prefers-reduced-motion` block at `:200-206`. Add a compact-style override in the `:1003` neighbourhood.

- [ ] **Step 7: Screenshot both styles and read the PNGs**

In fake mode, render a battlefield creature with `summoningSickness: true` untapped, once per style, at 1920×1080. Read both PNGs. Confirm the veil covers the whole card, does not hide the P/T badge or counters, and does not block the card's click target (click it and confirm the normal action fires). Also confirm the compact tile still fits its band.

- [ ] **Step 8: Add the settings UI and i18n**

In `BoardSection`, render the `settings-cards` + `Button variant="ghost"` pattern with one card per `SICKNESS_STYLES` entry, `data-testid={`settings-sickness-style-${style}`}`. Add `sickness_style_title`, `sickness_style_hint`, `sickness_style_badge`, `sickness_style_badge_desc`, `sickness_style_veil`, `sickness_style_veil_desc` under `lobby` in all 9 locales.

- [ ] **Step 9: Run the tests and verify they pass**

Run: `cd web && npx vitest run src/board/cardOverlays.test.ts src/board/CardSlot.test.tsx src/board src/ui/styleTokens.test.ts src/ui/cssIntegrity.test.ts`
Expected: PASS.

- [ ] **Step 10: Report the diff**

`git status --short` and `git diff --stat`. Do not commit.

---

### Task 7: `prioritySound` — stop the per-phase ding

**Files:**
- Create: `web/src/audio/prioritySound.ts`
- Modify: `web/src/state/persistence.ts` (`AudioSettings`, `DEFAULT_AUDIO_SETTINGS`, `loadAudioSettings`, `saveAudioSettings` — `:516-546`)
- Modify: `web/src/state/slices/settings.ts:11-40`
- Modify: `web/src/state/actions.ts:339-345` (`saveAudioSettings` call)
- Modify: `web/src/audio/gameSoundDispatcher.ts:11-13` and the signature
- Modify: `web/src/state/eventHandler.ts:162` (the call site)
- Modify: `web/src/settings/SoundFxControls.tsx`
- Modify: `web/src/i18n/locales/*.ts` (9 files)
- Test: `web/src/audio/gameSoundDispatcher.test.ts` (new if absent), `web/src/audio/prioritySound.test.ts` (new)
- Test: `web/e2e/board-overlays.spec.ts` (new) — the `@board` toggle case covering Tasks 4-6

**Interfaces:**
- Consumes: nothing from Tasks 4-6 (independent), but Task 7's E2E case asserts all three appearance flags, so run it after them.
- Produces: `dispatchGameSounds(prevGame: GameView | null, nextGame: GameView | null, method: string | undefined, prioritySound: PrioritySoundMode): void` — the mode is a **required** parameter, not a store read.

Context: `prompt_open` is **not** the repeated ding. `web/src/audio/promptSound.ts` dedupes by signature, so an identical prompt is silent. The ding is `gameSoundDispatcher.ts:11-13`, which fires on *every* `GAME_SELECT`, i.e. every phase. Lines 20-22 already implement the useful semantic.

- [ ] **Step 1: Write the failing tests**

Create `web/src/audio/prioritySound.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizePrioritySound } from './prioritySound'

it('defaults to every-prompt', () => {
  expect(normalizePrioritySound(undefined)).toBe('every-prompt')
  expect(normalizePrioritySound('nope')).toBe('every-prompt')
})
it('keeps each valid mode', () => {
  expect(normalizePrioritySound('every-prompt')).toBe('every-prompt')
  expect(normalizePrioritySound('on-gain')).toBe('on-gain')
  expect(normalizePrioritySound('off')).toBe('off')
})
```

Create or extend `web/src/audio/gameSoundDispatcher.test.ts` (it does not exist yet) with a spy on `soundManager.play`, calling `dispatchGameSounds` with a minimal `GameView` pair and a `method`, once per mode, asserting the number of `priority` plays: a phase change (`method: 'GAME_SELECT'`, same player holding priority before and after) → 1 / 0 / 0; a priority gain (`method: 'GAME_UPDATE'`, `hasPriority` false → true) → 1 / 1 / 0. `web/src/audio/promptSound.test.ts:38` already pins that `prompt_open` sounds once per signature, so do not add a duplicate — run it as a regression check instead.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `cd web && npx vitest run src/audio/prioritySound.test.ts src/audio/gameSoundDispatcher.test.ts`
Expected: FAIL — the module and the parameter do not exist.

- [ ] **Step 3: Create the mode module and thread the field**

Create `web/src/audio/prioritySound.ts`:

```ts
export type PrioritySoundMode = 'every-prompt' | 'on-gain' | 'off'

export const PRIORITY_SOUND_MODES: readonly PrioritySoundMode[] = ['every-prompt', 'on-gain', 'off']

export function normalizePrioritySound(value: unknown): PrioritySoundMode {
  return PRIORITY_SOUND_MODES.includes(value as PrioritySoundMode) ? (value as PrioritySoundMode) : 'every-prompt'
}
```

Add `prioritySound: PrioritySoundMode` to `AudioSettings` (required, not optional — unlike the appearance flags, this concern has no legacy blobs), `every-prompt` to `DEFAULT_AUDIO_SETTINGS`, `normalizePrioritySound(parsed.prioritySound)` to the object `loadAudioSettings` returns, and `prioritySound: normalizePrioritySound(value)` to the `saveAudioSettings` write path. Because `initialSettings` spreads `...loadAudioSettings()`, add the matching `SettingsState` field and pass `prioritySound` in `persistClientSettings`'s `saveAudioSettings({...})` call.

- [ ] **Step 4: Gate the dispatcher**

Change the signature to take `prioritySound: PrioritySoundMode` as its fourth parameter. At `:11-13`, wrap the `GAME_SELECT` play in a check that the mode is `'every-prompt'`. At `:20-22`, require the mode to be `'every-prompt'` or `'on-gain'`. Update the call site at `web/src/state/eventHandler.ts:162` to pass the current setting's `prioritySound`.

- [ ] **Step 5: Add the settings UI**

In `web/src/settings/SoundFxControls.tsx`, add a `fx-popover-row` with a `Tabs variant="segmented"` bound to `setSetting('prioritySound', id)`, built from `PRIORITY_SOUND_MODES`, mirroring the `FX_SPEEDS` control at `:22-33`. Label it `t('game','sound_priority_mode')` with a hint row `sound_priority_mode_hint`. Add the four keys (`sound_priority_mode`, `sound_priority_mode_hint`, `sound_priority_every`, `sound_priority_on_gain`, `sound_priority_off`) under the `game` category in all 9 locales — note this file uses the `game` category, not `lobby`.

- [ ] **Step 6: Run the tests and verify they pass**

Run: `cd web && npx vitest run src/audio src/state`
Expected: PASS.

- [ ] **Step 7: Add the `@board` E2E case**

Create `web/e2e/board-overlays.spec.ts`, tagged `@board`, running in fake mode. Start a game from the existing support helpers (`web/e2e/support/start-game.ts`), then assert through `window.__mageScene` and the DOM that with defaults on: `.hand-card-cost` is present and `.pt-badge` is present on a battlefield creature. Then set `ptBadgeMode` to `'hidden'` and `showHandCost` to `false` through the app's settings surface (drive the real settings UI, not a store poke) and assert both are gone. Follow the conventions in `web/e2e/support/` and register the tag in the package scripts only if you also add a `test:e2e:board` script — otherwise reuse `test:e2e`.

- [ ] **Step 8: Verify the residual risk from the spec**

The spec flags that if the server's prompt **title** varies by phase, `prompt_open` still fires and the ding survives. Confirm with the stack up: `node scripts/ctl.mjs restart all`, then `node scripts/test.mjs self-test`, and watch `.run/proxy.out.log` plus the browser console for `prompt_open` across a phase change. Report what you observed. **Do not** change `promptSound.ts` on the strength of a guess — if the ding survives, report it as a follow-up.

- [ ] **Step 9: Report the diff**

`git status --short` and `git diff --stat`. Do not commit.

---

### Task 8: Bookkeeping — docs and the issue

**Files:**
- Modify: `site/content.json` (feature-parity rows for the Create-Table wizard and import/export)
- Modify: `ROADMAP.md` §4 pending work
- Create: `.github/ISSUE_TEMPLATE/feedback.md`
- Modify: `.github/ISSUE_TEMPLATE/` config if a chooser file exists
- Test: none

**Interfaces:**
- Consumes: nothing.
- Produces: nothing.

- [ ] **Step 1: Add the issue template and the label**

Create `.github/ISSUE_TEMPLATE/feedback.md` asking what the user was doing, what they expected, browser + zoom level, and a screenshot — explicitly for non-bug feedback. Register it in `.github/ISSUE_TEMPLATE/config.yml` if that file lists templates. Then create the label: `gh label create feedback --color 0e8a16 --description "General feedback, not a bug"`.

- [ ] **Step 2: Update the dashboard content**

In `site/content.json`, update the Create-Table wizard row and the import/export row to mention: the dialog no longer clips, an Edit deck action exists on the Seats step, the file picker is the primary import source, and the format select reports the detected format. Match the file's existing row shape exactly.

- [ ] **Step 3: Update the roadmap**

In `ROADMAP.md`, remove any pending-work line this plan closes and add a line for the Wave C follow-up: always-visible card text (issue items 5 and 6) and clearer turn indication (item 2) still open, pending a design decision.

- [ ] **Step 4: Run the dashboard generator to confirm it still builds**

Run: `node scripts/gen-dashboard.mjs`
Expected: exit 0 and no error about unknown keys. If the generator writes into `site/status.json`, do not commit that output — it is generated per CI run.

- [ ] **Step 5: Run the full gate**

Run: `node scripts/test.mjs unit typecheck build i18n`
Expected: all four layers pass.

Then: `cd web && npx playwright test gallery.spec.ts board-overlays.spec.ts`
Expected: PASS in fake mode, no stack required.

Then, with the stack up (`node scripts/ctl.mjs restart all`): `node scripts/test.mjs`
Expected: all layers pass. Per `AGENTS.md`, restart the stack immediately before this run — a long-lived server degrades the callback channel and produces misleading flakes.

- [ ] **Step 6: Comment on issue #12 and report**

Post a comment on issue #12 listing which of the 11 items Wave A+B closed (1, 3, 4, 7, 8, 9, 10, 11), where each setting lives, and that 2, 5 and 6 are open pending a design decision. Then report the overall diff to the user with `git status --short` and `git diff --stat`. Do not commit.