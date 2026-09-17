# P5.2 — Evaluación heurística de interfaz (evaluador 1 de 2–3, 2026-09-17)

> Corresponde a `plan4.md` §5.2: "2–3 evaluadores independientes recorren cada
> pantalla de §4 con las 10 heurísticas de Nielsen + heurísticas de juego
> (estado del juego siempre visible, respuesta inmediata, legibilidad del
> tablero, carga cognitiva, consistencia con Arena/MTGO, errores prevenibles).
> Severidad 0–4 por hallazgo; los de severidad 3–4 bloquean." Este documento es
> la pasada del **evaluador 1**; queda pendiente consolidar con los
> evaluadores 2–3 cuando existan.

## Método y fuentes

- **Capturas reales** de la galería de regresión visual P3
  (`web/e2e/gallery.spec.ts-snapshots/*.png`), leídas directamente como
  imagen: `screen-login`, `screen-lobby-empty`, `screen-lobby-overflow`,
  `screen-decks`, `screen-draft`, `screen-draft-waiting`, `screen-construct`,
  `screen-construct-overflow`, `screen-tournament-inprogress`,
  `screen-tournament-finished`, `frame-combat`, `frame-block`, `frame-mutate`,
  `frame-xcosts`, `prompt-mana`, `prompt-target`, `prompt-combat-attack`,
  `prompt-mulligan`, `prompt-card-grid`, `prompt-voting`,
  `prompt-trigger-order`.
- **Código fuente** de `web/src` para lo que una captura no puede mostrar:
  `SpectatorStagingScreen.tsx`, `LobbyScreen.tsx`, `CreateTableDialog.tsx`,
  `SetupWizard.tsx`, `LoginScreen.tsx`, `DraftScreen.tsx`,
  `ConstructScreen.tsx`, `GameEndDialog.tsx`, `SettingsModal.tsx`,
  `TournamentBracketModal.tsx` + `TournamentBracket.css`, `DeckBox.tsx`,
  `VotingDialog.tsx`, `serverMessageTranslation.ts`, `ui/Modal.tsx` /
  `ui/DialogShell.tsx`.
- Para dos capturas dudosas se verificó contra el código **antes** de
  reportarlas, y se descartaron por ser artefactos del arnés de pruebas, no
  bugs reales (se documentan aquí para que el evaluador 2/3 no las
  redescubra):
  - `screen-draft*` / `screen-construct*` muestran el panel pegado al borde
    izquierdo del recorte con un hueco negro a la derecha. Medí el bounding
    box de contenido con Pillow: `x:[0,1077]` sobre una imagen de 1328 px (el
    ancho es el de `.gallery-stage`, sin el sidebar de 272 px de la galería
    dev). La causa es que `.draft-backdrop`/`.construct-backdrop` usan
    `position:fixed; inset:0`, que centra respecto al **viewport completo**
    (1600 px), no respecto al contenedor `.gallery-stage` que usa la galería
    para la captura. En la app real (`App.tsx:147-148` monta `<DraftScreen/>`
    y `<ConstructScreen/>` en la raíz, sin sidebar) esto centra bien. No es un
    hallazgo real, es un artefacto de cómo la galería de P3 incrusta estas
    dos pantallas.
  - Los frames reales de tablero (`frame-combat`, etc.) muestran la mano
    propia con solo la franja superior visible, cortada por el borde de la
    captura. Es diseño intencional documentado en `HandBar.css` (comentario:
    "La mano descansa metida bajo el borde del tablero... se eleva al
    hover"), igual que en Arena/MTGO. No es un hallazgo.

## Hallazgos por pantalla

### Sala de espera / staging

**[Severidad 2]** El estado "listo/no listo" se infiere de texto de chat, no de un campo de protocolo — `SpectatorStagingScreen.tsx:55-71`. El componente reconstruye `playerReadyMap` escaneando `chatMessages` en busca de las subcadenas literales `[NEXUS_READY]` / `[NEXUS_NOT_READY]` (`m.message?.includes(...)`, sin anclar el patrón ni exigir que sea el mensaje completo). Viola *prevención de errores* y *visibilidad del estado del sistema*: (a) cualquier mensaje de chat que contenga esa subcadena en cualquier posición (copiado/pegado, broma, spam) se interpreta como una señal real de disponibilidad para empezar la partida; (b) si el historial de chat de la sala no llega completo al reconectar/entrar tarde, el "listo" de otros jugadores no se puede reconstruir y la UI asume "listo" por defecto para cualquiera que no tenga una entrada `NOT_READY` explícita (`getSeatReadiness`, línea 172-180) — un jugador que se desconectó *no listo* puede aparecer como listo para un espectador o el anfitrión que se une después. El servidor XMage no tiene un campo de "ready" real en este flujo, así que es un hack deliberado, pero sin ningún guardarraíl (namespacing, timestamp, o al menos `startsWith`) es frágil para una acción que decide si la partida arranca.
*Sugerencia*: exigir que el mensaje sea *exactamente* el marcador (o un prefijo anclado con `^`), y no purgar el estado de listo al perder el historial de chat sino tratarlo como "desconocido" en vez de "listo" por defecto.

### Editor de mazos / galería

**[Severidad 2]** El monograma de reserva del mazo colisiona entre mazos con nombres parecidos — `web/src/decks/DeckBox.tsx:86`: `deck.name.slice(0, 2).toUpperCase()` cuando no hay `coverUrl` (art de Scryfall). Captura `screen-decks-1600x900-chromium-darwin.png`: de los 10 mazos mostrados, **9 de 10** son precons de ejemplo cuyo nombre empieza por "Mage Web ..." (`Mage Web bolt`, `Mage Web advanced...`, `Mage Web starter`, `Mage Web AI lands`, `Mage Web combat s...`, etc.) y **todos** muestran el mismo glifo "MA" — visualmente indistinguibles en la cuadrícula salvo por el texto pequeño debajo. Esto viola *reconocimiento antes que memoria* (la miniatura, que existe justamente para reconocer el mazo de un vistazo, deja de aportar información) y es más grave de lo que parece para este proyecto en concreto: el modelo de distribución es autoalojado (`plan4.md` §0/§6, "Sin internet: jugar posible con placeholders") y Scryfall puede no ser alcanzable, con lo que **todos** los mazos (no solo los de ejemplo) caerían en este fallback en un despliegue sin salida a internet.
*Sugerencia*: usar iniciales del *cover card* o de las palabras significativas del nombre (ignorando un prefijo común tipo marca/set), o mezclar con el color de identidad del mazo (ya se calcula `colors`/`ManaPip` un poco más abajo) para diferenciar visualmente aunque las letras coincidan.

### Torneo / cuadro

**[Severidad 2]** La columna de la última ronda se recorta sin ninguna pista visual de que hay más contenido desplazable — evidencia directa en `screen-tournament-finished-1600x900-chromium-darwin.png`: con 3 rondas, la columna "Ronda 3" queda cortada a la mitad (el badge de estado "COMPLETED" se ve literalmente partido, "C"), mientras que con 2 rondas (`screen-tournament-inprogress`) todo cabe. El contenedor `.bracket-columns` (`web/src/lobby/TournamentBracket.css:202-208`) sí tiene `overflow-x: auto` con columnas de ancho fijo (`flex: 0 0 220px`), así que la información no se pierde — se puede hacer scroll horizontal — pero no hay ningún estilo de scrollbar, degradado de borde ni flecha que lo indique (`grep scrollbar` no devuelve nada en ese CSS), y en macOS con scrollbars "solo al hacer scroll" el corte es indistinguible de un bug de layout. El propio `plan4.md` fija como criterio de aprobado de §4 "0 cortes o solapes en la matriz de estados", y esta captura muestra exactamente un corte. Con un Suizo de 8+ rondas (el caso que el plan pide probar explícitamente) el problema se agrava: la mayoría de rondas quedarían fuera de vista sin pista alguna. Mitigante: la tabla "Clasificación" de al lado sí muestra el resultado final completo sin recortes, así que no bloquea conocer el resultado, solo la revisión ronda a ronda del cuadro.
*Sugerencia*: añadir un indicador de scroll (sombra/gradiente en el borde derecho cuando `scrollLeft + clientWidth < scrollWidth`, o flechas ‹›), o forzar visibilidad del scrollbar con `scrollbar-gutter`/estilos explícitos como ya se hace en otros diálogos del proyecto (`DialogShell.css` usa `scrollbar-gutter: stable` en otros paneles, aquí no).

### Partida 1v1 (prompts sobre el tablero)

**[Severidad 2]** El diálogo de votación no localiza el texto que envía el servidor — `web/src/game/VotingDialog.tsx:42`: `message={<FormattedText text={prompt.message} />}` pasa `prompt.message` tal cual. Evidencia directa en `prompt-voting-1600x900-chromium-darwin.png`: el encabezado ("VOTACIÓN EN CURSO PASO 1 DE 2") está en español, pero la instrucción real justo debajo dice **"Vote for a permanent — Step 1 of 2"** en inglés sin traducir, en medio de una interfaz por lo demás en español. El propio componente incluso *parsea* ese texto en inglés con una regex (`/step\s+(\d+)\s+of\s+(\d+)/i`, línea 28) para reconstruir el contador traducido, es decir, es consciente de que el mensaje es del servidor en inglés, pero solo traduce el contador y no la instrucción. Contrasta con hermanos directos del mismo patrón de diálogo — `CardGrid.tsx`, `LibraryOrderDialog.tsx`, `MulliganDialog.tsx`, `PileDialog.tsx` — que sí pasan el mensaje por `localizeServerMessage(...)` antes de mostrarlo. Viola la heurística de juego "instrucción en el idioma del jugador" del propio checklist de prompts (§5.1 de `plan4.md`) y la heurística #4 de Nielsen (consistencia): mismo tipo de interacción, tratamiento distinto según el diálogo.
*Sugerencia*: pasar `prompt.message` (y `prompt.title`/labels de opciones si aplica) por `localizeServerMessage` igual que en los otros cuatro diálogos, o extender esa función con los patrones de votación ("Vote for X", "Step N of M").

### Draft / Construct y banquillo (mismo hallazgo en ambas pantallas)

**[Severidad 2]** `DraftScreen.tsx` y `ConstructScreen.tsx` se autodeclaran modales (`role="dialog" aria-modal="true"` en `draft-screen`/`construct-screen`, líneas 409 y 371 respectivamente) pero **no** usan el componente compartido `ui/Modal.tsx` / `ui/DialogShell.tsx` que usa el resto de diálogos de la app (`CreateTableDialog`, `SettingsModal`, `GameEndDialog`, `TournamentBracketModal`, `VotingDialog`, etc.). Revisando `Modal.tsx` se ve que es ahí donde vive toda la lógica real de modal: foco inicial al primer control, trampa de Tab dentro del diálogo, gestión de z-index apilado y cierre con Escape (`useEffect` de foco/trap, líneas ~78-120). Como Draft y Construct no pasan por ahí, no tienen ninguna de esas garantías: un usuario que navegue solo con teclado puede tabular fuera del "diálogo" hacia controles del lobby que quedan detrás (no ocultos con `inert`/`aria-hidden`), y un lector de pantalla anuncia "diálogo modal" sin que el navegador imponga el comportamiento modal real. Es un caso concreto de inconsistencia entre pantallas equivalentes (heurística #4) con impacto real en accesibilidad para teclado/lector de pantalla — no bloquea a la mayoría de jugadores (uso con ratón), de ahí severidad 2 y no 3.
*Nota*: no se marca como falta de ESC-cierra-diálogo del checklist de la §4, porque en estas dos pantallas ESC no debería cerrar nada (son prompts obligatorios con temporizador y auto-envío) — el hallazgo es solo la falta de trampa de foco/gestión de foco inicial, no el cierre.
*Sugerencia*: envolver ambas pantallas en `Modal`/`DialogShell` (sin botón de cierre, ya que no deben poder cerrarse) para heredar gratis el foco inicial y la trampa de Tab, tal como ya hacen los demás diálogos "obligatorios" de la app.

## Pantallas revisadas sin hallazgos por encima de lo cosmético

- **Setup wizard / Login**: flujo claro, deshabilita contraseña en beta con explicación visible, banner de invitación, sin problemas observables en código o captura.
- **Crear mesa (wizard)**: usa `DialogShell` (foco/trap/Escape heredados), progreso de pasos visible, envío bloqueado sin nombre; navegación libre entre pasos ya completados es una decisión de diseño razonable para un wizard corto.
- **Torneo (vista en progreso, 2 rondas)**: sin el problema de recorte descrito arriba porque cabe todo.
- **Fin de partida**: usa `DialogShell`; el sistema de localización de mensajes de fin de partida (`serverMessageTranslation.ts`) es notablemente más completo que el de `VotingDialog` (maneja "won/lost the game/match", turno, 2ª persona "You"), sin problemas evidentes en la revisión de código.
- **Ajustes**: navegación por secciones clara, cambios aplicados en vivo vía store; no se detectaron problemas en el código.
- **Pod / Commander / Arena**: sin captura de referencia todavía en la galería P3 (pendiente declarado en `plan4.md`, fila P3 slice 2); revisión de código superficial (`PodBoard.tsx`, `OpponentSwitcherBar.tsx`) no encontró nada accionable en el tiempo de esta pasada — recomendado que el evaluador 2/3 lo cubra en profundidad cuando existan capturas.

## Resumen: pantalla × hallazgos de severidad 3–4

| Pantalla | Severidad 3–4 |
|---|---|
| Setup wizard / Login | 0 |
| Lobby | 0 |
| Crear mesa (wizard) | 0 |
| Sala de espera / staging | 0 |
| Editor de mazos / galería | 0 |
| Partida 1v1 | 0 |
| Pod / Commander / Arena | 0 (sin evaluar en profundidad, ver nota arriba) |
| Draft | 0 |
| Construct y banquillo | 0 |
| Torneo / cuadro | 0 |
| Fin de partida | 0 |
| Ajustes | 0 |

**Total de esta pasada: 5 hallazgos, todos de severidad 2. 0 hallazgos de severidad 3–4** (el criterio de aprobado de `plan4.md` §7 — "0 hallazgos de severidad 3–4 abiertos" — no se ve bloqueado por esta pasada individual; pendiente consolidar con los evaluadores 2–3 antes de dar la heurística por cerrada).
