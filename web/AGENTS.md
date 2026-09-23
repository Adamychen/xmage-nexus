# web — Mage.Proxy web client

React 19 + Vite + TypeScript client. It communicates **only** with the
proxy over a JSON WebSocket and contains **no XMage/Java code**.

## Scope

- This folder is fully isolated from the Java proxy and the XMage fork.
- You do **not** need Java, Maven, or the XMage fork to work here.
- The only deliberate coupling to the proxy is the protocol contract:
  `web/schema/contract.schema.json` → `web/src/net/types.generated.ts`
  (regenerate with `npm run gen-types` after editing the schema).

## Everyday workflow (no stack needed)

- `npm install` (once)
- `npm run dev` — Vite dev server (port 5173)
- `npm run test` / `test:coverage` — vitest (pure logic)
- `npm run typecheck` — `tsc -b --noEmit`
- `npm run build` — `tsc -b && vite build`
- `npm run test:e2e` (alias `test:e2e:fake`) — Playwright against the
  **FakeServer** (`web/fixtures/fake.ts`): a Node WS server that speaks the real
  protocol derived from `web/src/net/types.ts`. No proxy, no server, no flakes.
  Dynamic port per test (`FakeServer.start(0)` + `setFakePort`; 8788 is the Java
  proxy's HTTP test page — never use it here), `fullyParallel` with up to 4
  workers (`E2E_WORKERS` to override).
- `E2E_BACKEND=real npm run test:e2e:real` — against a live stack (needs the
  proxy running; see `Mage.Proxy/AGENTS.md`). Use only as the anti-drift net.
- `#/gallery` — P3 gallery of states (dev only): 160+ entries (the builder
  reads `web/fixtures/recorded/manifest.json` dynamically: 115 recorded frames
  today + prompts + screens/variants), no stack needed. `npx playwright test
  e2e/gallery.spec.ts` walks every entry (0 page errors); visual regression is
  opt-in (`E2E_VISUAL=1`) with baselines per platform/browser/viewport, matrix
  in `scripts/gallery-visual.mjs` (`--update` to regenerate).

## Rules

- After touching `web/`: run `unit` and `typecheck` (and `build` if the build
  changed).
- Do not hand-edit `web/src/net/types.generated.ts` — regenerate it.
- The protocol contract in `web/schema/contract.schema.json` is the single
  source of truth for the wire format.
- `web/COMPONENT_PARITY.md` tracks Desktop↔Web feature parity per module
  (15 units): when closing a unit audit, update its row (Estado + Evidencia +
  Última verif.) and mirror only `yes/partial/no` into `site/content.json`.
- **Every request to `api.scryfall.com` goes through `web/src/cards/scryfallClient.ts`**
  (`scryfallFetch` / `scryfallJson`, or `fetchCardJson` in `scryfallCards.ts` for cards):
  one global queue (150 ms spacing, 3 in flight, common pause + `Retry-After` on 429),
  in-memory + IndexedDB cache. The queue clock and the 429 pause are shared across tabs
  over a `BroadcastChannel` (`xmage-scryfall-budget`), because Scryfall's limit is per IP,
  not per tab. Anything that resolves card art or JSON must use the cache-backed
  `scryfallJson` path (never raw `scryfallFetch`) unless it needs the `Response` itself.
  Never call `fetch('https://api.scryfall.com/…')` directly and
  never use `…?format=image` API URLs as `<img src>` (they count against the limit; use the
  `image_uris` CDN URLs from the card JSON, e.g. `useCardArtUrl`). Guarded by
  `e2e/scryfall-budget.spec.ts`. Use `{ urgent: true }` only for user-driven requests.
- Do not commit unless explicitly requested.
