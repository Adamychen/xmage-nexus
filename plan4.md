# PLAN-4 — verificar que la interfaz es correcta, usable y fiel al juego (2026-09-14)

> ESTADO AL CREAR: rama `master`, último commit `7cafe4ab079`. Resync del draft
> **sin commitear** (11 ficheros) + 3 PNG sueltos en la raíz. Documento **solo de
> planificación**: no se ha tocado código.
>
> **Modelo de distribución** (decisión del usuario): cada jugador se monta el stack
> por su cuenta o descarga el launcher de escritorio (Tauri: servidor + proxy + JRE).
> No hay un servicio público alojado. Por eso este plan se centra en **qué falta por
> probar de la interfaz, la UX y las mecánicas, y cómo probarlo**. La seguridad y la
> escala pasan a un anexo (§10).

---

## 0. Diagnóstico: qué significa hoy "✅ testeado"

| Capa | Qué demuestra de verdad | Qué **no** demuestra |
|---|---|---|
| ~1.516 tests unitarios | La lógica pura y los componentes hacen lo que su autor esperaba | Que el servidor real mande esa forma de datos |
| ~150 tests e2e en ~70 specs | La UI reacciona bien a escenarios **escritos a mano** (`fixtures/scenarios/*.ts`, motor `humanGame.ts`) | Que XMage real produzca esa secuencia de prompts y datos |
| e2e en modo real | Solo ~4 specs corren contra XMage (`full-flow`, `setup-wizard`, `multi-user`, `mutate.real`); **58 ficheros son solo simulados** (`fake-mode.ts`) | Casi ninguna mecánica en real |
| Frames grabados | 5 estados reales (`mutate`, `creature`, `combat`, `sealed-pool`, `tournament-end`) | El resto del catálogo de mecánicas |
| Guardas de contrato | Todo callback y todo campo que el servidor puede emitir está **modelado** | Que se **pinte** bien o que el flujo sea usable |
| QA en vivo (MCP + navegador) | Sesiones sueltas muy valiosas (gang-block, mutate, draft 2×HUMAN, Bo3…) | Repetible: no queda como test |
| Capturas (`web/e2e/shots/`, 360 PNG) | Alguien las miró | Regresión visual: **0 usos de `toHaveScreenshot`** |
| Auditoría UX | C.13 revisó lobby y editor en estático; C.14 teclado | La partida, draft y torneo no tienen auditoría UX; no hay pruebas con jugadores |

### Hallazgos concretos

1. **La cobertura de mecánicas es sobre todo "contra nuestra simulación"**. Si un escenario simulado está mal escrito, el test pasa y la partida real falla. Justo así nació el bug del draft de hoy: la UI ignoraba la respuesta real de `sendCardPick`.
2. **Sin regresión visual**: un cambio de CSS puede romper el tablero sin que falle ningún test. Varias capturas `-FAILED.png` se revisaron a mano.
3. **Una sola resolución** (1600×900, `web/playwright.config.ts`) y un solo navegador (Chromium). En escritorio, Tauri usa WebView2 en Windows y WKWebView en macOS, así que **Safari/WebKit es un motor real de producción**, no opcional.
4. **El mapa de paridad no es un oráculo fiable**: `COMPONENT_PARITY.md` marca G12-3 (menú contextual nunca renderizado) y G12-4 (`phasedIn` sin leer) como gaps, pero el código ya los tiene (`GameScreen.tsx:376` renderiza `PlayerContextMenu`; `BoardZone.tsx:230` filtra `phasedIn`). Hay que re-verificar el mapa antes de usarlo.
5. **Gaps funcionales conocidos** que afectan a la evaluación: permisos de mano y Mindslaver (G12-1 ❌); visores looked-at/companion/sideboard (G12-2 ⚠️); `MAX_BOARD_PLAYERS = 4` (`boardShared.ts:6`) mientras el servidor admite FFA de 3 a 10; `END_GAME_INFO` no llega a espectadores; replay aplazado; U8 generador de mazos ➖ (fuera de alcance 2026-09-14).

---

## 1. Tres oráculos para decidir qué es "correcto"

| Oráculo | Responde a | Cómo se usa |
|---|---|---|
| **Servidor XMage** (verdad de reglas y estado) | ¿Lo que se pinta coincide con el `GameView`? | Comprobador automático de fidelidad de render (§2 P2) en toda partida real |
| **Cliente de escritorio** (verdad de flujo) | ¿Aparecen los mismos prompts, con las mismas opciones y en el mismo orden? | Pruebas diferenciales: misma partida guionada en Swing y en Nexus (§2 P5) |
| **Jugadores** (verdad de UX) | ¿Se entiende qué pasa y qué hacer? | Heurística, prueba de 5 segundos, tareas moderadas, dogfooding (§5) |

---

## 2. Infraestructura de pruebas que falta (habilitadores)

| # | Pieza | Qué es | Por qué es necesaria | Tamaño |
|---|---|---|---|---|
| P1 | **Escenarios reales deterministas** | Colocar cartas concretas en zonas concretas de una partida real. Ya existe `skipInitShuffling` (mano top-first); falta exponer en el proxy el comando de trampas del modo test de XMage (verificar en el fork `MageServer.cheatMultiple` / `SystemUtil.addCardsForTesting`), solo con `testMode=true` | Sin esto, llegar a "tengo Counterspell y el rival lanza Bolt" en real depende de la suerte. Es la pieza que convierte el catálogo de mecánicas en tests reales | M |
| | ✅ hecho 2026-09-15 (núcleo): no existía comando remoto (solo `game.cheat` en-JVM) → parche aditivo en el fork `nexus` (7 ficheros: `cheatSetup` en `MageServer`/`Testable`/`SessionImpl` + `MageServerImpl` con gate `testMode` y resultado síncrono `executeWithResult` + `GameManager`/`GameController` con construcción vía `CardRepository`; misma versión, beta intacta) + acción WS `cheatSetup` en el proxy (fail-soft `ok:false` fuera de testMode o contra beta). Verificado en vivo: 2×Counterspell a mano + 2×Island al campo, partida sigue; carta desconocida → `ok:false` limpio. ✅ 2026-09-15: drivers de `record.mjs` (P4) y **exposición MCP** (`mage_cheat_setup`: test hermético `mcp/test/cheatSetup.test.ts` + verificado en vivo 2×Counterspell/2×Island con la partida siguiendo y mesa limpiada). | | | |
| P2 | **Comprobador de fidelidad de render** | Modo dev que, tras cada `GAME_UPDATE`, compara DOM/`window.__mageScene` con el `GameView`: cada permanente visible (salvo faseados), P/T, contadores, girado, adjuntos, controlador (lado correcto), vida, tamaño de mano/biblioteca/cementerio/exilio, pila en orden, fase y jugador activo, prompts pendientes visibles. Emite un informe de discrepancias | Detecta automáticamente "el servidor dice X y la UI pinta Y" en **cualquier** partida real, incluidas las del fuzzing y el self-play | M |
| | ✅ hecho 2026-09-14 v1 (`system/fidelity.ts`, hook en `eventHandler` tras fijar el `GameView`, flag `localStorage mage-web-fidelity=1`, informe al log `fidelidad` sin repetir firmas + `window.__mageFidelityRuns`): cubre permanentes presentes (salvo faseados), ids pintados desconocidos, orden de pila, turno en `game-status`, una sola pastilla de fase activa. Regresión: `e2e/fidelity.spec.ts` (mutate.json, 0 discrepancias). Unit 1556/1556 + typecheck ✅. ✅ v2 2026-09-15: P/T, contadores, girado y daño (data-attrs en `CardSlot`), vidas (`data-life` en `PlayerInfoBar`), lado del controlador (zona `[data-player-id]`) y prompt visible (marcador `data-prompt-method` en `FeedbackDialog`); `checkFidelity(game, painted, pendingPrompt)` con la última ocurrencia del DOM como canónica (la pila de mutate pinta las partes antes que el permanente fusionado). Regresión `e2e/fidelity.spec.ts` ×5 frames reales (mutate/combat/xcosts/aura/trigger-order, 0 discrepancias) + 10 casos unit nuevos. Pendiente v3: adjuntos, tamaños de mano/biblioteca/cementerio/exilio. Unit 1596/1596 + typecheck + build ✅ | | | |
| P3 | **Galería de estados + regresión visual** | Ruta dev (`#/gallery`) que monta cada pantalla y diálogo en sus estados clave con fixtures (vacío, cargando, error, desbordado, idioma largo, CJK). Playwright `toHaveScreenshot` con animaciones desactivadas, en 1366×768, 1920×1080 y 2560×1440, en Chromium y WebKit | Cualquier regresión visual falla en CI; también es la superficie para la evaluación heurística | M |
| | ✅ slice 1 2026-09-15: ruta dev `#/gallery` (`App.tsx` la detecta por hash y carga `dev/GalleryScreen` en diferido; el build de producción no incluye los frames) con **44 estados**: 33 frames reales del registro (tablero completo, reutiliza `manifest.json` + `import.meta.glob`), 10 prompts montados sobre el frame `gang-block` (target obligatorio/opcional, mana, combate ×2, ask, mulligan, grid de búsqueda, orden de triggers, votación) y login. El selector no debe quedar bajo los modales del estado (overlays de la app llegan a z=999999) → sidebar `z-index: 1000000`; al salir restaura el snapshot del store. Spec `e2e/gallery.spec.ts`: recorre las 44 entradas y exige 0 `pageerror` (SIEMPRE, sin stack) + regresión visual opt-in (`E2E_VISUAL=1`, red externa bloqueada para placeholders deterministas) de 12 estados con baselines por plataforma (`--update-snapshots`); unit del builder (ids únicos, grupos, objetivos/pago reales). Pendiente: estados de lobby/editor/draft/torneo y de la matriz §4 (vacío/cargando/error/desbordado/idioma/CJK), baselines en 1366×768/1920×1080/2560×1440 y WebKit, correrlas en CI (requiere baselines Linux). Unit 1600/1600 + typecheck ✅ | | | |
| P4 | **Regla "ningún escenario simulado sin frame real"** | Ampliar `record.mjs` para un driver por mecánica del §3 (usando P1) y derivar los escenarios simulados de esos frames | Cierra el hueco entre "pasa en simulado" y "funciona en real" | M–L |
| | ✅ en marcha 2026-09-15: `ctx.cheatSetup(zones)` + hook `driver.onPlayMana` en `rec-lib.mjs`; driver `counterspell` (mazo todo-Islas vs SIM Montañas+Bolt; setup T1, counter al Bolt, captura pila con ambos + objetivos cruzados) → `counterspell.json` + assert `hasCounterOnStack` (unit + replay e2e). **Regla P1 bisecada**: el cheat en la 1ª prioridad de T1 congela el loop (corre fuera del hilo de juego aún arrancando) → cheatear tras ≥1 acción normal (documentado en README + rec-lib; enrutar al hilo de juego daría deadlock porque espera el prompt). Suman `aura` (Rancor sobre Mystic 3/1, pago solo-Bosques: el Mystic mareado rompía el pago por defecto en bucle) y `tokens` (Dragon Fodder → 2 Goblin isToken WAR sin número) con asserts y replay (7/7), más `modal` (Boros Charm modo daño vs rival; modos por `GAME_CHOOSE_ABILITY`, pago por color; replay 8/8) y `xcosts` (Ballista X=2 con `onTargetAmount`, 2/2 +2 contadores; max INT_MAX sin acotar; replay 9/9), más `response` (Growth vs Sting propio al Mystic — el SIM retiene el Bolt con criaturas fuera), `trigger-order` (2 Wardens sin diálogo: auto-orden) y `may-trigger` (Solemn may→SÍ + búsqueda por TARGET; harnés: `onTarget(ctx,q,data)` + fallback onAsk→default). Replay 12/12. §3.4 pila→R, §3.7 modal→R, §3.2 X/XX→R, §3.5 triple→R. Suman `convoke` (taps como PLAY_MANA; X=0 sin objetivo) y `flashback` (descarte con memoria), grabados en paralelo (USER≤14c blindado), replay 14/14: §3.2 convoke→R, §3.3 flashback→R. ✅ 2026-09-16: cierran `vote` y `warp`, los dos últimos drivers del registro sin frame (33→35 en `manifest.json`; `monstrosity`/`combat-probe` quedan aparte, son solo sondas de investigación, no fixtures). `vote` (Council's Judgment) estaba roto: cheatear solo la mano propia no basta — el SIM no tenía ningún permanente sin tierras tan pronto (2 Mystics en 60 cartas), el voto se quedaba sin candidato y el hechizo fizzleaba mientras la partida se iba 10+ turnos a un descarte de limpieza en bucle (el `onTarget` de descarte devolvía un id fuera de `options.possibleTargets`, así que el servidor repetía la misma pregunta). Fix: cheat encadenado (no en paralelo, P1) que además pone un Mystic votable en el campo del rival; el voto llegó como `GAME_TARGET` (no `GAME_CHOOSE_CHOICE`). Hallazgo de motor sin resolver: el rival cheateado terminó con 2 Mystics exiliados en vez de 1 (posible bug de voto que deja votar por permanentes propios cuando no hay ajenos). `warp` (Time Warp) nunca se había corrido: sin `onTarget` para "Select a player" se congelaba hasta el timeout; con un `onTarget` sin discriminar por pregunta, el descarte de limpieza posterior heredaba la respuesta equivocada (mismo patrón que vote); y el propio `captureWhen` miraba `exile` con un comentario ("se exilia al resolver") que es falso para el texto real de Time Warp (va al cementerio, sin robo). Con las tres correcciones captura en el primer turno. Ambos con asserts (`hasVote`, `hasExtraTurn`), unit 36/36 y replay e2e 34/34 (`npx playwright test recorded.spec.ts`). ✅ 2026-09-15: cerrado también el pendiente de P1 — exposición MCP (`mage_cheat_setup`). ✅ 2026-09-16 (2ª tanda): cinco drivers más con cheatSetup — `hybrid` (Kitchen Finks {1}{G/W}{G/W} con 3 Bosques: el híbrido se paga con verde, sin pregunta de color), `anycolor` (Birds of Paradise paga el {U} de Opt; **hallazgo de motor**: con un solo color pagable NO hay `GAME_CHOOSE_CHOICE` de color, el servidor lo auto-resuelve), `planeswalker` (Teferi, Hero of Dominaria {3}{W}{U}: +1 robar, lealtad 4→5; **hallazgo del harnés**: enviar el UUID de la habilidad no activa nada — `HumanPlayer` resuelve el UUID con `game.getObject()` y una habilidad no es un objeto de juego; hay que clicar el permanente y responder `GAME_CHOOSE_ABILITY`; el helper `playAbility` pasa a hacer click), `saga` (History of Benalia {1}{W}{W}: capítulo I → lore:1 + ficha Knight 2/2 con vigilancia) y `morph` (Den Protector boca abajo por {3}: la habilidad va a la bolsa `other` por `SpellAbilityType.BASE_ALTERNATE` y el picker la etiqueta "Cast … using Morph: Megamorph {1}{G}"). Con asserts (`hasHybrid`, `hasAnyColor`, `hasPlaneswalker`, `hasSaga`, `hasFaceDown`), manifest 35→40, unit 41/41 y replay e2e 39/39. §3.2 híbrido→R, §3.2 any-color→R parcial, §3.8 morph→R parcial, §3.9 planeswalker→R, §3.9 sagas→R parcial. | | | |
| P5 | **Harness diferencial con escritorio** | Guion de partida (mazos + acciones) ejecutado dos veces: con el cliente Swing (o un espectador Swing) y con Nexus/MCP. Se compara la secuencia de callbacks, sus opciones y el estado final | Detecta prompts que Nexus resuelve distinto o se salta | M |
| P6 | **Fuzzing y partidas largas con detector de bloqueos** | Self-play MCP con mazos aleatorios reales; alerta si hay prioridad sin prompt visible durante más de X s, un evento sin manejar, una excepción o una discrepancia de P2 | Encuentra los casos que nadie pensó en escribir | M |
| P7 | **Kit de sesiones manuales** | Plantillas: charters de testing exploratorio por área, diario de partida, informe de incidencia (pasos, severidad, captura, `ws-frames`) y botón "Exportar diagnóstico" en la app (logs de cliente, proxy y servidor + últimos frames) | Hace repetibles y comparables las sesiones humanas | S |
| | ✅ hecho 2026-09-14: `docs/qa/` (charter, diario, informe) + Acerca de → Exportar diagnóstico (`system/diagnostics.ts`: versión, conexión sin contraseña, fase/mesa, resumen de partida, ajustes, log, últimos 60 frames vía `net/frameBuffer.ts` con hook en `Gateway`; payload completo solo si < 64 KB, digest de GAME_UPDATE). Logs proxy/servidor se adjuntan a mano (`tail.mjs`) según la plantilla. Unit 1549/1549 + typecheck ✅ | | | |

---

## 3. Matriz de mecánicas a verificar en real

Estados: **R** = verificado en real (sesión o spec) · **S** = solo simulado · **—** = sin test (no aparece en el catálogo) · **Gap** = falta implementación.

Método por fila: (1) escenario real con P1 → (2) jugarlo desde la UI → (3) P2 activo sin discrepancias → (4) checklist de prompt del §5.1 → (5) grabar frame (P4) → (6) test de regresión.

### 3.1 Inicio de partida
| Mecánica | Cartas / montaje | Qué comprobar en la UI | Estado |
|---|---|---|---|
| London mulligan hasta 5 + fondo | Mazo cualquiera, mulligan ×2 | Mano en abanico, contador N, elegir N cartas al fondo, no se puede confirmar con menos | R (sesión 09-12) |
| Mulligan gratuito de Commander / multijugador | Commander 4 jugadores | Que el primero no reste carta y el texto lo diga | — |
| Elegir quién empieza | Ganar la tirada | Diálogo con jugadores, timeout | S |
| Companion revelado | Lurrus en banquillo | Visible en zona propia y del rival; pagar {3} para ponerlo en mano | Gap parcial (G12-2) |
| Conceder durante mulligan | — | La UI no ofrece algo que el server ignora (lección plan3) | — |

### 3.2 Maná y costes
| Mecánica | Cartas | Qué comprobar | Estado |
|---|---|---|---|
| Pago estándar tocando fuentes | Tierras básicas | Fuentes jugables resaltadas, pool visible, auto-pago | R |
| Híbrido y pirexiano | Kitchen Finks, Dismember | Elegir vida o maná; vida baja reflejada | R (híbrido: frame `hybrid.json` — Finks 3/2 pagado con 3 Bosques, sin pregunta de color; pirexiano: frame `dismember.json` — 4 vidas; drivers P4 09-16) |
| X y XX | Blaze, Hangarback Walker, Villainous Wealth | Stepper con máximo real; XX cuenta doble | R (frame `xcosts.json`: Ballista X=2, XX doble ✓; el max del prompt es INT_MAX — el servidor no acota, driver P4 09-15) |
| Maná de cualquier color / elección | Birds of Paradise, Treasure | Elección de color y pool | R parcial (frame `anycolor.json`: Birds paga el {U} de Opt; el motor **auto-resuelve** el color cuando solo uno es pagable — no emite `GAME_CHOOSE_CHOICE` de color; driver P4 09-16) |
| Nieve, incoloro específico `{C}` | Blizzard Brawl, Eldrazi | Solo fuentes válidas resaltadas | — |
| Convoke / Improvise / Delve | Chord of Calling, Treasure Cruise | Seleccionar criaturas, artefactos o cartas del cementerio como pago | R (convoke: frame `convoke.json`, driver P4 09-15) · — (delve) |
| Costes alternativos: evoke, overload, dash, emerge | Solitude, Cyclonic Rift | Elegir modo de lanzamiento, coste mostrado | — |
| Kicker / multikicker / strive | Goblin Bushwhacker | Pregunta y coste final | S |
| Reducción de coste | Goblin Electromancer | Coste mostrado ya reducido | — |
| "Solo para gastar en…" / maná flotante al cambiar de fase | Eldrazi Temple | Aviso de vaciar pool (`confirmEmptyManaPool`) | S |

### 3.3 Lanzar desde otras zonas
| Mecánica | Cartas | Qué comprobar | Estado |
|---|---|---|---|
| Flashback / escape / jump-start | Faithless Looting, Uro | Carta jugable resaltada en el cementerio (`CrossZoneOverlay`), coste alternativo | R (flashback: frame `flashback.json`, driver P4 09-15) |
| Adventure desde exilio | Bonecrusher Giant | Lanzar la criatura desde exilio tras la aventura | S |
| Foretell / plot / exilio boca abajo | Saw It Coming | Carta boca abajo propia visible para mí, oculta al rival | — |
| Cascade / discover | Bloodbraid Elf | Pregunta "¿lanzar?" con la carta revelada | — |
| Suspend / madness | Rift Bolt, Fiery Temper | Contadores de tiempo; ventana de madness | — |
| Commander desde zona de mando + impuesto | Cualquier comandante | Coste con impuesto; volver a la zona de mando (pregunta al morir) | S |

### 3.4 Objetivos
| Mecánica | Cartas | Qué comprobar | Estado |
|---|---|---|---|
| Un objetivo (criatura o jugador) | Lightning Bolt | Válidos con brillo, flecha, avatar del jugador clicable | R |
| Dividir daño entre objetivos | Arc Trail, Fireball | Reparto con total correcto | S |
| "Hasta N" / cero objetivos | Aether Gust | Poder terminar con menos | S |
| Objetivo en la pila | Counterspell | Hechizos de la pila seleccionables | R (frame `counterspell.json`, driver P4 09-15) |
| Cambiar objetivos / copiar hechizo | Redirect, Twincast | Elegir nuevos objetivos para la copia | — |
| Ward / hexproof visible | Adeline, Sigarda | Icono; pagar ward o hechizo contrarrestado | — |
| Objetivo ilegal al resolver | Bolt a criatura que se sacrifica | Log claro de "contrarrestado por reglas" | — |

### 3.5 Pila y prioridad
| Mecánica | Cartas | Qué comprobar | Estado |
|---|---|---|---|
| Responder en la pila | Bolt en respuesta a Giant Growth | Pila en orden, mi prioridad obvia, resolución una a una | R (frame `response.json`: Growth vs Sting propio al Mystic, driver P4 09-15; el SIM retiene el Bolt con criaturas fuera) |
| Split second | Sudden Shock | La UI no ofrece jugar lo que no se puede | — |
| Orden de triggers simultáneos | Dos triggers de ETB | Diálogo de orden | R (frames `trigger-order.json`: 2 Wardens+Mystic → vidas 22 **sin diálogo** — el motor auto-ordena; driver P4 09-15) |
| Triggers "may" | Solemn Simulacrum | Pregunta Sí/No con la carta origen visible | R (frame `may-trigger.json`: may→SÍ + búsqueda de Bosque vía TARGET con `possibleTargets`; driver P4 09-15) |
| F2/F4/F9, stops por fase, auto-pass, hold | — | Nunca se pasa una ventana que el jugador marcó | S |
| Pila de 10+ objetos | Storm | Scroll y legibilidad | — |
| Timeout de reloj de partida | Timer bajo | Aviso visible, pérdida por tiempo | S |

### 3.6 Combate
| Mecánica | Cartas | Qué comprobar | Estado |
|---|---|---|---|
| Atacar y bloquear básico | Criaturas vanilla | Girado, flechas, daño y vida | R |
| Gang block + asignación de daño | 1 atacante vs 2 bloqueadores | Reparto multi-cantidad | R (sesión 09-12) |
| Trample + deathtouch | Rhox Faithmender | Asignación letal mínima | — |
| First / double strike | Boros Swiftblade | Dos pasos de daño visibles | — |
| Menace, "no puede bloquear", "debe bloquear" | Goblin War Drums, Lure | Bloqueos ilegales rechazados con motivo | — |
| Atacar a planeswalker o batalla | Multijugador con PW | Elegir defensor por atacante | S (batalla render) |
| Ninjutsu / trucos durante el combate | Ninja of the Deep Hours | Ventana tras declarar bloqueos | — |
| Vigilance, goad, "ataca cada combate" | — | Badges y restricciones aplicadas | S |
| Combate multijugador (varios defensores) | Pod de 4 | Flechas al jugador correcto | S |

### 3.7 Elecciones y aleatoriedad
| Mecánica | Cartas | Qué comprobar | Estado |
|---|---|---|---|
| Nombrar carta | Pithing Needle | Búsqueda por texto sobre 25.000 nombres | S (grid-search) |
| Elegir color, tipo de criatura, número | Cavern of Souls | Lista larga filtrable | S |
| Modal "elige uno/dos" | Boros Charm, Kolaghan's Command | Modos deshabilitados sin objetivos | R (frame `modal.json`: modo daño vs rival, driver P4 09-15) |
| Pilas (FoF) | Fact or Fiction | Dos pilas claras para quien elige y quien separa | S |
| Votación | Council's Judgment | Paso 1/2, resultados | R (frame `vote.json`: voto de un único jugador — el otro no tiene candidato — llega como `GAME_TARGET`, no como `GAME_CHOOSE_CHOICE`; Mystic del rival exiliado; driver P4 09-16, requiere cheatear también un permanente votable en el rival o el hechizo fizzlea) |
| Dados, moneda, clash | Krark's Thumb | Resultado visible en el log y en pantalla | — |

### 3.8 Biblioteca e información oculta
| Mecánica | Cartas | Qué comprobar | Estado |
|---|---|---|---|
| Scry / surveil | Opt, Consider | Arriba/abajo/cementerio por carta | S |
| Mirar N y ordenar | Brainstorm, Ponder | Orden resultante correcto | S |
| Tutor con "fallar la búsqueda" | Demonic Tutor, Evolving Wilds | Grid HD, filtro, poder no encontrar | S |
| Descarte de mano revelada | Thoughtseize | Grid con la mano rival | S |
| Boca abajo: morph, manifest, disguise, cloak | Hidden Dragonslayer | Yo veo la carta; el rival ve un 2/2 anónimo; girar boca arriba | R parcial (morph: frame `morph.json` — Den Protector boca abajo 2/2 con `faceDown`; manifest/disguise/cloak y girar boca arriba siguen —; driver P4 09-16) |
| Mirar la mano o la biblioteca del rival | Gitaxian Probe, Telepathy | Visor temporal | Gap parcial (G12-2) |

### 3.9 Permanentes y estados
| Mecánica | Cartas | Qué comprobar | Estado |
|---|---|---|---|
| Auras y equipos (mover, equipar) | Bonesplitter | Adjunto visible y movido | R |
| Contadores varios, anulación +1/−1 | Walking Ballista, Hapatra | Badges, anulación | R (Ballista) |
| Stun, shield, oil, etc. | — | Badge genérico legible | — |
| Fichas masivas (50+) | Krenko, Tendershoot | Agrupación, rendimiento, sin solaparse | — |
| Clones / "se convierte en copia" | Phantasmal Image | Nombre y arte de la copia | — |
| Transformar / DFC / day-night | Delver of Secrets | Cara correcta, animación | S |
| Phasing | Teferi's Protection | Permanentes desaparecen y vuelven | — (código sí filtra) |
| Sagas, clases, casos | — | Capítulo / nivel / resuelto | R parcial (sagas: frame `saga.json` — History of Benalia lore:1 + ficha Caballero; clases: badge solo-cliente; casos: gap del motor; driver P4 09-16) |
| Mutate | Gemrazer | Pila y badge Under/Over | R (sesión 09-14) |
| Planeswalkers: activar | Liliana | Diálogo de lealtad, un uso por turno | R (frame `planeswalker.json` — Teferi, Hero of Dominaria +1 robar, lealtad 4→5 vía picker `GAME_CHOOSE_ABILITY`; driver P4 09-16) |

### 3.10 Control y jugadores
| Mecánica | Cartas | Qué comprobar | Estado |
|---|---|---|---|
| Ganar control hasta fin de turno | Act of Treason | La criatura cambia de lado y vuelve | — |
| Intercambio de control | Switcheroo | Ambos lados actualizados | — |
| Controlar el turno de otro jugador | Mindslaver | Ver mano ajena y actuar por él | **Gap** (G12-1) |
| Monarch, initiative/dungeon, the ring, emblemas | — | Indicadores | S |
| Veneno, energía, radiación | — | Contadores de jugador | S |
| Turnos extra / saltar turno | Time Warp | Indicador de turno correcto | R (frame `warp.json`: TARGET "Select a player" → uno mismo → carta en el cementerio (sin exilio ni robo, pese al comentario original del driver); driver P4 09-16) |
| Ganar/perder por efecto, empate | Thassa's Oracle | Pantalla de fin correcta | — |
| Reiniciar la partida | Karn Liberated | La UI se re-inicializa | — |

### 3.11 Multijugador y formatos
| Mecánica | Montaje | Qué comprobar | Estado |
|---|---|---|---|
| Commander 4 jugadores | 4 cuentas o 1+3 IA | Daño de comandante, anillo de turnos, impuesto | S |
| FFA 5–10 jugadores | 1 + 5 IA | Layout standard con switcher (cae solo a standard con 5+); verificar la experiencia hojeando rivales | R pendiente (decisión §9: solo standard) |
| Two-Headed Giant | 2 vs 2 | Vida compartida, turno de equipo | S |
| Rango de influencia / atacar izquierda | FFA con rango 1 | Solo objetivos en rango | — |
| Jugador que abandona a mitad | Pod de 4 | Sus permanentes desaparecen; la partida sigue | — |
| Bo3 / Bo5 con banquillo | 2 humanos | Validación, timer, siguiente partida | R (B.10) |
| Draft 8 → construir → torneo | 2 humanos + bots | Picks, espera, construct, cuadro | R (sesión 09-14) |
| Sealed | 2 humanos | Pool de 90, tierras sugeridas | R |
| Suizo | 4+ jugadores | Emparejamientos, standings | S |
| Espectar partida y torneo | — | Sin controles de jugador, fin de partida visible (hoy no llega `END_GAME_INFO`) | R parcial |

**Aprobado de §3**: todas las filas en **R** con test o frame grabado, salvo las declaradas fuera de alcance; 0 discrepancias P2 en 200 partidas de fuzzing (P6); diferencias con escritorio (P5) documentadas y aceptadas una a una.

---

## 4. Inventario de interfaz: pantallas × estados

Cada pantalla se evalúa en **todos** estos estados (a través de la galería P3 cuando sea posible):

`vacío` · `cargando` · `error` · `desbordado` (nombres muy largos, 60+ mesas, 100+ fichas, mano de 15) · `idioma largo` (de/ru) · `CJK` (ja) · `1366×768` · `2560×1440` · `zoom 125 %` · `solo teclado` · `reduced-motion` · `desconexión`

| Pantalla | Qué mirar además | Evidencia actual |
|---|---|---|
| Setup wizard y login | Primera ejecución sin configuración, errores de conexión explicados | `setup-wizard.spec`, `join-errors.spec` |
| Lobby (mesas, filtros, chat flotante, historial, clasificación) | Actualización en vivo sin saltos, mesas que desaparecen mientras las miras | varios specs S |
| Crear mesa (wizard) | Combinaciones inválidas imposibles, resumen fiel | `wizard.spec`, `verify-wizard-matrix.mjs` |
| Sala de espera / staging | Roster, listo/no listo, cambiar mazo | `staging.spec` S, `multi-user` R |
| Editor de mazos, galería, import/export, mano de prueba | Mazos de 100 cartas, errores del validador, arrastrar | `decks-gallery.spec`, `deckvalidation.spec` |
| Partida 1v1 | Legibilidad a distancia, mano llena, pila grande, prompts encima del tablero | extenso S |
| Pod / Commander / Arena | 3 y 4 jugadores, alternar rival, anillo | `pod-bands`, `auto-pod`, `arena-board` S |
| Draft | Espera larga, recarga, 15 cartas en pantalla pequeña | `draft.spec` S + R |
| Construct y banquillo | Timer, contador de cartas, tierras básicas | S |
| Torneo / cuadro | Suizo con 8+, cuadro terminado | `tournament.spec` S |
| Fin de partida / fin de match | Resultado claro, siguiente acción obvia | `defeat.spec` S |
| Ajustes, apariencia, sonido, idioma, acerca de, ayuda | Cambios aplicados en vivo y persistidos | `settings.spec`, `zoom.spec`, `cjk.spec` |

**Checklist común a los 27 diálogos y modales**: ESC cierra (salvo prompts obligatorios), botón cerrar consistente, foco atrapado dentro y devuelto al cerrar, confirmación en acciones destructivas (conceder, abandonar mesa, borrar mazo), scroll interno si desborda, título y acción principal claros, no tapa información que el jugador necesita para decidir (p. ej. el tablero al elegir objetivo).

**Aprobado de §4**: toda la galería con captura de referencia aprobada; 0 cortes o solapes en la matriz de estados; checklist de diálogos 100 %.

---

## 5. Evaluación de UI y UX

### 5.1 Checklist de prompt (cada tipo de pregunta al jugador)
Para los ~20 tipos de prompt (target, choose ability, choice, pile, ask, select, play mana, X, amount, multi-amount, mulligan, trigger order, library order, card grid, voting, planeswalker, starting player, user request, sideboard, draft pick):

| Criterio | Pregunta |
|---|---|
| Instrucción | ¿Se lee qué hay que hacer en una frase, en el idioma del jugador? |
| Origen | ¿Se ve qué carta o efecto lo pide? |
| Opciones válidas | ¿Están resaltadas, y las inválidas no se pueden clicar? |
| Contexto | ¿Se sigue viendo el tablero necesario para decidir? |
| Salida | ¿Hay cancelar/atrás cuando el motor lo permite, y no aparece cuando no? |
| Teclado | ¿Se resuelve con teclado? |
| Tiempo | ¿Se ve el reloj si corre? |
| Acuse | ¿Hay respuesta visual en menos de 100 ms tras elegir (antes de que conteste el servidor)? |
| Vista del rival | ¿El otro jugador ve "esperando a X" en lugar de una pantalla congelada? |

Resultado: una tabla prompt × criterio con ✅/⚠️/❌, revisada en real.

### 5.2 Evaluación heurística
- 2–3 evaluadores **independientes** recorren cada pantalla de §4 con las 10 heurísticas de Nielsen + heurísticas de juego: estado del juego siempre visible (turno, fase, prioridad, vidas), respuesta inmediata, legibilidad del tablero, carga cognitiva, consistencia con convenciones de Arena/MTGO, errores prevenibles.
- Severidad 0–4 por hallazgo; consolidar; los de severidad 3–4 bloquean.

### 5.3 Prueba de 5 segundos del tablero
Mostrar 10 capturas de estados de partida reales (1v1, pod, combate, pila llena, prompt abierto) durante 5 s y preguntar: ¿de quién es el turno? ¿en qué fase? ¿cuánta vida tiene cada uno? ¿qué hay en la pila? ¿tengo que hacer algo? **Aprobado: ≥ 80 % de respuestas correctas.**

### 5.4 Latencia percibida
Medir, por acción (jugar tierra, lanzar, elegir objetivo, pasar, declarar atacantes, pick de draft), el tiempo desde el clic hasta el primer cambio visual y hasta la confirmación del servidor. **Aprobado: acuse visual < 100 ms; si el servidor tarda > 1 s, estado de espera explícito** (el fallo del draft era exactamente esto).

### 5.5 Pruebas con jugadores
- **Dos rondas de 5–8 jugadores** cada una: mitad veteranos de XMage escritorio, mitad jugadores de Arena/MTGO que nunca usaron XMage.
- Tareas sin ayuda, cronometradas, con pensar en voz alta:
  1. Instalar el launcher y llegar al lobby
  2. Importar un mazo de Arena y validarlo
  3. Jugar contra la IA hasta el turno 5
  4. Pagar un coste X y un coste híbrido
  5. Responder a un hechizo del rival con un instantáneo
  6. Bloquear con dos criaturas y repartir daño
  7. Buscar en la biblioteca con un tutor
  8. Hacer banquillo en un Bo3
  9. Completar 3 picks de draft
- **Veteranos de XMage**: repetir 3–6 en el cliente de escritorio para comparar tiempo y errores.
- Métricas: éxito por tarea, SEQ por tarea, SUS al final, incidentes "no sé qué hacer ahora".
- **Aprobado**: éxito ≥ 80 % por tarea; SUS ≥ 70; veteranos igual o más rápidos que en escritorio en 3 de 4 tareas comparadas.

### 5.6 Dogfooding estructurado y bug bash
- **Diario de partidas**: 10 partidas reales por formato (Standard, Modern, Pauper, Commander 4, draft, sealed) con plantilla P7: duración, incidencias, momentos de confusión.
- **Bug bash** de 90 min por área con charter (ej.: "explorar el pago de maná con costes raros para descubrir pagos imposibles o confusos").
- **Aprobado**: 0 incidencias bloqueantes abiertas y ≤ 3 graves por formato.

### 5.7 Sensación de juego
Las animaciones no bloquean la entrada y se pueden saltar; `reduced-motion` quita el movimiento no esencial; volúmenes y sonidos coherentes; ninguna animación se queda colgada tras recargar o reconectar.

---

## 6. Instalación, launcher y autoalojado

Como cada jugador se lo monta, **la primera hora de uso es parte del producto**.

| Escenario | Sistemas | Qué medir | Aprobado |
|---|---|---|---|
| Primera ejecución del launcher en máquina limpia | Win 10/11 x64, macOS arm64 y x64, Ubuntu | Tiempo hasta el lobby (incluido el escaneo de la BD de cartas, ~15 min en frío en CI), mensajes durante la espera | < 10 min con progreso visible y honesto |
| Avisos del sistema | Win SmartScreen, macOS Gatekeeper | Si el binario sin firmar se puede abrir y cómo se explica | Instrucciones claras o binario firmado |
| Puertos ocupados (17171, 8787, 8788) | Todos | Error comprensible o puerto alternativo | Nunca un fallo silencioso |
| Sin internet | Todos | Jugar contra la IA offline; imágenes de Scryfall no disponibles | Juego posible con placeholders |
| Actualización N → N+1 y actualización fallida | Todos | Updater firmado (minisign pendiente), vuelta a N | Sin reinstalar a mano |
| Recursos | Portátil de 8 GB | RAM y CPU del JVM (servidor + proxy) + WebView durante una partida Commander | Uso documentado; sin swapping |
| Jugar con un amigo | 2 launchers | Contra servidor público o uno hace de host en LAN | Pasos documentados y probados por un tercero |
| Autoalojado sin launcher | Guía `install.mjs` | Un desarrollador ajeno sigue la guía desde cero | Éxito sin ayuda en < 30 min (sin contar compilación) |
| Diagnóstico | Todos | Botón "Exportar diagnóstico" (P7) | El informe basta para reproducir el bug |
| Desinstalar | Todos | Datos y procesos restantes | Sin procesos Java huérfanos |

Bloqueantes actuales: JRE solo empaquetado para mac-arm64; updater sin clave de firma en GitHub.

---

## 7. Criterios de aprobado (resumen)

| Área | Umbral |
|---|---|
| Mecánicas (§3) | 100 % de filas en R o fuera de alcance declarado; 0 discrepancias P2 en 200 partidas |
| Flujo vs escritorio (P5) | Todas las diferencias documentadas y aceptadas |
| Visual (§4) | Galería completa con referencia; 0 cortes en la matriz de estados |
| Prompts (§5.1) | 0 ❌ en la tabla prompt × criterio |
| Heurística (§5.2) | 0 hallazgos de severidad 3–4 abiertos |
| Legibilidad (§5.3) | ≥ 80 % correctas |
| Latencia (§5.4) | Acuse < 100 ms en todas las acciones |
| Jugadores (§5.5) | Éxito ≥ 80 %, SUS ≥ 70 |
| Dogfooding (§5.6) | 0 bloqueantes, ≤ 3 graves por formato |
| Instalación (§6) | Todas las filas aprobadas en los 3 sistemas |

---

## 8. Orden de trabajo

1. **Base** — commitear o cerrar el draft; re-verificar `COMPONENT_PARITY.md` e `INTERACTION_COVERAGE.md` contra el código (filas desactualizadas como G12-3/G12-4); añadir WebKit y las 3 resoluciones a Playwright.
   - ✅ 2026-09-14: paridad re-verificada (filas G12-1–G12-4 apuntan al cierre U12; Mindslaver total fuera de alcance); `INTERACTION_COVERAGE` y `content.json` sin refs obsoletas. Playwright: `E2E_BROWSER=webkit` (`test:e2e:webkit`, WebKit instalado) + `E2E_VIEWPORT=AxB` (loop diario sigue en Chromium 1600×900).
   - ✅ resuelto 2026-09-15 — Hallazgo §4: `zoom.spec.ts` "tablero con 150%" fallaba a `E2E_VIEWPORT=1366x768` con `Element is outside of the viewport` en el submit de "Crear Mesa" (no era un loop de animación: con `zoom:1.5` en `<html>`, `.dlg-lg { max-height: 90vh }` deja al panel del diálogo genuinamente más alto que la pantalla física, y `.dlg-backdrop` — `position:fixed;inset:0` sin `overflow` — no tenía ninguna forma de desplazarse para alcanzar la parte recortada). Fix: `place-items: safe center` + `overflow-y: auto` en `.dlg-backdrop` (`DialogShell.css`) — centra cuando cabe, se ancla arriba y permite scroll cuando no; más `scrollbar-gutter: stable` en `.dlg-panel`/`.create-table-body`/`.setup-body` y un `scrollIntoViewIfNeeded()+click({force:true})` en el submit de `createTable()` (mismo patrón ya usado en `startMatch()`, con el mismo comentario). Verificado: `zoom.spec.ts` 3/3 en Chromium (1366×768 y viewport por defecto) y WebKit; `wizard.spec.ts`+`setup-wizard.spec.ts` 9/9 sin regresión; typecheck y unit (`CreateTableDialog.test.tsx`+`SetupWizard.test.tsx`, 30/30) verdes.
2. **Habilitadores** — P1 (trampas de modo test en el proxy) → P2 (fidelidad de render) → P3 (galería + regresión visual) → P7 (kit manual).
3. **Mecánicas en real** — recorrer §3 por bloques (3.1–3.5 primero: son todas las partidas), grabando frames (P4) y convirtiendo cada sesión en test.
4. **Diferencial y fuzzing** — P5 y P6 sobre lo ya cubierto.
5. **UX interna** — §5.1 checklist de prompts, §5.2 heurística, §5.4 latencia; corregir severidad 3–4.
6. **Jugadores ronda 1** — §5.3 y §5.5; corregir.
7. **Instalación** — §6 en máquinas limpias.
8. **Jugadores ronda 2 + dogfooding** — §5.5 con participantes nuevos y §5.6.

---

## 9. Decisiones pendientes

1. **FFA de 5–10 jugadores**: ✅ decidido 2026-09-14 — **solo posible en standard**. El switcher se queda solo en standard (en pod va el anillo); con 5+ jugadores el layout cae a standard automáticamente (`effectiveBoardLayout` en `board/boardLayout.ts`: `GameBoard` + switcher no recortan, pod/arena sí). Queda como gap menor la pestaña de daño de comandante (recorta a 4).
2. **Mindslaver y permisos de mano (G12-1)**: ✅ decidido 2026-09-14 — fuera de alcance.
3. **Replay, visores G12-2**: ✅ decidido 2026-09-14 — **visores dentro** (looked-at/companion/top-library/sideboard), **replay fuera**. (U8 generador: fuera de alcance 2026-09-14; `GAME_REDRAW_GUI`: fuera de alcance 2026-09-14.)
4. **Formatos objetivo** de la evaluación (§5.6): cuáles cuentan para el aprobado.
5. **Firma de binarios** (Windows/macOS): pagar certificados o documentar el bypass.
6. **Lenguas** que se evalúan con nativos (§4, estado idioma largo).

---

## 10. Anexo: qué queda del enfoque "servicio público"

Con distribución local, estos puntos bajan de prioridad pero no desaparecen:

- **`ws://` fijo** (`web/src/state/gateway.ts:145`): solo afecta a quien exponga el proxy por HTTPS; basta con elegir `wss://` según `location.protocol`.
- **Contraseña en `localStorage`** (`web/src/state/persistence.ts:85`): riesgo local; ofrecer "recordar" opcional.
- **Observabilidad**: se sustituye por el botón "Exportar diagnóstico" (P7).
- **Carga**: solo relevante para quien aloje para amigos; una prueba con 10 usuarios simultáneos es suficiente.
- **Legal**: aviso de no afiliación con Wizards (ya en `App.tsx:138`), atribución de Scryfall y licencias de terceros en launcher y "Acerca de".
