# P5.2 — Live heuristic evaluation (evaluator 3 of 3, 2026-09-29)

> Third pass of `plan4.md` §5.2 ("2–3 independent evaluators walk every screen
> of §4 with Nielsen's 10 heuristics + game heuristics"). Passes 1–2
> (`p5-2-heuristic-findings.md`, `...-eval2.md`) were static: gallery
> baselines + source reading. This pass was run **live** against the local
> stack, which is where keyboard and pointer behaviour can actually be
> observed — and it found two real input-path bugs the static passes could
> not see. Severity 0–4 per finding; 3–4 block.

## Method

- **Stack**: XMage server 17171 (testMode), proxy WS 8787, Vite 5173
  (`node scripts/ctl.mjs status`, all RUNNING), driven with the Playwright MCP
  (`browser_*`) against `http://localhost:5173`.
- **Screens visited live**: lobby (empty), create-table wizard (5 steps,
  1366×768 and 1600×900), staging vs SIM, 1v1 game (mulligan decision,
  hand-pick discard on cleanup, game menu, concede confirmation, game end over
  the lobby), Settings (language/interface sections), About, keyboard focus
  walk in the lobby.
- **Techniques**: screenshots read as images (`.run/playwright-mcp/audit-*.png`);
  geometry with `getBoundingClientRect` / `elementFromPoint`; a dispatched
  `KeyboardEvent` to separate "no listener" from "listener gated"; module state
  by dynamically importing the Vite module in the page
  (`import('/src/ui/Modal.tsx')` → `__modalAllocator.active`).
- **Profile caveats (not bugs)**: the audit browser carried settings persisted
  by previous sessions — auto-pass on (my turns played themselves) and
  *transparent dialogs* on. Both are product settings; noted where they change
  how a screenshot reads.
- **Not covered**: draft / construct / tournament live (unchanged since passes
  1–2, where their baselines were reviewed); opponent view (what the rival sees
  of you), still pending in the §5.2 remit.

## Findings

### F1 — **[S2] Escape did not close almost any dialog** (fixed)

Reproduced live with Settings and Create Table open: `Escape` did nothing;
About closed because it adds `useEscape` itself. A dispatched
`KeyboardEvent('keydown', {key:'Escape'})` on `window` left
`defaultPrevented: false`, so no `Modal` escape listener acted.

Root cause (not a z-stack leak): I verified `__modalAllocator.active = {503}`
and `isTopmostModal(503) === true`. `DialogShell` wires
`Modal.onEscape` to its **`onClose` prop**, but 31 of its 33 callers render
their own ✕ in `topRight` and never pass `onClose`
(`CreateTableDialog.tsx:34-37`, `SettingsModal.tsx:157-160`,
`AppearanceSettingsModal.tsx:53-56`, `LeaderboardModal`…), so `onEscape` was
`undefined` and the shell silently had no Escape path.

Fix: `DialogShell` gained an explicit `onEscape` prop (falls back to
`onClose`), wired in the 14 dismissible windows: Settings, Appearance,
Create Table, Tournament bracket, Avatar picker, Leaderboard, Join table,
Deck manager (import modal), Sample hand, Deck import, Import deck, Deck
inspector, Card printings, Random packs. Mandatory in-game prompts (mulligan,
target, vote, trigger order, sideboard…) deliberately keep no Escape.
Test: `web/src/ui/DialogShell.test.tsx` (3 cases).

### F2 — **[S2] The grown hand card covered the mulligan "Conservar mano" button** (fixed)

With the mulligan bar open, hovering the last hand card grows it (scale 1.5)
over the bar; the button centre resolved to `.card-slot.hand-card` via
`elementFromPoint` and Playwright's click was intercepted (log: "subtree
intercepts pointer events"). Both live in the same stacking context and
`.hand-card-slot:hover` (z 50) outranked `.hand-bar-prompt` (z 30).

Fix: `.hand-bar-prompt { z-index: 60 }` (one line + comment). Regression:
`web/e2e/mulligan.spec.ts` now hovers the last card, asserts
`prompt z-index > grown slot z-index` and then clicks *Conservar mano*
(measured red with 30, green with 60).

### F3 — **[S1] Discard prompt: same sentence twice and wrong Spanish phrasing** (fixed)

The hand-pick bar rendered the title *and* the hint with the literal same
string ("Elige una carta para que descarte"), and the Spanish key is the
third-person form ("for them to discard", correct for Thoughtseize) applied to
your own cleanup discard.

Fix: `es.ts` `choose_discard` → "Elige una carta para descartar" (neutral, the
same wording Arena uses for both cases); `TargetBar` hides the hint when the
localized server message equals the title, so only one line is shown.
Tests updated in `serverMessageTranslation.test.ts`, `feedback.test.ts`,
`FeedbackDialog.test.tsx`.

### F4 — **[S1, open] Game-end cinematic title over the lobby top strip**

After conceding and returning to the lobby, the result dialog is shown while
the cinematic layer remains: the 62px "PARTIDA FINALIZADA" title
(`.end-cinematic-title`, `top: 7%`) lands on the lobby header
(`XMage Nexus` / server caption). Amplified by the transparent-dialogs
setting in this profile; still collides with the top strip on the default
backdrop. Suggestion: keep the cinematic with the table, or move/centre the
title once the result panel is visible.

### F5 — **[S1, open] Duplicated copy in two dialogs**

- Confirm modal: kicker and title are both "CONFIRMAR" (eyebrow = título).
- Lobby empty state: the subtitle "Selecciona tu mazo activo…" is painted in
  the panel header and again under the empty-state title.

### F6 — **[S1, open, dev-only] Chat FAB covers the debug pill**

Measured: `floating-chat-fab` 1528–1580 × 828–880 vs `debug-toggle-btn`
("Eventos de red") 1413–1580 × 857–886 — the FAB paints over the pill's right
end. The pill is `import.meta.env.DEV` only (`LobbyScreen.tsx:343`), so this
never reaches production; moving the FAB up in dev (or the pill left) is
enough.

## Verified without findings

Wizard (5 steps, quick presets, sticky summary/footer, every control reachable
by scroll), staging (roster, readiness, progress rail, chat), 1v1 board (phase
bar, prompt bars, right rail with labels, resource piles, hand fan), Settings
sections, About, **visible keyboard focus rings** (nav, filters, disconnect),
and 1366×768 (lobby, wizard, settings, board) with no clipping beyond the
intentional hand sink. `autoPass`/transparent-dialog settings are
user-configured and behave as documented.

## Status after this pass

| Finding | Severity | State |
|---|---|---|
| F1 Escape dead in most dialogs | S2 | **Fixed** + unit test |
| F2 Mulligan keep occluded by grown card | S2 | **Fixed** + e2e regression |
| F3 Discard copy duplicated / phrasing | S1 | **Fixed** + tests |
| F4 Cinematic title over lobby header | S1 | Open |
| F5 Duplicated copy (confirm / lobby) | S1 | Open |
| F6 Dev FAB over debug pill | S1 (dev) | Open |

Verification of the fixes: unit **2447/2447**, `typecheck` clean,
`mulligan.spec.ts` **3/3** fake. No gallery baseline is affected: the changed
discard copy is not rendered by any `VISUAL_ENTRIES` frame (the newer
`prompt:discard-hand` entry has no baseline).

Remaining for §5.2 closure: F4–F6 (cosmetic) and the **opponent view**
(keyboard is now covered: F1 closed).
