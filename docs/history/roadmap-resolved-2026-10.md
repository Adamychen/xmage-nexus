# Roadmap §4 — resolved work archive (as of 2026-10-15)

> Moved verbatim out of `ROADMAP.md` §4 on 2026-10-15. The live pending list is `ROADMAP.md` §4;
> the narrative of each task also lives in its commit message. Nothing here is pending except where a row says so.


> Everything that is not done, in one place. Supersedes the per-idea status of `docs/enhancements.md`. Verified against the code on 2026-09-21.

### 4.2 Product ideas not built yet

Full spec and rationale per open idea: `docs/enhancements.md` (historic built/dropped catalog archived in `docs/history/enhancements-catalog.md`). Already built from that catalog: deck tracker (1.1), invite links (2.1), London-mulligan evaluator (1.4), sample-hand simulator (part of 4.3), the printing selector in the deck editor (part of 5.2; since 2026-09-30 the choice is a local per-player preference — each side sees their own art and it no longer travels in the game state), custom card images (part of 5.2, 2026-10-05: "Mi imagen" in the printings modal and the in-game card inspector uploads a per-card image stored locally in IndexedDB that overrides Scryfall art for that player only) and selectable playmats (5.1, 2026-09-23) and EDHREC suggestions (4.1, 2026-09-24). Since 2026-10-10 the pickers are **visual**: each gameplay preset shows a live miniature table (tapped lands, auto-cast spells, phase-stop dots — `settings/PresetDemo.tsx`), playmat tiles stage real card art, and the artwork is a committed local set — `scripts/gen-showcase-art.mjs` fetches 13 `art_crop` images from Scryfall to `web/public/showcase/` + `src/data/showcaseArt.generated.json` (762 KiB today; `showcaseArt.test.ts` fails past 1.5 MiB or on a missing file, so the pickers paint identically offline and in e2e, where external requests are aborted). Same wave: a compact `RankBadge` now sits in every in-game player bar, fed by the ratings that travel in `PlayerView.userData` (guard `e2e/rank-hud.spec.ts` replays real recorded frames; no badge without a real rating).

| Idea | Impact / effort | State |
|---|---|---|
| EDHREC suggestions in the deck builder | High / ~1-2 d | Done 2026-09-24 ("Suggestions" tab next to Search in the deck editor; EDHREC public JSON for the designated commander, cached, cards resolved via Scryfall collection, synergy badges, click/drag to add). 2026-09-29: DFC commanders use the front-face slug (Slicer), the panel consumes the whole EDHREC page (~277 cards for Slicer, parallel 75-name batches, per-name cache in memory + IndexedDB), and got the Arena filter bar (client-side matching of chips + Scryfall-syntax text), per-section sort and the shared card size |

Ideas added 2026-09-23 (client review focused on `beta.xmage.today`):

| Area | Idea | Impact / effort | State |
|---|---|---|---|
| Game UI | Opponent-turn recap: highlight new/changed/died permanents when priority returns + one-line summary ("played X, attacked with Y, you lost 4") | Very high / ~1-2 d | Done 2026-09-23 (non-blocking strip at my turn start: summary + departed-card chips by destination; NEW/CHANGED marks on the board) |
| Game UI | Smart stops (Arena-style): only stop when the server reports something playable | High / ~1 d | Done 2026-09-23 (opt-in toggle, off by default; ignores mana-only `canPlayObjects`; answers each `GAME_SELECT` once; validated against the local server by `e2e/smart-stops-real.spec.ts`) |
| Game UI | P/T tinted vs base (green up / red down), summoning-sickness marker, "entered this turn" glow | Medium / ~1 d | Done 2026-09-23 (per-component tint vs printed value with base in the tooltip; client-tracked entered-this-turn glow; sickness badge already existed) |
| Game FX | Spell weight impact: high-CMC / mythic spells darken the board, shake and flash in the card's colours | High / ~1 d | Done 2026-09-23 (2026-09-25: fires when the spell resolves, not when it is cast; countered permanents and cancelled casts never slam) |
| Game FX | Sequential combat strikes: when combat damage resolves, attackers lunge one after another at their blocker or at the player/planeswalker/battle they attack, each landing with the hit sound, sparks and a shake; dying combatants stay on screen until the sequence ends and damage/life numbers pop on each impact | High / small | Done 2026-09-25 (first-strike and regular damage steps animate separately; declaring attackers only shows the existing nudge) |
| Game FX | Physical combat: impact particles on damage, distinct deaths (destroy = burn, exile = beam of light, token = pop/puff); the attacker lunge already existed | High / ~2 d | Done 2026-09-23 |
| Game FX | Low-life tension: red vignette + heartbeat at ≤ 5 life | Medium / small | Done 2026-09-23 |
| Game FX | Foil shimmer + 3D tilt on the enlarged card preview | Medium / small | Done 2026-09-23 |
| Game FX | Selectable playmats, including animated mats tinted by colour identity (Phase 3 leftover; 7 static + 2 animated mats) | Medium / ~1 d | Done 2026-09-23 |
| Game UI | Compact (Arena-style) battlefield cards: art-crop tiles with name, type and mana-source pips; Settings → Board → Card style (Classic / Compact) and Tapped cards (Sideways 90° / Tilted 45°) | High / ~1 d | Done 2026-09-25 (battlefield only; hand, stack and dialogs keep full cards; tapped cards are scaled so the rotated box fits the row) |
| Game FX | Dynamic music: ambient layer that intensifies near lethal | Medium / ~1 d | Done 2026-09-23 |
| Game FX | Cinematic victory/defeat screen with match stats (key card, turns, life taken/lost, spells cast, creatures destroyed) | Medium / ~1 d | Done 2026-09-23 |
| Ease of use | "Your turn / response needed" browser notification + title/favicon badge when the tab is hidden | Very high / ~0.5 d | Done 2026-09-23 (toggle in Settings → Gameplay; permission asked on the first in-game click) |
| Ease of use | Explicit waiting state ("Waiting for X — thinking 0:23") | Medium / small | Done 2026-09-23 (action button names the actual priority holder, thinking clock + priority timer countdown, warn tint after 60 s) |
| Ease of use | Smart mana payment: opt-in exact solver taps the sources for the cost being paid and keeps colours open for instants in hand (public information only) | High / ~1 d | Done 2026-09-23 (toggle in Settings → Gameplay and the game menu, off by default; skips Treasure-style sacrifice, restricted mana and convoke; a multi-spell turn scheduler is not built; validated against the local server by `e2e/smart-mana-real.spec.ts`) |
| Game UI | Non-modal decision prompts: plain yes/no asks (pay life, optional costs, ward/cascade) answer from a dock bar; picks from your own hand (discards) resolve by clicking the highlighted hand with the grid as explicit fallback; any remaining dialog can be made transparent (Appearance) or peeked with Alt | High / ~1 d | Done 2026-09-29 (`feedbackModes/AskBar.tsx`, `game/handPick.ts`, `TargetBar` expand + `DialogShell`/`Modal` peek; `AskBar.test.tsx`, `handPick.test.ts`, `FeedbackDialog.test.tsx`, `selectors.test.ts`, `Modal.test.tsx`; fake e2e 281 passed, gallery entries `prompt:ask` / `prompt:discard-hand`) |
| Game UI | Trigger order, second pass: pick in resolution order with drag & drop, auto-chain the remaining one-at-a-time prompts, show the accumulated stack and the targets/related objects that distinguish duplicate triggers, decouple "pick" from "remember first/last" and manage saved rules per row | High / ~1-2 d | Done 2026-09-29 (`TriggerOrderDialog` + `triggerOrderPlan.ts`: drag/▲▼ resolution order, "Apply order" chains the bottom-up prompts, sent/next rows + "Sending n/N", manual pick kept, pins only remember, target/related labels, hover preview; `TriggerOrderDialog.test.tsx` 13, `trigger-order.spec.ts` 3 fake). Consciously out: non-modal dock and 1..9 shortcuts (Alt-peek already exists); per-row rule management is impossible server-side (only RESET_ALL and add) |
| Attract | Personal match history + per-deck stats (win rate by deck/format/opponent, IndexedDB) | Very high / ~2 d | Done 2026-09-23 ("My stats" sub-tab in the History tab; one record per finished game recorded on `GAME_OVER`, only when the player was seated and a winner is reported; deck name comes from the last equipped deck and format from the lobby table, so both can be missing; capped at 500 records) |
| Attract | Draft pick helper | High / ~2 d | Not started |

Ideas added 2026-10-06 — **state-reading assistants**. Three of the four were **dropped on 2026-10-07**, not deferred: they were specced on data that does not reach the client. Checked against the 119 recorded `GAME_UPDATE` frames in `web/fixtures/recorded/` (2 048 card views) and the fork:

- `CardView.playableStats` is **empty in all 2 048 of those views**. The Swing client fills it client-side from `canPlayObjects` (`Mage.Client/src/main/java/mage/client/game/GamePanel.java`), so on the wire it is a dead field, never a channel.
- The real channel, `GameView.canPlayObjects`, is only sent to the player who currently holds priority (`GameSessionPlayer.java:242` + `PlayerImpl.getTurnControlledBy()`, and it is skipped in the silent phase steps): 39 of the 58 recorded frames where I hold priority carry it, **0 of the 61 where an opponent does**. The response window is exactly a not-my-priority feature.
- An opponent's hand never travels (0 of the 119 frames carry `opponentHands` content, only `handCount`), so "which answers are visible on the other side" could only be a guess, which is what the module's own first rule forbids.
- There is nothing to ask instead of guessing: an illegal click is ignored by the server ("player has no priority to do something, so ignore the command", `GameController.java:1198`).
- Continuous effects that are not an attachment or a counter carry no source. 8 cards in the recorded frames show P/T above their base with nothing pointing at the cause (Craw Wurm 9/1 from base 6/4, Grizzly Bears 5/5 from 2/2, Trumpeting Carnosaur 10/9), and `web/ENGINE_VIEW_TRIAGE.md` already logs `abilities` as having no DTO channel — so a layer inspector would have to parse rules text and would be wrong in exactly the cases it exists for.

Dropped as specified: the response window, the blocked-action explainer and the layer / derived P-T inspector. Reopening any of them needs a fork change that puts the missing data on the wire (a per-player playable list, effect sources), not a client feature. One idea stays open; its gate is **no optimistic state** — a read mode over recorded views with its own slice, never a mutated live store.

| Area | Idea | Impact / effort | State |
|---|---|---|---|
| Game UI | Board rewind: opt-in capture of the views a game sent + scrub to any earlier turn to read the board as it was (review a line, screenshot a moment), also the substrate for a future replay file | High / ~2-3 d | Not started. `net/frameBuffer.ts` is the hook but is bounded for diagnostics (60 frames, whole frames up to 8 KB shipped / 64 KB dev) while a `GAME_UPDATE` is 200-800 KB, so it needs its own capture (per-turn snapshot or delta). Must be a read mode over recorded views with its own slice, never a mutated live store; the server's own replay stays off (`saveGameActivated="false"`, "not working correctly yet" upstream), which is why a client-side recording is the only replay that can actually be tested |

### 4.3 UI polish debt

RESOLVED 2026-10-06 (the list from the 2026-09-21 audit):

- **Spacing literals**: 815 → 19 in `padding`/`margin`/`gap`. Exact scale values became `--sp-*` with no pixel change (712), the off-scale ones snapped to the nearest step (84; ties up, as in `921a9e4`) and the scale gained `--sp-3h: 14px`, which saves 40 sites from moving. The 19 left are layout measures on purpose (icon insets of 34–42 px, `--card-w` fallbacks, hero paddings). Gallery visual suite regenerated at 1920 after checking every diff (1-px shifts in badges, pills and the phase bar).
- **Inline `style={{}}`**: 102 → 65, all of them data-driven (positions, widths, per-player colours, CSS variables). The static ones (cursors, flex rows, wizard hint boxes with literal colours, deck inspector titles) are classes on tokens.
- **Raw `<button>`**: the ~90 left are bespoke controls (cards, piles, phase pills, mana orbs, nav items) that no primitive fits without overriding all of it; the 8 without `type` got `type="button"`; `ui/rawButtons.test.ts` now checks that every raw button declares its type, besides its count ratchet (91 → 90).
- **`Field` / `Input` primitives** (`ui/Field.tsx`, `ui/Input.tsx`): label above, optional hint (muted or warn) and announced error outside the `<label>` and linked with `aria-describedby`, `group` mode for chip/radio sets. Create Table (all tabs), Login, Setup wizard and Import deck use them; their per-form label rules are gone, and the duplicated global `.import-name-input` (two sheets, last one won) is resolved.
- **Lobby list density**: compact rows toggle next to the filters (`tables_density` in localStorage), one line per table at desktop widths, wraps on narrow screens (`e2e/lobby-density.spec.ts`).
- **Construct pool sorting**: colour (WUBRG, gold, colourless, lands) / mana value (lands last) / type / name, `game/poolSort.ts` + tests.
- **Backup labels in Decks**: they said "Export deck (N)" / "Import deck (JSON)" for backing up all decks and restoring a backup (and were English in ja/zhs); now they say what they do in the 9 languages, with tooltips and a restore count message.

The style ratchet (`ui/styleTokens.test.ts`) keeps the counts from regressing.

RESOLVED 2026-10-14 — **dialog widths under `uiScale`**: `vw` ignores the root `zoom`, so at 900 px and 130 % a 760 px settings panel measured 988 px. `applyAppearanceToDocument` now publishes `--ui-zoom` next to the zoom, and the `--dlg-width-*` tokens, the settings modal, the leaderboard and the user-action dialog divide their `vw` allowance by it. Guard: `e2e/settings.spec.ts` ("the panel stays inside a small window at a high UI zoom"), verified red with the old `vw` width put back (1014 px in a 900 px window).

### 4.3b Board legibility (from issue #12, opened 2026-10-08)

Wave A+B of issue #12 shipped 2026-10-08 (spec and task plan lived in `docs/superpowers/`, deleted once the wave shipped — read the commit messages of `39f397d6f1b` and `ebfa8772213`, and issue #12): the create-table wizard no longer clips at 100% zoom, the import wizard leads with the file picker, the deck can be edited from the wizard's Seats step, and three card overlays plus the per-phase priority cue became settings (`showHandCost`, `ptBadgeMode`, `sicknessStyle`, `prioritySound`). RESOLVED 2026-10-09 — **clearer "whose turn is it"**. The complaint was accurate and not a matter of taste: the client had one visible turn marker and it was broken. `PlayerInfoBar` gave turn and priority the same two properties (`border-color` + `box-shadow`), and on the top bar `.opp.has-priority` (three classes) also beat `.is-turn` (two) on specificity, so during the rival's turn the border stayed the priority orange — measured in Chromium with `getComputedStyle` before touching anything (three of the "five indicators" counted here encoded *priority*, which is the question the reporter was not asking). Shipped: the two channels use different property families now (turn = fill + left accent bar, priority = border + glow) so they can paint together; `TurnOrderRing`, the only component that names the active player, is no longer pod-only — it fills the middle band in 1v1 and arena, where the `GameScreen` `center` slot was empty (838 px of dead space at a 1600 px window) — as a walkway with fixed slots that alternates sides with the two halves of the board and puts it in words; and the action button sublabel says whose turn it is instead of just "Priority". Guards: `e2e/turn-lane.spec.ts` (channel styles and geometry, measured at 1600/1280/900 px and in the pod/FFA layouts where the opponent switcher keeps its slot) + `board/TurnOrderRing.test.tsx` (5). The strip sits inside `.game`, which divides `uiScale` out with `inverseZoom`, so the walkway is not exposed to the `vw`-vs-zoom problem above.

RESOLVED 2026-10-13 — **legible card text**: with the `cardRender` setting on, every classic card is drawn from `CardView` data instead of the printed image (`web/src/cards/rendered/`): hand fan, hand column (`board/HandRail.tsx`, `handRail` / `handRailWidth`), battlefield, piles, grids and the hover preview, with localized name / type line / rules. Layouts: standard, planeswalker, battle, saga, class, leveler, room/split/aftermath/fuse, adventure, token, emblem, dungeon, ability, face-down. Rendered mode always uses the full card shape (the compact art-crop tiles are bypassed) and a face under 200 px drops its art to keep the text legible. Guard: `e2e/rendered-cards.spec.ts` (no rules text is ever cut). Read the commits from `1393dbbd7cc` on. What stays outside it: how large the board lets a battlefield card get (the zone scale in `board/useZoneScale.ts`, 70–145 px), so the rules text of a crowded battlefield is only as legible as that width allows.

Still open, each needing a **design decision, not a bug fix**:

| Open item | Why it is not a toggle |
|---|---|
| ~~See the rules text of every card in hand without hovering~~ — Closed 2026-10-13 (won't do: the full left/right split stays out of scope; the `HandRail` column is the answer; 2026-10-14: `HandRow` adds the same full cards as a scrollable row in the hand zone, `handRow` setting, mutually exclusive with `handRail`) | Was a fourth layout in `board/boardLayout.ts`, not a setting; `HandRail.tsx`/`HandRow.tsx` + `cardRender` already give full-text hand cards |
| See the rules text of every permanent in play without hovering | Legible text for 8+ permanents does not fit one screen. Options: bigger cards with band panning (the bands already scroll), a one-line rules strip under compact tiles, or a persistent inspector |
| ~~Clearer "whose turn is it"~~ | Resolved 2026-10-09, see above; the last hue clash closed 2026-10-14: opponent priority on the top bar and avatar ring is now `--err` rose instead of `--warn` orange, so turn = gold fill + bar, my priority = green, opponent priority = rose |

### 4.4 Test-infrastructure risk

RESOLVED 2026-10-14 (audit of gaps and hardening):

- **Security**: `renderNewsMarkdown` attribute injection (quotes were not escaped), launcher tarball
  extraction followed symlinks out of the destination, and the proxy CSP allowed inline scripts for one
  splash script. Fixed with tests that fail without the fix (`news.test.ts`, `extract.rs`,
  `MainSecurityTest`, `cspCompat.test.ts`); details in `docs/lessons.md`.
- **Accessibility**: `e2e/a11y.spec.ts` runs axe-core (WCAG A/AA) on the lobby, create-table dialog,
  every settings section and About; it found an unnamed `select` in the table filter bar.
  `e2e/keyboard.spec.ts` drives the lobby with the keyboard alone. `npm run test:e2e:a11y`.
- **Supply chain**: `audit` job in `web-ci.yml` (`npm audit --omit=dev` for web and mcp, `cargo audit`
  for the launcher) plus Dependabot for npm and cargo; the first run found a high advisory in
  `@modelcontextprotocol/sdk`, fixed in `mcp/package-lock.json`.
- **Budgets and gates**: `scripts/check-bundle-size.mjs` (entry 470 KB gzip, CSS 100 KB, locale chunk
  60 KB) runs after the build; coverage thresholds raised to 79 / 72 / 67 / 76 after new render suites
  for `GameScreen` (8 % -> 55 %) and `LobbyScreen` (0 % -> 47 %).
- **Parsers and i18n**: seeded fuzz suites for `parseFeedback` / the feedback record helpers and for the
  rules-text parsers (designations, commander plays, speed, room doors); a placeholder-parity guard
  across the nine locales found `pt` dropping `{picksPlural}`.
- Launcher: 22 Rust tests (truncated / non-gzip / missing archives, symlink escapes, malformed hashes and
  manifests).
- Not done: a replay/rewind file format for the demo (depends on the board rewind in §4.2), mobile
  layout (excluded on purpose).


RESOLVED 2026-10-13 (both top-card channels now have real frames, and one of them had never been
seen by the client):

1. `scripts/drivers/top-card-peek.mjs` + `top-card-revealed.mjs` cast the cards for real against the
   local server and pin the two channels. The premise above was wrong in one detail worth keeping:
   in this fork **Future Sight is not the look-any-time channel** — `FutureSight.java` is
   `PlayWithTheTopCardRevealedEffect` + `PlayFromTopOfLibraryEffect`, i.e. `PlayerView.topCard`, a
   full `CardView` rebuilt per view from the current library top. The `"Top card of your library"`
   group comes from `LookAtTopCardOfLibraryAnyTimeEffect` (Sphinx of Jwar Isle, Realmwalker, Ranger
   Class, Radha…) and on the wire it is a `LookedAtView` → `SimpleCardsView`:
   `{id, expansionSetCode, cardNumber, …}`, **no name, no rules text**. `contract.schema.json` types
   `lookedAt` as `RevealedView` and `CardView` declares no `required`, so zod cannot see that
   difference — the invariant `hasTopCardPeek` (the pointer must have no `name`) is what pins it.
2. Which is a shape the client had never rendered: `dev/galleryFixtures.ts` built
   `game:top-card-peek` by cloning a full `CardView` out of the hand, so the unit tests and the
   gallery were green against a payload the server never sends, and the real frame rendered `?` with
   a tooltip reading "…: undefined (only you can see it)". `game/topCardPeek.ts` now resolves the
   name from the printing (sync cache read, then one `awaitCardMeta` per key, never a retry per
   view) and `game/ResourceBar.tsx` prints a name only when it has one (new
   `game.top_card_peek_anon`, 9 locales). `e2e/recorded.spec.ts` asserts the slot paints the
   recorded card and that no `undefined`/`?` reaches the label — verified red with the old one-liner
   put back, which is the only reason the assertion means anything.
3. RESOLVED 2026-10-14 — the *alternation* is pinned: `scripts/drivers/top-card-peek-sequence.mjs` reuses the Sphinx setup, then keeps passing priority and stores every consecutive view until the WITH → WITHOUT → WITH triple appears (only the triple is dumped — a `GAME_UPDATE` is 200-800 KB — as `top-card-peek-sequence.json`, `kind: 'sequence'`, skipped by the FakeServer replay and the gallery like the tournament kinds). The `hasTopCardPeekSequence` invariant (`recorded.test.ts`) validates all 3 views against the contract and asserts the wire rhythm (group with exactly one nameless pointer → no group with Sphinx still out → group again) plus the stale pin (same `libraryCount` → same id, changed library → changed id, so `LookedAt.add` never accumulates under the title). Verified red by giving the middle view the group. First run captured the triple in three back-to-back views of turn 1 (same card id, library 53).
4. `e2e/picker-demos.spec.ts` had been red on master since `379e6b281f6`: its first test called
   `shot(...)` before that helper existed (the fix added it to the *second* test only), so the test
   died on a `ReferenceError` and its playmat-image assertions never ran. It surfaced on the first
   full fake run since the 2026-10-10 waves — the reason those waves were called done on 2 802 unit
   tests + 312 fake e2e without the stack layers. Fixed here.

RESOLVED 2026-10-10 (two failures that were invisible at the same time):

1. `turn-lane.spec.ts` encoded this machine's font metrics — the walkway's `max-width: 96px` name
   cap fitted macOS by 1.1 px and truncated the same 14-char name under Linux's system-ui fallback,
   so every CI run was red and every local run green. The cap is gone: the walkway now measures its
   own content against the room the band gives it (`board/laneFit.ts` + `useLaneFit.ts`) and degrades
   (whole row → active seat alone → dots) instead of clipping. The spec asserts the contract (no
   visible name clipped, row never wider than its band) under two fonts and at a starved band, and it
   was verified to fail once the constant came back. `--font-ui` is a token for exactly this.
2. The Pages nightly printed red layers into a green run: every stack step had
   `continue-on-error: true`, nothing read `status.json`, and `integration-report.mjs` skipped the
   `/ready` + warm-up gates `test.mjs` has had for a week, so self-test/human-test "failed" in 0.3 s
   against a proxy still building its card database. Both fixed: the nightly path now waits for
   `/ready`, warms the server up, dumps the failing command's output, and `scripts/check-status.mjs`
   (last Pages step, after the deploy) exits non-zero on any red layer — the page publishes the truth
   and the run is red with it.

RESOLVED 2026-09-30: the two real-mode failures flagged here earlier (`skips.spec.ts`,
`priority-stop-real.spec.ts`) were a mis-targeting artifact, not a code bug. `E2E_BACKEND=real`
without `E2E_SERVER_HOST` logs into **beta.xmage.today** (documented in `docs/lessons.md:98`), not
the local stack, and the public server's engine did not honor the mid-game `UserSkipPrioritySteps`
updates (correct `updatePreferences` payloads verified on the wire; the patched local 1.4.62-V1
honors them). With `E2E_SERVER_HOST=127.0.0.1` (what `integration-report.mjs` uses) both specs pass
against localhost. Hardened while investigating: the `mage_e2e` MCP tool forces
`E2E_SERVER_HOST=127.0.0.1` for `backend=real` (it is documented as the local stack), and
`e2e/support/start-game.ts` (`waitTableReady`/`startMatch`) now polls both staging and lobby paths
instead of committing to one at 500 ms — under beta's latency the app's late `JOINED_TABLE` jump
left the lobby row stale and the old wait hung.


RESOLVED 2026-09-28: `verify-player-leave.mjs` failed **deterministically** when it ran right after `multi-tenant-test.mjs` (all three retries, "partida congelada tras el CONCEDE (sin vistas)"), while passing 13/13 alone — reproduced with the pre-`RestoreIds` proxy build, so it was a pre-existing ordering sensitivity, not a regression. It now runs **first** in the layer, before any other script touches the proxy, and the layer is 9/9 (it still needs its own retry every so often: 82 s / attempt 2). What `multi-tenant-test` leaves behind is still unknown; the script remains the most sensitive one.

RESOLVED 2026-09-28: the 10 anti-drift scripts (`multi-tenant-test`, nine `verify-*`) plus the fuzzer
were not referenced by `test.mjs`, `web-ci.yml`, `pages.yml` or `dashboard-ci.mjs`, so ~2 900 lines of
regression tests only ran when someone remembered. They are now the `verify` layer (~100 s, in the
integration CI job), `verify-restart` (its own layer; it replaces the proxy process) and `fuzz`
(nightly). Wiring them up immediately found two real problems: the scripts never logged out, so a run
left 21 sessions and 458 threads behind and the sensitive one failed on the degraded server (fixed
with a `disconnect` per script: `created=21 disposed=0` → `created=47 disposed=46`), and the layer only
checked the port instead of `/ready`, so it could start while the proxy was still building its card
database.

### 4.5 Out of scope on purpose

Emblem cards in Create Table (experimental `.dck` feature of the desktop client; decided 2026-09-06).

### 4.6 Public proxy operations

Since 2026-09-26 a proxy restart no longer ends the games in progress: the proxy does not disconnect its sessions on shutdown, the server sees a lost connection and keeps the tables for 3 minutes, and a re-login through the new proxy restores the game with its pending prompt; the SIM seats of that account are logged in again from the on-disk roster (`--simRoster`) and keep playing (`scripts/verify-reconnect.mjs`, restart and SIM phases). Limit: the players must log in again within those 3 minutes (the web reconnects on its own while the tab is open).

Since 2026-09-27 the host runs `xmage-status` (`ops/status/`, LAN-only on `:8790`, no tunnel): players online, history, statistics, proxy/playit logs, host metrics and restarts, built from the journal and the playit log without touching the proxy. Findings from its first run:

| What | Why |
|---|---|
| RESOLVED 2026-09-28 — every failed login leaked 2-5 non-daemon threads. `Gateway.handleConnect` builds a `ProxyClient` per `connect` and its constructor schedules `lobbyTimer` (2 s) and `keepAliveTimer` (20 s) immediately, but the failed-login branch only did `unregisterSession`; the grace timer is never armed for a client that is not connected, and the process shutdown hook walks `byAccount`, where the client had already been removed — so nothing could ever release it. With the 172-retry login loop above that is ~1000-3000 threads per user, and non-daemon ones also keep the JVM from exiting | Fixed by `ProxyClient.dispose()` (the 6 `shutdownNow()` that `shutdown()` and `expireGrace()` duplicated), called from the failed-login branch and from `Gateway.onClose` when `isDisposable()` (no session, no relink, **no pending grace timer**, which runs on the timer we would be killing). Guarded by `ProxyClientFailedLoginTest`; the thread-count test reported 75 extra threads over 25 failed logins before the fix and 0 after |
| RESOLVED 2026-10-07 — 48 `Server error` / `Card not found - <card> - <set> - <number>` on join in three days | Imported decks with printings the server does not know still reached `joinTable`. Now an entry without a printing gets the XMage importer's printing at the proxy edge (`DeckJson.resolvePrinting`), imports take their printings from XMage (`resolvePrintings`), and the printings modal and the card search mark what the server's release lacks (`cardPrintings`). Confirmed on the host's journal (2026-09-23 → 2026-10-06): 2 `Card not found` in the whole window, none after 2026-09-27 |
| NEW 2026-10-07 — how a game ended was not recorded | The journal had `joinGame` and `quitMatch` but no game end, so finished games could not be told from games left behind by a disconnect or an expired session. `GameActivity` now writes `game_start` (`role=player\|watcher`) and `game_end` (`result=won\|lost\|draw\|quit\|conceded\|watched\|unfinished`, `reason`, `turns`, `duration_s`, `players`, `cause` from `GameEndView`: timeout / idle / quit, own or an opponent's); `xmage-status` shows it as "How games end". A game still open when the proxy process restarts has a `game_start` and no `game_end`. Guarded by `GameActivityTest` |
| NEW 2026-10-09 — sonda de daño de comandante | El daño de comandante no tiene campo en el view: viaja solo en las `rules` del objeto del comandante (una entrada de info por jugador, con el total acumulado), que es lo que parsea la web para su matriz (`web/src/board/commanders.ts`) — y que borraba la columna cuando el objeto caía en una zona invisible. `GameActivity` (proxy) ahora vuelca al journal `commander_damage` (`gameId`, `turn`, `Nombre{objetivo=total,…}`, solo cuando cambian los totales — el valor del wire es autoritativo, así que un rollback se ve bajar) y `commander_hidden` (una vez por desaparición: comandante con daño que ya no está en ninguna zona visible — mano rival, biblioteca). Sin comandantes con daño el journal no recibe líneas. Comparar en producción lo que el wire dice con lo que la web mostró. Guarded by `GameActivityTest` |
| NEW 2026-10-07 — a new upstream release silently stopped every login | Beta moved to 1.4.62-V1 on 2026-10-03 and the proxy (1.4.61) was refused for a day (59 `Wrong client version` logins, 0 games on 10-04) before anyone looked. Now: the proxy classifies it as `VERSION_MISMATCH`, the web explains it ("the server runs X, this proxy still runs Y") and stops retrying, `xmage-status` shows a red banner and pill from the first refused login, and `.github/workflows/upstream-release.yml` (`scripts/check-upstream-release.mjs`) fails every 6 h while magefree/mage has a newer `xmage_*` tag than the fork. Guarded by `ErrorClassifierTest`, `versionMismatch.test.ts`, `gateway-connect.test.ts` |
| NEW 2026-10-07 — 60 % of the players who logged in never sat down | 105 of 174 never created or joined a table; 28 opened Create Table and left. Outside DEV a new player has no deck at all (`bundledDecks()` is empty), so the seat step and Join Table had nothing to offer. Create Table and Join Table now offer three starter decks with one click: Mono Red Burn and Mono White Humans (both validated as Modern by XMage) and Krenko goblins for Commander; each seat gets one that fits the table. Measure it in the journal: share of users with `getGameTypes` that reach `createTable`, and of logged-in users that reach `joinGame`. The catalog's three Commander lists were illegal (53, 75 and 84 cards, and Edgar ran a green land): completed to 100 and all three validated by XMage on 2026-10-07 |
| RESOLVED 2026-09-28 — login success is ~34 %: most failures are `User already connected or your IP address changed` retry loops (one user: 172). The server hands a session to any login that presents its id as `restoreSessionId` (even from another address), but the proxy only kept that id inside the live `ProxyClient`: after a dispose or a restart it sent nothing and every retry was refused until the server expired the old session. The proxy now keeps the id per `host\|username` in memory and on disk (`RestoreIds`, `--restoreIds`, 10-min TTL like the SIM roster) and presents it on the next login; a `disconnect` (logout) drops it. Verified live: after a proxy restart the re-login logs `connected to server with restored session`. The web also counts the wait down on the connecting splash and, when it still fails (the account is open elsewhere), replaces the raw server text with an actionable message instead of looping silently |

### 4.6b Proxy hardening (2026-09-28, same pass as the thread leak)

All verified against the local stack; `175` Maven tests, `self-test`, `human-test`, `multi-tenant-test` and five
`verify-*` scripts green.

| What | Why |
|---|---|
| RESOLVED — `catch (Exception)` in `processCallback` and `handleCommand` | Both run on single-thread executors, so an `Error` killed the thread for good (`ThreadPoolExecutor` never replaces a dead one) and the session went deaf with nothing in the log. Now `catch (Throwable)` |
| RESOLVED — `SessionProbe` resolved `SessionImpl.server` by reflection on every probe and swallowed the failure | A field renamed in the fork would make every probe report a dead link and put every session in a permanent relink loop: a self-inflicted outage, silently. The field is resolved once (a broken one logs `SEVERE` at startup) and an unaskable probe now answers "alive", never "lost" — relinking on a false alarm kicks the healthy session and freezes the game thread |
| RESOLVED — `pollDetailedMessage` was a `Thread.sleep(60)` loop on `commandExecutor` | The session's only server-facing thread, blocked 1.6 s per rejected action (4.5 s on a failed login, 0.9 s covering an error); a burst serialised into tens of seconds of dead queue. Now a leaf lock + condition that returns the moment the message is captured |
| RESOLVED — the sequencer's 400 ms gap timer shared `pingTimer` with `expireGrace` | `expireGrace` holds the client monitor across a server round-trip, so while it ran the gap budget was silently overrun. The sequencer has its own timer |
| RESOLVED — `fetchOnlineDeck` blocked the command thread for up to 8 s | A single deck import froze every other action of that session, and it ran on a shared multi-tenant proxy. Now a bounded daemon pool (2-4 threads, queue 16) that answers "too many in flight" instead of growing an unbounded backlog of sockets |
| RESOLVED — `JsonUtil` re-walked `getDeclaredFields()` per object per event | The filter only depends on the class, so the writable-field array is now resolved once per class; a `GAME_UPDATE` walks a thousand views. Control characters use a hex table instead of `String.format` per char |
| RESOLVED — `OutboundLog.withSeq` copied the whole frame on every broadcast | `"{\"seq\":" + seq + "," + json.substring(1)` allocated a full 200-800 KB copy and grew a default-16 StringBuilder through it. Now one exactly-sized buffer. Building the `seq` at the source would be cheaper but unsafe: it has to be assigned under the `authorized` lock in broadcast order |
| RESOLVED — `Config.parse` took a flag as the previous flag's value | `--host --port 17171` set `host="--port"` and dropped the port, so a typo in a systemd unit started the proxy against host `--port` with nothing in the log. It now refuses to start |
| RESOLVED — `Gateway.onError` printed the exception text only, unthrottled, on stderr | A client that desyncs raised it per frame, and stderr has no rotation. Now one stack, then one line per minute, like the lobby throttle |
| RESOLVED — no `/health` nor `/ready`; the HTTP server had no executor | `HttpServer.create(addr, 0)` without `setExecutor` uses the single-threaded JDK dispatcher, so one slow `/admin/status` (500 serialised events) blocked every static file and would have blocked the health checks. Both endpoints now exist: `/health` is liveness, `/ready` is `503` until the card database is `READY` (a proxy with a failed card DB still accepted logins, the usual cause of a confusing "login failed" during a deploy) |
| RESOLVED — the admin token was accepted in the query string, compared with `String.equals`; the static server sent no security or cache headers | The token landed in access logs, browser history and every proxy in between. Header-only `Bearer`, `GET` only, plus `nosniff`/`DENY`/`Referrer-Policy`/CSP and immutable caching for fingerprinted `assets/*`. No consumer used the query-string form (`ops/status` reads the journal) |
| NEW — watchdog | A line per minute with `threads`, `clientsAlive` (`created - disposed`), `openConns`, `accounts`, `wsErrors` and the card-DB state, plus the same under `/admin/status` `runtime`, and per-connection detail under `sessions`. The leak above ran for weeks with no counter that would have shown it. `clientsAlive` climbing while `openConns`/`accounts` do not turns into a `WARNING` |
| RESOLVED — the replay cache kept the last `GameUpdate` of every game a session ever played | 200-800 KB per game, for as long as the user stayed logged in. A finished game now moves to a single slot, so a client that re-attaches right after `GAME_OVER` still gets the final board and nothing accumulates |
| RESOLVED — the outdated-guard map was a plain `HashMap` written from the command thread and read/written from the callback thread | Concurrent mutation of a `HashMap` can lose entries or spin on a resize; it also boxed a `Stream` over every entry on every callback. Now a `ConcurrentHashMap` plus a maintained high-water mark |
| RESOLVED — the grace period that expired with the XMage link already down returned early | It left the account registered and the user listed in `Activity` forever. It now releases the local session (the server round trip is still skipped, there is nothing to disconnect) |
| RESOLVED — the per-session game allowlist only ever grew | One UUID per game for a session that plays for months. Trimmed past 256, and only ever dropping ids that are not in a game still in progress |
| RESOLVED — the E2E suite had 5 failures nobody could reproduce | Root cause found and fixed: the `mechanics`/`pod` fixtures publish a `revealed` group with **no `name`**, which the contract requires, and the info-window viewer renders a nameless group as `undefined` in the dialog title. Because those viewers latch open over the board, the modal swallowed the hovers four specs were about. Fixed at the source (3 new `*_window_plain` keys in all 9 locales, `infoWindowTitle()`), the fixtures now name their group, and the hover specs dismiss it through a new `dismissInfoWindows()` helper. `mechanics.spec.ts` went from a 120 s timeout to 8.7 s |

### 4.6c Web client payload (2026-09-28)

| What | Why |
|---|---|
| RESOLVED — the nine locales were statically imported | 1.15 MB of source, about half the bundle, for a player who reads one of them. English stays eager (it is the `t()` fallback, so the app is never without strings); the other eight are their own ~35 KB gzip chunks, fetched on demand and re-rendered when they land. Entry chunk **2.36 MB → 1.43 MB raw, 682 KB → 395 KB gzip (-42 %)**. `setLanguage` paints the new language immediately and the chunk follows, so a test has to await: `useLanguage()` switches and resolves once the strings are in |
| RESOLVED — the coverage gate listed two files that do not exist and left `src/board/` out | It measured 721 instrumented lines of ~80 000 and reported "87 % lines" on the dashboard. The scope is now `net`, `state`, `board`, `cards/cardImages`, `game/feedback` and `infoWindowState`: **4 952 lines** at 85 % / 75 % branches, with thresholds lowered to match reality rather than propped up |
| RESOLVED — three unused `@dnd-kit` production dependencies | 2.2 MB of `npm install` and CI cache for a library nothing imports |
| RESOLVED — the frame buffer kept up to 3.8 MB of whole frames in production | `recordFrame` is **not** a dev tool: it feeds the "Export diagnostics" bundle players send with bug reports, so it was bounded rather than gated — 8 KB per frame in a shipped build (the prompts and results are what a report needs), 64 KB in dev |

### 4.6d The other proxy thread leak: one pool per session (2026-09-28)

Found while chasing a flaky `verify-player-leave`, and independent from it. jboss-remoting 2.5.4
creates a oneway thread pool per remoting connection and never stops it: `Client.disconnect()`,
`ServerInvoker.stop()` and `ServerInvoker.destroy()` do not touch it, and the pool is orphaned
anyway because `Client.getOnewayThreadPool()` asks for 10 threads on an executor built `4/4` and
`BasicThreadPool.setMaximumPoolSize` sets the core size before the maximum (`IllegalArgumentException`
before the pool is stored). The proxy makes it visible because it creates one `SessionImpl` per
browser session **and one per SIM seat**: 12 pools / 48 threads after a single four-player game,
105 pools / 420 parked threads after ~100 sessions, which is what made long-lived stacks slow enough
for games to stop producing views.

| What | Why |
|---|---|
| RESOLVED — the pool is no longer per session | **One file, additive**: the fork's `CustomThreadPool` (the class jboss instantiates from the `onewayThreadPool` locator parameter, used by the callback server's `ServerInvoker`) now delegates every instance to one shared pool. Measured 48 -> 0 leaked threads, proxy total 143 -> 61. Nothing else in the fork depends on it, so an upstream merge that fixes the leak just drops this file's diff |
| RESOLVED — `Client.getOnewayThreadPool()` also leaked, before it was ever reached | An earlier attempt stopped the *client's* pool on disconnect, which required asking for a size `BasicThreadPool` accepts (`setMaximumPoolSize` sets the core size before the max, so 10 on a 4/4 executor throws). Reverting `SessionImpl` and keeping only the shared `CustomThreadPool` measured the same 0 threads and no `IllegalArgumentException`, so the patch stayed at one file |
| RESOLVED — `dev.mjs restart` started the new proxy while the old still held the port | A fixed 1.5 s sleep instead of waiting: the new WebSocket server failed to bind (`BindException`) but the process stayed up answering HTTP and reporting `/ready`, so every script failed differently. It now waits for the ports to go down, and a bind failure is fatal in `Gateway.onError` instead of a half-alive proxy |
| RESOLVED — `verify-player-leave` was flaky (still is a *sensitive* script, but no longer red) | Two separate causes: it logged no `disconnect` (fixed: every verify script logs out, `created=21 disposed=0` -> `created=47 disposed=46`), and its "no views in 20 s" watchdog called a healthy game frozen in a four-player lands-only FFA where the engine legitimately pushes nothing when the board does not change (the server itself only warns at 30 s). The pre-concede liveness precondition is gone and the script now runs **second** in the `verify` layer, before the scripts that hammer the server |

### 4.7 Connection resilience follow-ups

The 2026-09-26 freeze/reconnect work is done: short drops, proxy restarts, out-of-order callbacks, the login race, the WebSocket deadlock, the proxy re-logging in by itself after losing the XMage server (`serverLink` banner instead of the login screen), a visible retry of the automatic re-login, the restore id on re-login, the resumable `seq` stream, the prompt cache kept until the answer, SIM seats across restarts, the short grace period for a closed tab (`leaving`, 45 s), the slower lobby poll during a game and the cheaper `recordFrame` (guarded by `scripts/verify-reconnect.mjs`, `OutboundLogTest`, `ReplayCacheTest`, `SimRosterTest`, `ProxyClientStreamTest`, `CallbackSequencerTest`, `GatewayCompressionTest`, `gateway-resilience.test.ts`). What is left:

| What | Why |
|---|---|
| RESOLVED 2026-10-06 — persist the resume token (`streamId`, `seq`) across a page reload | `pagehide` saves it per tab in `sessionStorage` (same proxy + account, 10 min max), the re-login after the reload presents it once and the proxy replays the frames of the gap; the page still rejoins for the board + prompt it lost. Logout forgets it. Guarded by `persistence.test.ts`, `gateway-connect.test.ts`, `Gateway.test.ts` and `e2e/reconnect-real.spec.ts` (reload mid-game → `resumed: true`) |
| RESOLVED 2026-09-28 — the restore id survives a proxy restart only for the same address (in memory) | `RestoreIds` now persists the per-account session id (`--restoreIds`, default `<tmpdir>/mage-proxy-restore-<wsPort>.json`, ignored after 10 min); a re-login after an IP change **and** a restart presents it and the server hands the old session over |

### 4.8 View fields the UI reads but the server never sends (2026-10-06)

Found while removing `any` from the web client: the contract schema (`web/schema/contract.schema.json`) is the authority on what a view carries, and these reads went through casts.

| What | Why |
|---|---|
| RESOLVED 2026-10-06 — commander tax was always +0 in a real game | `CommandZone` / `CommanderDamageMatrix` read `castCount`, which is in no view. No view field or proxy change was needed: the engine's `CommanderInfoWatcher` already writes the count into the commander's `rules` (`<b>Commander</b> 2 times played from the command zone.`, omitted at zero), upstream code, so beta sends it too. `commanderPlaysCount` parses it; fixtures and tests now carry that rule (`commanderInfoRule`) instead of the invented field, and `commanders.test.ts` checks the recorded `commander-zone` / `commander-4` frames (2 and 1 plays) |
| RESOLVED 2026-10-06 — copies on the stack were only recognised by name | The `[Copia N]` / `[Copy` names only ever existed in fixtures; the server sends the card's own name. For a spell, `CardView.originalIsCopy` is `Spell.isCopy()` (`setOriginalValues` runs on `SpellAbility.getCharacteristics`, which returns the stack `Spell` itself; upstream code, not a fork patch), so `isCopyCard` reads it and the storm fixture marks its copies that way |
| RESOLVED — two views of different games were diffed into animations | `useGameTransitions` compared `GameView.gameId`/`matchId`, which a `GameView` does not carry, so the guard never fired; it now takes the store's `gameId`, recorded with the view it came with (`START_GAME` switches the id before the new game's first view) |

### 4.9 Report pipeline (built 2026-10-09) — what is still open

Design and rejected alternatives in `docs/plans/2026-10-09-report-pipeline-design.md`. Built: capture (`web/src/system/report.ts` + `errorLog.ts`) → `report_issue` over the WebSocket that is already open → journal line + `reports/<date>/<id>.json` on the machine running the proxy → `scripts/issue-from-report.mjs` (dry-run unless `--yes`) → GitHub issue. Guarded by `ReportSinkTest`, `report.test.ts`, `ReportDialog.test.tsx` and `scripts/verify-report.mjs` (in the `verify` layer). Nothing publishes by itself and no report leaves a device without a click.

| What | Why |
|---|---|
| Desktop cannot deliver a report | Desktop dials its **own** local proxy (`launcher/src-tauri/src/main.rs` starts it; `web/src/state/gateway.ts` sends the target server *inside* `connect`), so a desktop report lands in `%LOCALAPPDATA%\today.xmage.nexus` and stops — even when playing on `beta.xmage.today`. The crash case that started all of this (issue #12) has no proxy at all. Open: package it well (bundle + log tails) and hand it to the player, or upload it from the launcher itself (Rust is not bound by the webview CSP), which needs a receiver and abuse limits |
| No reader for what lands | `xmage-status` has no Reports panel yet; today you read them with `node scripts/issue-from-report.mjs --list --host <user@host>`. Grouping by fingerprint is the whole point: 40 reports of one bug must look like one row |
| ~~Tunnels~~ — RESOLVED 2026-10-13 | playit retired (subscription lapsed). The public path is three cloudflared quick tunnels as user units with `Restart=always` + linger; `scripts/tunnel-sync.mjs` rewrites the hostnames everywhere after a rotation and `docs/deploy-tunnels.md` documents the setup. Known trade-off: quick-tunnel hostnames rotate on every tunnel restart — the GitHub Pages link is re-pointed automatically by the script, but a named tunnel (needs a domain) remains the upgrade path if a permanent hostname is ever wanted |
| ~~Visitor counting~~ — RESOLVED 2026-10-13 | `ops/status` no longer reads the playit log: public visitors are counted from the proxy's `ws_open` activity lines (real IP via Cloudflare's `CF-Connecting-IP`/XFF). Tunnel liveness is a `pgrep` count (n/3 units up). History accumulated before the switch came from the playit log format and is kept as-is |

### 4.10 Interactive demo on GitHub Pages (built 2026-10-13) — what is still open

`site/demo/` is the real web client built with `vite build --mode demo` (`npm --prefix web run build:demo`), running entirely in the browser: `src/demo/DemoSocket.ts` replaces the WebSocket with the e2e `FakeServerCore`, `src/demo/boot.ts` seeds a session (wizard skipped, auto-login as `Planeswalker`, three starter decks), and `src/demo/DemoTour.tsx` is the floating menu (lobby, ELO ranking and tier ladder, deck gallery, deck builder with EDHREC suggestions, history, settings, plus 12 scripted scenarios chosen with `?scenario=<id>`). Games follow a fixed script — it is not the XMage rules engine, and the landing says so. Guarded by `src/demo/*.test.ts` and `scripts/verify-demo.mjs`, wired into `pages.yml`.

| What | Why |
|---|---|
| Tour copy is English only | `DemoTour.tsx` hard-codes its strings; the rest of the client is translated in 9 locales. Move them into `game`/`lobby`-style namespaces if the landing's language switch should carry into the demo |
| EDHREC is frozen for one commander | `demoEdhrecPage` only answers `krenko-mob-boss` (the starter Commander deck); any other commander shows "not found". Deck builder search and EDHREC card resolution still call Scryfall live, so the demo needs internet and honours its rate limit |
| Roster, ratings and tables are invented | `src/demo/data.ts`. Match counts only (no fabricated win/loss), as the real server sends. Ratings are labelled nowhere in the UI as sample data; a visible "sample data" hint on the leaderboard would be more honest |
| Not a layer on the status dashboard | `verify-demo.mjs` fails the Pages run but `status.json` has no row for it, so a skipped demo is only visible in the run |
| Not covered: replay viewer, spectate, chat bots | Spectating a table and the replay viewer need a scenario that streams frames; the chat is the fixture echo only |
| Mobile layout unchecked | Verified at 1440×900; the tour panel has a narrow-width rule but no screenshot below 520 px |

---
