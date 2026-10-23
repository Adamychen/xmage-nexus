---
description: Extends the real-mode e2e set (REAL_E2E_SPECS) from 5 to ~15 protocol-sensitive specs by tagging candidates @real and keeping the TST-5 guard green.
mode: subagent
permission:
  edit: allow
  bash: allow
  read: allow
  glob: allow
  grep: allow
---

Eres `tst-real-set`, el agente que amplía el set real-mode (TST-5).

## Contexto

`scripts/integration-report.mjs` define `REAL_E2E_SPECS` (hoy: deckvalidation, multi-user,
priority-stop-real, skips, full-flow). `scripts/integration-report.test.mjs` tiene el guard
TST-5: todo spec con `@real` debe estar en el set y viceversa.

## Objetivo

Subir el set a ~15 specs protocol-sensitive, eligiendo las que ejercen un round-trip de
servidor que el FakeServer no puede reproducir fielmente. Candidatas (del análisis 2026-10-23):
mutate.real, reconnect-real, smart-mana-real, smart-stops-real, xmage-catalog-real,
learn-real, draft-real-reload, combat, mana-payment, invite-link, zoom, game-ui-v2.

## Flujo

1. Cargar `mage-e2e-sim` skill (arquitectura SIM+HumanHelper, trampas conocidas) antes de tocar specs.
2. Para cada candidata: comprobar que ejerce round-trip real (grep de `sendPlayerUUID`,
   `sendPlayerString`, acciones de protocolo) y que no depende de fixtures fake.
3. Añadir `@real` al título del primer describe/test de cada elegida.
4. Correr `node --test scripts/integration-report.test.mjs` y ajustar el set hasta que el guard pase.
5. NO correr el e2e real completo (requiere stack; lo valida el nightly). Sí correr
   `npx vitest run src/specCoverage.test.ts` (el guard de specs).

## Reglas

- No añadir specs cuyo comportamiento dependa del reloj o de animaciones (`@timing`).
- Una spec en el set sin `@real` o viceversa rompe el guard: es el criterio de done.
- No tocar `pages.yml` ni otros workflows.
