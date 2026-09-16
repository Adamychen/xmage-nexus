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
3. ✅ **`GAME_REDRAW_GUI` — FUERA DE ALCANCE por decisión (2026-09-14)**: log-only permanente; el tablero ya reacciona a `GAME_UPDATE`.
4. ✅ **Recarga de página a mitad de draft (resync) — HECHO 2026-09-14**
   (ver §E 12ª parte: el server NO reenvía `DRAFT_INIT` a un `joinDraft` tardío).

## 3. Fork / motor — FUERA DE ALCANCE por decisión (2026-09-14)

Los gaps `harnessed`/`Case solved` (y el resto del baseline: habilidades de
jugador, día/noche, `can't-be-targeted`) quedan declarados fuera de alcance:
exigirían cambio en el fork + rebuild del motor, y el proxy no puede inferirlos
de `rules`/iconos. Documentado en `INTERACTION_COVERAGE.md` §Gaps; el guard
`engineViewCoverage` sigue vigilando que el gap no cambie.

1. `harnessed` (Unfinity): `ability.addHint(HarnessedHint.instance)` en
   `TheMindStone.java:54` y `TheSoulStone.java:47` (+ import).
2. `Case solved` (MKM): `this.addHint(new CaseSolvedHint(SolvedSourceCondition.SOLVED))`
   en `CaseAbility` ctor (+ import; `SolvedSourceCondition` ya importado).
3. Tras el rebuild: verificar badge en web + regenerar baseline
   `web/fixtures/engine-view-gap.baseline.json` (`scripts/engine-view-schema.mjs`).
   Aceptados sin fix: can't-be-targeted (gate por método), habilidades de
   jugador, flag día/noche.

## 4. Decisiones de producto (no test)

- **U8 generador de mazos**: ✅ FUERA DE ALCANCE por decisión (2026-09-14).
- ✅ **U4-2** (contraseña deshabilitada en beta) y **U4-12** (sonidos join/leave en staging) — hechos 2026-09-14.
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

- **2026-09-14 (6ª parte) — Win Rate del leaderboard → Juego Limpio (dato real)**
  - *Reporte del usuario*: la columna WIN RATE de Clasificación mostraba `—`.
    Causa: desde `f08ed4e46b8` (2026-09-12, auditoría interactiva) se dejó de
    fabricar un win rate a partir del ELO; el server **nunca** envía W-L
    (`User.userStatsToMatchHistory` solo manda el conteo + abandonos:
    `1 (Q:1)`), así que el dato no existe.
  - *Decisión del usuario*: mostrar el **fair play real** disponible. La columna
    pasa a `JUEGO LIMPIO` = `100 − matchQuitRatio` (con tooltip
    `leaderboard_fair_play_hint`: "{ratio}% de abandonos"; `—` con pista cuando
    no hay partidas). Tie-break del sort por juego limpio en vez de winrate.
  - *Tests*: 2 en `LeaderboardModal.test.tsx` (rojo sin el cambio: el de
    solo-conteo exigía `—` y ahora exige `83%` con tooltip; + el de 0 partidas
    sigue en `—`); clave nueva ×9 locales + `types.ts`. Unit **1465/1465** ✅ +
    typecheck ✅. Verificado en vivo (`p2-live2-SPEC`: HISTORIAL `1 (Q:1)` →
    JUEGO LIMPIO `0%`; captura `web/e2e/shots/leaderboard-fairplay.png`).

- **2026-09-14 (7ª parte) — X de cerrar modales centrados (reporte del usuario)**
  - *Reporte*: «alguno está descentrado». Auditoría: los ✕ de texto dependían de
    la métrica de la fuente y varios modales no centraban su caja
    (`settings-close`, `appearance-close`, `sleeve-picker-close`,
    `create-dialog-close-btn`, `close-btn` de Join, `wiki-close-btn`,
    `about-close-btn`, `deck-import-close-btn`); además había 3 glifos distintos
    (`✕`, `×`, `&times;`).
  - *Fix*: todos los cierres de modal/overlay usan el icono SVG `<Icon name="x" />`
    (geometría garantizada) y su CSS declara centrado
    (`inline-flex` + `align-items`/`justify-content: center` + `line-height: 1`;
    los que ya usaban `grid`/`place-items` se mantienen). Campos tocados:
    DialogShell (todos los modales que lo usan), Settings, Apariencia, Sleeve
    picker, Crear mesa, Unirse, Cuadro de torneo (modal + cabecera), Wiki,
    Torneo (panel), CardPreview, Importar mazo, Acerca de, PileOverlay,
    CrossZoneOverlay, HandViewer, Leaderboard, Perfil de usuario, Avatar picker.
    Fuera de alcance (no son cierres): buscadores con ✕, borrados de reglas de
    auto-respuesta, borrar baraja del manager, banner de error del login.
  - *Guard*: `web/src/ui/modalCloseCentering.test.ts` (16 cases) exige el
    centrado en CSS; **rojo exacto en los 8 ofensores** sin el fix.
  - *Vivo*: medido con probe (SVG-center vs botón-center, dx/dy = 0) en Settings,
    About, Crear Mesa, Unirse y Clasificación; capturas
    `web/e2e/shots/x-settings-fixed.png`, `x-join-fixed.png`. Unit **1481/1481** +
    typecheck + build ✅; e2e fake de modales (about/settings/wizard/staging/
    tournament/decks) 35/35 ✅.

- **2026-09-14 (8ª parte) — Errores de unión a mesa: banner formateado y descartable (reporte del usuario)**
  - *Reporte*: al unirse a una mesa el error no se podía cerrar y se veía crudo.
    Causa raíz doble: (1) el fallo de `joinTable` (eventHandler, «delegated»)
    pintaba el banner del lobby **detrás** del diálogo — ilegible/inaccesible; y
    (2) el texto llegaba con el título del servidor pegado
    (`Join Table Wrong password.`) y sin botón de cierre.
  - *Fix*: componente compartido `ui/ErrorBanner` (icono en badge, mensaje con
    `pre-wrap`/`overflow-wrap`, `role=alert` y X de cierre accesible) usado en
    el diálogo de unión, el lobby y el staging. `handleJoinWithDeck` lanza el
    error ya traducido y limpia el global (sin duplicado detrás del modal);
    `translateError` descarta el título del servidor
    (`Join Table|Join Tournament|Create Table|Create Tournament`) y mapea
    `Wrong password.` a la traducción limpia.
  - *Tests*: unit (`ui/ErrorBanner.test.tsx` 5, `JoinTableDialog` cierra el
    banner, `useTableActions` rechaza sin tocar el store, i18n con el título
    quitado) + e2e fake `web/e2e/join-errors.spec.ts` (2: banner en el diálogo
    sin banner en el lobby y descarte del banner del lobby tras fallar
    `watchTable`; hook `onRequest` nuevo en `makeBaseScenario`).
  - *Vivo*: real, mesa con password `err-banner-1` + password incorrecta →
    banner dentro del diálogo con «La contraseña de la mesa es incorrecta» y X
    (capturas `web/e2e/shots/join-error-banner.png`, `lobby-error-banner.png`).
    Unit 1489/1489 + typecheck + build ✅.

- **2026-09-14 (9ª parte) — UX del Deck Builder (auditoría, sin mecánicas nuevas)**
  - *Petición*: mejorar la experiencia del editor de mazos sin añadir funcionalidad.
    Auditoría del subagente sobre `decks/*` + verificación viva en 1280×800.
  - *Lote 1 (bugs visibles)*: el debounce de guardado ya no pierde la última
    edición al cerrar (`handleClose` + flush en el cleanup del desmontaje; tests
    `DeckBuilder.test`), rejilla de búsqueda operable por teclado (Enter/Espacio)
    y tira con `focus-within` + `stopPropagation` del keydown de sus botones
    (antes Enter en “+” restaba copia), hint de la papelera honesto («quitar una
    copia»), “Cargando…” del botón de paginar → “Cargar más” y overlay
    “+ Buscar” → “+ Añadir”.
  - *Lote 2 (feedback)*: “Copiar” del Inspector copia de verdad
    (`exportTxt` + fallback a no-confirmar), badge de guardado “Guardando…/
    Guardado ✓” con `role=status aria-live`, tooltips de export sin “¡Copiado!”,
    problemas de legalidad visibles al clic (popover; antes solo tooltip),
    drop de `.dck` inválido avisa, búsqueda con estados diferenciados
    (sin resultados con la query + limpiar filtros; error con reintento) y
    banner de issues del servidor descartable y anunciado.
  - *Lote 3 (pulido)*: banquillo con tope real por formato (`FORMAT_CONFIGS`,
    antes “/15” fijo), vista horizontal sin scroll lateral (columnas adaptables),
    tooltips honestos del header (layout/curva), filtros con `aria-pressed` y
    etiquetas de color reales, operador F/R sin valor 3 implícito, slider con
    valor visible, popover de ayuda con Escape, curva con vacío y `role=img`,
    etiquetas “Pips de maná/Tierras objetivo”, contador de copias >4 numérico,
    confirmaciones al borrar todas las copias y al sugerir tierras, foco al
    vecino al vaciar una tira, hint de drop fuera del flujo (sin empujar),
    preview clampada al viewport, “Equipar/Equipado” por id persistido,
    placeholders/aria del nombre y doble clic contenido.
  - *Tests*: `DeckBuilder.test.tsx` (2), `ArenaCardStrip.test.tsx` (4),
    `ArenaCardGrid.test.tsx` (+4), `DeckListPanel.test.tsx` (+1 y banquillo por
    formato); e2e fake `decks-gallery.spec` actualizado (conteo sin “/15”) y
    suite de decks/deckvalidation/grid-search en verde. Unit **1500/1500** +
    typecheck + build ✅. Vivo: capturas `web/e2e/shots/db-after-*.png`
    (header/issues, sin resultados, horizontal, guardado).

- **2026-09-14 (10ª parte) — Maná del Deck Builder: donuts SVG reales (reporte del usuario)**
  - *Petición*: «lo de ver el maná se ve cutre, ¿no se puede hacer un pie chart
    de verdad?». Los antiguos repartos eran tres `conic-gradient` de 38 px con
    agujero y leyenda de pips suelta (sin nombres ni porcentajes).
  - *Implementación*: componente reutilizable `ManaPie.tsx/.css` — donut SVG por
    sectores (`stroke-dasharray`/`dashoffset` sobre círculos rotados −90°),
    separación de 2 px entre sectores (sin hueco si hay uno solo), total en el
    centro, hover con brillo y `<title>` por sector; `ManaPieLegend` con
    símbolo/icono, nombre del color (`game.color_*` vía `COLOR_LABEL_KEYS`,
    exportado desde `ArenaFilterBar`), cantidad y porcentaje (`manaShare`, con
    «<1%» para porciones diminutas). `CurveChart` pasa a tres secciones con
    título + gráfico + leyenda: **Pips de maná** (104 px), **Fuentes de maná**
    (76 px, tierras/no-tierras con iconos) y **Tierras básicas** (76 px, por
    color); «Maná por coste» se mantiene (segmentos con hover). Panel de curva:
    `max-height` 30vh → 38vh para que el gráfico respire. CSS muerto eliminado
    (`curve-color-donut`, `curve-donut-hole`, `curve-pips-*`).
  - *Tests*: `ManaPie.test.tsx` (6: sectores, anillo mono-color sin hueco, hueco
    entre sectores, vacío → `null`, leyenda con % y redondeo/límite de
    `manaShare`); `CurveChart.test.tsx` ajustado (el total ahora aparece también
    en el centro). Unit **1506/1506** + typecheck + build ✅; e2e fake
    `decks-gallery`/`deckvalidation`/`grid-search` 14/14 ✅.
  - *Vivo (1280×800, real)*: donut de 5 colores (Rojo 50%, resto 13%) con total
    y leyenda, fuentes/tierras en anillo completo mono-color, y el mismo gráfico
    en el Inspector (doble clic) — capturas `web/e2e/shots/mana-pie-after.png`,
    `mana-pie-donut.png`, `mana-pie-sections.png`, `mana-pie-inspector.png`
    (antes: `mana-pie-before.png`).

- **2026-09-14 (11ª parte) — Draft: acuse del pick, espera honesta y nombres (reporte del usuario)**
  - *Reporte*: «intenté jugar un draft y fue imposible; a veces me quedaba
    esperando porque decía que el tiempo se acababa pero cuando clickeo una
    carta el contador sigue; no sé si la selección es correcta y es que estoy
    esperando al otro; falta info visual».
  - *Diagnóstico (protocolo real)*: al pickear, el server **no manda ningún
    evento** hasta que TODOS han elegido (el `DRAFT_UPDATE` de rotación solo
    sale cuando el sobre pasa). El proxy **sí** devuelve en la respuesta de
    `sendCardPick` el `DraftPickView` posterior (`picking:false`), como el
    cliente de escritorio, pero la web lo ignoraba: el `picking:true` viejo
    seguía mandando → contador local bajando a 0 («tiempo agotado»), cartas aún
    clicables y ningún acuse de la carta elegida (un segundo clic se perdía en
    silencio). Además, en el protocolo real `SimpleCardView` **no trae `name`**
    → sobres y banners con UUIDs.
  - *Fix cliente*: `mergePickAck` en `state/events/draft.ts` aplica la respuesta
    solo si el pick sigue vigente (mismo sobre/carta; si llegó el siguiente
    `DRAFT_PICK` en el round-trip, se descarta) y `DRAFT_UPDATE` sin pickView
    fuerza `picking:false` (cubre autopicks, que no generan respuesta).
    `DraftScreen`: acuse local inmediato (banner «Has elegido {carta}» + chip
    «Esperando…», timer parado), anti-doble-pick por acuse, `freshPick` acepta
    también `DRAFT_INIT` (recarga/reconexión en mitad del pick), timeout 0 =
    ∞, progreso «Sobre X/N · Carta Y», texto de dirección de paso, `is-picked`/
    `is-new` (ring verde) y nombre resuelto por Scryfall (`CardStripMeta.name`)
    cuando el contrato no lo trae.
  - *Tests*: `draft.test.ts` (+5: ack, merge de picks, guarda de vigencia,
    DRAFT_UPDATE→false), `DraftScreen.test.tsx` (+5: acuse/no doble pick,
    fallback sin data, siguiente pick re-habilita, respuesta obsoleta, nombre
    por Scryfall), escenario fake `draft.ts` fiel al protocolo (responde el
    `DraftPickView` + silencio configurable `nextPickDelayMs`, updates con
    `draftPickView:null`) y e2e nuevo `draft.spec.ts` «el pick acusa al instante
    y espera a los demás». Unit **1516/1516** + typecheck + build ✅; `@draft`
    4/4 ✅.
  - *Vivo (protocolo real, 2×HUMAN)*: `Booster Draft Elimination` M21 con la web
    como un humano y un segundo humano por WS crudo que retiene el pick a
    voluntad (`draft-hold.mjs`): espera larga verificada sin contador fantasma
    (`web/e2e/shots/draft-live-waiting.png`), al pickear el rival el siguiente
    `DRAFT_PICK` limpia el banner y re-habilita las cartas solo
    (`draft-live-resumed.png`). Resuelto el límite A.1 de plan2 (picks de draft
    jugados en vivo con la web). El submit del pool desde `ConstructScreen`
    (A.2) ya estaba verificado en vivo con sealed (§1.2, submit 40 desde la UI);
    el camino draft→construct usa la misma pantalla.
  - *Vivo en el servidor oficial (`beta.xmage.today`)*: mismo guion con la web
    logueada en beta (98 jugadores online; la mesa pública `nexus-qa-*` se creó,
    jugó 2 rondas y se eliminó): nombres reales resueltos por Scryfall (el
    contrato real no trae `name`), banner «Has elegido Alpine Watchdog», espera
    sin contador (`web/e2e/shots/beta-draft-waiting.png`) y re-habilitación al
    pickear el rival (`beta-draft-resumed.png`). Login anónimo OK en esta
    ventana; la verificación canónica sigue siendo el fork local (beta es
    intermitente por diseño).
- **2026-09-14 (12ª parte) — Recarga a mitad de draft: resync ✅ (código + vivo)**
  - *Hallazgo de motor (fork)*: `DraftController.join()` crea una `DraftSession`
    nueva SIN llamar `init()` (solo se llama al arrancar el draft), así que el
    server **NO responde `DRAFT_INIT` a un `joinDraft` tardío** — solo mandará
    los próximos `DRAFT_PICK`. Persistir solo el `draftId` no repinta nada:
    la primera versión del fix lo confirmó en vivo (lobby hasta el siguiente
    pick). Fix final (solo web, sin Java): `persistence` guarda la **instantánea
    completa** (`ActiveDraftPersistence {draft, tournamentId, savedAt}`, máx 3h,
    rechaza el id sintético `'draft'`); `handleDraftUpdate` la sella en cada
    evento y `handlePick` tras el acuse (`persistDraft`); `gateway.restoreLimited`
    (en `onOpen` y en `runConnect` tras el login) re-pinta la instantánea con
    `lastDraftEventAt=now` y `lastDraftMethod='DRAFT_INIT'` si `picking` (si no,
    `null`: la espera sigue sin manos calientes) y re-une la sesión con
    `joinDraft` — si falla, descarta instantánea y estado. Limpieza en
    `DRAFT_OVER`/`CONSTRUCT`/`quitDraft`/login manual/`reset`.
  - *Tests*: `persistence.test` (+7: snapshot, corrupto, caducidad…),
    `gateway-rejoin.test` (+4: re-pinta+re-une, espera sin pick fresco, fallo
    descarta+limpia estado, `reset`), `draft.test` (+4: sella/limpia); el fake
    ya no manda `DRAFT_INIT` espontáneo tras la 1ª conexión y `joinDraft` tiene
    modo `joinDraftSilent` (fiel al server real); e2e `draft.spec` +1 (recarga
    con `joinDraftSilent`: la pantalla solo puede volver por la instantánea,
    y el pick posterior funciona). Unit **1531/1531** + typecheck + build ✅;
    `@draft` **5/5** ✅.
  - *Vivo (protocolo real, 2×HUMAN, M21)*: recarga en mitad de la espera →
    lobby (sin instantánea útil); con el fix, tras la 2ª recarga la pantalla
    **vuelve al instante** desde la instantánea («Tu turno», booster y picks
    intactos) y el pick desde la pantalla restaurada lo acepta el server
    («Has elegido Battle-Rattle Shaman», 3 picks).
    Capturas: `draft-live3-resync.png` (+ `draft-live2-*`).
  - *Límites honestos*: el temporizador restaurado cuenta desde el `timeout` del
    evento (puede sobreestimar tras una caída larga; el server manda y su
    autopick manda — la UI se autocorrige al siguiente evento); una recarga en
    *tu* turno funciona porque el pick seguía pendiente en el server; sin
    sesión viva en el server (proxy >60s de gracia), `joinDraft` falla y se
    limpia.
