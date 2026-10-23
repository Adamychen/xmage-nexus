# Testing robustness

Prefix: `TST`

How the project's own quality gates must behave, so that the real protocol never drifts
silently while the fake suite stays green. A rule here is held by a test exactly like a
behaviour rule: the test title carries the rule id, and `specCoverage.test.ts` fails when one
drifts. The testing layers themselves live in `docs/testing.md`; this file decides what they
must guarantee.

### TST-1 · Every state the client renders satisfies integrity invariants
Any `GameView` the web renders must be internally consistent: no object id appears in two
owning zones at once (battlefield, graveyard, exile, command list, sideboard, stack, hands,
revealed groups, watched hands), and the reported zone count (`handCount`) matches what the
client can see. The aggregated `exiles` view carries the same population as each player's
`exile` zone, so ownership is checked per player (adding both would double-count); `libraryCount`
has no full visible library view to compare against.

- Why: the fake suite replays recorded frames, so a protocol change that corrupts the state
  would stay green as long as the frames still replay. Verified against the current 128 frames:
  1,872 owning objects, 0 duplicated ids (probe 2026-10-23).
- Guard: `src/state/gameInvariants.test.ts`

### TST-2 · The invariants run over every recorded frame on every push
The TST-1 tests run on `web/fixtures/recorded/*.json` in `unit`, with no Java and no stack, so
a bad frame or a bad schema change fails before CI reaches the real stack.

- Why: the recorded frames are the cheapest real-protocol material the repo owns; they re-run
  on every push, unlike the five nightly real specs.
- Guard: `src/state/gameInvariants.test.ts`

### TST-3 · Every new fuzz anomaly signature blocks until triaged
The fuzz soak groups its anomalies by signature: a repeated state with no new prompts
(`sameStateUpdates` over the livelock threshold) and a prompt storm with no state change
(`promptsSinceUpdate` over its threshold) are different classes and are triaged separately. A
signature that has not been seen before makes the fuzz run fail; the failure is the queue for
the next triage: either a real bug (a regression test is written) or a known pattern (the
signature joins an allowlist with a reason).

- Why: the fuzz runs nightly and has reported eight livelocks in 280 games (2026-10-19..23),
  but nothing turns a signature into a regression test — the sensor does not close the loop.
- Guard: `scripts/fuzz-triage.test.mjs`

### TST-4 · A failed integration layer is a red run
When the integration report (`self-test`, `human-test`, `verify`, `verify-restart`, real e2e)
has a failing layer, the run that produced it must be red — no `continue-on-error` swallowing.
The published `status.json` carries the same status, and `scripts/check-status.mjs` already
fails the Pages run on any red layer.

- Why: before 2026-10-10 every nightly step ran `continue-on-error: true` and nothing read the
  result, so the nightly ran green for days while the published `status.json` said fake-e2e
  FAIL + integration FAIL (`AGENTS.md`, "Status dashboard").
- Guard: `scripts/workflows.test.mjs` (must be extended to forbid a
  `continue-on-error: true` on the integration step of `.github/workflows/pages.yml`)

### TST-5 · The real-mode e2e run covers every protocol-sensitive spec
The real e2e job runs the specs in `REAL_E2E_SPECS` in `scripts/integration-report.mjs`.
Every spec tagged `@real` (a spec that exercises a server round-trip the fake server cannot
faithfully reproduce) must be in that set, and every spec in the set must be tagged `@real`.

- Why: the nightly real-mode job covers eleven of ~330 specs; the set is the bound of what the
  real protocol proves, so it must be explicit and drift-checked (`ROADMAP.md` §4.4).
- Guard: `scripts/integration-report.test.mjs`

### TST-6 · Each guard has a verified fail mode
A guard whose verdict the suite cannot make red is not a guard. Every coverage gate and every
baseline-comparing guard (engine-view gap, mechanics, callbacks, invariants) must have a
fail-mode check: removing or corrupting the guarded fact makes the guard fail. The fail-mode
checks run in `scripts` or `unit`, never only manually.

- Why: an unverified guard can be silently maintained into a no-op; the repo already applies
  this routine to its layout guards ("verify the guard can fail", `AGENTS.md`).
- Guard: `src/state/gameInvariants.test.ts` (fail-mode tests); `scripts/coverage-gate.test.mjs`; `src/state/engineViewCoverage.test.ts`

### TST-7 · Isolated verify runs each script on a fresh proxy
The verify layer can opt in to isolation (`--isolate-verify` or `VERIFY_ISOLATE=1`): before
each verify script the proxy is restarted and the run waits for `/ready`, so every script
starts on a fresh proxy and clean server-side session state instead of degrading on a
long-lived stack. Isolation refuses to run together with `self-test`/`human-test`/`fuzz`
(those hold live sessions across a restart) and cleans the tables of the verify scripts whose
usernames are deterministically known (`multi-tenant-test.mjs`).

- Why: `AGENTS.md` documents that accumulated orphan sessions degrade the server callback
  channel and make verify/self-test flaky; the Phase 0 baseline (fresh stack) verified 10/10
  verify scripts in 83 s with zero residue. Default behaviour stays unchanged when isolation is off.
- Guard: `scripts/verify-isolate.test.mjs`
