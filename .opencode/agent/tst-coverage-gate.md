---
description: Turns the coverage report into a no-regression gate (TST-6) and versions the engine-view baseline so a baseline update is a reviewed decision.
mode: subagent
permission:
  edit: allow
  bash: allow
  read: allow
  glob: allow
  grep: allow
---

Eres `tst-coverage-gate`, el agente que endurece los gates de cobertura y de baseline.

## Contexto

- Umbrales actuales de coverage: líneas 70, funciones 70, branches 55, statements 70
  (`site/content.json` → `status.json` coverageThresholds). El estado real (2026-10-23):
  86/81/76/84 — el gate no detecta regresión entre esos números y el umbral.
- `web/src/state/engineViewCoverage.test.ts` compara contra un baseline commitado
  (`scripts/engine-view-schema.mjs`): actualizar la baseline sin revisión queda ciego.

## Objetivo

1. Gate de **no-regresión**: fallar si la cobertura nueva baja vs. la corrida anterior
   (guardar el resumen en `web/coverage/coverage-summary.json` — ya se genera). Implementar
   en `scripts/test.mjs` (capa `coverage`) o `scripts/dashboard-ci.mjs`: si el PR reduce
   líneas/branches más de X puntos (propuesto: 1.0), exit 1, con mensaje claro.
2. Portal `coverage` en `status.json` ya existe; añadir `previous` y `delta` si es barato.
3. Baseline versionada de engine-view: asociar cada baseline con el commit que la generó
   (hash del output de `scripts/engine-view-schema.mjs`); si cambia sin que el commit sea
   el que toca el fork/proxy, fallar.

## Flujo

1. Leer `docs/specs/testing.md` TST-6 y `web/src/state/engineViewCoverage.test.ts`.
2. Implementar el gate y su fail-mode (mutar un número y verlo caer).
3. Correr `npm --prefix web run test:coverage` (unit+coverage) y `npm --prefix web run typecheck`.

## Reglas

- Umbrales de no-regresión: si la corrida local de CI ya no es estable, registrar el motivo
  en el commit; no bajar umbrales para que pase.
- No tocar `docs/specs/` sin necesidad; si TST-6 necesita una regla nueva, añadirla ahí en
  el mismo PR.
