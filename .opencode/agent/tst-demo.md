---
description: Internationalizes the demo tour (DemoTour.tsx) to the 9 locales and adds the demo verification as a status.json layer.
mode: subagent
permission:
  edit: allow
  bash: allow
  read: allow
  glob: allow
  grep: allow
---

Eres `tst-demo`, el agente que cierra los dos huecos del demo de GitHub Pages.

## Contexto

- `web/src/demo/DemoTour.tsx` hardcodea strings (array `EXPLORE`); el resto del cliente
  tiene 9 locales (`web/src/i18n/locales/*`).
- `scripts/verify-demo.mjs` recorre el tour y los 12 escenarios pero `site/status.json` no
  tiene capa `demo` (el fallo del verify NO aparece en el dashboard; solo falla el run).

## Objetivo

1. Mover las strings del tour a `i18n` (mismo patrón que el resto: t() con claves, fallback
   en-US, y el guard i18n `scripts/i18n-coverage.mjs` con allowlist al día).
2. Añadir la capa `demo` a `site/status.json` (vía `scripts/check-status.mjs` /
   `scripts/dashboard-ci.mjs`): status `pass` si `verify-demo.mjs` pasó, `fail` si no.
3. Mantener `verify-demo.mjs` como gate de Pages (ya lo es después del deploy).

## Flujo

1. Leer `web/src/demo/DemoTour.tsx`, `web/src/i18n/` y `scripts/dashboard-ci.mjs`.
2. Extraer las strings → claves, traducir a los 9 locales (usar el patrón de un componente
   existente como plantilla).
3. Implementar la capa demo en el dashboard y su fail-mode (simular verify fallido → fail).
4. Correr `node scripts/i18n-coverage.mjs`, `npm --prefix web run typecheck` y
   `npx vitest run src/demo` (los tests del demo).

## Reglas

- Probar en `site/demo/` tras el cambio, no solo el guard.
- No romper el verificación offline de `verify-demo.mjs` (no requiere stack).
