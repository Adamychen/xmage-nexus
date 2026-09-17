---
name: mage-test-suite
description: Use cuando haya que ejecutar o interpretar la suite de tests del Mage (scripts/test.mjs), decidir qué capas correr tras un cambio, validar criterios de éxito (unit, coverage, typecheck, build, java, self-test, human-test, e2e, i18n) o antes de declarar una tarea "terminada". Keywords: tests, suite, capas, coverage, self-test, human-test, e2e, i18n, mcp, fuzz, validación.
---

# Mage.Proxy — Suite de tests

## Orquestador

`node scripts/test.mjs [capa...] [--skip=a,b]` — sin args corre TODAS las capas en orden.
Código de salida 0 = todo verde. Vía MCP: `mage_run_tests { layers, skip }`.

| Capa | Comando efectivo | Requiere stack | Criterio |
| --- | --- | --- | --- |
| `unit` | `npm --prefix web run test` (vitest) | no | todos los tests pasan (incluye las guardas de contrato) |
| `coverage` | `npm --prefix web run test:coverage` | no | pasa los thresholds de `web/vitest.config.ts` (lines/functions/statements 70, branches 55) y no baja respecto a PROJECT.md |
| `typecheck` | `npm --prefix web run typecheck` | no | sin errores |
| `build` | `npm --prefix web run build` | no | build completo (regenera splash-i18n) |
| `java` | `mvn -f Mage.Proxy/pom.xml test` (con artefactos del fork) | no | tests del proxy pasan |
| `self-test` | `node scripts/self-test.mjs` (E2E headless WS) | server + proxy | todos PASS, 0 FAIL |
| `human-test` | `node scripts/human-test.mjs` (jugador humano vs IA) | server + proxy | todos PASS |
| `e2e` | `npx playwright test` (en web) | solo en real | 0 failed |
| `i18n` | `node scripts/i18n-coverage.mjs` (894 claves, whitelist) | no | sin claves faltantes ni copias por encima del umbral |

Fuera del orquestador (capas del CI en `.github/workflows/web-ci.yml`):
- MCP: `npm --prefix mcp run typecheck` + `npm --prefix mcp test` (nunca escribe a stdout).
- Fuzz/soak: `node scripts/fuzz.mjs [--games=N --concurrency=N]` (protocolo/proxy/servidor).
- Multi-tenant: `node scripts/multi-tenant-test.mjs` (aislamiento de sesiones del proxy).
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
2. `PROJECT.md` actualizado: tabla de calidad, lecciones y log con fecha (y header).
3. `web/INTERACTION_COVERAGE.md` (callbacks/mecánicas tocadas + fecha) y `site/content.json` si
   cambian fases/paridad.
4. Nada sin validar en `web`, Java del proxy ni el fork.
