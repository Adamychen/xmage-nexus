# P5.2 — Evaluación heurística de interfaz (evaluador 2 de 2–3, 2026-09-18)

> Segunda pasada independiente de `plan4.md` §5.2 ("2–3 evaluadores
> independientes recorren cada pantalla de §4 con las 10 heurísticas de Nielsen
> + heurísticas de juego […]. Severidad 0–4 por hallazgo; los de severidad 3–4
> bloquean"). Complementa `p5-2-heuristic-findings.md` (evaluador 1) sin
> repetir sus hallazgos cerrados. Cobertura prioritaria de esta pasada: Pod /
> Commander / Arena (sin capturas cuando escribió el evaluador 1) y las
> matrices de estados que no revisó (wizard/create-table, staging, fin de
> partida, ajustes/apariencia/acerca/ayuda, prompts, frames reales, ru, ja,
> zoom 125 %, reconexión, mano de 15, nombres largos, errores de lobby/login,
> desbordes de draft/construct, torneo cargando/error/espera).

## Método y fuentes

- **Capturas reales** de la galería P3
  (`web/e2e/gallery.spec.ts-snapshots/*.png`), abiertas como imagen (no solo
  inventariadas). Leídas, entre otras:
  - Tableros: `board-pod-4`, `board-pod-commander`, `board-arena-4` en
    1600x900-chromium, 1366x768-chromium y 1920x1080-webkit (3 de las 7 placas
    por familia; el resto comparte layout).
  - Prompts: `prompt-target`, `prompt-mana`, `prompt-combat-attack`,
    `prompt-card-grid`, `prompt-mulligan`, `prompt-trigger-order`,
    `prompt-voting` (1600x900-chromium). Los otros 3 de la galería
    (`prompt:target-optional`, `prompt:combat-block`, `prompt:ask`) **no tienen
    baseline** en `VISUAL_ENTRIES`; se revisaron solo en código/fixture.
  - Frames reales: `frame-combat`, `frame-block`, `frame-mutate`,
    `frame-xcosts` (1600x900-chromium).
  - Pantallas: `screen-setup`, `screen-wizard`, `screen-staging-player`,
    `screen-gameend-game`, `screen-gameend-match`, `screen-settings`,
    `screen-appearance`, `screen-about`, `screen-help`, `screen-lobby-overflow`,
    `screen-lobby-error`, `screen-decks`, `screen-draft`,
    `screen-draft-stalled`, `screen-draft-waiting`, `screen-construct`,
    `screen-construct-overflow`, `screen-tournament-panel`,
    `screen-tournament-finished/loading/error/waiting`,
    `screen-login-connecting/error`.
  - Globales y variantes: `global-lang-lobby-ru`, `global-lang-game-ja`,
    `global-zoom-lobby-125`, `global-reconnecting`, `game-hand-15`,
    `game-long-names`.
- **Código** (árbol de trabajo, no `HEAD`): `GameEndDialog.tsx`,
  `serverMessageTranslation.ts`, `TableCard.tsx`, `TournamentBracket.tsx`,
  `TournamentPanel.tsx`, `TournamentStandings.tsx`,
  `SpectatorStagingScreen.tsx`, `ChatBox.tsx`, `BoardShell.css`,
  `TwoHeadedBoard.tsx`, `CardSlot.tsx`, `Modal.tsx`, `galleryFixtures.ts`,
  `GalleryScreen.tsx/css` y `../xmage-fork/.../TableState.java`.
- **Disciplina anti-falso-positivo**: cuando una captura sugirió un bug se
  verificó contra código antes de reportarlo. Descartados así:
  1. `global:reconnecting` aparece **entero** color marrón; es un artefacto de
     la galería, no del producto (ver §Artefactos).
  2. La dirección de la flecha roja de ataque parecía invertida en
     `frame-combat`; al ampliar con Pillow la punta está en el avatar del
     defensor y el origen en la criatura atacante (`CombatArrowsOverlay.tsx:173`,
     `attCenter → defCenter`) — correcto.
  3. El pill del grid (`prompt:card-grid`) leído como "6 Mano" es "6 Maná" =
     suma de CMC de los 6 resultados; no hay bug.
  4. Los recortes laterales de modales y tableros a 1366 px son del arnés
     (stage = viewport − 272 px de sidebar de la galería), la misma clase que
     documentó el evaluador 1 para draft/construct.
- **Limitación declarada (honestidad)**: las capturas son estáticas. Los
  criterios "solo teclado" (trampa de foco, orden de tabulación, Escape) y
  "vista del rival" (lo que el oponente ve de ti) **no se pueden validar del
  todo sin sesión en vivo**; se revisan por código cuando aplica y no se
  reportan como hallazgos. Tampoco se ejecutó la suite completa: solo
  `vitest run serverMessageTranslation.test.ts TournamentBracket.test.tsx`
  (30/30 pasan) para confirmar que los arreglos del árbol de trabajo funcionan.
- **Estado del repo**: al escribir esto hay 31 ficheros modificados sin
  commitear que contienen correcciones a hallazgos del evaluador 1 (staging,
  bracket, i18n). Las referencias de código son al **árbol de trabajo**; varias
  capturas están desactualizadas respecto a él y se indica en cada caso.

## Artefactos del arnés de galería (no son hallazgos)

Se documentan para que el evaluador 3 no los redescubra. El evaluador 1 ya
documentó draft/construct (panel descentrado) y la mano hundida por diseño; no
se repiten.

1. **Modales recortados por el stage (1366 y 1600).** Los diálogos usan
   `position: fixed; inset: 0` y centran respecto al viewport completo, pero la
   captura recorta `.gallery-stage` (viewport − 272 px de sidebar,
   `GalleryScreen.css:90-96`). Resultado: `screen-settings-1366`, `screen-setup`,
   `screen-wizard-1366`, `prompt-card-grid-1600`, `prompt-mulligan`,
   `prompt-trigger-order`, `prompt-voting`, `screen-tournament-*`,
   `screen-help`, `screen-gameend-*`, `screen-draft*`, `screen-construct*`
   aparecen cortados por la izquierda. En la app real (sin sidebar) centran
   bien. Es el mismo mecanismo que el evaluador 1 verificó para draft/construct.
2. **Tableros de partida a 1366.** El stage mide 1094 px y el tablero tiene un
   ancho mínimo mayor: el panel derecho (PILA/MAZO/LOG/…) y el último chip del
   turn order quedan cortados (`board-pod-4-1366`, `board-arena-4-1366`,
   `game-hand-15-1366`, `game-long-names-1366`). En 1600 (stage 1328) y 1920
   (1648) todo cabe. En la app real a 1366 px de ventana el tablero dispone de
   1366 px, por lo que no es reproducible; **queda sin verificar** qué pasa en
   una ventana real < ~1150 px (fuera de la matriz del plan, que empieza en
   1366). Recomendación: smoke real a 1024-1152 px si se quiere soportar.
3. **`global:reconnecting` marrón a pantalla completa.** `GalleryScreen.tsx:216`
   monta el banner *dentro* de `.gallery-stage`, y la regla
   `.gallery-stage > * { height: 100% }` (`GalleryScreen.css:98`) lo estira a
   todo el stage. En la app el banner es una franja superior de ~30 px
   (`App.tsx:125`, `styles.css:183-195`). La captura no representa al producto.
4. **Baselines obsoletos respecto al árbol de trabajo**: `prompt-voting`
   todavía muestra el mensaje del servidor en inglés y `screen-tournament-
   finished` todavía muestra la columna "Ronda 3" recortada; ambos están
   corregidos en código (ver §Estado evaluador 1) pero los PNG no se han
   regenerado. `screen-decks` sí refleja ya el monograma corregido (WB/WA/WS/
   AL/CS/CH/BS/WL/WM en vez de "MA" repetido).

## Hallazgos por pantalla

### Fin de partida (game-end / match-end) — 1 hallazgo

**[Severidad 2] El resultado del servidor se muestra en inglés cuando el
ganador no es "You" (y también en el match con marcador).**
Evidencia directa: `screen-gameend-game-1600x900-chromium` muestra
"Bartholomew-Montgomery-Fitzwilliam-III **has won the game**" entre textos en
español ("Derrota", "Ganador:", "El match continúa…"); `screen-gameend-match-
1366x768-chromium` muestra además "Alejandro-…-Castillo **has won the match
2-1**".
En código: `GameEndDialog.tsx:47-48` pasa `gameInfo`/`matchInfo` por
`localizeGameEndMessage`, pero `serverMessageTranslation.ts:168-186` **devuelve
`trimmed` (el inglés crudo) para un jugador con nombre** (la rama traducida
`end_won_game_turn`/`end_lost_game_turn` solo existe *con turno*), y la rama
"You" sin turno también devuelve crudo (línea 179). El patrón del match
(`:188`) exige `^(.+?)\s+won\s+the\s+match[.!]?$`, así que
"…has won the match 2-1" tampoco entra. Locale: solo existen las claves
`end_won_game_turn*`/`end_lost_game_turn*` (`es.ts:689-692`).
Viola *consistencia (#4)* y la heurística de juego "instrucción en el idioma
del jugador" del checklist §5.1; contradice la impresión del evaluador 1
("sin problemas evidentes") — la pasada 1 no abrió las capturas de game-end.
*Sugerencia*: añadir claves `end_won_game`/`end_lost_game` sin turno y aceptar
`has won the match <score>` en la regex (o normalizar el marcador).

### Lobby — 1 hallazgo

**[Severidad 2] El badge de estado de mesa se pinta en inglés en todos los
idiomas.** Todas las tarjetas del lobby muestran `WAITING` / `DUELING` /
`SIDEBARING` / `FINISHED` en crudo (`screen-lobby-overflow-1600x900-chromium`
en español y `global-lang-lobby-ru-1600x900-chromium` en ruso), mientras el
resto de la tarjeta está traducida ("Espectar", "Asiento Libre", "Abandono
máx.", "Готов").
En código: `TableCard.tsx:103` renderiza `tTable.tableStateText` sin pasar por
i18n; el motor define ese texto en inglés
(`../xmage-fork/Mage/src/main/java/mage/constants/TableState.java`: "Waiting
for players", "Dueling", …). No existe ninguna clave `table_state_*` en los
locales. Es el elemento de estado más visible de cada mesa y es el único
inglés de la tarjeta; en el fixture de la galería además se mezclan el código
(`'WAITING'`, `galleryFixtures.ts:211`) y la frase (`'Waiting for players'`,
`:500`), lo que hace visible la falta de mapeo.
*Sugerencia*: mapear `tableState` (enum del contrato) a claves i18n y usar
`tableStateText` solo como fallback.

### Torneo / cuadro — 2 hallazgos

**[Severidad 2] Estados de torneo y de eliminatoria sin traducir.**
`screen-tournament-waiting-1366x768-chromium` muestra el badge
`CONSTRUCTING` y la columna ESTADO con `ACTIVE`; `screen-tournament-
finished-1600x900-chromium` y `screen-tournament-panel-1920x1080-chromium`
muestran `COMPLETED` / `DUELING` / `FINISHED` / `ACTIVE` en crudo.
Código: `TournamentBracket.tsx:77` (badge `view.tournamentState`),
`:140` (estado de cada partida `g.state`), `TournamentPanel.tsx:146`
(`tournamentName — tournamentState · N jugadores`) y
`TournamentStandings.tsx:43` (`p.state`). Son textos del servidor en inglés
(TableState del fork) renderizados tal cual; mismo problema que el badge del
lobby, pero afecta a tres pantallas del torneo.
*Sugerencia*: mapa de estados (`Constructing`→"En construcción", `Dueling`→
"En partida", `Completed`→"Completada", `Active`→"Activo", `Finished`→
"Finalizada") en i18n y aplicarlo en los cuatro puntos.

**[Severidad 2] La tabla de clasificación usa `.replace()` sobre cadenas
traducidas: cabeceras duplicadas y badge incorrecto fuera de español.**
`TournamentStandings.tsx:22` `t('lobby','leaderboard_col_elo').replace('ELO',
'Pts')`, `:24` `…leaderboard_col_history).replace('Historial','Resultados')` y
`:40` `t('lobby','history_quits').replace('abandonos','Abandonó')`.
Verificado en locales: `leaderboard_col_history` es `History` (en), `История`
(ru), `戦績` (ja); el segundo `.replace` no encuentra nada y **las columnas
"RESULTADOS" e "HISTORIAL" quedan con el mismo encabezado en los 8 idiomas no
españoles**; el badge de abandono muestra "quits"/"выходов" en minúscula en
lugar de "Abandonó". Es una bomba de relojería además en español: cualquier
retraducción rompe el `.replace` silenciosamente.
*Sugerencia*: claves propias (`leaderboard_col_results`, `standings_quit_badge`)
en vez de `replace` sobre traducciones.

### Sala de espera / staging — hallazgo del evaluador 1 parcialmente abierto

Ver §Estado evaluador 1. El "desconocido = listo" sigue abierto
(`SpectatorStagingScreen.tsx:172-179`); el spoofing por subcadena ya está
corregido. No se cuenta como hallazgo nuevo.

### Pod / Commander / Arena — 1 hallazgo

**[Severidad 1] En pod de 4 jugadores, la etiqueta "Tu lado" del divisor
señala la zona de un rival.** El evaluador 1 no pudo evaluar estas pantallas
(no había capturas). Revisadas las 3 familias en 3 placas cada una, el único
problema real es el etiquetado decorativo:
`BoardShell.css:81-89` rotula el divisor horizontal con "Oponentes" a la
izquierda y "Tu lado" a la derecha; `TwoHeadedBoard.tsx:59-64` coloca en pod a
`[rival1, rival2, yo, rival3]` en la rejilla 2×2. En `board-pod-4-1600x900-
chromium` y `board-arena-4-1920x1080-webkit` (y sus placas 1366), "TU LADO"
queda encima de la celda inferior-derecha, que es del rival sim-000043,
mientras "OPONENTES" queda encima de mi propia celda: la etiqueta contradice
la propiedad de la zona (viola *consistencia* y *correspondencia con el mundo
real*). En pod de 3 (`board-pod-commander`) la fila inferior es toda mía y no
hay contradicción. Es cosmético (texto de ~7 px, opacidad 0.4, no interactivo)
pero puede desorientar en una FFA de 4.
*Sugerencia*: rotular por celda ("Tú" en la celda propia, nombre del rival en
las demás) o mover las etiquetas a la mitad de cada semibanda en lugar de los
extremos; si se mantiene, al menos condicionar "Tu lado" a
`pod-board--bottom-full`.
Sin más hallazgos en la familia: los paneles de jugador, recursos, giro de
cartas, comandantes (badge dorado, zona de mando), flechas de ataque/bloqueo y
la mano en 2×2 se ven correctos en las 9 placas; las diferencias entre
viewports son las del arnés (§Artefactos 2).

### Tablero 1v1 (indicadores de carta) — 1 hallazgo

**[Severidad 1] El indicador de "invocación enferma" tiene el tooltip
equivocado.** `CardSlot.tsx:336-339` pinta un badge con icono `timer` cuando
`perm.summoningSickness === true` y le pone `title={t('game', 'tap_mana')}`,
cuyo valor es "Girar para maná" (`es.ts:621`) / "Tap for mana" (`en.ts:621`).
El badge aparece, por ejemplo, en el Walking Ballista de `frame-xcosts` y en el
Elvish Mystic recién lanzado de los tableros pod (`board-pod-4-*`), y al pasar
el ratón (o con lector de pantalla) anuncia una acción que la criatura no puede
hacer — precisamente la que la enfermedad de invocación impide.
Además no existe ninguna clave i18n de summoning sickness.
*Sugerencia*: clave `summoning_sickness` ("Enfermedad de invocación — no puede
atacar ni usar {T}") y `aria-label` en el badge.

### Global / idiomas — 1 hallazgo

**[Severidad 1] Las pestañas "Log" y "Chat" no se traducen en cirílico/CJK.**
`global-lang-game-ja-1600x900-chromium` muestra "スタック", "メカニズム",
"ビジュアル/テキスト" traducidos pero `LOG` y `CHAT` en latín.
`ja.ts:893/895`, `ru.ts:890/892` y `zhs.ts:893/895` (y el resto) tienen
literalmente `tab_log: 'Log'`, `tab_chat: 'Chat'`. En español/portugués/francés
pasan como préstamos; en ruso/japonés/chino son las dos únicas etiquetas sin
traducir de la interfaz de partida (en ruso lo esperable sería "Лог"/"Чат").
*Sugerencia*: traducir esas dos claves en ru/ja/zhs (y decidir si se dejan como
préstamo en los idiomas latinos).

## Pantallas revisadas sin hallazgos por encima de lo cosmético

- **Setup wizard / Login** (`screen-setup`, `screen-login-connecting`,
  `screen-login-error`): flujo claro, "Conectando…" con spinner y error junto
  al botón. El descentrado de `screen-setup`/`screen-wizard` es artefacto
  (§Artefactos 1).
- **Crear mesa (wizard)**: `screen-wizard-1366`: pasos, resumen y presets;
  contenido correcto (el recorte del borde izquierdo es artefacto).
- **Staging** (`screen-staging-player`): roster, listo/no listo, stepper,
  chat; coherente entre asientos y mensajes. El único punto abierto es el
  heredado del evaluador 1.
- **Prompts** (`target`, `mana`, `combat-attack`, `mulligan`, `card-grid`,
  `trigger-order`, `voting`): instrucciones localizadas (el `localizeServerMessage`
  del voto está en el árbol de trabajo), coste de maná legible, "Atacar con
  todos"/"Acción especial"/"Cancelar" visibles y estado del juego siempre
  presente. `prompt:target-optional`, `prompt:combat-block` y `prompt:ask` no
  tienen baseline; revisados en fixture, sin problemas.
- **Frames reales** (`combat`, `block`, `mutate`, `xcosts`): flechas con
  dirección correcta, daño/contadores visibles, pila de mutar legible.
- **Draft / Construct** (`screen-draft`, `screen-draft-waiting`,
  `screen-draft-stalled`, `screen-construct`, `screen-construct-overflow`):
  traducción completa, banner de draft atascado con acción "Reintentar",
  overflow del pool con scroll; el recorte lateral es artefacto.
- **Ajustes / Apariencia / Acerca de / Ayuda** (`screen-settings`,
  `screen-appearance`, `screen-about`, `screen-help`): navegación por secciones
  clara, zoom/CJK/fundas y glosario correctos.
- **Lobby (overflow y error), editor de mazos**: sin hallazgos nuevos más allá
  del monograma (ya cerrado, ver estado evaluador 1) y del badge de estado
  (reportado arriba). El lobby vacío ya lo cubrió el evaluador 1.
- **Mano de 15** (`game-hand-15`): el abanico se comprime y se hunde bajo el
  borde, consistente con el diseño intencional de `HandBar` ya documentado.
- **Nombres largos** (`game-long-names`): el panel del rival crece y muestra el
  nombre completo; el mío trunca con elipsis; el placeholder de carta parte la
  palabra (`Asmoranomardicadaistinaculdacar`) pero solo aplica a placeholders
  sin arte, no a la carta real.
- **Zoom 125 %** (`global-zoom-lobby-125`): el lobby escala y mantiene 3
  columnas; sin solapes.
- **Lobby en ruso** (`global-lang-lobby-ru`): toda la interfaz traducida salvo
  el badge de estado reportado.

## Estado de los hallazgos del evaluador 1 (verificación 2026-09-18)

| # | Hallazgo eval. 1 | Estado real hoy | Evidencia |
|---|---|---|---|
| 1 | Marcadores `[NEXUS_READY]` por subcadena de chat | **Parcialmente corregido** (sin commitear): el parser ahora exige prefijo anclado y comprueba emisor; queda "desconocido = listo" | `ChatBox.tsx:23-28` (`/^\s*\[\s*NEXUS_(NOT_)?READY\s*\]\s*(.*)$/i`), `SpectatorStagingScreen.tsx:59-65`; el default sigue en `SpectatorStagingScreen.tsx:172-179` (`return 'ready'`) |
| 2 | Monograma DeckBox `deck.name.slice(0,2)` → "MA" repetido | **Cerrado**: `deckInitials()` usa las 2 últimas palabras significativas | `decks/types.ts:34-43`, `DeckBox.tsx:86`; la captura `screen-decks-1600x900-chromium` ya muestra WB/WA/WS/AL/CS/CH/BS/WL/WM (commit `a15dd22e403`) |
| 3 | Corte de la última ronda del cuadro sin indicador de scroll | **Cerrado en árbol de trabajo**: scrollbar visible + degradado + chevrón condicionado a overflow + tests | `TournamentBracket.css:213-251` (`scrollbar-gutter`, `scrollbar-color`, `bracket-fade-right`), `TournamentBracket.tsx:227-231` (`hasOverflowRight`/`scrollBracketRight`), `TournamentBracket.test.tsx:215-226`; baseline `screen-tournament-finished` **sin regenerar** |
| 4 | `VotingDialog` muestra el mensaje del servidor en inglés | **Cerrado en árbol de trabajo**: pasa por `localizeServerMessage` + regex de voto + tests | `VotingDialog.tsx:42`, `serverMessageTranslation.ts` (bloque `Vote for …` del diff sin commitear), `serverMessageTranslation.test.ts:84-89` (vitest 30/30 verde); baseline `prompt-voting` **sin regenerar** (aún en inglés) |
| 5 | Draft/Construct sin trampa de foco (`role="dialog"` sin `Modal`) | **Cerrado**: ambas pantallas envuelven en `Modal` (foco inicial, Tab-trap, Escape/z-index) | `DraftScreen.tsx:12,409`, `ConstructScreen.tsx:19,371`, `Modal.tsx:78-118`; ya está en `HEAD` |

Nota: los cambios sin commitear (31 ficheros) incluyen las correcciones 1, 3 y 4;
la corrección 2 y 5 están commiteadas. Los baselines de la galería no se han
regenerado para 3 y 4 (capturas obsoletas).

## Resumen: pantalla × hallazgos de severidad 3–4

| Pantalla | Severidad 3–4 |
|---|---|
| Setup wizard / Login | 0 |
| Lobby | 0 |
| Crear mesa (wizard) | 0 |
| Sala de espera / staging | 0 (hallazgo heredado de eval. 1, S2, parcialmente corregido) |
| Editor de mazos / galería | 0 |
| Partida 1v1 (prompts, frames, mano 15, nombres largos, zoom, ru, ja) | 0 |
| Pod / Commander / Arena | 0 (1 hallazgo S1 de etiquetado) |
| Draft | 0 |
| Construct y banquillo | 0 |
| Torneo / cuadro | 0 |
| Fin de partida | 0 |
| Ajustes / Apariencia / Acerca de / Ayuda | 0 |

**Total de esta pasada: 7 hallazgos nuevos — 0 de severidad 3–4, 4 de severidad
2 (fin de partida, badge de lobby, estados de torneo, `.replace` de
clasificación) y 3 de severidad 1 (etiqueta "Tu lado" en pod-4, tooltip de
invocación enferma y pestañas Log/Chat globales); más 1 hallazgo S2 del
evaluador 1 que sigue parcialmente abierto (staging).**
El criterio de aprobado de `plan4.md` §7 ("0 hallazgos de severidad 3–4
abiertos") no se ve bloqueado por esta pasada, pero el veredicto de la
heurística debe esperar a (a) regenerar los baselines tras los arreglos
pendientes de commit y (b) la pasada del evaluador 3, que debería cubrir en
vivo lo que las capturas estáticas no permiten (teclado, vista del rival).

---

## Cierre de la pasada 2 (2026-09-18)

Correcciones aplicadas a los 7 hallazgos + verificación:

| Hallazgo | Estado | Cambio |
|---|---|---|
| S2 Fin de partida en inglés | **✅** | `serverMessageTranslation.ts`: patrones sin turno (`end_won_game`/`end_lost_game`/`..._you`, 9 idiomas) y match con marcador (`has won the match 2-1`); `GameEndDialog` reconoce "You have won…". Tests con los strings exactos de las capturas. |
| S2 Badge de estado de mesa | **✅** | `TableCard.tsx` mapea `tableState` a `lobby.table_state_*` (12 estados × 9 idiomas) con fallback al texto del servidor; test es/en. |
| S2 Estados de torneo/partida | **✅** | Helper `stateLabel` (TournamentStandings) aplicado en bracket, partidas, panel y clasificación, con sufijos (`Finished (…)`). Tests por pantalla. |
| S2 `.replace()` sobre traducciones | **✅** | Claves propias `leaderboard_col_points/results`, `standings_quit_badge`; `.replace` eliminados; test de encabezados únicos en en/ru. |
| S1 Etiqueta "Tu lado" en pod-4 | **✅** | En la rejilla 2×2 (pod-4/arena-4) no se pintan las etiquetas de banda (`labels={isBottomFull}`); en pod 2/3 se conservan. Test en `PodBoard.test.tsx`. |
| S1 Tooltip de invocación enferma | **✅** | Clave `summoning_sickness` ×9 + `aria-label` en el badge (`CardSlot.tsx`); test. |
| S1 Log/Chat sin traducir en ru/ja/zhs | **✅** | `Лог`/`Чат`, `ログ`/`チャット`, `日志`/`聊天`; latinos se mantienen como préstamo. Test en `i18n.test.ts`. |

Verificación: unit 1824/1824, typecheck, build y e2e fake completo (259 passed /
4 skipped) el 2026-09-18. Artefactos del arnés: siguen vigentes tal cual se
documentaron (recortes del stage, banner de reconexión estirado, baselines
antiguos); los baselines afectados por estas correcciones se regeneraron
(`prompt-target`, `screen-lobby-overflow`).
