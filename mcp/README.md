# mcp — MCP server for XMage Nexus

Servidor [MCP](https://modelcontextprotocol.io) (stdio) que expone el stack de
desarrollo y —fase 2— un jugador XMage headless como tools para agentes
(opencode, Claude Desktop, Cursor…).

- **Sin build**: Node ≥24 ejecuta TypeScript nativo (type stripping). `node src/index.ts`.
- **Sin Java**: la fase A solo invoca los scripts del repo (`scripts/*.mjs`); la
  fase C hablará el protocolo WS del proxy (`Mage.Proxy/README.md`).
- **stdout reservado** para el protocolo MCP: los diagnósticos van a stderr.

## Uso

Registrado en `opencode.json` como servidor `mage`. Reinicia opencode tras
cambiar la config. Para probarlo a mano (desde `mcp/`):

```bash
npm install          # una vez
npm test             # vitest: arranca el server por stdio y ejerce tools/resources
npm run typecheck
node src/index.ts    # servidor stdio (espera JSON-RPC por stdin)
```

## Tools — fase A (DevOps)

| Tool | Args | Qué hace |
|---|---|---|
| `mage_stack` | `action`(status/start/stop/restart), `target`(server/proxy/vite/all), `waitMs` | Estado del stack y control vía `scripts/ctl.mjs`; espera a que los puertos converjan (pid nuevo). Arranque en frío del servidor: `waitMs=600000`. |
| `mage_logs` | `target`, `lines`, `grep?`, `ignoreCase` | Cola de `.run/*.log` (con fallbacks de `logFileFor`), filtrada por regex. |
| `mage_run_tests` | `layers[]`, `skip[]`, `timeoutSec` | `scripts/test.mjs`; devuelve resultado por capa y cola de salida si falla. |
| `mage_build` | `target`(proxy/full), `timeoutSec` | `scripts/build.mjs` (proxy requiere reiniciarlo después). |
| `mage_record_fixture` | `mechanic`, `timeoutSec` | `scripts/record.mjs` (requiere stack arriba). |
| `mage_validate_generated` | — | Validadores `--validate` de gen-types/gen-zod/gen-server-state/gen-splash-i18n. |
| `mage_e2e` | `spec?`, `grep?`, `backend`(fake/real), `includeKnownBroken?`, `timeoutSec?` | Playwright en `web/` (fake sin stack en 5175; real con stack en 5173). Ej: `spec=decks-gallery.spec.ts`, `grep=@decks`. |

## Tools — fase C1 (sesión / lobby / partida)

| Tool | Args | Qué hace |
|---|---|---|
| `mage_connect` | `session?`, `proxyUrl?`, `host?`, `port?`, `username?`, `password?`, `timeoutSec?` | Abre el WS contra el proxy y hace login (default local; cuenta autogenerada de ≤14 chars; reintenta `WARMING_UP`). `session` nombra la sesión MCP (multi-sesión). |
| `mage_disconnect` | — | Cierra la sesión activa. |
| `mage_reconnect` | — | Reabre el WS con las credenciales guardadas, re-loguea (attach si la sesión sigue viva; `lastConnectAttached`) y resincroniza la partida con `joinGame`. El auto-reconnect (backoff 1s→10s) ya lo hace solo. |
| `mage_lobby` | `limit?` | Mesas de la sala (id, tipo, asientos, estado) + resumen de usuarios. |
| `mage_create_table` | `name?`, `gameType?`, `deckType?`, `winsNeeded?`, `playerTypes?`, `simDecks?`, `seatSkills?`, `skipInitShuffling?`, `skipStartingPlayerChoice?` | Crea mesa (default HUMAN+SIM) y devuelve `tableId`. |
| `mage_join_table` | `tableId`, `deck` (DeckJson), `playerName?`, `playerType?`, `skill?`, `password?` | Se une como jugador con mazo. |
| `mage_start_match` | `tableId?`, `waitMs?` | Arranca y espera `START_GAME`; devuelve `gameId`. |
| `mage_leave_table` | `tableId?`, `remove?` | Sale de la mesa o la elimina (dueño). |
| `mage_session` | — | Estado de la sesión ACTIVA (id, conexión, mesa, gameId, turno/fase/prioridad) + cola de eventos. |
| `mage_sessions` | — | Lista todas las sesiones nombradas (id, activa, conexión, username, mesa, gameId). |
| `mage_use_session` | `session` | Cambia la sesión activa; las demás siguen recibiendo eventos (y auto-pass) en segundo plano. |

## Tools — fase C2 (jugar)

| Tool | Args | Qué hace |
|---|---|---|
| `mage_game_state` | `level`(compact/full) | Estado compacto (turno/fase/prioridad, vidas, mano, battlefield, stack, jugables, combate) + prompt pendiente. |
| `mage_wait_for_prompt` | `timeoutMs?`, `afterSeq?` | Bloquea hasta que el servidor pida decisión o la partida acabe; devuelve el prompt normalizado con opciones. |
| `mage_action` | `kind`(uuid/boolean/integer/string/manaType/playerAction), `value?`, `action?`, `data?`, `playerId?`, `force?` | Respuesta cruda validada contra el prompt pendiente. |
| `mage_choose` | `optionId?`, `value?`, `values?` | Responde por opción/valor; sin args pasa (select/combat). |
| `mage_play_card` | `cardId` | `sendPlayerUUID` de una carta/fuente/habilidad jugable. |
| `mage_pay_mana` | `sourceId?`, `manaType?` | Paga con una fuente (`sendPlayerUUID`) o del pool (`sendPlayerManaType`). |
| `mage_pass_priority` | — | `sendPlayerBoolean(false)`: pasar/confirmar/rechazar. |
| `mage_combat` | `attackers?`, `blockers?`, `confirm?` | Declara UUIDs y confirma el paso de combate. |
| `mage_auto_pass` | `enabled` | Auto-pass en ventanas de prioridad del rival o sin jugables (default ON; nunca en asks/maná). Anti-flood: si el servidor repite el mismo prompt >5 veces, lo desactiva y registra `AUTO_PASS_STOPPED`. |
| `mage_concede` | — | `sendPlayerAction CONCEDE`. |
| `mage_chat` | `text`, `chatId?` | Chat de la partida. |

### Bucle de juego

```
mage_connect → mage_create_table(HUMAN+SIM) → mage_join_table(deck) → mage_start_match
repetir:
  mage_wait_for_prompt(afterSeq = último promptSeq)   # bloquea hasta decisión / GAME_OVER
  mage_game_state (si hace falta más contexto)
  mage_choose / mage_play_card / mage_pay_mana / mage_combat / mage_pass_priority
```

`mage_auto_pass` está activado por defecto: el agente solo recibe prompts en los que
realmente puede decidir (su turno con jugables, asks, targets, maná). Desactívalo con
`mage_auto_pass({enabled:false})` si quieres ver también las prioridades del rival.

**Multi-sesión**: `mage_connect({session:"a"})` crea una sesión nombrada (varias
cuentas/partidas en un proceso MCP). Todas las tools operan sobre la sesión
**activa**; cámbiala con `mage_use_session` y lístalas con `mage_sessions`.
Las sesiones inactivas siguen procesando eventos en segundo plano (incluido el
auto-pass), así que una partida puede avanzar mientras juegas otra.

## Resources (fase A)

`mage://status/project` · `mage://status/dashboard` · `mage://coverage/interactions` ·
`mage://contract/schema` · `mage://fixtures/manifest`.

## UI real (complementario)

Para que el agente **vea y toque la UI** (hover, drag & drop, snapshots,
screenshots) hay un segundo MCP local, `playwright`, registrado en
`opencode.json` y lanzado por `scripts/playwright-mcp.mjs` (reutiliza el
Chromium de `web/`; artefactos en `.run/playwright-mcp/`). Para verificación
determinista, `mage_e2e` ejecuta los specs reales de Playwright.

## Roadmap

- **Fase A (hecha, 2026-09-11)**: tools DevOps + resources.
- **Fase C1 (hecha, 2026-09-11)**: sesión WS, lobby y arranque de partida
  (`START_GAME`) contra el stack local.
- **Fase C2 (hecha, 2026-09-11)**: jugador LLM — estado compacto, prompt
  normalizado (`promptView`), bucle `wait_for_prompt` + acciones, combate,
  pagos de maná y auto-pass. Verificado con una partida real completa vs Sim
  (`MCP_E2E=1 npm test` en `mcp/`).
- **Fase C3 (hecha, 2026-09-11)**: endurecimiento en 4 sub-fases, en
  orden **C3.3 → C3.1 → C3.2 → C3.4**:
  - **C3.3 · Arnés FixtureServer en CI** (hecha): tests del MCP contra
    `FakeServer.start(0, escenario)` de `web/fixtures/fake.ts` vía
    `test/support/fakeServer.ts` (import dinámico no-literal, porque `fake.ts`
    usa parameter properties y no corre en strip-only), partida scripted
    (`test/fakeGame.test.ts`), reconexión hermética (`test/reconnect.test.ts`) y
    anti-flood (`test/autoPass.test.ts`); capa `mcp` (typecheck+test) en
    `scripts/dashboard-ci.mjs` + jobs `mcp` en los workflows (web-ci/pages).
  - **C3.1 · Maná e interacciones complejas** (hecha): `mage_pay_mana special`
    (auto-pago → `sendPlayerString("special")`), `mage_choose optionId="special"`
    (all attack), botón especial expuesto en el prompt (`special`/`specialLabel`),
    `queryType`, orden de cartas por índices → ids, y **auto-pass v2** con firma
    `(method, turno, fase, paso, opciones)` + tope de 5 repeticiones
    (`AUTO_PASS_STOPPED`). Matriz completa en `test/complexInteractions.test.ts`
    (phyrexian, kicker, split, adventure, convoke multi-paso, X-mana,
    `GAME_GET_AMOUNT`, pila, modo, color, orden, multi-amount, trigger order),
    contrastada con el cliente web y `SimPlayer` del proxy.
  - **C3.2 · Reconexión/resync** (hecha): backoff 1s→10s en `ProxyClient`
    (espejo de `web/src/state/gateway.ts:13-54`), `mage_reconnect`, auto ON, y
    **replay de estado en el proxy**: cachea por partida el último
    GAME_INIT/GAME_UPDATE y el último prompt pendiente y los reenvía a la
    conexión que hace `joinGame` tras el re-attach (el GameClient del proxy
    nunca se desconecta, así que XMage no reenvía nada); `data.attached` en el
    `result` de `connect` (`true` re-attach / `false` sesión nueva). Verificado
    real: connect→start→disconnect→reconnect (attached=true, gameId y prompt
    reenviados) y grace expirado (attached=false, gameId limpiado).
  - **C3.4 · Multi-sesión** (hecha): sesiones nombradas en `session.ts`
    (`sessions` Map + sesión activa), `mage_connect {session}`,
    `mage_use_session`, `mage_sessions`; cada sesión tiene su `ProxyClient`,
    estado, prompts y auto-pass propios (las inactivas siguen procesando
    eventos). Verificado con dos FakeServers en paralelo
    (`test/multiSession.test.ts`): partidas independientes, `mage_sessions`
    correcto y desconectar una no afecta a la otra.

## Notas de plataforma

- Node ejecuta el TS en modo *strip-only*: prohibido `enum`, `namespace` y
  **parameter properties** (`constructor(private x)`) — rompen en runtime.
- `import type` cruzado hacia `web/src/net/types.generated.ts` es seguro: se
  borra en runtime.

## Reglas

- Tras tocar `mcp/`: `npm --prefix mcp test` + `npm --prefix mcp run typecheck`.
- No escribir a stdout fuera del transporte MCP.
