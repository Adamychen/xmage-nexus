---
name: mage-visual-qa
description: QA visual y UX: MCP Playwright (snapshot para actuar + screenshot para verificar y leer el PNG), multi-viewport y WebKit, regresión visual opt-in de la galería (E2E_VISUAL + toHaveScreenshot), estado determinista (window.__mageScene, data-testid) y auditoría de pantallas. Keywords: visual, UX, screenshot, playwright, MCP, webkit, viewport, galería, gallery, baselines, toHaveScreenshot, E2E_VISUAL, overlap, clipping, a11y.
---

# QA visual y UX

## Reglas de oro

1. Snapshot para ACTUAR (accessibility), screenshot para VERIFICAR. Tras cada paso relevante:
   `browser_take_screenshot` y LEER el PNG (Read) para cazar solapes, clipping, estados vacíos
   y tablero mal pintado.
2. En specs: aserciones deterministas (DOM/`__mageScene`), nunca por píxeles sueltos. La
   regresión visual formal es `toHaveScreenshot` con animaciones desactivadas y datos fijos.
3. El tablero es DOM/CSS (no canvas): usa `sceneClick`/`[data-card-id]`, no coordenadas.

## MCP Playwright

- Registrado en `opencode.json` -> `node scripts/playwright-mcp.mjs --headless --viewport-size
  1600x900` (reutiliza el Chromium de `web/node_modules/playwright-core`; versión de
  `@playwright/mcp` fijada con `PLAYWRIGHT_MCP_VERSION`).
- Artefactos: `.run/playwright-mcp/` (snapshots `page-*.yml`, PNG, `console-*.log`).
- URLs: stack real `http://localhost:5173` (`node scripts/ctl.mjs start`); galería sin backend
  `http://localhost:5173/#/gallery`; el fake de tests levanta vite 5175 + FixtureServer 8789
  (no hay app fake permanente).
- Reproducir pantallas inyectando estado: `window.__mageStore.setState(...)` (solo DEV; patrón de
  `draft.spec.ts`/`tournament.spec.ts`).
- Alternativa CLI: tool MCP `mage_e2e { spec, grep, backend: fake|real, includeKnownBroken }`.

## Suite e2e

- `npm --prefix web run test:e2e` (fake, sin stack; vite propio en 5175), `:real`
  (`E2E_BACKEND=real`, requiere stack y usa 5173), `:webkit` (`E2E_BROWSER=webkit`),
  `:spells|targeting|combat|fullflow` (tags).
- Matriz: `E2E_VIEWPORT=1366x768|1920x1080|2560x1440`; default Chromium 1600x900. WebKit es
  motor real del launcher (WKWebView en macOS; WebView2 en Windows): probarlo es producción.
- `web/e2e/known-broken.ts`: lista vacía (2026-09-12). Si un fake falla estable, añade su título
  exacto `_grepTitleWithTags` + firma/evidencia en AGENTS.md; `E2E_INCLUDE_KNOWN_BROKEN=1` los
  re-incluye para triage.
- `locale: 'es-ES'` es obligatorio (los specs buscan texto en español); `workers: 1`,
  timeout 120 s.

## Regresión visual (galería)

- `web/e2e/gallery.spec.ts` con `E2E_VISUAL=1`: 48 baselines por combinación en
  `web/e2e/gallery.spec.ts-snapshots/` (`*-<WxH>-<navegador>-<plataforma>.png`),
  recorte de `.gallery-stage`, red externa bloqueada, `GALLERY_EPOCH` fijo y
  `reducedMotion: 'reduce'` (las animaciones infinitas se apagan por CSS).
- Matriz completa (chromium+webkit × 1366x768/1920x1080/2560x1440):
  `node scripts/gallery-visual.mjs` (verifica) / `--update` (regenera) /
  `--dry-run` / `--browser=… --viewport=…`. Alternativa directa:
  `npm --prefix web run test:e2e:visual[:update]` (solo chromium 1920x1080; no hay
  baselines de 1600x900, ese viewport es solo el del loop e2e diario. Ojo:
  `gallery.spec.ts` a secas también matchea `decks-gallery.spec.ts`).
- Bajo `reducedMotion: 'reduce'` (que la galería activa) las flechas y la línea de
  targeting van **sólidas**: el trazo discontinuo tiene fase ligada a la longitud
  sub-píxel del path y variaba entre sesiones (hasta 2 820 px en arena@2560). No
  devuelvas el dash sin resolver antes esa fase.
- `maxDiffPixels: 1200` queda como margen del AA del marcador; no lo bajes sin
  repetir la medición (regresiones reales >2 500 px).
- Pendiente (plan4): cablear la matriz en CI (necesita baselines Linux,
  `playwright install --with-deps webkit`) y la revisión de `solo teclado`.
- Capturas de verificación humana: `web/e2e/fixtures.ts` (`autoShot`, fullPage, sufijo
  `-FAILED`) en `web/e2e/shots/` (gitignored); varios specs escriben PNG propios.

## Estado y selectores

- `window.__mageScene` (`web/src/board/sceneBridge.ts`, solo DEV): `cards`, `playable`,
  `click(id)`, `targeting`, `combat`, `game`, `gameView`; se refresca cada 500 ms SALVO si hay
  vuelos activos -> puede ir un frame por detrás.
- Helpers `web/e2e/support/`: `scene.ts` (sceneClick, waitSceneTargeting/Combat), `canvas.ts`
  (clickHandCard/BattlefieldCard/PlayerTarget), `frames.ts` (frames/GameView, waitFrame,
  nextManaSource), `game-screen.ts` (feedbackDialog, payMana, waitPlayable), `start-game.ts`
  (`GameSession`).
- Atributos estables: `[data-card-id]`, `[data-player-id]`, `[data-role]`, `data-hand-count`,
  `data-life`, `data-prompt-method`; testids `setup-skip`, `staging-start`, `hand-bar`,
  `game-status`, `draft-*`, `bracket-*`, `confirm-modal-ok`, etc.

## Rutas para auditar

| Pantalla | Cómo llegar |
| --- | --- |
| Login / wizard | `goto('/')` en contexto limpio; `setup-skip` |
| Lobby / crear mesa | login (fake 8789 o real 8787); botón Nueva; `.create-submit-btn` |
| Staging / partida | crear mesa vs SIM; `staging-start`; esperar `game-status` |
| Draft / Construct | inyección de store o escenarios `fixtures/scenarios/draft.ts` |
| Torneo | `TournamentPanel` / bracket modal (galería `screen:tournament`) |
| Deck builder | Lobby -> Mis Mazos -> `.decks-gallery` (o galería `screen:decks`; usa IndexedDB real) |
| Galería (dev) | `#/gallery`: estados reales (frames + prompts + pantallas) sin stack |

## Trampas

- Animaciones: `html.fx-off`, `prefers-reduced-motion`, `animations:'disabled'` en
  `toHaveScreenshot`; no evaluar posiciones durante vuelos.
- Imágenes de cartas = red (Scryfall): bloquear red externa para determinismo.
- Nada de `Date.now()` en fixtures visuales (usar `GALLERY_EPOCH`).
- Los baselines llevan plataforma/navegador en el nombre: otro SO/navegador = regenerar.
- En la galería, pantallas `position:fixed;inset:0` (draft/construct) se ven descentradas por el
  sidebar dev: no es bug real.
- Puertos aislados (fake 5175/8789, real 5173/8787): no compartir; el fake usa FixtureServer, no
  el proxy.
- Hallazgos UX abiertos de plan4 (§5): revisar `plan4.md`, `docs/qa/p5-1-prompt-checklist.md` y
  `p5-2-heuristic-findings.md` antes de dar por cerrada una auditoría.
