# PLAN-3 — cierre de verificación de la estela + UX reportado (2026-09-14)

> ESTADO AL CREAR: repo `mage_alt_client`, rama `master`, último commit
> `24c68c1359c` (botón cerrar del asistente). `plan.md` (fases 0–4) y
> `plan2.md` están completos salvo lo anotado en §6 de este fichero.
> **Sin commitear** (a petición): fix del scroll del Historial + docs de la
> sesión de hoy (`PROJECT.md`, `plan2.md`, `web/COMPONENT_PARITY.md`,
> `web/INTERACTION_COVERAGE.md`, `web/src/lobby/FinishedMatchesPanel.{tsx,css,test.tsx}`,
> `web/e2e/finished-matches.spec.ts`, `web/fixtures/scenarios/finishedMatches.ts`).
> Mandato: **planificar/ejecutar por lanes; no commitear sin pedirlo**.

## 0. Contexto heredado (no redescubrir)

- Stack: server 17171, proxy 8787 (multi-tenant), vite 5173. Control:
  `node scripts/ctl.mjs start|stop|restart|status [server|proxy|vite|all]`.
  Browser MCP logado como `p2-live2-SPEC`; lobby a 0 mesas al crear el plan.
- Cuentas reutilizables: `qa-ui-1345`, `qa-self-A/B`, `qa-gang-A/B`,
  `qa-mull-A/B`, `qa-vfy-A/B`, `qa-vfy-A2/B2`, `mcp-mtyu3t58`, `qa-seal-A/B`,
  `qa-beta-probe`, y las de hoy `qa-mut-A/B`, `qa-perf-A/B`, `qa-hist-probe`.
- Harness MCP: pin `session?` en 19+ tools; torneos completos
  (`mage_create_tournament_table` → `join_tournament_table` → `start_tournament`
  → **`join_tournament` ×2 (sin esto el torneo no avanza)** → `submit_deck` →
  `join_game`/`get_tournament`). `mage_submit_deck` YA existe (desbloquea B.10).
- Lecciones vigentes: respuestas raw usan campo `value`; cerrar WS mata la
  sesión XMage ~60s; `head -N` mata por SIGPIPE (nohup+fichero); `wait_for_prompt
  timeout:true` devuelve estado CACHEADO (exigir prompts frescos); apagar
  auto-pass antes de declarar atacantes; mano inicial top-first con
  `skipInitShuffling`; F1 no existe en web; `watchGame` es por partida;
  `END_GAME_INFO` no llega a espectadores; HMR ≠ bug (recarga dura).
- Lecciones NUEVAS de hoy (§E): el server **no reenvía GAME_INIT al re-watch**
  (repro = `stopWatching` + `watchTournamentTable`); `mage_create_tournament_table`
  exige un `tournamentType` REAL de XMage (`'Sealed Elimination'`,
  `'Constructed Elimination'`; `'Elimination'` → NPE `Class.getConstructor`/`Map.get`);
  sealed auto-submitea con `constructionTime:10`;
  `GAME_INIT` de espectador NO incluye pools/sideboards; instrumentación WS en
  el navegador = `page.addInitScript` con wrap de `WebSocket` + `window.__wsPerf`.
  Otras de la 2ª parte: el auto-pass del MCP **no pasa** si hay objetos jugables
  (una tierra en mano lo bloquea toda la partida) → pasar a mano o jugar la
  tierra; `CONCEDE` durante el mulligan/elección inicial se ignora (contestar
  antes); el pago de maná en la web exige clicar la FUENTE del battlefield
  (los auto-pagos no cubren todo); en la mano solapada, `dispatchEvent('click')`
  evita que otra carta intercepte el click.

## 1. Cierres vivos baratos (~1 sesión)

1. ✅ **B.10 follow en Bo3** — verificado en vivo 2026-09-14 con bug de raíz
   arreglado (ver §E). Falta el residual del jugador web (ver §E 2ª parte).
2. ✅ **Sealed T3/T6 visual** — CONSTRUCT real desde la UI (pool 90 M20,
   sugerida de tierras + 23 cartas, submit 40) y tableros en los turnos 3 y 6
   (`web/e2e/shots/seal-construct-built.png`, `seal-turn3.png`, `seal-turn6.png`).
3. ✅ **Bracket final** — verificado con datos reales (`getTournament`:
   Finished, "Winner", 3 pts) y DESTAPÓ un bug: `Ver Cuadro` de una mesa AJENA
   pintaba el torneo propio cacheado (fallback mal guardado). Arreglado en
   `useTournamentBracket.ts` (3 guards + `isOwnTournament`) con 2 tests
   rojos→verdes. Nota: la mesa desaparece del lobby al terminar el torneo
   (sigue sin poder verse el cuadro final desde el lobby).
4. ✅ **C.14 foco teclado** — verificado en vivo 2026-09-14 (ver §E 4ª
   parte): lobby OK (el "resaltado" de `Mesas (1)` era el anillo de foco del
   tab activo, correcto) y partida OK (mano operable con Tab + glow en
   `:focus-visible`, Space juega UNA tierra sin doble disparo). Findings
   menores: el foco cae a `<body>` al jugar la carta enfocada (se desmonta el
   nodo) y el link del footer entra en el orden de tabulación; cantera, sin
   fix.

## 2. Verificación que exige código antes (~1–2 sesiones)

1. ✅ **Espectar match de torneo EN VIVO desde el lobby** — HECHO 2026-09-14
   (ver §E 5ª parte): `SHOW_TOURNAMENT` resolvía tableId→tournamentId (antes
   solo se logueaba y el staging se quedaba en «Preparando inicio…»); el lobby
   guarda la resolución y abre el cuadro con el id real; las dos entradas
   (ojo del cuadro y `Espectar` de la tarjeta) verificadas en vivo contra un
   torneo Constructed con match Dueling. Extra: "Abandonar torneo" ya no
   aparece en torneos ajenos y usa el id real. Tool MCP
   `mage_watch_tournament_match` añadida.
2. ⏸️ **Replay — APLAZADO por decisión (2026-09-14)**: no se toca
   `saveGameActivated` ni se implementan controles/exit en la web mientras el
   motor no lo soporte. Motivo: es el único switch (`GameController.setSaveGame`
   / `cleanUpOnMatchEnd`) y el propio template upstream lo marca «not working
   correctly yet» con `false` por defecto; la sonda a beta (qa-beta-probe) dio
   25 partidas terminadas y **0 con `games[]`/`replayAvailable`**, así que
   contra el server oficial el botón del Historial nunca aparece. Reactivar si
   upstream lo arregla: (a) local `saveGameActivated="true"` + restart y validar
   que el motor guarda/reproduce; (b) UI de transporte
   (`replayNext/Previous/SkipForward`) + salida en `REPLAY_DONE`; (c) tests
   (unit de `replay.ts` + escenario fake `REPLAY_*` + e2e). Contexto en
   `INTERACTION_COVERAGE` §Replay viewer. Mientras tanto el botón del Historial
   ya queda oculto solo (no hay `games[]`).
3. **`GAME_REDRAW_GUI`**: log-only (INTERACTION_COVERAGE:41) → aceptar/issue.

## 3. Fork / motor (coste alto: rebuild del server)

1. `harnessed` (Unfinity): `ability.addHint(HarnessedHint.instance)` en
   `TheMindStone.java:54` y `TheSoulStone.java:47` (+ import).
2. `Case solved` (MKM): `this.addHint(new CaseSolvedHint(SolvedSourceCondition.SOLVED))`
   en `CaseAbility` ctor (+ import; `SolvedSourceCondition` ya importado).
3. Tras el rebuild: verificar badge en web + regenerar baseline
   `web/fixtures/engine-view-gap.baseline.json` (`scripts/engine-view-schema.mjs`).
   Aceptados sin fix: can't-be-targeted (gate por método), habilidades de
   jugador, flag día/noche.

## 4. Decisiones de producto (no test)

- **U8 generador de mazos**: único ❌ del mapa (`web/COMPONENT_PARITY.md:33`)
  → implementar o declarar fuera de alcance.
- **U4-2** caché de password y **U4-12** sonidos de staging (stretch menores).
- **PWA/offline** (ROADMAP Phase 3).
- **Tauri release**: guardar clave privada minisign + secrets
  `TAURI_SIGNING_PRIVATE_KEY[_PASSWORD]` en GitHub y probar updater real
  (solo mac-arm64 verificado; win-x64/mac-x64 sin JRE).

## 5. Permanentes documentadas (no bloquean)

Beta login anónimo intermitente (server-side) · `END_GAME_INFO` no llega a
espectadores · espectador sin auto-follow Bo3/torneo (paridad desktop) · quirk
Ballista en declare-attackers (fork) · flake `WATCHGAME` en frío (reintentar
con server caliente) · 404s Scryfall `/es` (ruido de consola, fallback EN) ·
`exileCount` del compact MCP en 0 con cartas en exilio (tooling, la UI pinta bien).

## 6. Limpieza de docs

- `AGENTS.md`: dice "solo quedan 2 tests excluidos por `grepInvert`
  (deep-links)" pero `web/e2e/known-broken.ts` está VACÍO desde plan2 →
  actualizar el texto.
- `plan2.md`: C.17 (rendimiento) **medido hoy** → cerrable con los números de
  §E; C.13 solo auditó lobby/builder (partida/torneo sin informe); C.16 móvil
  queda excluido por decisión del usuario.
- `COMPONENT_PARITY.md` U10 e `INTERACTION_COVERAGE.md` (mutate/replay) ya
  actualizados hoy.

## Orden propuesto y estimación gruesa

1. §1 completo (vivos): ~1 sesión.
2. §2.1 (watch live) + decisión §2.2 replay: ~1 sesión.
3. §3 fork (harnessed/Case) + §2.3: ~media sesión + rebuild del motor.
4. §4 decisiones: depende del usuario.

## Criterio de cierre por ítem

- Cobertura: evidencia en vivo (mesa + turnos + screenshots) o justificación
  escrita de imposibilidad (config del server, límite del engine).
- Fixes: tests que fallen sin el fix (unit y/o e2e fake) + `unit`/`typecheck`
  en verde; docs (`PROJECT.md` fila fechada + este fichero) al día.
- Commit solo a petición.

## E. Sesiones (bitácora)

- **2026-09-14 (2ª parte) — B.10 follow Bo3 en vivo ✅ + bug de raíz encontrado y arreglado**
  - *Setup*: mesa `b10-follow` (Bo3 2×HUMAN, `winsNeeded:2`, `skipInitShuffling`),
    `qa-b10-A/B` por MCP, navegador `p2-live2-SPEC` de espectador.
  - *Flujo verificado en vivo*: P1 la concede B → diálogo "Partida finalizada"
    (ganador qa-b10-A) → sideboards de ambos con `mage_submit_deck` → arranca la
    2ª → aviso "La partida cambió: la mesa ha empezado una nueva partida." +
    botón "Seguir partida" → clic.
  - *Bug real (B.10 no funcionaba de verdad)*: al pulsar Seguir, `watchGame`
    arrancaba (`GAME_INIT` de la 2ª llegaba al navegador) pero la app se quedaba
    en el staging «Preparando inicio…» hasta que llegara el primer frame con
    `turn > 1` (los auto-pass no generan `GAME_UPDATE`, así que en la práctica
    no se ve la 2ª partida desde su inicio): el guard anti-stale
    `isOlderThanCurrentGame` comparaba turno/paso del view nuevo contra
    `s.game` (la vista de la 1ª) con `s.gameId` ya actualizado al de la 2ª →
    GAME_INIT (turno 1, `step` vacío) clasificado como viejo y descartado.
    Evidencia: store en `spectating_pending`, `game` con la vista de la 1ª,
    `gameId` `ad2d1977…`, sin `GAME_UPDATE` posterior (los auto-pass no
    generan frames) → sin auto-recuperación hasta el turno 2.
  - *Fix (2 sitios)*: `handleWatchGame` limpia `game`/`gameEnd` al cambiar de
    partida; `eventHandler` no compara contra `s.game` cuando llega un
    `START_GAME` de otra partida (Bo3 de jugador: mismo agujero). Regresión:
    2 tests en `store.test.ts` (rojo sin el fix, verde con él).
  - *Re-verificación en vivo tras el fix*: 2ª concede A (1-1) → sideboards →
    arranca la 3ª `e3ce1a2a…` → aviso + clic Seguir → tablero de la 3ª
    (turno 1, esperando qa-b10-B). Capturas en `web/e2e/shots/` (gitignored):
    `b10-spectate-game1.png`, `b10-follow-after-fix-game3.png`.
  - Mantra: `unit` 1453/1453 + `typecheck` ✅. Mesa `b10-follow` eliminada.
  - *Residual*: falta ver en vivo el paso de partida 1→2 de un **jugador** de la
    web en Bo3 (el fix cubre el código, tests unitarios en verde; los Bo3 en
    vivo usados hasta ahora llevaban jugadores MCP, no la UI).

- **2026-09-14 — live QA de la estela + fix UX Historial ✅/⚠️**
  - *Mutate en vivo ✅* (mesa 2×HUMAN `mutate-live-1`, espectada): Gemrazer
    mutado sobre Elvish con `GAME_ASK` Under/Over (costo mutate `{1}{G}{G}`);
    ambas direcciones pintan `.card-mutate-pile` + `.mutated-badge`:
    Over → partes `[Gemrazer, Elvish Mystic]` 4/4, Under → `[Elvish Mystic,
    Gemrazer]` 1/1 (P/T del top, RE+TR del conjunto). Cierra el "play en vivo
    nunca verificado" de INTERACTION_COVERAGE (fixture `recorded/mutate.json`
    ya existía). Mesa eliminada.
  - *Replay ⚠️ bloqueado*: probe real `getFinishedMatches` → `games:[]`/
    `replayAvailable:false` siempre; causa `saveGameActivated="false"` en el
    config del server (upstream «not working correctly yet»). Probe a **beta**
    (qa-beta-probe): 25 partidas terminadas, **0 con games/replay**. Cliente:
    botón del Historial solo con `games.length>0`; sin controles de transporte;
    `REPLAY_DONE` no sale del tablero. Anotado en INTERACTION_COVERAGE.
  - *Rendimiento ✅* (sealed `perf-sealed-1`, 2×HUMAN 6×M20, `constructionTime:10`
    → auto-submit): instrumentación WS en navegador (wrap `WebSocket` en
    `addInitScript` + `window.__wsPerf`): **GAME_INIT de espectador 4.247 B →
    ~27 ms al primer pintado** (79 ms desde `watchTournamentTable`); frame más
    grande observado **47.073 B** (`GAME_UPDATE_AND_INFORM` de jugador vía
    `joinGame`). Los ~180 KB de C.17 no se reproducen; **no hace falta
    virtualizar el log**.
  - *Hallazgo torneo*: no se puede espectar un match **en vivo** desde el lobby
    (Ver Cuadro solo finalizadas; Espectar deja el staging sin seguir el match).
    Watch real = `watchTournamentTable(matchTableId)` por WS (verificado:
    `attached:true`, GAME_INIT broadcast al navegador). Anotado en
    COMPONENT_PARITY U10. Repro de re-watch: `stopWatching` + `watchTournamentTable`.
  - *Fix UX reportado por el usuario ✅*: el Historial (25 partidas en beta /
    11 locales) no se desplazaba — `.finished-matches-panel`/`-list`
    desbordaban `.lobby-main` (`overflow:hidden`); medido en vivo
    `main clientH 849 / scrollH 2081 overflowY hidden` y lista `visible`.
    Fix: panel `flex:1; min-height:0` + lista `flex:1; min-height:0;
    overflow-y:auto` y la lista solo se monta con partidas (empty-state fuera,
    centrado). Regresión: `web/e2e/finished-matches.spec.ts` (fake, escenario
    `web/fixtures/scenarios/finishedMatches.ts` con 14 partidas) — **falla sin
    el fix** (`overflowY: visible`) y pasa con él; +2 asserts unit
    (`FinishedMatchesPanel.test.tsx` 9/9). `unit` 1451/1451 + `typecheck` ✅;
    verificado en vivo con scroll hasta la última tarjeta (screenshots borrados).
  - Scripts de la sesión (gitignored, recreables): `web/.run/scratch/p3-history-probe.mjs`,
    `p3-watch-match.mjs`, `p3-ws-size.mjs`, `p3-beta-history.mjs`.
  - Limpieza: mesas eliminadas, sesiones MCP cerradas, lobby a 0.
  - **Pendiente inmediato**: commitear a petición (fix scroll + docs + tests).

- **2026-09-14 (3ª parte) — sealed visual (CONSTRUCT/T3/T6) + bracket final ✅ + 2º bug arreglado**
  - *Sealed real desde la UI* (torneo `seal-vis-1`, 2×HUMAN 6×M20,
    `constructionTime:300`; navegador `p2-live2-SPEC` de jugador + `qa-b10-B`
    MCP): CONSTRUCT con pool de 90 cartas, Tierras Básicas sugeridas (17) + 23
    cartas del pool por clic (`moveOneToMain`), `Total: 40 (mín 40)` y
    `Enviar mazo` → partida `e0c1e09b…`. Capturas: `seal-construct-built.png`,
    `seal-turn3.png` (Swamp+Montaña+Sanitarium Skeleton), `seal-turn6.png`
    (2 skeletons + Vial of Dragonfire + 3 tierras; B con 2 montañas) — turnos
    jugados por UI y oponente MCP. Fin: "Has ganado la partida en el turno 6 /
    Has ganado el match / Duración: 15m 7s".
  - *Bracket final*: torneo `brk-final-1` (Constructed Elimination 2×HUMAN,
    MCP A/B; !`'Elimination'` NPE → el tipo real es `'Constructed Elimination'`).
    `getTournament` final: `Finished`, ronda "Player qa-b10-A is the winner",
    A `Finished (Winner)` 3 pts, B `Eliminated`. La mesa desaparece del lobby al
    terminar (sigue sin verse el cuadro final desde el lobby), y **bug nuevo**:
    `Ver Cuadro` de una mesa AJENA (`brk-final-1`) pintó el torneo propio
    cacheado (`seal-vis-1`, congelado en "Dueling 0:14:59") porque
    `useTournamentBracket` usaba `tournamentState.view` como fallback aunque el
    torneo cacheado no fuera el pedido. Fix: `isOwnTournament` + 3 guards
    (open/refresh/effect) y error honesto si `getTournament(tableId)` no
    devuelve nada; 2 tests nuevos rojos→verdes en `useTournamentBracket.test.ts`.
  - *Lecciones de harness*: el auto-pass del MCP no pasa con objetos jugables
    (tierra en mano = bloqueo en cada main; hay que pasar a mano o jugar la
    tierra); `CONCEDE` se ignora durante mulligan/elección inicial; el pago de
    maná en la web requiere clic en la FUENTE del battlefield; con mano
    solapada, `dispatchEvent('click')` esquiva la carta que intercepta.
  - *Estado*: unit **1455/1455** ✅ + typecheck ✅ (incluye los fixes de B.10 y
    `Ver Cuadro`). Lobby a 0 mesas/torneos; sesiones MCP `a`/`b` abiertas
    (qa-b10-A/B). Capturas en `web/e2e/shots/` (gitignored): `seal-construct-built.png`, `seal-turn3.png`, `seal-turn6.png`, `b10-*.png`.
  - *Residual §1.4*: foco teclado (2 Tabs en lobby `Mesas (1)` y partida) —
    sin hacer.

- **2026-09-14 (4ª parte) — §1.4 C.14 foco teclado: cierre del parcial ✅ (informe)**
  - *Lobby* (navegador `p2-live2-SPEC`): orden de tabulación sano — Nueva Mesa
    → Mesas → Mazos → Historial → Clasificación → ajustes ×2 → Desconectar →
    toggle filtros → buscador → pills. Todos `:focus-visible` con anillo visible
    (`outline auto 3px`; el buscador usa el `outline solid` de `styles.css`).
    El "`Mesas (1)` parece resaltado" del parcial era el anillo de foco sobre el
    tab ACTIVO: comportamiento correcto, no bug (captura
    `web/e2e/shots/focus-lobby-tab2.png`).
  - *Partida real* (`focus-live-1`, 2×HUMAN: MCP `qa-focus-A` 40 Forests +
    navegador "Mage Web bolt"; `skipInitShuffling`): la mano es operable con
    Tab (`.hand-card.clickable` role=button tabindex=0) y la carta jugable
    enfocada muestra el glow de `.card-slot.playable:focus-visible`
    (`focus-game-playable-card.png`); **Space juega exactamente UNA tierra**
    (mano 7→6, battlefield 0→1, sin segundo intento ni error) — el fix de
    "Space doble" de C.14 confirmado en vivo. Diálogos con trampa de foco OK
    (mulligan y confirmaciones enfocan su primer control; en confirmar-salir
    el foco inicial es "Cancelar", buena elección).
  - *Findings menores (cantera, sin fix)*: (a) al jugar la carta enfocada por
    teclado, el nodo se desmonta y el foco cae a `<body>` → el jugador de
    teclado debe re-Tabear todo; (b) el enlace Scryfall del footer entra en el
    orden de tabulación entre el botón grande de prioridad y el header (orden
    DOM, no roto); (c) AT/BL son focusables fuera de combate (son toggles de
    parada, legítimos).
  - *Extras verificados de paso*: keep de mulligan con Enter (el web NO
    auto-responde en real; el helper e2e sí lo hace en fake), Conceder→
    Confirmar→"ha abandonado la partida"→Salir→confirm→lobby. El CONCEDE del
    MCP se registra en el log del server aunque el game de la sesión siga
    mostrando el turno (la concesión del navegador cerró la partida).
  - *Estado*: mesa eliminada, sesión MCP cerrada, lobby a 0, navegador en el
    lobby. Capturas en `web/e2e/shots/` (gitignored). Sin cambios de código.

- **2026-09-14 (5ª parte) — §2.1 watch de torneo en vivo desde el lobby ✅ (código + vivo)**
  - *Causa raíz*: al espectar una mesa de torneo, el server
    (`TableController.watchTable`) responde **SHOW_TOURNAMENT con el id REAL del
    torneo** (objectId) + `currentTableId`; el web solo lo logueaba → el staging
    se quedaba en «Preparando inicio…» y no había forma de llegar al cuadro.
    Además `getTournament` del proxy/server exige el id de TORNEO
    (`tournamentFindById`), no el de la mesa.
  - *Fix (web)*: `handleShowTournament(objectId, data)` guarda
    `spectateTournament {tournamentId, tableId}` (idempotente);
    `useTournamentBracket.openBracket(table, tournamentId?)` usa el id resuelto
    (sin él espera el callback en vez de consultar con el tableId);
    `LobbyScreen` consume la resolución y abre el cuadro (sin staging);
    `useTableActions.watchTable` ya no mete las mesas de torneo al staging;
    `handleWatchGame` limpia la resolución (no reabre el cuadro al volver del
    juego). Extra: el bracket del modal recibe el id real y `canQuit` → en
    torneos ajenos ya no aparece "Abandonar torneo" (antes además quitaba con el
    tableId equivocado).
  - *MCP*: tool `mage_watch_tournament_match` (WATCHGAME → `watchGame` →
    espera `gameView`), inventario del server test actualizado.
  - *Tests*: `useTournamentBracket` (5→6), `useTableActions` (+2 watchTable),
    `store.test` (+3 SHOW_TOURNAMENT +1 limpieza en watchGame),
    `TournamentBracket` (+2 canQuit). Unit **1464/1464** + typecheck ✅;
    `mcp test` 39 pass + typecheck ✅.
  - *Verificación viva* (torneo `tt-live-1`, Constructed Elimination 2×HUMAN
    `qa-tt-A/B`, match `2fc133b2…` Dueling): navegador `p2-live2-SPEC` (ajeno)
    → "Ver Cuadro" carga el cuadro EN VIVO (Dueling, 1 ronda, 1 partida, ojo) →
    el ojo pinta el tablero del match como espectador
    (`web/e2e/shots/bracket-live-watch.png`); "Espectar" de la tarjeta abre el
    cuadro directo (sin staging) y sin "Abandonar torneo"
    (`bracket-live-modal.png`). Mesa eliminada, sesiones cerradas, lobby a 0.
  - *Pendientes relacionados*: cuadro de torneos YA TERMINADOS desde el
    Historial (la mesa desaparece del lobby y `MatchView` no trae tournamentId:
    haría falta un command de historial→torneo); §2.2 replay (decisión usuario).
