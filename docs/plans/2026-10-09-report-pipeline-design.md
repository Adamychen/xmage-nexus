# Report pipeline: from "something feels wrong" to a GitHub issue

Design validated with the user on 2026-10-09. Scope of phase 1 is the **web path** (player
connected through the deployed proxy). Desktop and the tunnel doc cleanup are listed as later
phases, not silently dropped.

## 1. The problem

Reports from players arrive without context, so triage means re-interviewing the reporter.

- Issue #12 (open) is one paragraph of complaints plus a Windows launcher crash. The reporter
  wrote "I didn't want to flood your issues page with bugs and I don't see a feedback section so
  I had to do it this way", and could not attach the logs the error message itself named
  (`%LOCALAPPDATA%\today.xmage.nexus\logs`).
- Issue #4 and #11 name cards but no version, no server, no turn, no view.

The bottleneck is not the number of reports, it is that the ones that arrive carry nothing to
reproduce with. Everything below exists to move context, not to collect text.

## 2. What was rejected, and why

- **Clipboard + prefilled `issues/new?body=…` only.** Needs a GitHub account, so it only serves
  the few players who would have opened an issue anyway; it also cannot carry the bundle (a body
  that long exceeds what a URL survives). Kept as a *fallback* for desktop, not as the system.
- **A public HTTPS ingest endpoint** (Cloudflare Worker holding a PAT, or a public `/feedback` on
  the host). Unauthenticated write path into a public tracker: spam, and PII disclosed without a
  human in the loop. Also needs a `connect-src` change, and the host dashboard is LAN-only on
  purpose (tunnel visitors look like localhost, see `ops/status/README.md`).
- **Auto-publishing anything.** No report reaches GitHub without a human reading it.
- **Shipping a GitHub token in the client.** Extractable from any shipped bundle; a public repo
  plus a write token is a self-inflicted incident.

Consequence that decides the shape: **the reporter must not need a GitHub account.** The player
clicks once; the maintainer is the one who opens the issue.

## 3. Architecture

```
ReportDialog (web)                    Mage.Proxy                            host
  capture  ─────────────────────────────────────────────────────────────────────
  └─ buildReport()                       report_issue action
     · DiagnosticBundle (exists)            ├─ one journal line  [activity] report …
     · console errors (new)                 └─ reports/<date>/<id>.json   (capped, pruned)
     · scene + fingerprint                          │
  send over the WS already open                     ▼
     · report_ack { id }  ─────────────►   xmage-status "Reports" panel
                                             · grouped by fingerprint
                                                   │
                                             scripts/issue-from-report.mjs  (run by the maintainer)
                                                   ▼
                                             GitHub issue, template + environment pre-filled
```

Transport is the WebSocket that is already open, because it is the only channel that works in
both front ends without a new surface: no CORS, no `connect-src` change (Tauri already allows
`ws:`), and no secret in the client. Landing is the host, promotion is a command the maintainer
runs with their own `gh` auth.

## 4. Contract

Client → proxy action, handled like the other non-game actions in `ProxyClient`:

```json
{ "type": "action", "action": "report_issue", "requestId": "r-42",
  "args": {
    "kind": "bug",
    "text": "Darksteel Angel: I lost and still had priority",
    "fingerprint": "bug:darksteel-angel:lost-with-priority",
    "bundle": { "…DiagnosticBundle…": "…" } } }
```

- **Requires an authorized session.** Reports go through the same `connections.contains(conn)`
  gate as game actions, so spamming the channel requires a working XMage login first.
- **Caps.** Flat wire, ≤ 96 KB; frames are trimmed to digests plus the last 12 whole frames
  inside a 32 KB budget. The message limit of the gateway is 1 MB and the flood control is
  100 msg/s, so a report must never approach either.
- **Quota.** 5 reports per connection, at most one per 30 s, and a repeated fingerprint inside a
  session is counted instead of stored. A report that cannot be stored still gets an
  `ok` result, so a player never sees an error for trying to report.
- **Ack.** `report_ack` returns the report id, which the UI shows ("referencia `a1b2c3d4`").

## 5. Landing

- Journal: one `[activity] report …` line with `id`, `kind`, `turn`, `bytes`, `fp` and a
  120-character sanitized excerpt of the player's text. Free text is kept off the per-action
  activity line (`Activity` only echoes `SAFE_ARGS`), and the whole body goes to the file.
- File: `reports/<YYYY-MM-DD>/<id>.json` under the directory given by `--reportsDir`
  (`OFF` disables the feature entirely). Pruned by count and by age so an unattended proxy
  cannot fill the disk.
- Never written, in either place: passwords, chat text, deck lists — the rule `Activity` already
  states. `GameActivity` (commander probes) is the precedent for "one line per real change".

## 6. Dashboard and promotion

`xmage-status` gains a Reports panel reading `REPORTS_DIR` (read-only, same LAN-only service, no
proxy involvement): count per fingerprint, kind, version, server, last seen, and the payload of
one report on click.

`scripts/issue-from-report.mjs` runs on the maintainer's machine: `--list` groups reports (from
`--dir` or `--host user@machine` over ssh), `--open <fp|id>` renders the body from the existing
`.github/ISSUE_TEMPLATE` (bug or feedback) with the environment block filled from the bundle, and
creates it with `gh issue create`. GitHub stays the single tracker; the pipeline only feeds it.

## 7. Testing

- Proxy: `ReportSinkTest` — caps, quota, fingerprint dedupe, sanitization (a `\n` in the text
  cannot forge a second journal line), off-switch, pruning. `mvn -f Mage.Proxy/pom.xml test`.
- Web: `report.test.ts` for the capture (bundle shape, frame budget, fingerprint stability),
  `ReportDialog.test.tsx` for the UI. The FakeServer gains the `report_issue` action so the
  dialog is testable in fake mode, and `window.__mageReport` exposes the last payload for E2E.
- Guard: the new action is listed in `INTERACTION_COVERAGE.md` and in the proxy protocol
  reference, per `AGENTS.md`.

## 8. Phases

**Phase 1 shipped 2026-10-09** (this document): capture (`web/src/system/report.ts`,
`errorLog.ts`), the dialog (`web/src/game/ReportDialog.tsx`, reachable from the game menu and
the crash screen), the transport (`report_issue` over the gateway), the landing
(`Mage.Proxy/.../ReportSink.java` + the `report` journal line), and the promotion
(`scripts/issue-from-report.mjs`, dry-run unless `--yes`). `scripts/verify-report.mjs` runs the
whole channel against the real proxy and is in the `verify` layer.

Two things changed while building it: the wire stays flat
(`{kind, fingerprint, text, viewport, errors, bundle}`) and the proxy stores the command
verbatim, because the first end-to-end run showed the file was dropping `errors` and `viewport`
- the two fields a maintainer reads first. The client-side oversize gate was also dropped: the
trims keep a report around 40 KB, so the cap is a server-side guard and the dialog just shows
whatever the proxy answers.

1. **This one (web).** Capture + transport + landing + dashboard panel + promotion script,
   against the deployed proxy.
2. **Desktop.** A launcher crash has no proxy and therefore no transport; the only thing possible
   there is to package well (bundle plus `proxy.log`/`server.log` tails) and hand it to the user
   (clipboard or file). Also: desktop dials its own local proxy even when playing on
   `beta.xmage.today` (`launcher/src-tauri/src/main.rs` starts the proxy; `gateway.ts` sends the
   target server *inside* `connect`), so "report to the host" cannot be the desktop default.
   Auto-upload from desktop would need a receiver; if it ever happens it goes through a native
   command, not the webview, and still needs the abuse controls.
3. **Tunnels.** Playit is gone from the docs and scripts. Verified on 2026-10-09: it is still
   `active` on the host and still took three real connections that day, while the three
   cloudflared quick tunnels are started by hand (no unit, no script), with rotating hostnames
   baked into `web/.env.production.local` and `--allowedOrigins`. Removing it is a production
   change and needs an explicit go-ahead, not a doc edit.
