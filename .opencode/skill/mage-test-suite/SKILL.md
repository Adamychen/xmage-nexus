---
name: mage-test-suite
description: Use cuando haya que ejecutar o interpretar la suite de tests del Mage (scripts/test.mjs), decidir qué capas correr tras un cambio, validar criterios de éxito (unit, coverage, typecheck, build, java, self-test, human-test, verify, verify-restart, fuzz, e2e, i18n) o antes de declarar una tarea "terminada". Keywords: tests, suite, capas, coverage, self-test, human-test, e2e, i18n, mcp, fuzz, validación.
---

# Mage.Proxy — Suite de tests

## Orquestador

`node scripts/test.mjs [capa...] [--skip=a,b]` — sin args corre TODAS las capas en orden.
Código de salida 0 = todo verde. Vía MCP: `mage_run_tests { layers, skip }`.

| Capa | Comando efectivo | Requiere stack | Criterio |
| --- | --- | --- | --- |
| `unit` | `npm --prefix web run test` (vitest) | no | todos los tests pasan (incluye las guardas de contrato) |
| `coverage` | `npm --prefix web run test:coverage` | no | pasa los thresholds de `web/vitest.config.ts` (líneas/funciones/statements 60, branches 45; el ámbito es net+state+board+cards+feedback, unas 4.950 líneas) |
| `typecheck` | `npm --prefix web run typecheck` | no | sin errores |
| `build` | `npm --prefix web run build` | no | build completo (regenera splash-i18n) |
| `java` | `mvn -f Mage.Proxy/pom.xml test` (con artefactos del fork) | no | tests del proxy pasan |
| `self-test` | `node scripts/self-test.mjs` (E2E headless WS) | server + proxy, READY | todos PASS, 0 FAIL |
| `human-test` | `node scripts/human-test.mjs` (jugador humano vs IA) | server + proxy, READY | todos PASS |
| `verify` | `node scripts/test.mjs verify` (9 scripts, ~100 s) | server + proxy, READY | los 9 salen con código 0 |
| `verify-restart` | `node scripts/test.mjs verify-restart` | server + proxy | `verify-reconnect.mjs` 100% (reinicia el proxy: no lo mezcles con otras capas) |
| `fuzz` | `node scripts/fuzz.mjs [--games=N --concurrency=N]` | server + proxy | 0 anomalías (20 partidas por defecto: nightly) |
| `e2e` | `npx playwright test` (en web) | solo en real | 0 failed |
| `i18n` | `node scripts/i18n-coverage.mjs` (894 claves, whitelist) | no | sin claves faltantes ni copias por encima del umbral |

El orquestador espera a `/ready` del proxy antes de las capas con stack, y avisa si el stack
lleva más de una hora en pie o acumula 20+ sesiones: ahí el canal de callbacks del servidor se
degrada y `verify`/`self-test` fallan con "sin vistas" (el juego se ve congelado en el turno 2
porque no llega ninguna vista). Eso no es un fallo de código: reinicia el stack y repite.

Fuera del orquestador (capas del CI en `.github/workflows/web-ci.yml`):
- MCP: `npm --prefix mcp run typecheck` + `npm --prefix mcp test` (nunca escribe a stdout).
- Validadores de generados: `mage_validate_generated` / `npm run gen-*:validate` (skill
  `mage-contract-codegen`).

## Cuándo correr cada cosa

- Tocar `web` → `unit` + `typecheck` (mínimo); `build` si cambió la build; `e2e` si cambió
  UI/flujo; `i18n` si hay strings nuevos.
- Tocar Java del proxy (`Mage.Proxy/src`) → `java` + `node scripts/build.mjs proxy` +
  `node scripts/ctl.mjs restart all` (el jar cambia: el stack ejercita el jar viejo si no se
  recompila).
- Tocar contrato/schema/generados → `unit` (guardas) + `typecheck` + skill `mage-contract-codegen`.
- Tocar `e2e/support/` o `fixtures/scenarios/` → e2e fake completo + real (skill `mage-e2e-sim`).
- Validación final de tarea → `node scripts/test.mjs` con el stack arriba (skill `mage-stack`).

## Matices de la capa `e2e`

- En modo fake (default) NO necesita stack: Playwright levanta su propio vite en 5175 y el
  FixtureServer en 8789. En modo real (`E2E_BACKEND=real`) sí exige el stack (vite 5173 + proxy
  8787) y `test.mjs` reporta SKIP con el hint si falta.
- La suite fake tarda ~10 min; el timeout interno del orquestador para Playwright es 1800 s.
- `E2E_BROWSER=webkit` / `E2E_VIEWPORT=AxB` para la matriz de navegador/resolución (skill
  `mage-visual-qa`).

## Flakes conocidos

- `self-test` puede fallar en `WATCHGAME` SOLO en la primera partida tras arranque en frío del
  servidor. El test ya reintenta. Verificar que no es bug real: el proxy no loguea
  `event >> GAME_INIT` y `server.out.log` tiene `SESSION CALLBACK EXCEPTION - Unable to create
  socket`. Reintentar en caliente → debe pasar; si falla repetidamente, es bug real.
- Tras reiniciar solo el proxy, el primer login se cuelga (sesiones huérfanas): usar
  `restart all` antes de dar un fallo por bueno.
- `decks-gallery.spec.ts`/`draft.spec.ts` han tenido flakes ligados al WIP de `web/src/decks/*`:
  si fallan, re-ejecutar el spec en solitario antes de investigar.

## Checklist "tarea terminada"

1. Suite completa en verde (`node scripts/test.mjs`) o capas relevantes + validadores de
   generados si se tocó el contrato.
2. Docs afectados: `ROADMAP.md` §4, `docs/lessons.md` si hay lección nueva, `site/content.json` si cambian fases.
3. `web/INTERACTION_COVERAGE.md` (callbacks/mecánicas tocadas + fecha) y `site/content.json` si
   cambian fases/paridad.
4. Nada sin validar en `web`, Java del proxy ni el fork.
