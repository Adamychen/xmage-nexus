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
| U2 | Lobby mesas | `table/TablesPanel.java`, `TablesPane.java`, `TablesTableModel.java`, `MatchesTableModel.java` | `lobby/LobbyScreen.tsx`, `TableCard.tsx`, `TableFilterBar.tsx`, `FinishedMatchesPanel.tsx` | ⚠️ | `content.json`: Table Filters & PM → `no` | 2026-09-05 |
| U3 | Crear mesa | `dialog/NewTableDialog.java`, `table/TablePlayerPanel.java`, `NewPlayerPanel.java` | `lobby/CreateTableDialog.tsx` + `lobby/CreateTable/` | ⚠️ | Auditado en `lobby_roadmap.md` §F; Fases 1–4 pendientes de implementar | 2026-09-04 |
| U4 | Unirse / Espera / Staging | `dialog/JoinTableDialog.java`, `TableWaitingDialog.java` | `lobby/JoinTableDialog.tsx`, `SpectatorStagingScreen.tsx` | ❓ | `JOINED_TABLE` ✅ (`staging.spec.ts`); comparativa fina pendiente | — |
| U5 | Chat | `chat/ChatPanelBasic.java`, `ChatPanelSeparated.java`, `table/PlayersChatPanel.java` | `game/GameChat.tsx`, `lobby/ChatBox.tsx` | ❓ | `CHATMESSAGE` ✅ (`chat.spec.ts`); PM y ventana separada por auditar | — |
| U6 | Editor mazos | `deckeditor/DeckEditorPanel.java`, `CardSelector.java`, `DeckArea.java`, `DeckLegalityPanel.java`, `collection/viewer/` | `decks/DeckBuilder.tsx` + `decks/*` (27 ficheros) | ❓ | Phase 3 done (`content.json`); comparativa fina pendiente | — |
| U7 | Import / Export / Sample | `deckeditor/DeckImportClipboardDialog.java`, `DeckExportClipboardDialog.java` | `decks/DeckImportModal.tsx`, `exportDeckFile.ts`, `SampleHandModal.tsx` | ❓ | export+clipboard ✅ (Phase 3); comparativa fina pendiente | — |
| U8 | Generador mazos | `deck/generator/DeckGenerator*.java` (5), `RatioAdjustingSliderPanel.java` | — (sin equivalente en `web/src`) | ❌ | grep `*generat*deck*|*random*deck*` en `web/src` → 0 resultados | 2026-09-05 |
| U9 | Draft | `draft/DraftPanel.java`, `DraftGrid.java` | `game/DraftScreen.tsx` | ❓ | `DRAFT_*` ✅ (`draft.spec.ts`); comparativa fina pendiente | — |
| U10 | Torneo | `tournament/TournamentPanel.java`, `dialog/NewTournamentDialog.java`, `RandomPacksSelectorDialog.java` | `game/TournamentPanel.tsx`, `lobby/TournamentBracket.tsx`, `TournamentStandings.tsx` | ❓ | `TOURNAMENT_*` ✅ (`tournament.spec.ts`); `RandomPacksSelector` por auditar | — |
| U11 | Núcleo partida | `game/GamePanel.java`, `GamePane.java` | `game/GameScreen.tsx`, `state/eventHandler.ts`, `state/events/` | ❓ | `GAME_*` ✅ (full-flow/spells/targeting); comparativa fina pendiente | — |
| U12 | Zonas y jugador | `game/PlayAreaPanel.java`, `BattlefieldPanel.java`, `HandPanel.java`, `PlayerPanelExt.java`, `cards/*` | `board/*` (37: `BoardZone`, `HandBar`, `StackZone`, `CommandZone`, `Pile`…) | ❓ | board E2E en verde; comparativa fina pendiente | — |
| U13 | Combate / Maná | `combat/CombatManager.java`, `game/ManaPool.java` | `game/feedbackModes/CombatBar.tsx`, `ManaBar.tsx`, `ResourceBar.tsx` | ❓ | `combat*.spec.ts`, `complex-costs.spec.ts` ✅; comparativa fina pendiente | — |
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

### U1 · U2 · U4 · U5 · U6 · U7 · U9 · U10 · U11 · U12 · U13 · U15 — pendientes

### U3 — Crear mesa (auditada, implementación parcial)

Ver `lobby_roadmap.md` §F (tablas F1–F10, U1–U8, plan Fases 1–4).

### U8 — Generador mazos (gap confirmado)

Sin equivalente web. Decidir: implementar (nueva feature) o declarar fuera de alcance.

## Exclusiones (no aplican al web)

MDI/look&feel/bandeja Swing (`MageJDesktop`, `MageDesktopManager`, `MageTray`,
`MageSynstStyleFactory`); DnD nativo (`CardDraggerGlassPane`, `DragCardSource/Target`);
red RMI (`remote/CallbackClientImpl`, `XmageURLConnection` — sustituido por proxy WS);
`MagePreferences` (en web es `localStorage`); framework de descarga
(`plugins/card/dl/beans`, `dl/sources` — web usa caché HTTP); motor de render
`card/arcane` (web lo sustituye por DOM/Canvas + imágenes; solo el concepto aplica);
diálogos `dialog/Test*` (solo test); constantes/comparadores/layout puros.
