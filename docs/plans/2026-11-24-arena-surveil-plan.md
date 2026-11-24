# Arena surveil and scry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A surveil or scry of your own opens one Arena-style overlay where the player drags cards between two fanned boxes; Done answers the engine's whole chain of prompts without showing any of them.

**Architecture:** Detection flags each prompt of the chain (`libraryStep` on `FeedbackPrompt`). A pure plan module turns the on-screen arrangement into the one answer for each prompt it meets. The store holds the running plan and the prompt handlers consult it before showing anything; the overlay (built from the gallery mockup, split into reusable fan/drag/shell pieces) renders the first prompt and stays in a "sending" state while the plan runs.

**Tech Stack:** React 19, TypeScript, Vite, vitest, Playwright (FakeServer), Node recorder scripts.

**Spec:** `docs/plans/2026-11-24-arena-surveil-design.md` (approved 2026-11-24). Reference mockup: `web/src/dev/ArenaSurveilMock.tsx` + `.css` (commit `b7263bc50e`).

## Global Constraints

- English only in code, tests, docs and commit messages; user-facing strings go through `web/src/i18n/locales/*` (all nine: de, en, es, fr, it, ja, pt, ru, zhs).
- No comments in code. Shipped CSS uses tokens from `web/src/ui/tokens.css` only: the new stylesheets get no `styleBaseline.json` entry (`src/ui/styleTokens.test.ts`); every `font-family` stack that names a system font includes `'Twemoji Country Flags'` (APR-4); every `backdrop-filter` has a `prefers-reduced-transparency` fallback (ACC-1).
- The overlay renders through `web/src/ui/Modal.tsx` (DLG-1…5): no Escape close (the prompt is required), no backdrop close, focus trapped, Alt peek works.
- One answer per prompt (PRM-17). Answers: pick = `cmds.sendPlayerUUID(id, gameId)`; Done = `cmds.sendPlayerBoolean(false, gameId)`; yes = `cmds.sendPlayerBoolean(true, gameId)`.
- Never answer a prompt the plan does not recognise; it is shown with the regular UI.
- Position semantics: library box leftmost = top of library; graveyard box rightmost = top of graveyard; bottom box (scry) rightmost = bottommost.
- After touching `web/`: `npm run test`, `npm run typecheck`, `npm run lint`; before done, the related e2e specs by name and the full fake e2e (this plan touches `fixtures/`).
- Commit only when the user asks; each task's "Commit" step is a checkpoint to offer.

## Review Focus

- A surveil/scry of **one** card: no order prompts at all; Done with the card in either box ends the chain after the pick step. → Task 2 test `PRM-18: a single card ends the chain at the pick step`.
- A prompt **unrelated to the plan arriving mid-chain** (a trigger's target, a GAME_ASK from a replacement effect): shown normally, plan dropped, nothing sent for it. → Task 3 test `PRM-18: a foreign prompt mid-chain is shown and ends the plan`.
- The engine **auto-picking** (a step skipped, `chosenTargets` already holding a card): the plan answers from what arrives, not from a step counter. → Task 2 test `PRM-18: the pick step reads chosenTargets, not a counter`.
- An **opponent's** surveil/scry or a spectator: no overlay, no plan (the cards are not yours to arrange). → Task 1 test `flags libraryStep only for the controlled player's library cards`.
- **Reconnect or game change while a plan runs**: the plan never answers a prompt of another game. → Task 3 test `PRM-18: a plan never answers a prompt of another game`.

---

### Task 1: Detect every prompt of the chain

**Files:**
- Modify: `web/src/game/feedback/detect.ts` (`isLibraryOrderPick`, new `libraryChainStep`)
- Modify: `web/src/game/feedback/types.ts` (new `LibraryStep` type, `libraryStep?` on `FeedbackPrompt`)
- Modify: `web/src/game/feedback/parse.ts` (`GAME_TARGET` and `GAME_ASK` cases set `libraryStep`)
- Test: `web/src/game/feedback/detect.libraryChain.test.ts`

**Interfaces:**
- Produces: `export type LibraryStep = 'surveil-pick' | 'scry-pick' | 'top-order' | 'bottom-order' | 'grave-order' | 'grave-order-ask'`; `export function libraryChainStep(message: string): LibraryStep | null` in `detect.ts`; `FeedbackPrompt.libraryStep?: LibraryStep`.

- [ ] **Step 1: Write the failing tests** — one `it` per engine message (HTML stripped, case-insensitive), using the exact fork texts:
  - `'Select card(s) to PUT into your GRAVEYARD (Surveil)'` → `'surveil-pick'`
  - `'Select up to 3 cards to PUT on the BOTTOM of your library (Scry)'` → `'scry-pick'`
  - `'Select a card ORDER to put on the TOP of your library (last one chosen will be topmost)'` → `'top-order'`
  - `'Select a card ORDER to put on the BOTTOM of your library (last one chosen will be bottommost)'` → `'bottom-order'`
  - `'Select a card to put on the top of your graveyard (last one chosen will be topmost)'` → `'grave-order'`
  - `'Choose the order in which the cards go to the graveyard?'` → `'grave-order-ask'`
  - `'Select a card to discard'` → `null`
  - `isLibraryOrderPick` now also true for the bottommost message.
  - `flags libraryStep only for the controlled player's library cards`: `parseFeedback('GAME_TARGET', …)` with the surveil message sets `libraryStep: 'surveil-pick'`; the same message with `cardsView1` empty leaves it unset.
- [ ] **Step 2: Run** `npx vitest run src/game/feedback/detect.libraryChain.test.ts` — FAIL (`libraryChainStep` not exported).
- [ ] **Step 3: Implement** `libraryChainStep` as an ordered list of regexes over the stripped message; widen `isLibraryOrderPick` to `(topmost|bottommost)`; in `parse.ts` set `fp.libraryStep` for `GAME_TARGET` when the prompt has cards, and for `GAME_ASK` when the step is `'grave-order-ask'`. The pick prompts keep `mode: 'uuid'`.
- [ ] **Step 4: Run** the new test and `npx vitest run src/game/feedback` — PASS.
- [ ] **Step 5: Commit** — `Library prompts of a surveil or scry carry their step in the chain`.

### Task 2: The plan answers each prompt from the arrangement (PRM-18)

**Files:**
- Create: `web/src/game/feedback/libraryPlan.ts`
- Test: `web/src/game/feedback/libraryPlan.test.ts`
- Modify: `docs/specs/prompts.md` (new rule PRM-18)

**Interfaces:**
- Consumes: `LibraryStep`, `FeedbackPrompt.libraryStep`, `FeedbackPrompt.chosenTargets`, `FeedbackPrompt.options[].id` (Task 1).
- Produces:
  ```ts
  export interface LibraryArrangement { mode: 'surveil' | 'scry'; top: string[]; away: string[] }
  export interface LibraryPlan extends LibraryArrangement { gameId: string; cardIds: string[]; settled: boolean }
  export type PlanAnswer = { kind: 'uuid'; value: string } | { kind: 'boolean'; value: boolean }
  export function createLibraryPlan(gameId: string, cardIds: string[], arrangement: LibraryArrangement): LibraryPlan
  export function nextPlanAnswer(plan: LibraryPlan, prompt: FeedbackPrompt): { answer: PlanAnswer; plan: LibraryPlan } | null
  ```

- [ ] **Step 1: Add PRM-18 to `docs/specs/prompts.md`** — "Surveil and scry are one screen; the client answers the engine's chain from it": the overlay decides both boxes and their order by position (the semantics in Global Constraints); Done answers each prompt of the chain as it arrives, one answer per prompt; a prompt the plan does not recognise is shown normally and ends the plan. Why: XMage asks one Arena decision as a pick plus one order pick per card (design doc). Guard: `src/game/feedback/libraryPlan.test.ts` · `src/state/events/prompts.libraryPlan.test.ts` · `e2e/arena-surveil.spec.ts`.
- [ ] **Step 2: Write the failing tests**, each titled `PRM-18: …`, with cards `a b c`:
  - surveil, `away=['b','c']`, pick prompt with `chosenTargets=[]` → `{uuid:'b'}`; with `['b']` → `{uuid:'c'}`; with `['b','c']` → `{boolean:false}`.
  - `the pick step reads chosenTargets, not a counter`: first call with `chosenTargets=['c']` → `{uuid:'b'}`.
  - pick prompt whose `chosenTargets` holds `'a'` (not in `away`) → `null`.
  - top order, `top=['a','b','c']` (a on top): offered `a b c` → `{uuid:'c'}`; offered `a b` → `{uuid:'b'}`; offered with an id outside `top` → `null`.
  - bottom order (scry), `away=['b','c']` (c bottommost): offered `b c` → `{uuid:'b'}`.
  - grave order, `away=['b','c']` (c on top of the graveyard): offered `b c` → `{uuid:'b'}`; `grave-order-ask` → `{boolean:true}`; `grave-order-ask` with `away.length < 2` → `null`.
  - `a single card ends the chain at the pick step`: one card, after its Done (or pick that completes) `plan.settled === true`.
  - scry `top=['a']`, `away=['b','c']`: after the bottom-order pick with two offered, `plan.settled === true`; surveil `top=['a']`, `away=['b','c']`: after Done, `plan.settled === false`.
  - top order with two offered → the returned `plan.settled === true` (the leftover card is placed by the engine).
  - a prompt with no `libraryStep`, or a `scry-pick` against a surveil plan → `null`; a prompt whose `gameId` differs from `plan.gameId` → `null`.
- [ ] **Step 3: Run** `npx vitest run src/game/feedback/libraryPlan.test.ts` — FAIL.
- [ ] **Step 4: Implement** `libraryPlan.ts`. Order picks answer the first id of the relevant list that the prompt offers: `[...top].reverse()` for `top-order`, `away` for `bottom-order` and `grave-order`; every offered id must belong to that list, else `null`. `settled` means no further prompt of the chain can arrive: true after the last top-order pick (two offered); when `top.length < 2`, true after the last bottom-order pick for a scry with `away.length >= 2`, and after the pick step's final answer when `away.length < 2`. A surveil with `away.length >= 2` and `top.length < 2` never settles by itself (the graveyard-order ask depends on a server preference): the next foreign prompt or the idle timer ends it.
- [ ] **Step 5: Run** the test and `npx vitest run src/specCoverage.test.ts` — PASS.
- [ ] **Step 6: Commit** — `A surveil or scry plan answers each prompt of the engine's chain`.

### Task 3: The store runs the plan and hides the chain

**Files:**
- Modify: `web/src/state/slices/game.ts` (`libraryPlan: LibraryPlan | null`, default `null`)
- Create: `web/src/state/libraryPlanRunner.ts`
- Modify: `web/src/state/events/prompts.ts` (`handleGameTarget`, `handleGameAsk` consult the plan first)
- Modify: `web/src/state/eventHandler.ts` (end the plan on foreign prompts)
- Test: `web/src/state/events/prompts.libraryPlan.test.ts`

**Interfaces:**
- Consumes: `createLibraryPlan`, `nextPlanAnswer`, `LibraryArrangement` (Task 2).
- Produces:
  ```ts
  export function startLibraryPlan(prompt: FeedbackPrompt, arrangement: LibraryArrangement): void
  export function answerFromLibraryPlan(feedback: FeedbackPrompt): boolean
  export function endLibraryPlan(): void
  export const LIBRARY_PLAN_IDLE_MS = 5000
  ```
  `startLibraryPlan` creates the plan from the open pick prompt, sets `feedback: null`, and answers that prompt through `answerFromLibraryPlan`. `answerFromLibraryPlan` returns `true` when it sent an answer (caller must not show the prompt) and `false` after ending the plan otherwise. `endLibraryPlan` clears `libraryPlan`.

- [ ] **Step 1: Write the failing tests** (mock `net/commands` as `prompts.autoAnswers.test.ts` does), titled `PRM-18: …`:
  - `startLibraryPlan` on a surveil pick with `away=['b']` sends `sendPlayerUUID('b', 'g1')`, leaves `feedback` null and `libraryPlan` set.
  - the re-asked pick (`chosenTargets=['b']`) arriving through `handleGameTarget` sends `sendPlayerBoolean(false, 'g1')` and leaves `feedback` null.
  - `a foreign prompt mid-chain is shown and ends the plan`: a `handleGameTarget` with `'Select target creature'` sends nothing, sets `feedback`, clears `libraryPlan`.
  - `a plan never answers a prompt of another game`: a matching prompt with `objectId 'g2'` is shown and the plan ends.
  - a `GAME_SELECT` through `handleEvent` ends the plan.
  - with fake timers, no prompt for `LIBRARY_PLAN_IDLE_MS` ends the plan; a settled plan ends right after its last answer.
  - the grave-order `GAME_ASK` is answered by the plan before the auto-answer rules are consulted.
- [ ] **Step 2: Run** `npx vitest run src/state/events/prompts.libraryPlan.test.ts` — FAIL.
- [ ] **Step 3: Implement** the runner and wire it: at the top of `handleGameTarget` and `handleGameAsk`, after `parseFeedback`, `if (getState().libraryPlan && answerFromLibraryPlan(feedback)) return`. In `eventHandler.ts`, before dispatch, end the plan for any method matching `/^GAME_(SELECT|PLAY_|CHOOSE_|GET_|TARGET_AMOUNT|OVER)/`. The idle timer restarts on every answer.
- [ ] **Step 4: Run** the test, `npx vitest run src/state` and `npx vitest run src/state/callbackCoverage.test.ts` — PASS.
- [ ] **Step 5: Commit** — `The store answers a surveil or scry chain from the player's plan`.

### Task 4: Reusable Arena overlay pieces

**Files:**
- Create: `web/src/game/arena/ArenaPromptShell.tsx` + `ArenaPromptShell.css`
- Create: `web/src/game/arena/ArenaFan.tsx` + `ArenaFan.css`
- Create: `web/src/game/arena/useFanDrag.ts`
- Test: `web/src/game/arena/ArenaFan.test.tsx`, `web/src/game/arena/useFanDrag.test.ts`

**Interfaces:**
- Produces:
  ```ts
  ArenaPromptShell(props: { title: string; instruction: string; aside?: ReactNode; children: ReactNode; footer: ReactNode; testId: string }): JSX.Element
  ArenaFan(props: { zoneId: string; cards: CardView[]; leadingBack?: CardView; gapIndex: number | null; dealing: boolean; onCardPointerDown: (e: PointerEvent, id: string) => void; laneRef: (el: HTMLDivElement | null) => void }): JSX.Element
  export function fanIndexAt(x: number, lane: DOMRect, cardW: number, count: number, leading: boolean): number
  export function useFanDrag(opts: { zones: string[]; canDrag: boolean; onDrop: (id: string, zone: string, index: number) => void; onClick: (id: string, from: string) => void }): { drag: { id: string; from: string; started: boolean } | null; hover: { zone: string; index: number } | null; bindRoot: { ref: RefObject<HTMLDivElement>; onPointerMove; onPointerUp; onPointerCancel; onLostPointerCapture }; startDrag: (e: PointerEvent, id: string, from: string) => void; dragLayer: (card: CardView | null) => ReactNode }
  ```
  Port the mockup behaviour unchanged: `zoneFan.ts` geometry (`FAN_SLICE`, `FAN_STEP_DEG`, `fanRadius`), the hover clone with `pointer-events: none`, the pointer-locked drag with velocity tilt, root pointer capture, drop without a landing animation, click with a 360 ms flight, a fresh `CardSlot` `cardId` per move (`arena:<zone>:<id>:<version>`). The shell renders through `Modal` with the mockup's layout (title + rule + instruction, View Battlefield held to peek, three columns, footer under the centre).

- [ ] **Step 1: Write the failing tests**: `fanIndexAt` maps the pointer at the lane centre of a 3-card fan to index 1, at the far left to 0, at the far right to 3 (insert after the last), and accounts for a leading back; `ArenaFan` renders one `[data-arena-card]` per card with a `rotate` that grows from left to right and a leading back that takes no pointer events; hovering a card adds `is-lifted` to it and appends one `.arena-lift` clone, hovering the next card moves both.
- [ ] **Step 2: Run** `npx vitest run src/game/arena` — FAIL.
- [ ] **Step 3: Implement** the three modules from the mockup, CSS on tokens only.
- [ ] **Step 4: Run** `npx vitest run src/game/arena src/ui/styleTokens.test.ts src/system/flagFontStacks.test.ts src/a11yStyle.test.ts` — PASS.
- [ ] **Step 5: Commit** — `Arena prompts share an overlay shell, a fanned zone and a drag engine`.

### Task 5: The surveil/scry overlay

**Files:**
- Create: `web/src/game/ArenaLibraryPrompt.tsx` + `ArenaLibraryPrompt.css`
- Modify: `web/src/game/FeedbackDialog.tsx` (route `surveil-pick` / `scry-pick` before the `CardGrid` branch; keep the overlay mounted while `libraryPlan` is set)
- Modify: `web/src/i18n/locales/*.ts` (keys below)
- Test: `web/src/game/ArenaLibraryPrompt.test.tsx`

**Interfaces:**
- Consumes: `ArenaPromptShell`, `ArenaFan`, `useFanDrag` (Task 4); `startLibraryPlan`, `LibraryArrangement` (Task 3); `prompt.cards`, `prompt.sourceName`.
- Produces: `ArenaLibraryPrompt(props: { prompt: FeedbackPrompt; sending: boolean }): JSX.Element`, test id `arena-library-prompt`, Done test id `arena-library-done`.
- i18n keys in `dialogs`: `arena_surveil_title` "Surveil", `arena_scry_title` "Scry", `arena_surveil_hint` "Drag cards to put them on the top of your library or into your graveyard.", `arena_scry_hint` "Drag cards to put them on the top or the bottom of your library.", `arena_zone_library` "Library", `arena_zone_top` "Top of Library", `arena_zone_graveyard` "Graveyard", `arena_zone_bottom` "Bottom of Library", `arena_done` "Done", `arena_sending` "Sending…", `arena_view_battlefield` "View Battlefield".

- [ ] **Step 1: Write the failing tests** (titles `PRM-18: …` where they pin the rule): all prompt cards start in the library box in prompt order with the deck back first; clicking a card moves it to the other box; Done calls `startLibraryPlan` with `{ mode, top, away }` read left to right; while `sending` the cards take no pointer events and Done shows `arena_sending` and is disabled; a scry prompt labels the boxes Top/Bottom of Library.
- [ ] **Step 2: Run** `npx vitest run src/game/ArenaLibraryPrompt.test.tsx` — FAIL.
- [ ] **Step 3: Implement** and route it in `FeedbackDialog`; the source card shown on the right is built from `prompt.sourceName` (name-only `CardView`, as `promptCardPreview` does).
- [ ] **Step 4: Run** the test, `npx vitest run src/game src/i18n` and `node ../scripts/test.mjs i18n` — PASS.
- [ ] **Step 5: Commit** — `A surveil or scry opens the Arena overlay and Done answers the whole chain`.

### Task 6: Gallery shows the real overlay; the mockup goes

**Files:**
- Modify: `web/src/dev/galleryFixtures.ts` (entries `arena:surveil`, `arena:scry` become prompt entries with `feedback` carrying `libraryStep`), `web/src/dev/galleryFixtures.test.ts`, `web/src/dev/GalleryScreen.tsx`
- Delete: `web/src/dev/ArenaSurveilMock.tsx`, `web/src/dev/ArenaSurveilMock.css`; remove `dev/ArenaSurveilMock.css` from `web/src/ui/styleBaseline.json`

- [ ] **Step 1: Update** the entries (group `Prompts`, labels `Surveil 3 (Arena)`, `Scry 4 (Arena)`), drop the `arena-surveil`/`arena-scry` screens and the `Arena prompts (mockup)` group from the test's group list.
- [ ] **Step 2: Run** `npx vitest run src/dev src/ui/styleTokens.test.ts` and `npx playwright test e2e/gallery.spec.ts` — PASS; screenshot both entries at 1600×900 and compare with the mockup's layout.
- [ ] **Step 3: Commit** — `The gallery shows the real surveil and scry overlay instead of the mockup`.

### Task 7: The chain end to end against the FakeServer

**Files:**
- Create: `web/fixtures/scenarios/arenaSurveil.ts` (+ `TABLE.arenaSurveil` in `web/fixtures/table-names.ts`)
- Create: `web/e2e/arena-surveil.spec.ts` (tag `@prompts`)

**Interfaces:**
- Consumes: `makeBaseScenario` (`onStartMatch`, `onSendPlayerUUID`, `onSendPlayerBoolean`), `quickStartGame`, `withFakeServer`.
- Produces: `arenaSurveilScenario(variant: 'surveil' | 'scry' | 'foreign'): Scenario` that replays the engine's chain: the pick prompt re-sent with growing `chosenTargets` per UUID, Done ends it, then the order picks (one fewer offered each time), then `GAME_SELECT` priority. It records every answer for the spec to read (exposed over the scenario's state the way other scenarios expose theirs).

- [ ] **Step 1: Write the spec**, three tests titled `PRM-18: …`: surveil 3, drag one card to the graveyard and reorder the other two, Done → the recorded answers are `[uuid card, false, uuid deepest]` and no other prompt UI ever became visible (`.feedback-dialog`, `.card-grid` stay hidden throughout); scry 3 with two to the bottom → the bottom-order answer precedes the top-order one; `foreign` variant sends an unrelated `GAME_TARGET` after the pick → it is shown with the regular UI and no answer is sent for it. `expect(pageErrors).toEqual([])` in each.
- [ ] **Step 2: Run** `npx playwright test e2e/arena-surveil.spec.ts` — FAIL until the scenario exists; then PASS.
- [ ] **Step 3: Run** the full fake e2e: `node ../scripts/test.mjs e2e` — PASS.
- [ ] **Step 4: Commit** — `The surveil and scry chain is answered end to end against the fake server`.

### Task 8: Real prompt texts recorded from the engine (anti-drift)

**Files:**
- Modify: `scripts/rec-lib.mjs` (driver option `promptsOutFile`: append each `GAME_TARGET`/`GAME_ASK` payload, without `gameView`, to `web/fixtures/recorded/prompts/<file>`)
- Modify: `scripts/record.mjs` (drivers `surveil-chain`: cheatSetup `Discovery // Dispersal` with two Islands, keep both on top so the top-order pick is asked; `scry-chain`: `Preordain`, both to the bottom so the bottom-order pick is asked. If cheatSetup cannot resolve the split name, use `Notion Rain` with Island, Island, Swamp)
- Create: `web/fixtures/recorded/prompts/surveil-chain.json`, `scry-chain.json` (recorded)
- Test: `web/fixtures/recordedPrompts.test.ts`

- [ ] **Step 1: Record** with the stack up: `node scripts/ctl.mjs restart all`, then `node scripts/record.mjs surveil-chain` and `node scripts/record.mjs scry-chain`.
- [ ] **Step 2: Write the test**: every recorded prompt parses with `parseFeedback` and gets the expected `libraryStep` in recorded order (`surveil-pick…`, `top-order`; `scry-pick…`, `bottom-order`).
- [ ] **Step 3: Run** `npx vitest run fixtures/recordedPrompts.test.ts` — PASS (a FAIL here means Task 1's regexes miss the real text: fix them, not the fixture).
- [ ] **Step 4: Commit** — `Surveil and scry prompt texts are recorded from the engine and checked`.

### Task 9: Coverage docs

**Files:**
- Modify: `web/INTERACTION_COVERAGE.md` (rows for the surveil pick, scry pick, top/bottom/graveyard order picks and the graveyard-order ask: implemented + tested, test refs, 2026-11-24)
- Modify: `ROADMAP.md` §4 (the Arena prompt overlays: surveil/scry done; next prompts listed), `site/content.json` if the feature matrix lists prompt dialogs

- [ ] **Step 1: Update** the three files.
- [ ] **Step 2: Run** `npx vitest run src/state/callbackCoverage.test.ts src/specCoverage.test.ts`, `npm run typecheck`, `npm run lint`, `npm run test` — PASS.
- [ ] **Step 3: Commit** — `Coverage and roadmap record the Arena surveil and scry overlay`.
