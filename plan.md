# AUDIT-PLAN — continuar tras compactar (2026-09-12)

> ESTADO AL COMPACTAR: todo lo de abajo ejecutado y commiteado (`f08ed4e46b`
> auditoría, `52aa95565e` feed P/T, `99e078ae91` harness MCP). Siguiente
> objetivo elegido por el usuario: **fichas (tokens)** en mesa determinista.
> Lobby local a 0 mesas. Stack corriendo (ver §1). El proceso MCP vivo corre
> código ANTERIOR al harness (sin pin/combat nuevo): **reconectar el MCP
> (reiniciar opencode) antes de jugar en paralelo o usar `session`/gang-block**.

Auditoría interactiva exhaustiva de XMage Nexus (repo `/Users/adam/Desktop/proyectos_git/mage_alt_client`,
rama `master`, 6 commits por delante de `origin/master`). Mandato del usuario: **auditoría completa
(fases 0–4) y arreglar todo lo encontrado, con tests**. No commitear sin pedirlo (hay un lote grande sin commitear).

## 1. Estado de la sesión en vivo (no tocar sin leer esto)

- Stack corriendo: server 17171 (pid 6385), proxy 8787 (pid 41421), vite 5173 (pid 28324).
  Ver con `mage_mage_stack status`. NO reiniciar a la ligera (hay partida viva).
- Navegador Playwright MCP en `http://localhost:5173/`, logado como **qa-ui-1345** (sesión restaurada).
- **Partida viva**: mesa `audit-lobby-1` (Two Player Duel, Freeform, creada desde el wizard en Fase 2B),
  vs SIM `sim-000001-1`. Último estado leído de `window.__mageScene`:
  `turn 1, phase PRECOMBAT_MAIN (turno del SIM), priority:true, playable:0`, mi mano 7 Montañas.
  Mazo en uso: **Mazo 4** (99 cartas: 98× Mountain LEA:292 + Sidar CMR:535, comandante=Sidar, partner=undefined).
- MCP `mage` conectado como `mcp-mtxhziub` (sin partida; solo lobby/chat). No sirve para ver la partida del navegador.
- `Mazo 4` vive en IndexedDB del perfil Chromium del MCP (`mage-nexus`, store `decks-v2`).

## 2. Lo ya completado y verificado

- Fases 0 (inventario), 1 (smoke) hechas. Tres agentes de análisis estático (game/, lobby+setup,
  decks+settings) devolvieron hallazgos; casi todos verificados en código y corregidos.
- Unit suite: **1361/1361** en verde (169 ficheros). `typecheck` limpio. `build` OK
  (solo warning preexistente de chunk en decks/storage). `zoom.spec.ts` e2e fake: 3/3.
- Fixes grandes ya aplicados (ver `git status`/`git diff` para el detalle; ~110 ficheros tocados):
  - Bloqueantes: GenericDialog hooks-order (+test), useInviteLink server-switch (+2 tests),
    storage quota tipada + badge de error con reintento en DeckBuilder (+tests), cloneDeckForEdit
    conserva comandante/pareja/favorito (+test), import replace conserva/adopta comandante + drop-file
    fusiona banquillo (+tests), payload de drag con `type_line` canónico (+test) + DeckInspectorModal.
  - Juego: CardPreview DFC fallback, QuickReactions botón muerto, dungeons.ts guard (+test),
    PileDialog botón explícito (actualizados `interactions.spec.ts`, `pile-visual.spec.ts`, FeedbackDialog.test),
    PlayerInfoBar curse key, ResourceBar `card_number` i18n, GameChat `isGameChatEntry` (+test),
    MechanicsTray cleanup, TournamentPanel deps, GenericDialog stepper i18n (6 claves),
    DeckTracker tooltips, mana_symbol_title, clickableProps helper (+test) aplicado a
    PlayerInfoBar/HandZone/StackZone, ContextMenu Escape, GameChat send aria, CardPreview close aria.
  - Lobby: seats `?? []` (TableCard, useTableActions, SpectatorStagingScreen, UserActionModal),
    onWatchTable try/catch, `create_table_name_required`, JoinTableDialog ref, InviteLinkButton
    estado de error honesto (+tests), TableFilterBar pares excluyentes + sanitize al cargar (+test),
    stepper `goToStep` con validación (+test), campo puerto proxy en LoginScreen (+`proxy_port`),
    SetupWizard username requerido (+test), deepLink `serverRaw` + aviso (+tests en deepLink/useInviteLink).
  - Mazos: onlineDeckService designa comandante/pareja (+tests), parseDck round-trip Commander
    (`Deck.commanders`, exports Arena/txt con sección Commander, .cod zone commander, [COMMANDER] en .dck,
    ImportResult.commanders + adopción) (+tests), filterQuery (C exclusivo, NaN guard, aviso colisión
    raw/chips + `filter_raw_color_clash`) (+test), DecksGallery `mergeEnrichedColors` + AbortController (+tests),
    useDeckMetadata dedup por refs + in-flight (+test), DeckBuilder persist con error + cleanup timers,
    `save_failed_retry`, BasicLandAdder reset por formato, sideboard acepta ficheros, zoom stepper por
    presets (actualizados `zoom.spec.ts` e2e + SettingsModal.test), SleevePickerModal suscrito,
    Modal z-index con wrap (+test), CardPrintingsModal dep `t`.
  - Interactivos: FormattedText entidades latinas (+test; verificado en vivo en chat),
    parseStats honesto (sin W-L/winrate fabricados; verificado en vivo: Historial "6 (T:2 Q:1)", "—"),
    `isUserInGame` (tokens Match:/Sideb:/Draft:/Const:/Tourn:; verificado en vivo "En el lobby") (+tests).
  - **Feed de partida (Fase 2C, bug real con 404s en vivo)**: el servidor loguea
    `X casts Y targeting Z from hand` (forma inline de `AbilityImpl#getGameLogMessage`,
    verificada en `xmage-fork` `Spell.getActivatedMessage`) pero `parseGameEvent` solo partía
    `[target: Z]` → `cardName` quedaba `Lightning Bolt targeting qa-ui-1345`, el feed no mostraba
    la píldora ➔ y `ActionFeedCard` disparaba 4×404 a Scryfall. Fix: grupo inline
    `(?:\s+targeting\s+(.+?))?` antes del `from <zona>` en `gameEventParser.ts` + 3 tests live-like.
    (El CardView de la pila/cementerio viene limpio del servidor: `M10/146`.)
  - **Log "¿...??" duplicado**: `questionLogLine` (`state/events/prompts.ts`, ahora exportada +
    test) miraba el crudo con HTML del servidor y no veía el `?` final → envolvía de más.
    Fix: decide sobre el texto visible (sin tags) y acepta `.`/`!` como terminal.
  - **Fin de partida agramatical ("Tú pierde/gana")**: `localizeGameEndMessage` sustituía "You"→"Tú"
    manteniendo el verbo en 3ª persona (también mal en de/fr/it/ru y "You wins" en en).
    Fix: claves `_you` (`end_won/lost_game_turn_you`, `feed_won_match_you`) en types + 9 locales;
    tests actualizados (fosilizaban el bug). Verificado en unit+typecheck; el diálogo en vivo
    ("Partida finalizada", duración, Descargar log, Volver al lobby) OK antes del HMR.
  - **PingBadge en español fijo**: tooltip "Latencia… (conectado…)" y 'Desconectado' hardcodeados,
    visibles al cambiar a inglés. Fix: claves `ping_tooltip`/`ping_tooltip_conn`/`ping_disconnected`
    en types + 9 locales; `parsePing` acepta etiqueta; componente usa `useTranslation` (+test).
    Verificado en vivo EN ("Latency: 1ms (connected avg: <1ms)") y ES.
- Fase 2C verificada en vivo con partida real vs SIM (3 turnos, concesión): mulligan, tierra,
  habilidad de maná ({R}1 en reserva), pila con flecha de objetivo, ASK de maná con Sí/No,
  skip attack, feed con píldoras ➔, chat de partida + timestamp, reacciones, DeckTracker
  (90/98 97.8%), phase stops, GameMenu completo (Conceder/Salir/Rebobinar/Triggers/prefs de
  maná/Auto-respuestas/Ajustes/Wiki/F11), confirm de concesión, game-over → lobby limpio.
- Fase 2B-rest verificada en vivo: wizard Torneo (Draft/Limitado, plazas, sets, summary),
  join con contraseña (`audit-pw-1` vía MCP, diálogo con anfitrión + "Requiere contraseña" +
  picker de mazos + Guardar clave), staging (Privada, Invitar a jugar/espectar, No estoy listo,
  Cambiar baraja, Chat de la Mesa), leave + limpieza de mesa. El "(42%)" del tooltip es el
  **quit-ratio del servidor** (`userStatsToMatchQuitRatio`, verificado en fork), no un winrate:
  no es bug (paridad desktop). PENDIENTE: UserActionModal con otro humano (sin segundo humano
  disponible; cubierto por tests) y deep-link `#join=` en vivo (ruta cubierta por e2e fake).
- Fase 3 adversarial verificada en vivo: cambio de idioma ES→EN→ES en caliente (cazó PingBadge),
  localStorage corrupto (conn/lang/draft → fallback gracioso a login en español, re-login OK),
  viewport móvil 390px (navegación móvil dedicada, sin roturas), Tab con foco visible
  (outline + glow; cazó la falta de trampa), Escape no cierra el wizard (deliberado: Modal
  solo cierra con onEscape explícito; el wizard protege el draft).
- Fase 4 (a11y): **Modal compartido ahora con auto-foco + trampa de Tab + restauración de foco**
  (`ui/Modal.tsx`, solo el topmost atrapa; 2 tests nuevos; verificado en vivo: al abrir el
  wizard el foco cae en ✕ dentro del dialog). Suite 1361 sin regresiones.
  - Claves i18n añadidas a types + 9 locales (necesario para `i18n.coverage.test.ts`): save_failed_retry,
    pile_choose, create_table_name_required, proxy_port, username_required, invite_copy_failed,
    invite_bad_server, amount_* (6), tracker_clear_search/sort_label, mana_symbol_title, chat_send,
    18 claves lobby (seat_sim/ai_*, draft_timing_*, dev_*, table_min/max, join_sb_suffix, time_min_short),
    10 claves decks (export_*, grid_of_total, drag_remove, box_new_deck, search_help_*),
    filter_raw_color_clash. Whitelist de coverage ampliada con 5 (SIM, Regular, Dev/Test, SB, {min}m).
  - Hallazgos de la auditoría en vivo ya corregidos: **cache-poison de nombres localizados**
    (`setCachedCardName` usaba el nombre pedido en vez de `data.name`; 3 sitios + test de no-envenenado),
    **pareja = misma carta** (`canPairCommanders` rechaza mismo nombre, `commanderCardsFor` dedup,
    import adopta pareja distinta) (+tests), **applySuggestion arrastra comandante/pareja/portada** (+test).
  - Proyecto/docs aún NO actualizados: PROJECT.md, COMPONENT_PARITY.md, site/content.json.

## 3. Lo pendiente (en orden)

1. **Fase 2C (casi completa)**: partida `audit-lobby-1` CONCEDIDA en turno 3, de vuelta al
   lobby como qa-ui-1345. Resta si se quiere: menús de avatar en partida, visor de cementerio/exilio,
   atajos F1/F11. La mesa `audit-lobby-1` puede seguir existiendo en el servidor (salir la cierra
   para el humano; el SIM se limpia solo).
2. **Fase 2B (resto)**: HECHA (ver §2). Solo quedan los dos pendientes anotados allí.
3. **Fase 2D**: estados raros (voto, trigger-order múltiple, planeswalker, dungeon, mutate,
   sideboard Bo3) — NO probados en vivo (requieren partidas amañadas); quedan cubiertos por
   los e2e fake/real existentes (`recorded.spec`, spells/targeting/combat) que se corren en el cierre.
4. **Fase 3 adversarial**: HECHA la parte barata en vivo (ver §2). Quedan fuera del alcance de
   una sola ventana: 2ª ventana misma cuenta (attach; cubierto por suite MCP `mage_reconnect`) y
   proxy caído a mitad de juego (cubierto por tests de reconexión del proxy).
5. **Fase 4**: pase UX/a11y final (navegación por teclado en builder y partida, foco visible, contraste).
6. **Cierre**: `npm run test` 1361/1361 ✅ + `typecheck` ✅ + `build` ✅; e2e fake completo
   112 pass / 5 fail / 2 skip → los 5 eran coletazos del lote (best-of×3, settings zoom 115%,
   U6 `Export(ar)? .DEK`) → specs actualizados, re-run 6/6 ✅; PROJECT.md actualizado
   (header + fila §9 del 2026-09-12). FALTA: decisión de commit del usuario.

## 4. Lecciones/gotchas (no redescubrir)

- **HMR ≠ bug**: editar hooks con el componente montado produce "change in the order of Hooks" +
  `getSnapshot of null`. Siempre confirmar con recarga dura (navegar a `/`) antes de tratarlo como bug.
- **Vitest**: `localStorage` es `undefined` en este entorno → los tests que lo necesiten deben hacer
  `vi.stubGlobal('localStorage', fake)`. `-t <nombre>` filtrado puede dar `document is not defined`
  espurio; fuente de verdad = run del fichero completo. Cuidado con el transform-cache tras
  stash/pop rápidos (un run puede servir código viejo; repetir para confirmar).
- **Flakes por CPU**: no correr e2e full con el navegador MCP abierto ni partidas vivas pesadas.
- **Datos de prueba**: LEA:292 **NO es Montaña** en Scryfall/DB (es Isla); PC2:1 **NO es Sidar**
  (es Armored Griffin). Impresiones correctas: **Sidar CMR:535, Tana CMR:537**.
  Fuente de verdad rápida: `curl "https://api.scryfall.com/cards/<set>/<num>?format=json"`.
- **Servidor (fork `../xmage-fork`, verificado en fuente)**: `matchHistory` es SOLO conteo
  (`"6"`, `"6 (Q:1)"`, nunca W-L); `getGameInfo()` devuelve `"not active"` (string no vacío) sin partida
  y tokens `Wait:/Match:/Sideb:/Draft:/Const:/Tourn:/Watch:` en juego. De ahí salieron los fixes de
  honestidad/presencia.
- **Scryfall `/es`**: 404 esperado para cartas sin impresión española (LEA etc.); el fallback a URL
  canónica funciona, pero genera ruido 404 en consola (nit anotado, sin fix posible desde JS).
- **Chat flotante tapa botones** de la galería (Editar interceptado por el panel de chat): bug UX real
  pendiente de fix (z-order/posición del FloatingChat vs contenido). Repro: abrir Chat Global en Mazos
  e intentar clic en Editar.
- **Playwright `dragTo`** no es fiable para el DnD HTML5 de la app; en e2e se usa
  `dispatchEvent('dragstart/dragover/drop', {dataTransfer})` (ver decks-gallery.spec.ts, test corona).
  La corona (hover → ★/Designar) es el camino fiable en MCP.
- Estado del Mazo 4: commander=Sidar CMR:535, partner=undefined, 99 cartas (98×LEA:292 + Sidar).
  La entrada envenenada `nexus_loc_card_es:sidar kondo of jamuraa` ya se borró del LS del perfil MCP.

## 6. Sesión post-plan (2026-09-12 12:00–13:30): self-play, oleada paralela, harness

- **Workflow navegador por defecto** (mandato usuario, en `AGENTS.md`): snapshot
  para actuar + **screenshot para verificar** mirando la imagen. Artefactos en
  `.run/playwright-mcp/` (`selfplay-*.png` de esta sesión).
- **Self-play PvP `selfplay-1`** (un solo agente, sesiones `self-A`/`self-B`,
  2xHUMAN determinista, 6 turnos, espectado en navegador): mulligan keep,
  tierras, Goblins haste, ataques con daño, **Bolt T4A con GAME_TARGET real**
  (5 opciones) a criatura rival, **bloqueo T5B** (trade 1/1), concesión T6A →
  `GAME_OVER`+`END_GAME_INFO` en ambos lados. Fixes (commit `52aa95565e`,
  `gameEventParser.test.ts` 21 ✅): `cleanCardName()` (sufijo `(1/1)` del
  servidor → 404s Scryfall), sin `cardName` en ataques de conteo
  (`1 creature` → 8×404), `(?:has\s+)?` en `X has won the match/game`
  (`qa-self-B has gana la partida`).
- **Oleada paralela** (2 subagentes, cuentas/mesas propias): (a) `gang-block-1`:
  gang-block real + `GAME_GET_MULTI_AMOUNT` directo (SIN prompt de orden previo;
  defaults en orden de declaración) → trade + 1 que pasa (A 20–B 15, concede B);
  `mage_combat blockers=[a,b]` NO sirve (2º UUID cae en el GAME_TARGET);
  workaround por-bloqueador verificado. (b) `london-chat-1`: Londres a 5 ✅
  (5 vs 7) + chat cruzado enviado (recepción invisible vía MCP = gap harness) +
  concesión. **Lección**: la sesión activa MCP es global → los probes se
  interfirieron (acciones en partida ajena, mesa contaminada + fantasma
  `4622ec…` en Starting, eliminada; lobby a 0). Engine: `LondonMulligan`
  sin scry (solo Vancouver lo tiene; desviación del fork, no tocar).
- **Harness MCP** (commit `99e078ae91`): pin `session?` en 19 tools +
  `mage_combat` gang-block aware (`blockTargets`, `targetsAnswered`/`unresolved`,
  `sent` completo). Tests `sessionPin` + `combatGangBlock`; suite mcp
  33 pass/1 skip + typecheck ✅; `mcp/README.md` actualizado. Debug: Node
  strip-only aborta con `ERR_INVALID_TYPESCRIPT_SYNTAX` ante ediciones
  parciales (mirar el crash antes que la lógica).
- **Beta** (`beta.xmage.today:17171`): login OK a la primera como
  `qa-beta-probe`, lobby real con 19 mesas; solo lectura (no crear/jugar allí).
- **Cuentas de prueba creadas** (reutilizables): qa-ui-1345 (navegador),
  qa-self-A/B, qa-gang-A/B, qa-mull-A/B, qa-vfy-A/B, qa-beta-probe.
- **Queda por testear**: fichas (SIGUIENTE), contadores, auras/equipos,
  planeswalker, evasión/first-strike/trample, diálogo multi-cantidad en web,
  draft jugado, Bo3 en UI, concesión en pila, 2º humano (perfil), chat en web,
  espectar en beta, Historial/Clasificación a fondo, Ajustes, tablero móvil,
  vías de error (pass mala, mesa llena, acción ilegal), reloj, 3+ jugadores,
  locales pt/ru/ja/zhs, 2 e2e invite en known-broken, verificación en vivo
  del harness nuevo (tras reiniciar opencode).

## 5. Pregunta abierta (no bloquea)

- La vía histórica exacta por la que `partnerCard` quedó = Sidar CMR:535 (duplicando al comandante,
  con duplicate-key errors en consola) no se identificó con certeza pese a repro unitaria de los
  caminos (handleSetCommander limpio; derivePartnerCard devuelve null en los estados modelados).
  El invariante ya está cerrado por construcción (canPair rechaza mismo nombre + dedupe en
  commanderCardsFor + guards en adopt/drop/crown) con tests, y el estado se curó en vivo.
   Si reaparece un duplicado, instrumentar `schedulePersist` con traza en vez de re-analizar en vacío.

## 7. Sesión 2026-09-12 tarde: tokens + auras + 4 fixes (sin commit, a petición)

- **Harness nuevo verificado en vivo**: el MCP reiniciado acepta `session?`; `tokens-1` y `aura-1`
  (2×HUMAN, `skipInitShuffling`, sesiones `vfy-A`/`vfy-B` pineadas) jugadas en paralelo sin
  interferencias — cierra la advertencia del §1 ("reconectar el MCP").
- **Tokens**: `Dragon Fodder ORI:140` → 2× Goblin 1/1 (`isToken`, `mageObjectType TOKEN`,
  `cardNumber` vacío), ataque + daño 20→19→17, render + feed con píldoras ➔. Ojo: la mano
  inicial viene **ordenada por el servidor** (contenido determinista, orden no).
- **Auras**: `Elvish Mystic m14:169` + `Rancor M13:185` (el servidor auto-elige objetivo con una
  sola criatura legal, sin `GAME_TARGET`); 3/1+trample, doble Rancor 5/1; `attachments[]`,
  `attachedTo`, icono `ABILITY_TRAMPLE`; la web apila el aura + badge TR + tooltip Arrollar.
- **Fixes** (unit 1365/1365 + typecheck, sin commitear): `Attacker: X (P/T)` sin `cleanCardName`
  (8×404 por ficha); `feed_lose/gain_life_one` ×9 locales (`pierde 1 vidas`→`pierde 1 vida`);
  `Player X is the winner` + `X wants to concede` en crudo (parser + badge `GameEndDialog`);
  `handleWatchGame` no limpiaba el feed (arrastraba la partida anterior al espectar).
- **Lección harness**: `mage_combat` multi-atacante pierde el 2º UUID igual que el gang-block →
  secuencial (UUID→wait→UUID→confirm); auto-pay `special` no paga solo (usar `sourceId`).
- **Queda**: contadores (Ballista `2XM:306`, diálogo X/multi-cantidad en web), PW (Jace `WWK:31`),
  equipos (Greaves `2XM:267`/Boots `C20:254`), evasión (Serra `LEA:39` — el research
  decía `LEA:227` pero es War Mammoth), draft/Bo3 en UI.
  Lobby a 0 mesas. Cuentas reutilizables: qa-vfy-A2/B2 (1 victoria cada una).

## 8. Sesión 2026-09-12 tarde-noche: contadores (Ballista) — mecánicas ✅, ataque ❌ (quirk engine)

- **Mesa `counters-1`** (2×HUMAN determinista, sesiones pineadas, 17 turnos, espectada
  con screenshots + recarga dura): `Walking Ballista 2XM:306` (verificada en Scryfall)
  con X=2 (`GAME_CHOOSE_ABILITY` → `GAME_GET_AMOUNT` "Announce the value for {X}{X}" →
  `mage_choose value=2` (ojo: `mage_action integer` rechaza string del transporte;
  `mage_choose` sí coerciona con `Number()`) → pago {4} girando 4 Bosques).
- **Contadores verificados**: entra 2/2 con 2×+1/+1; ping T7 quitando 1 contador como
  coste (`GAME_TARGET` a B, 20→19, queda 1/1+1); `{4}: poner contador` en T9 (2/2+2).
  GameView trae `counters:[{+1/+1×2}]` + icono `OTHER_COST_X "x=2" ("Announced X = 2")`
  + las 3 reglas; la web renderiza arte + `2/2` + badge `+2` + chip `x=2` (screenshots
  `page-2026-09-12T17-25-58` y `18-04-42`, turno 7 y 17, B a 19).
- **Quirk engine (fork, fuera de alcance)**: el UUID de la Ballista en la ventana
  declare-attackers abre `GAME_CHOOSE_ABILITY` en vez de declarar (4 reproducciones:
  T9 con `mage_combat`, T11 botón `special` "All attack", T15 UUID solo con auto-pass
  OFF, T17 doble-clic). El proxy reenvía directo (`SessionImpl` de `Mage.Client`);
  `HumanPlayer.selectAttackers` debería declarar vía `selectDefender` (1 defensor =
  directo), pero empíricamente sale el menú; la web manda el mismo UUID que el
  desktop (`GameScreen.onCombatClick`), así que hay paridad por construcción y el
  ataque con criaturas normales está cubierto (tokens + `combat.spec` real).
- **Lección harness**: el auto-pass come el declare si llega como `mode=select`
  (confirmado en `mage_session`: `AUTO_PASS` tras `GAME_SELECT`, T13 saltado sin
  atacantes) → **apagarlo (`mage_auto_pass enabled=false`) antes de declarar**.
  Por eso el T13 se saltó el combate; con auto-pass off el declare sobrevive.
- Mesa concedida (gana B) y abandonada; lobby a 0; auto-pass de vfy-A restaurado a on.
  Sin cambios de código → suite 1365 + typecheck siguen vigentes.
- **Queda**: PW (Jace `WWK:31`), equipos (`2XM:267`/`C20:254`), evasión (Serra `LEA:39`),
  draft/Bo3 en UI, diálogo multi-cantidad en web, 2 e2e invite en known-broken.

## 9. Sesión 2026-09-12 noche: PW (Jace) + equipos/evasión (Serra) — todo ✅

- **Mesa `pw-1`** (2×HUMAN determinista, sesiones pineadas, 10 turnos, espectada con
  screenshots): `Jace, the Mind Sculptor WWK:31` (verificado en Scryfall) casteado T8
  con `{2}{U}{U}` (4 Islas `iko/263` por `sourceId`); entra con lealtad 3.
- **+2** (`GAME_CHOOSE_ABILITY` solo ofrece +2 y 0: −1 sin criatura, −12 sin lealtad —
  legalidad correcta del engine): `GAME_TARGET` a jugador (B) → `GAME_ASK` Yes/No
  "bottom of library" → lealtad 3→5 ✅, biblioteca de B intacta en conteo.
- **0 Brainstorm**: roba 3 (mano 7→10, biblio 48→45) + 2× `GAME_TARGET` secuencial
  "Select a card" para devolver (mano 8, biblio 47, pila vacía, lealtad sigue 5).
  Cubre de paso el diálogo de "orden/devolución" del plan.
- Web: Jace con "Lealtad: 5" + badge `+5`, bibliotecas 47/49, feed limpio al espectar
  (fix `handleWatchGame` re-verificado); screenshots `page-2026-09-12T18-13-54` (T9)
  y `18-15-15` (T10). Mesa concedida (gana B) y abandonada.
- **Mesa `equip-1`** (12 turnos, espectada con screenshot): mano inicial perfecta
  (Serra+Greaves+Boots+4 Plains `iko/260`, todo verificado en Scryfall).
  Greaves T4 (`{2}`, `Pay {2}` con 2 Plains), Boots T6 (`{2}`), Serra T10
  (`{3}{W}{W}` con 5 Plains) → 4/4 en mesa.
- **Equipar**: UUID de Greaves → `GAME_CHOOSE_ABILITY` "Equip {0}" → el servidor
  **auto-elige objetivo con una sola criatura legal** (igual que Rancor, sin
  `GAME_TARGET`); `attachments:[greaves]`, reglas `Flying/Vigilance/Haste/Shroud`,
  `summoningSickness:false`, iconos `ABILITY_FLYING/VIGILANCE/HEXPROOF("Shroud")`
  (ojo: shroud mapea a tipo `ABILITY_HEXPROOF` en el engine).
- **Ataque T10 con `mage_combat` directo**: criatura sin habilidades activadas declara
  sin menú (contraste con el quirk Ballista: el UUID abre `CHOOSE_ABILITY` solo si la
  carta TIENE habilidades) → B 20→16 (evasión flying ✅), Serra **no girada**
  (vigilance ✅), haste vía Greaves ✅.
- **Shroud negativo**: en T12 ni Greaves ni Boots aparecen en `playableIds` (única
  criatura con shroud → equip sin objetivo legal no se ofrece). Engine correcto.
- Web: Serra 4/4 con badges FL/VI/SH + tooltips ES (Volar 🦅, Prisa 🔥, Velo 🌫️,
  Vigilancia 🛡️), Greaves anexadas, Boots sueltas, B a 16; screenshot
  `page-2026-09-12T18-24-20`. Mesa concedida (gana B) y abandonada; lobby a 0.
  Sin cambios de código → suite 1365 + typecheck siguen vigentes.
- **Queda**: draft/Bo3 en UI, 2 e2e invite en known-broken.

## 10. Sesión 2026-09-12 noche: Bo3 completo + fix timer + invite unblocked ✅

- **Mesa `bo3-1`** (winsNeeded 2, 2×HUMAN con `playerTypes:[HUMAN,HUMAN]` — lección:
  con el default HUMAN+SIM el bot ocupa el asiento libre antes de que B se una;
  hubo que borrar y recrear): 3 partidas con concesiones (B gana P1, A gana P2,
  B gana P3 → match 2-1). Mazos 55 tierras + 5 de sideboard.
- **Sideboard entre partidas**: el servidor emite `SIDEBOARD` (objectId = mesa) y
  espera ambos submits; el harness MCP no expone `submitDeck`, así que se envió
  por WS crudo con script temporal (`.run/scratch/submit-sideboard.mjs`: connect
  con misma cuenta → `attached:true` → `submitDeck {tableId,deck}` → `ok:true`).
  Tras ambos submits arranca la siguiente partida con bibliotecas restauradas
  (55). Sin cambios, mazos intactos. Gap de harness anotado (no hay tool de
  sideboard; el proxy sí lo soporta — `GameCommands.java:106`).
- **Web Bo3**: lobby "Wins: 2 Score: 0-0/0-1", pips de match ○○→●○→1/2 en
  PlayerInfoBar con tooltip "Victorias en el match", feed 1ª persona en
  concesiones, feed limpio al re-espectar ("Espectador: mirando la partida
  e5e1ac0a…", 1 evento), `SideboardScreen`/`GameEndDialog` cableados y
  testeados (el diálogo se oculta durante sideboard). Screenshots
  `page-2026-09-12T19-38-22` (P1 fin), `19-43-52` (P2).
- **Límite del espectador**: `watchGame(gameId)` es por partida — al empezar P2
  el espectador se queda en P1 (diálogo de fin). Hay que Volver al lobby +
  re-Espectar (verificado: entra en P2 con marcador 0-1). Sin auto-follow;
  paridad con desktop, no se toca.
- **Hallazgo: END_GAME_INFO no llega a espectadores** (probado en `probe-1`:
  el `gameEnd` del watcher es 100% sintético de `handleGameOver`, con
  `matchView.endTime` = hora actual). Consecuencia: no hay señal fiable para
  distinguir fin-de-partida de fin-de-match en el watcher — se deja el diálogo
  como está (Volver al lobby siempre) en vez de arriesgar espectadores
  atascados. Anotado, no fix.
- **Fix timer sin-reloj** (`utils/timer.ts`, `PlayerInfoBar.tsx` + 3 tests):
  el servidor envía `priorityTimeLeftSecs: 2147483647` (Integer.MAX_VALUE) que
  se renderizaba como "596523:14:07" (2^31-1 s exactos, confirmado por cálculo
  + screenshot P2). Ahora `isUnlimitedTime()` lo trata como sin límite: badge
  oculto, hook devuelve 0 sin tickear. Suite 1368/1368 + typecheck ✅.
  Nota: en vivo también se ve badge "00:00" (`timerActive` con left=0,
  comportamiento previo, sin cambios).
- **Invite known-broken VACÍO**: los 2 tests (`invite-link.spec`) pasan al
  re-ejecutarlos (1.5s c/u, con y sin flag) — eran coletazo del bug del
  SetupWizard, no bug propio. `KNOWN_BROKEN_TITLES = []`.
- **Draft en vivo**: diferido con criterio — creación via wizard ya verificada
  (§2), `DraftScreen`/`ConstructScreen` cubiertas por e2e fake (`draft.spec`,
  `tournament.spec`) + unit, `submitDeck` verificado en vivo aquí; jugar picks
  reales (~45+ clics como participante) es desproporcionado para esta sesión.
- Mesas `bo3-1`/`probe-1`/`tmr-1` cerradas; lobby a 0.
- **Queda**: draft jugado en vivo (opcional, caro), commit del lote (pedir).
