# Component Parity — Desktop Swing ↔ Web

Comparativa de funcionalidades por **módulo** entre el cliente desktop oficial
(`Mage.Client`, Swing) y el web (`web/src`, React). Es el tracker que responde
"¿qué tiene el desktop que el web no tiene?".

- **Granularidad**: 15 unidades modulares (§ Tabla madre). El detalle por componente
  vive en la sección de auditoría de cada unidad.
- **No duplica**: `INTERACTION_COVERAGE.md` sigue siendo el oráculo de
  callbacks/mecánicas (con guard); aquí se trackea **UI/funcionalidad por pantalla**.
  `site/content.json` es el espejo grueso para el dashboard (solo `yes/partial/no`).
- **Regla de mantenimiento**: al cerrar la auditoría de una unidad, marcar su fila
  (Estado + Evidencia + Fecha) y añadir commit propio. Ver también `web/AGENTS.md`.

Leyenda: ✅ = paridad evidenciada (guard/E2E/doc) · ⚠️ = gap conocido ·
❓ = pendiente de auditoría fina · ❌ = ausente en web · — = no aplica al web.

Inventario base (2026-09-05): desktop 292 `.java` (~65 componentes comparables;
resto MDI/Swing/DnD/RMI/descargador — ver § Exclusiones) · web 179 `.tsx`
(9 pantallas + 27 `*Dialog|*Modal`).

## Tabla madre

| # | Unidad | Desktop ref | Web ref | Estado | Evidencia | Última verif. |
|---|---|---|---|---|---|---|
| U1 | Shell / Conexión | `mage/client/MageFrame.java`, `MagePane.java`, `dialog/ConnectDialog.java`, `RegisterUserDialog.java`, `ResetPasswordDialog.java` | `src/App.tsx`, `lobby/LoginScreen.tsx` | ✅ | Login supera al desktop (presets, split proxy/servidor, avatar, i18n). Registro/reset **no aplican**: el servidor lleva `authenticationActivated=false` por defecto (`config.xml:58`, *"user need not to register"*); `Session.registerUser` responde `REGISTRATION_DISABLED_MESSAGE` y el login ignora la pass (`Session.java:88-93,246-255`; `Main.java:87` "no password check"). Solo tendrían sentido contra un servidor con auth activada | 2026-09-05 |
| U2 | Lobby mesas | `table/TablesPanel.java`, `TablesPane.java`, `TablesTableModel.java`, `MatchesTableModel.java` | `lobby/LobbyScreen.tsx`, `TableCard.tsx`, `TableFilterBar.tsx`, `FinishedMatchesPanel.tsx` | ✅ | Filtros desktop (rated/unrated, abierta/privada, torneo constructed/limited, ocultar ignorados con toggle OFF por defecto + aviso en join) + orden desktop-default (libres primero, recientes) con selector + búsqueda propia por texto (el desktop no la tiene) + PM/whisper/ignore + doble-clic unirse/espectar (`TableFilterBar.test.tsx` 13 tests) | 2026-09-06 |
| U3 | Crear mesa | `dialog/NewTableDialog.java`, `table/TablePlayerPanel.java`, `NewPlayerPanel.java` | `lobby/CreateTableDialog.tsx` + `lobby/CreateTable/` | ✅ | Paridad cerrada 2026-09-06 (delta sobre §F): skill por plaza 1-10 default 2 (`seatSkills` web→`SimManager`→`SimPlayer` + skill propia) como `NewPlayerPanel.spnLevel`, bannedUsers con UI (proxy ya lo parseaba), numberRounds con UI (0=auto), range/attack por flags del servidor (`GameTypeView.useRange/useAttackOption`, fallback heurística), validación por paso (nombre+compat+ocupantes), hint vivo por plaza (cartas del mazo + aviso vacío). F11 2026-09-06: plazas HUMAN en espera (`Humano — espera rival` por plaza + chip global, como `TablePlayerPanel=HUMAN`; tipos normalizados a enum canónico). Fuera de alcance: F6 emblemas `.dck` (experimental desktop, 3 capas). Tests: `CreateTableDialog.test` 8/8 + `constants.test` 4/4 + `wizard.spec.ts` 3/3 fake con aserción del frame WS | 2026-09-06 |
| U4 | Unirse / Espera / Staging | `dialog/JoinTableDialog.java`, `TableWaitingDialog.java` | `lobby/JoinTableDialog.tsx`, `SpectatorStagingScreen.tsx` | ✅ | Auditada 2026-09-06 (ver § U4): swapSeats (proxy+↑/↓ dueño en READY), torneo (bypass join sin mazo en limitado + `startTournament`), roster rico (rating limited/constructed + history + flag), start con confirm si falta ready (aviso, no bloqueo). 2026-09-07: chat por mesa U4-11 cerrado (proxy `getTableChatId` + `joinChat/leaveChat` por ciclo de sala + `ChatBox chatIdOverride` + marcas Listo a la mesa). Stretch restante: caché password (U4-2), sonidos (U4-12). Tests: `TableStagingCommandsTest` 7/7 java + `store.test` 7 nuevos + `staging.spec.ts` 8/8 + `staging-chat.spec.ts` 2/2 fake + verificación real 11/11 (2 sesiones + espectador + aislamiento entre mesas) | 2026-09-07 |
| U5 | Chat | `chat/ChatPanelBasic.java`, `ChatPanelSeparated.java`, `table/PlayersChatPanel.java` | `game/GameChat.tsx`, `lobby/ChatBox.tsx` | ✅ | Auditada 2026-09-07: envío/recepción sala+mesa+partida ✅, whisper `/w` (envío por parser del servidor + `WHISPER_FROM/TO` diferenciados con sonido) ✅, `/history`/`/me`/`/card`/`/list` (responden `USER_INFO` → sistema) ✅, `[Carta]` + hover ✅ (supera), split Talk/System ≈ toggle + canales ✅, usuarios (flag/rank/ping) + `UserActionModal` ✅, ventana separada ≈ `FloatingChat` arrastrable ✅. Delta: hora tenue por mensaje (U5-2, `time` del evento), propio en verde (U5-4), límite 500 con aviso i18n (U5-3, `GameChat` ya lo tenía). Diferencias declaradas: ignore solo-cliente (el desktop bloquea joins; cubrir con password/vetados), profanity fuera de alcance. Tests: `ChatBox.test` +3 + `chat.spec`/`staging-chat.spec` asserts de hora + verificación real 8/8 (whisper A↔B, `/history`, `/card`, >500 lo acepta el servidor) | 2026-09-07 |
| U6 | Editor mazos | `deckeditor/DeckEditorPanel.java`, `CardSelector.java`, `DeckArea.java`, `DeckLegalityPanel.java`, `collection/viewer/` | `decks/DeckBuilder.tsx` + `decks/*` (69 ficheros) | ✅ | Auditada 2026-09-07 (ver § U6): sort resultados (6 órdenes + dirección, U6-1), Mana Analyser completo (fuentes/básicas/distribución, U6-2), +4 formatos (Oathbreaker, PD Commander, Highlander EU/CA, U6-3), import `.dek`/`.cod`/`.o8d` + export `.dek` (U6-4/5), slider tamaño carta. Supera: sintaxis Scryfall, sample hand London + goldfish, catálogo meta + Moxfield/Archidekt, reparación de issues del servidor. No-aplica: `CollectionViewer/MageBook` (sin DB local), Open Booster, Bling, Draft Rating, LAYOUT posicional. Resto import/export (`.mwdeck/.draft/.json`) → U7. Tests: unit 883 + `decks-gallery.spec` 5/5 (nuevo test U6) + `deckvalidation` 3/3 | 2026-09-07 |
| U7 | Import / Export / Sample | `deckeditor/DeckImportClipboardDialog.java`, `DeckExportClipboardDialog.java` | `decks/DeckImportModal.tsx`, `exportDeckFile.ts`, `SampleHandModal.tsx` | ✅ | Auditada 2026-09-07 (ver § U7): import 9 ext desktop cubiertas (U7-1 `.draft`, U7-2 mtgjson `.json` con backup-restore desambiguado, U7-3 `.mwdeck` bracket/set + switch banquillo por línea vacía MTGO + comentarios `#` + cabeceras con conteo), botón pegar-portapapeles (U7-5), Commander→principal+cover y Maybeboard→banquillo (U7-6), Partner 2 coronas + unión identidad por datos oráculo (U7-7, supera: desktop sin zona). Export 4 formatos ✅ (dck_info no-aplica). Supera: URLs Moxfield/Archidekt, sample London+goldfish, badge live. Tests: unit 894 + `decks-gallery.spec` 6/6 (test U7) + `deckvalidation` 3/3 | 2026-09-07 |
| U8 | Generador mazos | `deck/generator/DeckGenerator*.java` (5), `RatioAdjustingSliderPanel.java` | — (sin equivalente en `web/src`) | ❌ | grep `*generat*deck*|*random*deck*` en `web/src` → 0 resultados | 2026-09-05 |
| U9 | Draft | `draft/DraftPanel.java`, `DraftGrid.java` | `game/DraftScreen.tsx` | ❓ | `DRAFT_*` ✅ (`draft.spec.ts`); comparativa fina pendiente | — |
| U10 | Torneo | `tournament/TournamentPanel.java`, `dialog/NewTournamentDialog.java`, `RandomPacksSelectorDialog.java` | `game/TournamentPanel.tsx`, `lobby/TournamentBracket.tsx`, `TournamentStandings.tsx` | ❓ | `TOURNAMENT_*` ✅ (`tournament.spec.ts`); `RandomPacksSelector` por auditar | — |
| U11 | Núcleo partida | `game/GamePanel.java`, `GamePane.java` | `game/GameScreen.tsx`, `state/eventHandler.ts`, `state/events/` | ⚠️ | Auditada 2026-09-05: 4 gaps (skips F5/F6/F7/F10/F11/F3, trigger-order, auto-answers, macros), resto ✅ | 2026-09-05 |
| U12 | Zonas y jugador | `game/PlayAreaPanel.java`, `BattlefieldPanel.java`, `HandPanel.java`, `PlayerPanelExt.java`, `cards/*` | `board/*` (37: `BoardZone`, `HandBar`, `StackZone`, `CommandZone`, `Pile`…) | ⚠️ | Auditada 2026-09-05: 4 gaps (permisos de mano, visores looked-at/companion/sideboard, menú contextual sin cablear, phased-out), resto ✅ | 2026-09-05 |
| U13 | Combate / Maná | `combat/CombatManager.java`, `game/ManaPool.java` | `game/feedbackModes/CombatBar.tsx`, `ManaBar.tsx`, `ResourceBar.tsx` | ✅ | Auditada 2026-09-05: G13-1 cerrado (fix 2026-09-06), resto ✅ | 2026-09-06 |
| U14 | Preguntas al jugador | `dialog/Pick*.java` (5), `ShowCardsDialog.java`, `CustomOptionsDialog.java`, `UserRequestDialog.java`, `game/FeedbackPanel.java`, `components/ability/AbilityPicker.java` | `game/feedback/*`, `game/feedbackModes/*`, `FeedbackDialog.tsx`, `UserRequestDialog.tsx` | ⚠️ | Sin gaps bloqueantes; 6 gaps menores UX (P14-1…P14-6, ver auditoría) | 2026-09-05 |
| U15 | Sistema | `dialog/PreferencesDialog.java`, `DownloadImagesDialog.java`, `GameEndDialog.java`, `AddLandDialog.java`, `CardInfoWindowDialog.java`, `AboutDialog.java`, `WhatsNewDialog.java` | `appearance/AppearanceSettingsModal.tsx`, `lobby/DownloadImagesDialog.tsx`, `game/GameEndDialog.tsx`, `game/HelpWikiModal.tsx` | ❓ | mapeo parcial visible; auditoría pendiente | — |

## Auditorías por unidad

### U14 — Preguntas al jugador (AUDITADA 2026-09-05)

Base web: `feedback/parse.ts` normaliza cada callback a `FeedbackPrompt`
(mode `string|integer|multiString|boolean|uuid|...` + `options/min/max/required/sourceName`);
`feedbackModes/` renderiza (`GenericDialog` genérico + `TargetBar/ManaBar/CombatBar`
dedicados + `MulliganDialog/VotingDialog/UserRequestDialog`).

| Desktop | Web | Estado |
|---|---|---|
| `PickChoiceDialog` básico (lista + Choose/Cancel, `required`, ESC) | `GenericDialog` grid de opciones + `required`/`finishOptionalTarget` | ✅ |
| `message` + `subMessage` (doble cabecera) | `message` + subtítulo `sourceName` (`options.secondMessage`, HTML strip) — `feedback.test.ts:75` | ✅ |
| Búsqueda incremental (filtrado + ↑/↓ + auto-select si queda 1) | Modo `string`: sugerencias filtradas + Enter ✅; grid de opciones: **sin caja de búsqueda** | ⚠️ P14-1 (listas grandes, ej. choose-card-name) |
| Orden custom (`sortData`) | Orden del servidor, sin re-sort | ⚠️ P14-2 menor |
| Hints por ítem (popup carta / tooltip texto / dungeon / game-object al hover) | Etiquetas `FormattedText`; sin preview-on-hover en opciones evidenciado | ⚠️ P14-3 menor |
| Checkbox `special` ("remember choose" — auto-responder igual la próxima vez) | Sin equivalente (`special` web = botón de acción en combat/maná, otro concepto) | ❌ P14-4 menor |
| `startSelectionValue` (preselección) | Sin evidencia | ❌ P14-5 menor |
| Doble-click elige | Single-click; sin auto-single tras filtrar evidenciado | ⚠️ P14-6 menor UX |
| `PickNumberDialog` (spinner min/max, etiqueta límites, flag cancel) | Stepper `integer` + quick Mín/Máx + rango visible (`GenericDialog.tsx:144-203`) | ✅ (supera) |
| `PickMultiNumberDialog` (N spinners) | Modo `multiString` por ítem (`GenericDialog.tsx:205-241`) | ✅ |
| `PickCheckBoxDialog` (multi + search + sort) | `uuid max>1` multi + confirm con contador | ✅ básico; hereda P14-1/P14-2 |
| `PickPileDialog` (dos grids de cartas lado a lado) | Booleano pile1/pile2 con resumen de texto (`parse.ts:172-176`) | ⚠️ funcional, menos visual |
| `ShowCardsDialog` (revelar) | ❓ ver U12 (Thoughtseize interactivo ✅ sugiere cobertura parcial) | ❓ |
| `AbilityPicker` (`GAME_CHOOSE_ABILITY`) | `GenericDialog` kicker ⚡ + `feedback.test.ts` | ✅ |
| `UserRequestDialog` | `UserRequestDialog.tsx` + `missing-prompts.spec.ts` | ✅ |
| `FeedbackPanel/HelperPanel` (Done/Undo) | `ActionButton` + `RollbackDialog` (UNDO testeado, `RollbackDialog.test.tsx:71`) | ✅ |

Evidencia: `feedback.test.ts`, `detect.test.ts`, `FeedbackDialog.test.tsx`,
`RollbackDialog.test.tsx`, `missing-prompts.spec.ts`, `complex-costs.spec.ts`.
Veredicto: **sin gaps bloqueantes** — P14-1…P14-6 son pulido UX, priorizar P14-1
(búsqueda en grid) si aparecen listas largas en juego real.

### U1 · U2 · U9 · U10 · U15 — pendientes (U4/U5/U6/U7 cerradas)

### U11 — Núcleo partida (AUDITADA 2026-09-05)

Base desktop: `GamePanel.java` (tablero + skips F2–F11 + macros + trigger-order +
botones concede/replay) · `FeedbackPanel.java` (OK/Undo/Special, coloreado por fase) ·
`HelperPanel.java` (auto-answers, aviso sonoro) · `GamePane.java` (modos show/watch/replay).
Base web: `GameScreen.tsx` + `ActionButton/PriorityOrb` + `RollbackDialog` + `GameEndDialog`.

| Desktop | Web | Estado |
|---|---|---|
| Skips F4/F9 one-shot (pasar turno / hasta mi turno) | `Pasar ▾` + teclas F4/F9 (`skips.ts`, `PassMenu.tsx`) | ✅ |
| Skips F5 (hasta end step), F7 (hasta próxima main), F10 (saltar pila), F11 (end previo a mi turno), F3 (cancelar skips), F2 (confirmar) + botones con borde activo. Sin F6: el propio desktop lo tiene desactivado (`GamePanel.java:2897-2904`) | `Pasar ▾` split-button (`ActionButton` + `PassMenu`: 6 skips + F3 cancela solo con skip activo) + atajos F4/F5/F7/F9/F10/F11/F3 (`GameScreen.tsx`); skip activo con borde dorado + sublabel `skip_active_to` leído de los flags `passed*` del contrato; `e2e/skips.spec.ts` dual (fake: teclas+clics+DOM; real local: ok proxy a las 7 acciones + eco `passedAllTurns` + limpieza F3). Nota: F10 con pila vacía es no-op en el servidor (`PlayerImpl`) | ✅ G11-1 cerrado 2026-09-05 |
| Trigger order: menú first/last/name + prefs `TRIGGER_AUTO_ORDER_*` | Diálogo dedicado `TriggerOrderDialog` (ruta `isTriggerOrder` en `FeedbackDialog`): 1 fila por trigger (arte+regla) con Elegir + ⏫/⏬ por carta o por texto + alcance carta/texto + ↺ reset; `sendTriggerAutoOrder` en `commands.ts`; proxy convierte data String→UUID en `TRIGGER_AUTO_ORDER_ABILITY_*` (`JsonArgs.parseActionData`, `JsonArgsTest` 5); reset también en `GameMenu` ⋯ | ✅ G11-2 cerrado 2026-09-05 |
| Auto-answers (reemplazos, yes/no por texto) `automaticConfirmsMenu` | Solo-cliente (sin servidor): reglas `{texto→Sí/No}` en `game/autoAnswers.ts` (match exacto normalizado), persistidas `mage-web-auto-answers` vía slice `settings`; intercepción en `prompts.ts handleGameAsk` (nunca mulligan/voting/starting, rastro `auto:` en log); creación con checkbox en `GenericDialog` boolean; gestión en `GameMenu` ⋯ (lista+badge+✕+borrar todas) | ✅ G11-3 cerrado 2026-09-05 |
| Macros `T` (grabar/repetir) | Sin equivalente | ❌ G11-4 menor |
| Concede game/match, stop watching, hold priority Ctrl+click, rollback votado 0-3, Undo (solo con pila vacía) | `concedeGame/concedeMatch/stopWatching`, hold-priority, `RollbackDialog`, UNDO (menú ⋯ `GameMenu` + `state/actions`) | ✅ |
| Replay (play/next/prev/skip10/stop) | Replay viewer (`TournamentPanel`, F5) | ✅ |
| Reloj chess + aviso <5min + sonido si app inactiva | Timer prioridad + buffer en header + `timer-low` + tick ≤10s (`GameScreen/PlayerInfoBar`) | ✅ |
| Coloreado feedback por fase, textos fase/paso/turno, GUI scale | `ActionButton` por estados + `PhaseBar` + `uiScale`/sleeves | ✅ |
| Fin partida auto-cierre 8s | `GameEndDialog` manual (decisión UX, no gap) | — |
| Cheat solo testMode | Sin equivalente (solo dev; no aplica a release) | — |

Veredicto: ~~priorizar **G11-1** (skips), luego G11-2/G11-3. G11-4 menor.~~ **G11-1 cerrado 2026-09-05** (skips + rediseño pantalla: `GameMenu`, `PassMenu`, header de estado); **G11-2 cerrado 2026-09-05** (diálogo trigger order); **G11-3 cerrado 2026-09-05** (auto-respuestas solo-cliente); queda G11-4 menor.

### U12 — Zonas y jugador (AUDITADA 2026-09-05)

Base desktop: `PlayAreaPanel.java` (menú contextual jugador: skips/maná/concede/visores/permisos) ·
`BattlefieldPanel.java` (render + `phasedIn` + sonidos invocación/muerte) ·
`HandPanel.java` · `PlayerPanelExt.java` (avatar targeteable, bordes estado, pool maná,
cementerio/exilio jugables, contadores) · `CardInfoWindowDialog` (cementerio/exilio/reveal/
looked-at/companion/top-library/sideboard) · `GamePanel#displayStack/showRevealed`.

| Desktop | Web | Estado |
|---|---|---|
| Tablero por jugador, layouts 1v1/pod/arena/espectador, agrupación tierras, auras/mutate anidadas, overlay derrotado, anillo orden, switcher con orden | `board/*` (37 ficheros): `GameBoard/PodBoard/ArenaBoard` sobre `BoardShell+BoardZone`, `HandBar/HandZone`, `CommandZone`, `PileOverlay`, `TurnOrderRing`, `OpponentSwitcherBar` | ✅ (supera en layouts) |
| Bordes estado jugador (verde/rojo/amarillo: prioridad/turno/target) + avatar targeteable | Glow prioridad + glow turno `is-turn` + etiqueta (`PlayerInfoBar`) + click target en barra | ✅ |
| Pool maná en panel jugador + cementerio/exilio resaltados si jugables | `ResourceBar` (desglose WUBRGC + dot jugable) + `CrossZoneOverlay` | ✅ |
| Contadores (vida/veneno/energía/exp/rad/ticket + counts biblioteca/cementerio/exilio/mano) | `PlayerInfoBar` + `ResourceBar` | ✅ |
| Stack con orden invertido + activar/targetear en pila | `StackZone` (rail #N, tipos, controlador, resolver) + auto-pestaña | ✅ |
| Permisos de mano: pedir/ver/autorizar/revocar + Switch Hands (Mindslaver) | Solo se muestra lo enviado (`revealed/opponentHands/watchedHands`); grep `PERMISSION_TO_SEE|SWITCH_HAND` → 0 | ❌ G12-1 (multi/Commander) |
| Visores: looked-at, companion dedicada, top-library, sideboard solo-ver | `PileOverlay` cubre cementerio/exilio/biblioteca (+carta top 👁️); **visor de mano rival** (`HandViewer`: conocidas + dorsos, 👁️ solo si hay algo que ver, clicable para Thoughtseize); looked-at/companion/sideboard sin ventana | ⚠️ G12-2 (parcial, mano ✅ 2026-09-05) |
| Menú contextual botón derecho sobre jugador | `ContextMenu.tsx` + `CARD_CONTEXT_ITEMS` definidos pero **jamás renderizados** (grep uso → 0) | ⚠️ G12-3 (cablear) |
| Filtro `phasedIn` (oculta faseados) | `phasedIn` existe en contrato (`types.generated.ts:165`) pero nada lo lee | ❌ G12-4 menor (verificar visual) |
| Hover carta grande, flechas targeting/combate, sonidos tablero | `FloatingCardPreview` + `CombatArrowsOverlay` + 15 sfx | ✅ |

Veredicto: priorizar **G12-1** (permisos mano), luego G12-2/G12-3. G12-4 menor.

### U13 — Combate / Maná (AUDITADA 2026-09-05)

Base desktop: `CombatManager.java` (flechas atacante→defensor rojo/gris si bloqueado,
bloqueadora→atacante azul, sonidos, show/hide) · `PlayerPanelExt#btnManaActionPerformed`
(pago manual por color) + `ManaPool.java` legacy · prefs auto-pay/restricted/first-ability/
confirm-empty-pool.

| Desktop | Web | Estado |
|---|---|---|
| Declarar atacantes/bloqueadores + `Atacar con todo` + confirmar | `CombatBar` + selección en campo + `ActionButton` (`combat*.spec.ts` ✅) | ✅ |
| Flechas combate con colores por estado | `CombatArrowsOverlay` (roja/cian, curva SVG) | ✅ |
| Pago manual por color WUBRG+C | `ManaBar` (botones pool + special + cancelar) + clicks en tablero en modo maná (`complex-costs.spec.ts` ✅) | ✅ |
| Prefs auto-pago on/off, restringido (no usar flotante), primera habilidad al girar, confirmar vaciar pool | Sección *"Pago de maná"* en `GameMenu` ⋯ (3 checks = `PlayAreaPanel.java:227-274` + confirmar pool); toggles 1-3 → `sendPlayerAction` (`MANA_AUTO_PAYMENT_*`, `USE_FIRST_MANA_ABILITY_*`, `data=null`) + re-emisión al `GAME_INIT`; confirmar pool → `updatePreferences {confirmEmptyManaPool}` (vive en `UserData`, aplica en vivo vía `update()` in-place; el servidor pregunta con `GAME_ASK` en `HumanPlayer.passWithManaPoolCheck`); pips del pool propio clicables → `sendPlayerManaType` | ✅ G13-1 cerrado 2026-09-05 (fix 2026-09-06: eliminado diálogo local duplicado, la confirmación la emite el servidor) |
| Highlight cementerio/exilio jugables | Dot jugable + cross-zone (`ResourceBar`) | ✅ |

Veredicto: un solo gap, **G13-1** (prefs maná en ajustes + respetarlas en `ManaBar`).

### U3 — Crear mesa (AUDITADA 2026-09-04, CERRADA 2026-09-06)

Ver `lobby_roadmap.md` §F (tablas F1–F10, U1–U8 + delta 2026-09-06). F6 emblemas declarado fuera de alcance.

### U4 — Unirse / Espera / Staging (AUDITADA 2026-09-06, CERRADA)

Base desktop: `JoinTableDialog.java` (158 lín., nombre bloqueado, mazo `.dck`+Generate, password recordada, skill oculto=1, sin validación, bypass torneo limitado sin password) · `TableWaitingDialog.java` (461 lín., roster Seat/Loc/Name/Rating/Type/History, Move Up/Down dueño en READY, Start dueño en READY, chat por mesa, polling 1 s + sonidos, sin ready-toggle, sin cambio de mazo, sin kick).
Base web: `JoinTableDialog.tsx` (galería+import+pre-validación `validateDeck`) · `SpectatorStagingScreen.tsx` (modos player/spectator, toggle Listo, cambio de mazo en vivo, re-entrada "Ir a la mesa").

| Desktop | Web | Estado |
|---|---|---|
| Join: nombre fijo, skill 1, HUMAN fijo, sin validación | Idéntico + pre-validación viva del mazo | ✅ (supera) |
| Join: password siempre visible + recordada | Solo si `passworded`, sin caché | ⚠️ U4-2 menor (stretch) |
| Join: mazo `.dck` + Generate | Galería + import inline | ✅ (Generate cae en U8) |
| Join: bypass torneo limitado sin password | `isDirectTournamentJoin` en `lobbyUtils` + `joinTournamentDirect` | ✅ U4-4 cerrado 2026-09-06 |
| Espera: roster con Rating/History/Loc | Rating (limited?limited:constructed) + history + `CountryFlag` por asiento (`RankBadge` compact) | ✅ U4-7 cerrado 2026-09-06 (ratings añadidos al contrato `SeatView`) |
| Espera: Move Up/Down (`swapSeats`, dueño, READY) | Acción proxy `swapSeats` + botones ↑/↓ por asiento ocupado | ✅ U4-8 cerrado 2026-09-06 |
| Espera: Start dueño en READY, sin ready-toggle | Start habilitado en READY; sin readys → `confirm` (aviso, no bloqueo) | ✅ U4-9 cerrado 2026-09-06 (decisión: no bloquear) |
| Espera: `startTournament` en torneo | Acción proxy `startTournament`; `startStagedMatch` elige por `isTournament`/`flag` de `JOINED_TABLE` | ✅ U4-10 cerrado 2026-09-06 |
| Espera: chat por mesa | Chat propio de la mesa en la sala (`tableChatId` + `joinChat` al entrar, `leaveChat` al salir; `ChatBox` con `chatIdOverride`; marcas Listo van a la mesa) | ✅ U4-11 cerrado 2026-09-07 (proxy `getTableChatId` + inyección `chatId` en `CHATMESSAGE`, veredicto: el `ChatMessage` real no trae chatId — solo el `objectId` del envelope) |
| Espera: polling + sonidos join/leave/start | Broadcast lobby, sin sonidos | ⚠️ U4-12 menor (stretch) |
| Espera: sin cambio de mazo, sin kick | Cambio de mazo en vivo (dueño recrea con confirm) | ✅ (supera; kick tampoco existe en desktop) |

Evidencia: `Mage.Proxy/TableStagingCommandsTest.java` 7/7 + `SpectatorStagingScreen.test.tsx` 17/17 + `lobbyUtils.test.ts` 4/4 + `staging.spec.ts` 8/8 + `staging-chat.spec.ts` 2/2 fake (swap round-trip, confirm accept/dismiss, bypass torneo, chat de mesa + marcas Listo).

### U8 — Generador mazos (gap confirmado)

Sin equivalente web. Decidir: implementar (nueva feature) o declarar fuera de alcance.

### U7 — Import / Export / Sample (AUDITADA 2026-09-07, CERRADA)

Base desktop: `DeckImportClipboardDialog.java` (ejemplos MTGO/MTGA-moxfield-archidekt, pre-relleno con portapapeles, botón Pegar, detección `MtgaImporter.isMTGA`, modos nuevo/añadir) · `DeckExportClipboardDialog.java` (combo 4 formatos `DeckFormats`: dck/dck_info/dek/mtga + preview + copiar) · `DeckImporter.getDeckImporter` (9 ext: dec/mwdeck/txt/dck/dek/cod/o8d/json/draft/mtga) · `TxtDeckImporter` (switch a banquillo por primera línea vacía, `SB:`, comentarios `#` deckstats, ignora categorías) · `MtgaImporter` (Commander/Maybeboard→banquillo) · `MWSDeckImporter` (`N [SET] Nombre`) · `DraftLogImporter` (`------ SET ------` + `--> pick`) · `MtgjsonDeckImporter` (`data.mainBoard/sideBoard/commander`) · exportadores sin cabeceras, ext `.mtga`.
Base web: `DeckImportModal.tsx` (modos añadir/reemplazar, drag&drop, badge live) + `parseDck.ts` (`parseAnyDeck`) + `downloadDeckFile` (descarga Y copia) + `SampleHandModal` + `onlineDeckService` (URLs).

| Desktop | Web | Estado |
|---|---|---|
| Fichero 9 ext + clipboard nuevo/añadir + botón Pegar SO | Modal añadir/reemplazar + pickers 10 ext (U7-4: +`.mtga/.mwdeck/.draft/.json`) + botón pegar-portapapeles `readText` con fallback (U7-5) + drag&drop | ✅ |
| Detección MTGA-vs-texto, errores en diálogo, auto-fix fichero | Parseo uniforme por contenido + badge live + normalización básicas | ✅ equivalente |
| `.draft` log → principal con set | `parseDraftLog` (agrupa picks, setCode por sección) | ✅ U7-1 |
| mtgjson `.json` (commander→banquillo) | `parseMtgjson` (commander→principal en cabeza, U7-6; `.json` en galería desambigua backup vs mazo) | ✅ U7-2 |
| `.mwdeck` `N [SET] Nombre`, `SB:`, `//` | Variante bracket + `SB:` + `//` + comentarios `#` (U7-3) | ✅ |
| `.txt` switch banquillo por línea vacía | `hasExplicitSideboardMark` + primera línea vacía (U7-3; reimporta bien el propio `.dek`; tolera `Sideboard (15)` y categorías `Creatures (10)`) | ✅ |
| `Commander/Maybeboard`→banquillo | Commander→principal **en cabeza** (=`coverCard`→zona 👑, la web SÍ muestra zona y el desktop no) + Maybeboard→banquillo (U7-6) | ✅ (divergencia justificada) |
| Sin zona comandante / sin Partner | Banner 1 corona, o 2 con Partner (detección por `keywords`/oráculo, unión de identidad; U7-7) | ✅ (supera; sin mantenimiento manual ante cartas/reglas nuevas) |
| Export fichero dck/dck_info/dek/mtga; export clipboard con preview | Footer dck/arena/txt/dek (descarga+copia) + `.dek` (U6-5); `dck_info` no-aplica; Arena con cabeceras (compatible) | ✅ |
| Import URL / sample hand — no existen | Moxfield/Archidekt por URL, London mulligan + goldfish T1–T3 | ✅ (supera) |

Evidencia: `parseDck.test` +7 (draft, mtgjson, bracket, blank-switch, roundtrip `.dek`, commander/maybeboard, categorías), `deckUtils.test` +2 (partner), `formatRules.test` +1 (unión identidad), `DeckImportModal.test` +1 (pegado), `decks-gallery.spec` test U7 (commander/maybeboard/`.draft`/botón pegar).

### U6 — Editor mazos (AUDITADA 2026-09-07, CERRADA)

Base desktop: `DeckEditorPanel.java` (1706 lín., modos FREE/LIMITED/SIDEBOARD, botones NEW/Generate/LOAD/Import/SAVE/Export/SUBMIT/Lands/Validate/Exit + timer) · `CardSelector.java` (1686, filtros color/tipo/rareza/set + sintaxis AND + SortBy + Piles + Open Booster) · `DeckArea.java` (2 `DragCardGrid` main/side + card-size) · `DeckLegalityPanel.java` (15 formatos + semáforo + clic-selecciona-ilegales) · `ManaPieChart/ManaBarChart` (4 gráficos) · importers (`dec/mwdeck/txt/dck/dek/cod/o8d/json/draft/mtga`) / exporters (`dck/dck_info/dek/mtga`) · `AddLandDialog` (spinners + Suggest) · `collection/viewer` (MageBook).
Base web: `DeckBuilder.tsx` + `decks/*` (69 ficheros: Scryfall full-syntax, `CurveChart`, `SampleHandModal`, `DeckImportModal`, catálogo meta + Moxfield/Archidekt, validación local + servidor con reparación).

| Desktop | Web | Estado |
|---|---|---|
| Búsqueda AND + `"frase"` + ámbito Names/Types/Rules + Unique | Sintaxis Scryfall (`t:/c:/o:""/pow/set/f:`, 24 keywords, 9 idiomas) | ✅ (supera) |
| Filtros color/tipo/rareza/set + Penny + multiselect | `ArenaFilterBar` (WUBRGC, 8 tipos, CMC, rarezas, keywords, P/T, set + QUICK_SETS) | ✅ |
| SortBy (Type/Cost/Color/Identity/Name/Rarity/Unsorted/EDH) + Piles | Selector 6 órdenes (Coste/Nombre/Rareza/Color/EDHREC/Lanzamiento) + ↑/↓ (`order`+`dir` Scryfall) | ✅ U6-1 (Type/Identity/Unsorted sin soporte servidor — documentado) |
| Vista lista/imágenes + slider tamaño 0.5–2.0x | Grid + tira + lista V/H + preview flotante + slider 90–190px | ✅ U6-1 (slider añadido) |
| Añadir (doble-clic, botones, DnD, SET_NUMBER, Hide/Duplicate) + `Lands...` + Suggest | Click Arena, DnD search→mazo y main↔side, `BasicLandAdder` + auto-reparto | ✅ |
| Contadores main/side, counts por tipo, CMC default | Totales, side n/15, categorías bilingües, ⚠ por carta | ✅ |
| Validate 15 formatos + semáforo + clic-selecciona | 15 formatos (11 + Oathbreaker/PD Commander/Highlander EU/CA) + banner servidor **reparable** | ✅ U6-3 (CanLander puntos y firma Oathbreaker no validables — documentado) |
| Mana Analyser 4 gráficos (pips, básicas, fuentes, distribución) | `CurveChart` + 3 bloques (fuentes tierras/no-tierras, donut 6 básicas + no-básicas, barras apiladas pips×CMC) | ✅ U6-2 (`oracleText` añadido al meta; heurística fuentes documentada en `deckUtils`) |
| Sample hand — no existe | `SampleHandModal` (mano 7, London mulligan, goldfish T1–3) | ✅ (supera) |
| Import 10 formatos + clipboard + drag SO | `.dck`/Arena/txt + **`.dec`(=.txt)/`.dek`(XML MTGO)/`.cod`/`.o8d`** + clipboard + drag + online | ✅ U6-4 (resto `.mwdeck/.draft/.json` → U7) |
| Export `dck/dck_info/dek/mtga` + clipboard | `.dck`/Arena/txt + **`.dek`** + clipboard + backup JSON | ✅ U6-5 (`dck_info` = metadatos internos, no-aplica) |
| Nombre editable, NEW/LOAD/SAVE local | Input nombre + IndexedDB + galería + backup/restore | ✅ |
| `CollectionViewer/MageBook`, Open Booster, Bling, Draft Rating, LAYOUT posicional, Generate | Sin equivalente | — no-aplica (DB local / grid posicional; Generate → U8) |

Evidencia: `scryfallSearch.test` +3 (U6-1, incl. fix doble-fetch pág≥2 con idioma), `deckUtils.test` +2, `CurveChart.test` +1, `formatRules.test` +3, `parseDck.test` +6, `decks-gallery.spec` test U6 (sort/slider/`.cod`/`.dek`), `DeckBuilder.css` 4 botones/fila (el 7º botón rompía el hover del e2e).

## Exclusiones (no aplican al web)

MDI/look&feel/bandeja Swing (`MageJDesktop`, `MageDesktopManager`, `MageTray`,
`MageSynstStyleFactory`); DnD nativo (`CardDraggerGlassPane`, `DragCardSource/Target`);
red RMI (`remote/CallbackClientImpl`, `XmageURLConnection` — sustituido por proxy WS);
`MagePreferences` (en web es `localStorage`); framework de descarga
(`plugins/card/dl/beans`, `dl/sources` — web usa caché HTTP); motor de render
`card/arcane` (web lo sustituye por DOM/Canvas + imágenes; solo el concepto aplica);
diálogos `dialog/Test*` (solo test); constantes/comparadores/layout puros.
