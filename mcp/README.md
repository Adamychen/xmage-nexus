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
npm test             # vitest en serie (--maxWorkers=1): cada fichero levanta el server por stdio y los timeouts de 30s flakean en paralelo (CI 2026-09-11)
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
| `mage_disconnect` | `session?` | Cierra la sesión (pin o activa). |
| `mage_reconnect` | `session?` | Reabre el WS con las credenciales guardadas, re-loguea (attach si la sesión sigue viva; `lastConnectAttached`) y resincroniza la partida con `joinGame`. El auto-reconnect (backoff 1s→10s) ya lo hace solo. |
| `mage_lobby` | `limit?`, `session?` | Mesas de la sala (id, tipo, asientos, estado) + resumen de usuarios. |
| `mage_create_table` | `name?`, `gameType?`, `deckType?`, `winsNeeded?`, `playerTypes?`, `simDecks?`, `seatSkills?`, `skipInitShuffling?`, `skipStartingPlayerChoice?`, `session?` | Crea mesa (default HUMAN+SIM) y devuelve `tableId`. |
| `mage_join_table` | `tableId`, `deck` (DeckJson), `playerName?`, `playerType?`, `skill?`, `password?`, `session?` | Se une como jugador con mazo. |
| `mage_start_match` | `tableId?`, `waitMs?`, `session?` | Arranca y espera `START_GAME`; devuelve `gameId`. |
| `mage_leave_table` | `tableId?`, `remove?`, `session?` | Sale de la mesa o la elimina (dueño). |
| `mage_session` | `session?` | Estado de la sesión (pin o activa: id, conexión, mesa, gameId, turno/fase/prioridad) + cola de eventos. |
| `mage_sessions` | — | Lista todas las sesiones nombradas (id, activa, conexión, username, mesa, gameId). |
| `mage_use_session` | `session` | Cambia la sesión activa; las demás siguen recibiendo eventos (y auto-pass) en segundo plano. |

| Tool | Args | Qué hace |
|---|---|---|
| `mage_create_tournament_table` | `name?`, `tournamentType?`(Constructed Elimination), `gameType?`, `deckType?`, `limited?`, `limitedOptions?`{setCodes, numberBoosters, constructionTime, draftCubeName, timing}, `playerTypes?`, `password?`, `winsNeeded?`, `numberRounds?`, `skillLevel?`, `rated?`, `spectatorsAllowed?`, `quitRatio?`, `session?` | Crea mesa de torneo (Sealed/Draft/Elimination…); limitado → `deckType:Limited` + sin mazo al unirse. Devuelve `tableId`. `tournamentType` debe ser un nombre registrado del config del server (un nombre inexistente → NPE). |
| `mage_join_tournament_table` | `tableId`, `deck?` (opcional en limitado), `playerName?`, `playerType?`, `skill?`, `password?`, `deckType?`, `gameType?`, `session?` | Ocupa un asiento del torneo. |
| `mage_start_tournament` | `tableId?`, `waitMs?`, `session?` | Arranca el torneo y espera `START_TOURNAMENT` para devolver el `tournamentId` (sin unirse al panel el torneo no avanza). |
| `mage_join_tournament` | `tournamentId?` (= último visto), `session?` | Unión obligatoria al panel (idempotente: vale como re-join). |
| `mage_join_game` | `gameId?` (= partida activa), `waitMs?`, `session?` | Attach a partida por id (torneo/Bo3); el proxy reenvía el `GAME_INIT` cacheado; espera vista fresca. |
| `mage_get_tournament` | `tournamentId?` (= último visto), `session?` | TournamentView (nombre, estado, jugadores, rondas). Solo lectura. |
| `mage_submit_deck` | `tableId?`, `deck` (DeckJson), `session?` | Mazo construido (CONSTRUCT limitado 40 cartas / sideboard Bo3). |
| `mage_watch_tournament_match` | `tableId` (del match, `rounds[].tableId`), `waitMs?`, `session?` | Especta un match de torneo en vivo: `watchTournamentTable` → `WATCHGAME` → `watchGame` → espera el `GAME_INIT` cacheado. |

Flujo torneo (verificado en vivo, Sealed Elimination 2×HUMAN):
```
mage_create_tournament_table(limited) → mage_join_tournament_table ×2 (sin mazo)
→ mage_start_tournament → mage_join_tournament ×2 (OBLIGATORIO, si no no arranca)
→ CONSTRUCT: mage_submit_deck → START_GAME → mage_join_game {gameId}
```
La sesión captura `tournamentId` de `START_TOURNAMENT`/`TOURNAMENT_INIT`/`TOURNAMENT_UPDATE`
igual que `gameId` de `START_GAME`/`GAME_*`, así que `join/get` lo resuelven por defecto.

## Tools — fase C2 (jugar)

| Tool | Args | Qué hace |
|---|---|---|
| `mage_game_state` | `level`(compact/full), `session?` | Estado compacto (turno/fase/prioridad, vidas, mano, battlefield, stack, jugables, combate) + prompt pendiente. |
| `mage_wait_for_prompt` | `timeoutMs?`, `afterSeq?`, `session?` | Bloquea hasta que el servidor pida decisión o la partida acabe; devuelve el prompt normalizado con opciones. |
| `mage_action` | `kind`(uuid/boolean/integer/string/manaType/playerAction), `value?`, `action?`, `data?`, `playerId?`, `force?`, `session?` | Respuesta cruda validada contra el prompt pendiente. |
| `mage_choose` | `optionId?`, `value?`, `values?`, `session?` | Responde por opción/valor; sin args pasa (select/combat). |
| `mage_play_card` | `cardId`, `session?` | `sendPlayerUUID` de una carta/fuente/habilidad jugable. |
| `mage_pay_mana` | `sourceId?`, `manaType?`, `session?` | Paga con una fuente (`sendPlayerUUID`) o del pool (`sendPlayerManaType`). |
| `mage_pass_priority` | `session?` | `sendPlayerBoolean(false)`: pasar/confirmar/rechazar. |
| `mage_combat` | `attackers?`, `blockers?`, `blockTargets?`, `confirm?`, `targetTimeoutMs?`, `session?` | Declara atacantes; bloqueadoras de una en una respondiendo el `GAME_TARGET` intercalado con `blockTargets[i]` (gang-block). |
| `mage_auto_pass` | `enabled`, `session?` | Auto-pass en ventanas de prioridad del rival o sin jugables (default ON; nunca en asks/maná). Anti-flood: si el servidor repite el mismo prompt >5 veces, lo desactiva y registra `AUTO_PASS_STOPPED`. |
| `mage_concede` | `session?` | `sendPlayerAction CONCEDE`. |
| `mage_chat` | `text`, `chatId?`, `session?` | Chat de la partida. |
| `mage_cheat_setup` | `playerId?`, `hand?`, `battlefield?`, `library?`, `graveyard?`, `exile?`, `session?` | **Solo testMode local** (beta → `ok:false`): siembra cartas por nombre en las zonas del jugador (P1; `library` apila encima, el último nombre queda arriba). `playerId` default: el controlado. Llamar con prioridad en turno propio y tras ≥1 acción normal (en la 1ª prioridad del T1 o en turno ajeno congela el hilo). Verificado en vivo 2026-09-15 (2×Counterspell + 2×Island, la partida sigue). |

> **Pin `session` (anti-carreras)**: casi todas las tools aceptan `session?` para
> operar sobre una sesión MCP sin cambiar la activa global. Imprescindible en
> juego paralelo (varios agentes/partidas en un proceso MCP): sin pin, dos
> agentes conmutando `mage_use_session` se pisan (acciones caídas en la partida
> ajena). Verificado con self-play PvP + oleada paralela.

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
cuentas/partidas en un proceso MCP). Sin pin, las tools operan sobre la sesión
**activa** (cámbiala con `mage_use_session`, lístalas con `mage_sessions`);
con pin `session?` operan sobre esa sin tocar la activa — obligatorio en juego
  paralelo (la activa global es una carrera entre agentes).
  Las sesiones inactivas siguen procesando eventos en segundo plano (incluido el
  auto-pass), así que una partida puede avanzar mientras juegas otra.

- **Harness torneo B.12 (hecha, 2026-09-13)**: `mage_create_tournament_table`,
  `mage_join_tournament_table`, `mage_start_tournament`, `mage_join_tournament`
  (panel obligatorio + re-join), `mage_join_game` (attach por id), `mage_get_tournament`
  (estado/pool/rondas), `mage_submit_deck` (CONSTRUCT/sideboard) y
  `mage_watch_tournament_match` (espectar match en vivo). Tests herméticos en
  `test/tournament.test.ts` + verificación en vivo (Sealed Elimination 2×HUMAN,
  `CONSTRUCT` → submit ok, lobby a 0).

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
- **Fase C3 (hecha, 2026-09-11)**: endurecimiento en 4 sub-fases, en  orden **C3.3 → C3.1 → C3.2 → C3.4**:
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
- **P1/P4 (hecha, 2026-09-15)**: `mage_cheat_setup` expone la siembra del modo
  test de XMage (parche aditivo del fork `nexus`, gate `testMode`) para montar
  escenarios reales deterministas desde MCP — cartas por nombre en
  hand/battlefield/library/graveyard/exile. Test hermético
  (`test/cheatSetup.test.ts`) + verificado en vivo.

## Notas de plataforma

- Node ejecuta el TS en modo *strip-only*: prohibido `enum`, `namespace` y
  **parameter properties** (`constructor(private x)`) — rompen en runtime.
- `import type` cruzado hacia `web/src/net/types.generated.ts` es seguro: se
  borra en runtime.

## Reglas

- Tras tocar `mcp/`: `npm --prefix mcp test` + `npm --prefix mcp run typecheck`.
- No escribir a stdout fuera del transporte MCP.
