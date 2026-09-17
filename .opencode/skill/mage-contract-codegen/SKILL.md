---
name: mage-contract-codegen
description: Contrato del protocolo XMage y codegen: añadir callbacks/tipos view/acciones del proxy, modelar campos en contract.schema.json, regenerar generados (gen-types/gen-zod/gen-server-state/splash) y pasar las guardas callbackCoverage/mechanicsCoverage/engineViewCoverage/serverStateCoverage + INTERACTION_COVERAGE.md. Keywords: contrato, protocol, schema, codegen, gen-types, gen-zod, gen-server-state, guardas, callbackCoverage, mechanicsCoverage, engineViewCoverage, serverStateCoverage, INTERACTION_COVERAGE, KNOWN_UNHANDLED, baseline, ALLOWED_EXTRA.
---

# Contrato y codegen

## Regla 0

`docs/protocol.md`: la verdad es, por orden, (1) wire real XMage 1.4.61-V1, (2) `Mage.Proxy/README.md`,
(3) `contract.schema.json` -> generados, (4) `web/src/net/types.ts`. NUNCA editar a mano:
`web/src/net/types.generated.ts`, `web/fixtures/schema.generated.ts`, `web/public/splash-i18n.js`,
el bloque `keywords` de los locales, los JSON oráculo (`server-view-schema.json`,
`server-state-schema.json`, `engine-view-gap*.json`) ni `recorded/*`.

Pipeline:

```
contract.schema.json --gen-types--> web/src/net/types.generated.ts  (re-export en net/types.ts)
                     --gen-zod----> web/fixtures/schema.generated.ts (zod del GameView)
fork mage.view.*  --view-schema.mjs--------> server-view-schema.json  -> mechanicsCoverage
fork mage.game.*  --engine-view-schema.mjs--> engine-view-gap*.json   -> engineViewCoverage
fork config.xml   --server-state-schema.mjs-> server-state-schema.json -> serverStateCoverage
ClientCallbackMethod.java -> callbackCoverage + INTERACTION_COVERAGE.md
```

## Recetas

### Callback nuevo (server -> cliente)

1. ¿Pide input al jugador? -> `web/src/game/feedback/parse.ts` (+ componente en
   `web/src/game/feedbackModes/` o diálogo; router `web/src/game/FeedbackDialog.tsx`).
   ¿Solo estado? -> `case` en `web/src/state/eventHandler.ts` con el cuerpo en
   `web/src/state/events/<dominio>.ts` (chat/game/prompts/sideboard/draft/tournament/replay/views).
2. Fila en `web/INTERACTION_COVERAGE.md` Tabla A. Si aún no se implementa:
   `KNOWN_UNHANDLED` en `callbackCoverage.test.ts` con motivo.
3. Verificar: `npm --prefix web run test` + `npm --prefix web run typecheck`.

### Tipo view o campo nuevo (clase `mage.view.*`)

1. Modelarlo en `web/schema/contract.schema.json` (`definitions`, nombre PascalCase de la clase Java).
2. `cd web && npm run gen-types && npm run gen-zod && npm run gen-server-state`,
   y luego los `:validate` equivalentes.
3. Si el cambio viene del fork: regenerar el oráculo con `node scripts/view-schema.mjs`.
4. Map-subclass (`ExileView`/`MutateView`): el proxy anida las entradas del mapa bajo `cards`.
5. Afecta a `mcp/` (importa `types.generated.ts`): `npm --prefix mcp run typecheck && npm --prefix mcp test`.

### Acción del proxy (cliente -> servidor)

1. `Mage.Proxy/.../CommandDispatch.java` -> `case` en `Info|Table|Tournament|GameCommands.java`;
   parsear con `JsonArgs`; responder con el envelope de `ProxyProtocol.resultJson`; si es
   game-scoped, añadirla a `requiresGameId` de `ProxyClient.java`.
2. Wrapper TS en `web/src/net/commands.ts` y llamada desde el cliente.
3. `node scripts/build.mjs proxy` + `node scripts/ctl.mjs restart proxy` (mejor `restart all`).

## Generados: regenerar / validar

| Generado | Regenerar (en `web/`) | Validar |
| --- | --- | --- |
| `types.generated.ts` | `npm run gen-types` | `npm run gen-types:validate` |
| `schema.generated.ts` (zod) | `npm run gen-zod` | `npm run gen-zod:validate` |
| `server-state-schema.json` | `npm run gen-server-state` | `npm run gen-server-state:validate` |
| `public/splash-i18n.js` | `npm run gen-splash-i18n` (también en `build`) | `npm run gen-splash-i18n:validate` |
| bloque `keywords` i18n | `node scripts/gen-keywords-i18n.mjs` | `--check` |

`npm run gen` = los 3 principales. Validación agregada: tool MCP `mage_validate_generated`.
CI: `.github/workflows/web-ci.yml` (jobs web/mcp/proxy/e2e-fake/integration) y
`scripts/dashboard-ci.mjs`.

## Convenciones del schema

- JSON Schema draft-07, SOLO `definitions`, referencias `#/definitions/X`; nombres = clase Java.
- camelCase (reflejo de `JsonUtil`); UUID y enums como `string`; fechas/epoch millis `number`;
  `Optional` desempaquetado.
- Sin `required` => todas las props opcionales. Nulabilidad: `["string","null"]`, `anyOf` con
  `{type:'null'}` o `"null"` directo.
- Herencia con `allOf` (p.ej. `PermanentView extends CardView`); mapas con `additionalProperties`
  -> `Record<string,T>`; `{}` = unknown/any; `enum` soportado por los generadores.
- `gen-zod` solo valida los campos de GameView del allowlist `GAME_VIEW_FIELDS` de `scripts/gen-zod.mjs`.

## Guardas: fallo -> arreglo

- `callbackCoverage`: callback sin `case` ni `KNOWN_UNHANDLED` -> implementarlo o documentarlo en
  la allowlist; falta una fila en `INTERACTION_COVERAGE.md` -> añadirla. OJO: el enum Java vive en
  el fork (`../xmage-fork`) y el test usa `FALLBACK_CALLBACKS` hardcodeado: si upstream añade un
  callback, actualiza el fallback a mano.
- `mechanicsCoverage`: campo del server sin modelar -> modelar en `contract.schema.json` +
  regenerar; si es interno justificado -> `ALLOWED_EXTRA` (hoy vacío a propósito). El cross-check
  de TODOS los frames detecta claves emitidas que el oráculo no lista (parser/fork desactualizado).
- `engineViewCoverage`: gap engine->view distinto del baseline -> TRIAR; si se acepta,
  `node scripts/engine-view-schema.mjs --update-baseline`; si upstream expone un campo de
  `KNOWN_DISPLAYABLE_GAPS`, modelarlo en el cliente y quitarlo de la lista.
- `serverStateCoverage`: `npm run gen-server-state` + actualizar `web/src/lobby/CreateTable/constants.ts`
  y los defaults del FakeServer (`web/fixtures/fake.ts`).
- Validadores: regenerar sin flag y commitear; nunca parchear el generado a mano.

## INTERACTION_COVERAGE.md

- Tabla A (callbacks), cabecera exacta:
  `| Callback | Manejado | Unit | E2E | Ref de test | Última verif. |`. La guarda exige que TODOS
  los callbacks aparezcan como primera celda de una fila.
- Catálogo de mecánicas (tablas A-M): `| Mecánica | Implementado | Testeado | Ref | Última verif. |`;
  cita frames reales (`fixtures/recorded/<x>.json` + invariante) y fecha.
- Leyenda `✅ / ❌ / ⚠️ / — / ➖`; fechas `YYYY-MM-DD`. Actualizar al cerrar tarea junto a `PROJECT.md`.

## Trampas

- El proxy filtra antes de que el cliente vea nada: `DROPPED as outdated`,
  `event IGNORED (game not active in this session)`, `CHATMESSAGE` con `chatId` inyectado,
  prompts cacheados para re-attach (`isGamePrompt`).
- `EVENT_METHODS` de `types.ts` es un mapa parcial hand-written que hoy no se usa.
- Frames legacy: `name`/`id` opcionales en `MutateView`/`ExileView` (frames viejos).
- Sin fork (`forkDir()`: `NEXUS_FORK_DIR` -> `../xmage-fork`) no se regeneran los oráculos
  view/engine/server-state; `callbackCoverage` no lo necesita.
- Cada string nuevo de UI -> i18n x9 (`i18n.coverage.test.ts`); el splash exige literales sin
  backticks ni `${}`.
- Cambios nullable afectan a `mcp/`; `gen-types`/`gen-zod` no cubren el 100% del wire.
- No comentarios en código; no commitear `dist/`, `.run/`, `target/`, `local-server/`.
