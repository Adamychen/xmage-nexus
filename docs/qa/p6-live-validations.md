# P6 — Validaciones en vivo C1–C5 (plan6 §3)

> Ejecutado 2026-09-18 por el subagente WP-C con el stack local arriba
> (XMage server 17171 testMode, proxy WS 8787, Vite 5173). Herramientas: MCP
> `mage_*` (sesiones `c1` = `val_c1_224152`, `c5b` = `val_c5b_225304`,
> password `x`, `auto_pass=false`) y navegador MCP contra
> `http://localhost:5173`. La web se autenticó con el **mismo usuario** que la
> sesión MCP (el proxy multi-tenant la attachea a la misma sesión XMage).
> `pageerror`s: **0**. Único error de consola: un 404 de Scryfall
> (`api.scryfall.com/cards/SLD/1079b`) al pedir el meta de una carta, benigno.
>
> Screenshots y snapshots de evidencia en `docs/qa/p6-live-validations/`
> (`c1-*.png`…`c5-*.png`). Snapshots/consola del navegador en
> `.run/playwright-mcp/`.

## Resumen

| # | Validación | Veredicto | Evidencia clave |
|---|---|---|---|
| C1 | Submit de `SideboardScreen` por UI (Bo3 real) | **pass** (con hallazgo F1) | Bo3 HUMAN+SIM; partida 1 ganada (11 veneno); UI movió 1 Bosque banquillo→principal (61/14) y «Enviar mazo»; partida 2 arranca con biblioteca 54 (=61−7) |
| C2 | Visor de exilio interactivo | **pass** (matiz de clic) | `Exilio (2 cartas)` con Lightning Bolt + Counterspell; hover-preview; cierre ×; el clic en carta no jugable es no-op por diseño |
| C3 | `UserActionModal` humano↔humano | **aceptada con causa** (mismo flujo que U5) | Sólo se renderiza en `LobbyScreen.tsx:381`; verificado en vivo en lobby (2ª sesión + chat global) |
| C4 | Reconexión web mid-game | **pass** | Recarga en partida 2: replay de estado (turno 1, biblioteca 54, exilio 2), log «has rejoined the game», «Pasar Prioridad» de la UI avanza el prompt del server (seq 23→24). Banner no observable (ver F3) |
| C5 | Staging de torneo + bracket con torneo vivo de 2 | **pass** (con hallazgo F2) | Torneo `Constructed Elimination` 2×HUMAN: staging 2/2 Listos; bracket Ronda 1 «EN PARTIDA» + standings + ojo de watch; quit por UI → FINALIZADA |

## C1 — Submit de `SideboardScreen` por UI en Bo3 real

**Setup**: sesión `c1` `mage_connect`; `mage_create_table`
(`p6-c1-bo3`, Two Player Duel, Constructed - Pioneer, `winsNeeded:2`,
`playerTypes:["HUMAN","SIM"]`, `skipStartingPlayerChoice:true`,
`tableId 024d4291-5e0b-410b-b66e-2e3498638799`); `mage_join_table` con mazo
propio (56× `Forest` RTR:270 + 4× `Lightning Bolt` M11:149; banquillo 15×
`Forest`). Login web con el mismo usuario (attached). `mage_start_match` →
game 1 `39c8fb83-cfb0-4882-8b5c-26670e8cccf0`.

**Pasos**:
1. Mulligan: `mage_choose optionId=right` (Keep). Turno 1 del SIM: pases.
2. Turno 2 (mío): `mage_play_card` Forest + `mage_cheat_setup
   battlefield:["Blightsteel Colossus"]` (11/11 infect). La web pinta el
   Colossus (`window.__mageScene` hand/battlefield; screenshot
   `c1-game1-blightsteel.png`).
3. `mage_combat attackers:[Blightsteel]` + confirm → SIM queda con **11
   contadores de veneno**; `GAME_OVER`. La web muestra «¡VICTORIA! …
   Marcador: 1–0 … El match continúa…» (`c1-sideboard.png`).
4. Cerrar el diálogo → aparece el **`SideboardScreen`** («Sideboard /
   p6-c1-deck», timer 2:56, log «Sideboard: 60 main / 15 side — tienes 179s»,
   `c1-sideboard-open.png`).
5. Hover sobre la tira del banquillo → botón «← Mazo Principal»
   (`e1381`); clic → DOM `Mazo Principal 61` / `Banquillo 14/15` y footer
   `Main: 61 (mín 60)` / `Side: 14 (máx 15)` (`c1-sideboard-moved.png`).
6. Clic «Enviar mazo» → modal «Esperando oponente…». Llega el `GAME_INIT` de
   la partida 2 `ac31713f-deb7-44b8-97b2-28ca162326f3`: la web muestra el
   mulligan con mano 6×Forest + 1×Lightning Bolt (`c1-game2-start.png`,
   `c1-game2-dialog.md`).

**Verificación del submit**: `mage_game_state` de la partida 2 da
`libraryCount: 54` con 7 en mano. El mazo enviado por la UI tenía 61 cartas
(60 + el Bosque movido); si el submit no hubiera llegado, la biblioteca sería
53 (mazo original de 60). El movimiento de banquillo + «Enviar mazo» llegó al
servidor.

**Hallazgo F1 (bug UI real, candidato a follow-up)** — el tablero de la web
quedó **congelado en la partida 1** al arrancar la partida 2: tras el submit,
`window.__mageScene.gameView` seguía en `turn 2 / COMBAT / DECLARE_BLOCKERS`,
bibliotecas 52/53 y `Blightsteel Colossus` + `Island` en el campo, mientras el
MCP ya estaba en la partida 2 (turno 1, biblioteca 54, gameId nuevo) y el log
de la web sí pintaba eventos de la partida 2 (`c2-web-state.png`). Recargar la
pestaña lo corrige (ver C4), lo que apunta a un `GAME_INIT` nuevo descartado
como stale en la transición Bo3 directa (la clase de bug que U2/B.10 cerró para
el watch; esta ruta no quedó cubierta). No invalida C1 (el submit es
server-side correcto) pero es una regresión visible para el jugador.

## C2 — Visor de exilio interactivo

**Setup**: se reutilizó la partida 2 en curso tras la recarga de C4 (vista
fresca). En mi precombat main: `mage_play_card` Forest (acción normal) +
`mage_cheat_setup exile:["Lightning Bolt","Counterspell"]`. Nota: el efecto del
cheat se materializa en el siguiente pase de prioridad (el primer
`GAME_SELECT` posterior aún dio `exileCount:0`; tras `mage_pass_priority`,
`exileCount:2`).

**Pasos y evidencia**:
- DOM: `[data-exile-count]` = `["0","2"]` (panel del rival y mío).
- Clic en el chip de exilio propio → `.pile-overlay` con título
  **«Exilio (2 cartas)»** y dos `pile-card-wrapper` con imagen:
  `Lightning Bolt` y `Counterspell` (`c2-exile-overlay.png`).
- Hover sobre `Counterspell` → `FloatingCardPreview` con imagen Scryfall
  (`.card-preview` presente, `preview:true`).
- Clic sobre la carta → sin acción (el `PileOverlay` sólo cablea `onClick`
  para cartas jugables/objetivo; el exilio no lo es). Sin error.
- Botón × → `.pile-overlay` ausente (`overlay:false`).

**Veredicto**: pass. El matiz honesto: el clic no abre un "detalle" adicional,
sólo el preview al hover; es el comportamiento diseñado del visor (mismo
componente que cementerio/biblioteca).

## C3 — `UserActionModal` humano↔humano

**Análisis de código** (`rg`): `UserActionModal` se importa/renderiza **sólo**
en `web/src/lobby/LobbyScreen.tsx:381`; sus disparadores son clics sobre
usuarios en el chat del lobby (global/flotante) y en la lista de usuarios
(`LobbyAside`). `web/src/game/` no lo referencia y `GameChat` no recibe
`onUserClick`. Es exactamente el componente/flujo ya marcado ✅ en U5
(chat) — no existe un camino de juego distinto que validar.

**Re-verificación en vivo (barata)**: con la web de vuelta en el lobby, la
sesión `c5b` envió un mensaje al chat global (`roomChatId
2cfe17f9-4cc8-479f-b835-2ab015caff1a`); clic en el nombre del autor →
`.user-action-dialog` con «Enviar Susurro Privado / Ver Perfil y Rango de Liga
/ Ignorar / Silenciar Usuario» y estado «En lobby disponible»
(`c3-user-action-modal.png`).

**Veredicto**: aceptada con causa — **mismo flujo que U5**; el modal vive sólo
en el lobby y la Última verif. sube a 2026-09-18.

## C4 — Reconexión web mid-game

**Setup**: partida 2 en curso (`ac31713f…`), prioridad mía pendiente, vista
pre-reload congelada en la partida 1 (F1). `playwright_browser_navigate` a
`http://localhost:5173` (recarga).

**Observado**:
- Replay del estado: `window.__mageScene.gameView` = `turn 1 /
  BEGIN_COMBAT`, activo `val_c1_224152`, biblioteca 54, mano 6, exilio
  `[Lightning Bolt, Counterspell]`, campo `[Forest]`, `__mageStore.gameId =
  ac31713f…` (partida 2 correcta, sin residuos de la 1). Log de la web:
  «val_c1_224152 has rejoined the game» (`c4-after-reload-immediate.png`).
- UI jugable: clic real en «Pasar Prioridad (Espacio)» → el servidor pasó de
  `promptSeq 23` (`BEGIN_COMBAT`) a `24` (`DECLARE_ATTACKERS`) por
  `mage_wait_for_prompt(afterSeq:23)`. También hay `Pasar` visible y cartas
  jugables en DOM.
- Banner de reconexión: **no observable** en este entorno (ver F3).

**Veredicto**: pass (replay + jugabilidad). El banner queda declarado como no
observado localmente.

## C5 — Staging de torneo + bracket con torneo vivo de 2

**Hallazgo F2 (harness MCP)**: `mage_create_tournament_table` con su default
`tournamentType:"Elimination"` falla contra el server real:
`Can't create new tourney: java.lang.NullPointerException: Cannot invoke
"java.lang.Class.getConstructor(java.lang.Class[])" because the return value
of "java.util.Map.get(Object)" is null` (registrados están los nombres del
config, p. ej. `Constructed Elimination`; `TournamentFactory.createTournament`
hace `tournaments.get(type)` → null). Con `"Constructed Elimination"` funciona.

**Setup y pasos**:
1. `mage_create_tournament_table` (2 plazas HUMAN, `Constructed Elimination`,
   Constructed - Pioneer, `winsNeeded:1`) → mesa
   `f9fe5df1-e8c8-4eac-9acf-28230c4f6b44`.
2. `c1` y `c5b` se unen con mazo (`mage_join_tournament_table`).
3. Staging verificado en la web: «MODO JUGADOR / p6-c5-torneo2 / Constructed
   Elimination / Constructed - Pioneer», 2/2 Listos, progreso hasta «¡A
   jugar!» (`c5-staging.png`).
4. `mage_start_tournament` → `tournamentId c17375d2-4e5c-42fe-ba40-8e80edfc76d9`;
   `mage_join_tournament` en ambas sesiones (obligatorio para avanzar).
5. `mage_get_tournament` = `Dueling`: Ronda 1, match `733c3436…`, game
   `4b2cc24c-4407-48e9-b5db-43f8bdc1425c`, mesa `deb3d718…`, ambos jugadores
   «Dueling». La web muestra el **bracket en vivo**: «Torneo en curso», badge
   «EN PARTIDA», Ronda 1 `val_c1_224152 - val_c5b_225304` con «EN PARTIDA»,
   botón de watch (ojo) y `#R1 Crear Mesa deb3d7`, standings «En partida»
   (`c5-bracket.png`).
6. Quit por UI: «Abandonar torneo» + confirmación → `mage_get_tournament` =
   `Finished` (c5b Winner 3 pts, c1 Eliminado); la web pinta «FINALIZADA» y
   «Sin emparejamientos aún» (`c3-after-quit.png`).

**Veredicto**: pass (staging + bracket con match en curso + watch presentes).
Hallazgo F2 sólo afecta al default del harness MCP, no a la web.

## Hallazgos transversales

- **F1 — GameView stale en la partida 2 de un Bo3 (web, bug real).** El
  `GAME_INIT` de la nueva partida no refresca el tablero si el jugador sigue
  en la misma sesión/adjunto (el log y los prompts sí son de la partida 2).
  Recarga = resincroniza (C4). Candidato a follow-up de WP-C.
  **RESUELTO (2026-09-18)**: causa raíz en `eventHandler.ts` (guard temprano de
  `gameId` + `switchingGame` solo eximían `START_GAME`; el `GAME_INIT` de la 2ª
  llegaba con el `gameId` ya actualizado por `START_GAME` y se descartaba por
  posición). Fix: `GAME_INIT` exento del guard temprano y tratado como
  switching incondicional; 3 tests en `store.test.ts` (uno replica el orden
  real `START_GAME` → `GAME_INIT`), rojo→verde. `best-of-3`/`best-of-5` fake
  verdes tras el fix.
- **F2 — `mage_create_tournament_table` default `Elimination`** no existe en
  el server (`Constructed Elimination` sí). Documentado arriba.
  **RESUELTO (2026-09-18)**: default del MCP a `Constructed Elimination` +
  descripción con nombres registrados; test en `mcp/test/tournament.test.ts`;
  `npm --prefix mcp test` 41 passed y typecheck limpio.
- **F3 — Banner de reconexión no observado.** `App.tsx:113-125`
  (`reconnecting = connecting && !wsAlive`) es condicional a una reconexión en
  curso; en local la recarga reconecta en milisegundos y `context.setOffline`
  de Playwright no cierra el WebSocket ya abierto (probado 4 s, banner:false).
  No se forzó una caída real del proxy para no romper el stack.
- **F4 — 404 de Scryfall** (`SLD/1079b`) en consola: fallo de recursos, no
  `pageerror`; ya conocido (meta de arte de carta).
- **Cheat off-thread**: `mage_cheat_setup` devuelve `ok` antes de aplicar los
  cambios al GameView; hay que pasar prioridad una vez para que se
  materialicen (observado en C2).

## Limpieza

Ambas sesiones MCP terminaron con `leave_table`/`remove_table` y
`mage_disconnect`; `mage_lobby` final = 0 mesas. La web vuelve al lobby sin
errores (`pageerror=0`).

## Herramientas / rutas

- MCP: `mage_connect`, `mage_auto_pass(false)`, `mage_create_table`,
  `mage_join_table`, `mage_start_match`, `mage_game_state`, `mage_play_card`,
  `mage_cheat_setup`, `mage_combat`, `mage_pass_priority`,
  `mage_wait_for_prompt`, `mage_choose`, `mage_submit_deck` (no usado: el
  submit de C1 fue por UI), `mage_create_tournament_table`,
  `mage_join_tournament_table`, `mage_start_tournament`,
  `mage_join_tournament`, `mage_get_tournament`, `mage_chat`, `mage_lobby`,
  `mage_leave_table`, `mage_disconnect`.
- Navegador MCP: `browser_navigate`, `browser_snapshot`, `browser_click`,
  `browser_hover`, `browser_fill_form`, `browser_evaluate`,
  `browser_take_screenshot` (PNG leídos), `browser_find`,
  `browser_console_messages`, `browser_run_code_unsafe` (setOffline).
- Screenshots (en `docs/qa/p6-live-validations/`): `c1-game1-start.png`,
  `c1-game1-blightsteel.png`, `c1-sideboard.png`, `c1-sideboard-open.png`,
  `c1-sideboard-moved.png`, `c1-game2-start.png`, `c2-web-state.png`,
  `c2-exile-overlay.png`, `c4-after-reload-immediate.png`,
  `c3-user-action-modal.png`, `c5-staging.png`, `c5-bracket.png`,
  `c3-after-quit.png`.
  (snapshots de texto: `c1-sideboard-snapshot.md`, `c1-game2-dialog.md`).
