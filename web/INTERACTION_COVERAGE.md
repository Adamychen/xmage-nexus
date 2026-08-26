# Interaction Coverage — XMage Nexus (Web)

Registro vivo de cobertura de **interacciones de juego**: para cada callback
servidor→cliente y cada interacción especial, si está **implementado** y **probado**
(unit/E2E). Es la fuente que responde "¿lo tenemos cubierto y testeado?".

- **Fuente autoritativa de callbacks**: `Mage.Common/.../ClientCallbackMethod.java`.
- **Guardia automática**: `web/src/state/callbackCoverage.test.ts` (capa `unit`) lee ese
  enum y falla si un callback no tiene `case` en `eventHandler.ts`/`feedback.ts` ni está en
  la allowlist de planificados, y si esta matriz no lista todos los callbacks. Mantiene el
  doc y el código sincronizados (anti-drift).
- **Regla de mantenimiento**: al terminar una tarea, además de `PROJECT.md`, actualiza las
  filas afectadas aquí (marca Manejado/Unit/E2E + `Ref de test` + `Última verif.`).

Leyenda: ✅ = sí · ❌ = no · ⚠️ = parcial/log-only · — = no aplica / sin test dedicado.

## Tabla A — Callbacks servidor→cliente

| Callback | Manejado | Unit | E2E | Ref de test | Última verif. |
|---|---|---|---|---|---|
| `CHATMESSAGE` | ✅ | — | ✅ | chat.spec.ts | 2026-08-24 |
| `SHOW_USERMESSAGE` | ✅ | — | — | — | 2026-08-24 |
| `SERVER_MESSAGE` | ✅ | — | — | — | 2026-08-24 |
| `JOINED_TABLE` | ✅ | — | — | — | 2026-08-24 |
| `START_TOURNAMENT` | ✅ | — | ✅ | tournament.spec.ts / TournamentBracket | 2026-08-26 |
| `TOURNAMENT_INIT` | ✅ | ✅ | ✅ | TournamentBracket.test.tsx / tournament.spec.ts | 2026-08-26 |
| `TOURNAMENT_UPDATE` | ✅ | ✅ | ✅ | TournamentBracket.test.tsx / tournament.spec.ts | 2026-08-26 |
| `TOURNAMENT_OVER` | ✅ | — | ✅ | tournament.spec.ts | 2026-08-26 |
| `START_DRAFT` | ✅ | — | ✅ | draft.spec.ts | 2026-08-26 |
| `SIDEBOARD` | ✅ | — | ✅ | best-of-3.spec.ts / best-of-5.spec.ts | 2026-08-24 |
| `CONSTRUCT` | ✅ | — | ✅ | ConstructScreen / draft.spec.ts | 2026-08-26 |
| `DRAFT_OVER` | ✅ | — | ✅ | draft.spec.ts | 2026-08-26 |
| `DRAFT_INIT` | ✅ | ✅ | ✅ | DraftScreen.test.tsx / draft.spec.ts | 2026-08-26 |
| `DRAFT_PICK` | ✅ | ✅ | ✅ | DraftScreen.test.tsx / draft.spec.ts | 2026-08-26 |
| `DRAFT_UPDATE` | ✅ | — | ✅ | draft.spec.ts | 2026-08-26 |
| `SHOW_TOURNAMENT` | ✅ | — | ✅ | TournamentBracket / tournament.spec.ts | 2026-08-26 |
| `WATCHGAME` | ✅ | — | ✅ | self-test (real) | 2026-08-24 |
| `VIEW_LIMITED_DECK` | ✅ | ✅ | — | eventHandler.test.ts | 2026-08-24 |
| `VIEW_SIDEBOARD` | ✅ | ✅ | — | eventHandler.test.ts | 2026-08-24 |
| `USER_REQUEST_DIALOG` | ✅ | ✅ | ✅ | eventHandler.test.ts / missing-prompts.spec.ts | 2026-08-24 |
| `GAME_REDRAW_GUI` | ⚠️ log-only | — | — | — | 2026-08-24 |
| `START_GAME` | ✅ | — | ✅ | full-flow.spec.ts | 2026-08-24 |
| `GAME_INIT` | ✅ | — | ✅ | full-flow.spec.ts / spells.spec.ts | 2026-08-24 |
| `GAME_UPDATE_AND_INFORM` | ✅ | — | ✅ | (partidas E2E) | 2026-08-24 |
| `GAME_INFORM_PERSONAL` | ✅ | — | — | — | 2026-08-24 |
| `GAME_ERROR` | ✅ | ✅ | — | eventHandler.test.ts | 2026-08-24 |
| `GAME_UPDATE` | ✅ | — | ✅ | (todas las partidas E2E) | 2026-08-24 |
| `GAME_TARGET` | ✅ | — | ✅ | targeting.spec.ts / combat*.spec.ts | 2026-08-24 |
| `GAME_CHOOSE_ABILITY` | ✅ | ✅ | ✅ | feedback.test.ts / complex-costs.spec.ts | 2026-08-24 |
| `GAME_CHOOSE_PILE` | ✅ | ✅ | — | feedback.test.ts | 2026-08-24 |
| `GAME_CHOOSE_CHOICE` | ✅ | ✅ | — | feedback.test.ts | 2026-08-24 |
| `GAME_ASK` | ✅ | — | ✅ | spells.spec.ts / combat*.spec.ts | 2026-08-24 |
| `GAME_SELECT` | ✅ | — | ✅ | full-flow.spec.ts / interactions.spec.ts | 2026-08-24 |
| `GAME_PLAY_MANA` | ✅ | — | ✅ | complex-costs.spec.ts / stack-priority.spec.ts / mechanics.spec.ts | 2026-08-24 |
| `GAME_PLAY_XMANA` | ✅ | ✅ | ✅ | feedback.test.ts / missing-prompts.spec.ts | 2026-08-24 |
| `GAME_GET_AMOUNT` | ✅ | ✅ | ✅ | feedback.test.ts / complex-costs.spec.ts | 2026-08-24 |
| `GAME_GET_MULTI_AMOUNT` | ✅ | ✅ | — | feedback.test.ts | 2026-08-24 |
| `GAME_OVER` | ✅ | — | ✅ | full-flow.spec.ts / defeat.spec.ts | 2026-08-24 |
| `END_GAME_INFO` | ✅ | — | ✅ | best-of-3.spec.ts / best-of-5.spec.ts | 2026-08-24 |
| `REPLAY_GAME` | ✅ | — | — | eventHandler `REPLAY_GAME` (log) | 2026-08-26 |
| `REPLAY_INIT` | ✅ | — | — | eventHandler `REPLAY_INIT` + replayViewer | 2026-08-26 |
| `REPLAY_UPDATE` | ✅ | — | — | eventHandler `REPLAY_UPDATE` | 2026-08-26 |
| `REPLAY_DONE` | ✅ | — | — | eventHandler `REPLAY_DONE` | 2026-08-26 |

## Catálogo de mecánicas de juego

Enumeración exhaustiva de mecánicas de MTG que el cliente debe soportar, con estado
real auditado en `web/src` (componentes/handlers) y los specs E2E. Cruza con el
blueprint de `ROADMAP.md` §7. Leyenda: ✅ = sí · ⚠️ = parcial · ❌ = no.

**Cobertura automática de campos (reverse-drift, server→cliente):** `web/src/state/mechanicsCoverage.test.ts`
difumina el oráculo `web/fixtures/server-view-schema.json` (generado por
`scripts/view-schema.mjs` desde las clases `mage.view.*` del server) contra los
campos modelados en `contract.schema.json`. Cualquier campo que el server *puede*
emitir y el cliente no modela hace fallar el test. Ejecutado en CI como parte de
`unit`. Tras esto, los únicos campos de carta no modelados eran 16 de datos/ayuda
de render (split-cards, selección, arte) — ya añadidos al contrato y tipos.

**Cobertura engine→view (segunda dimensión de drift):** `web/src/state/engineViewCoverage.test.ts`
compara el gap engine→view contra el baseline `web/fixtures/engine-view-gap.baseline.json`
(generado por `scripts/engine-view-schema.mjs`, que calcula los campos de instancia
del motor `mage.game.*` que NO se copian en el DTO `mage.view.*`). Si el gap cambia,
el test falla y obliga a triar el nuevo estado. Esto captura mecánicas cuyo estado
existe en el motor pero el server no lo serializa — invisibles para cualquier cliente
DTO remoto (incluido el cliente Swing remoto). `engine-view-gap.json` lista el gap actual.

**Goad — NO es un gap de campo:** el motor lleva `goadingPlayers` en `PermanentImpl`
(`Mage/.../permanent/PermanentImpl.java:85`), pero la restricción *"Goaded by X (must
attack)"* se añade a `rules` y a un icono `OTHER_HAS_RESTRICTIONS` de `cardIcons`
(`CardView.java:758-773`; `CardIconType.OTHER_HAS_RESTRICTIONS`). El cliente ya
renderiza `rules` y ahora también `cardIcons` (`CardIcons.tsx`), así que goad se
muestra como badge de restricción en el tablero. El campo `goadingPlayers` sigue
ausente en el DTO, pero su información llega por el icono — no requiere cambio del server.

### Gaps de emisión server (engine→view) — requieren cambio upstream del server
Estado del motor que **no se serializa** en `mage.view.*` y por tanto ningún cliente
DTO remoto puede mostrar (lo mismo que el cliente Swing remoto). No arreglables solo
en el cliente; necesitarían que el server oficial expusiera el campo en el DTO.
Rastreados por `engineViewCoverage.test.ts` (baseline `engine-view-gap.baseline.json`).
Lista actual (de `engine-view-gap.json`):
- **Can't be targeted** (criatura y jugador): `PermanentImpl.canBeTargetedBy` / `PlayerImpl`
  (gate por método, no campo) — invisible.
- **Harnessed** (Unfinity): `PermanentImpl.harnessed` — invisible.
- **Monstrous**: `PermanentImpl.monstrous` — invisible.
- **Renowned**: `PermanentImpl.renowned` — invisible.
- **Habilidades de jugador** (hexproof/shroud/can't be dealt damage/can't lose):
  `PlayerImpl` no tiene campo `rules`/abilities — invisible.
- **Day/Night**: el flag de juego no va en `GameView`, pero se infiere vía la carta
  daybound/nightbound en el command zone (`CommandZone.tsx`); por eso aparece como ✅ arriba.

### A. Morfologías de carta
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| MDFC / Transform (cara 2) | ✅ | ✅ | `CardPreview.secondCardFace`; `complex-costs.spec.ts` | 2026-08-24 |
| Adventures (modo criatura vs hechizo) | ✅ | ✅ | `complex-costs.spec.ts` | 2026-08-24 |
| Split / Fuse | ✅ | ✅ | `complex-costs.spec.ts` | 2026-08-24 |
| Sagas (badge de capítulo / lore) | ✅ | ✅ | `CardSlot` renderiza contador `lore` (📖 + nº de capítulo); `CardSlot.test.tsx` cubre contadores | 2026-08-25 |
| Battles (cartas batalla) | ✅ | ✅ | `mechanics.spec.ts` (`.defense-badge`) | 2026-08-24 |
| Tokens (Treasure/Food/Clue/Map/Blood) | ✅ | ✅ | `cardImages.tokenScryfallKey` + `gameEventParser` + `mechanics.spec.ts` (render) | 2026-08-24 |

### B. Adjuntos
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Auras / Equipment (render de adjuntos) | ✅ | ✅ | `OpponentZone` (`.attachment-subcard`) + `mechanics.spec.ts` | 2026-08-24 |
| Mutate (apilar bajo/sobre host) | ✅ | ✅ | `PermanentView.mutateView` (MutateView) + `.card-mutate-pile`/`.mutated-badge`/`.mutate-part` en `PlayerZone`/`OpponentZone`; activación vía `canPlayObjects`→`GAME_CHOOSE_ABILITY`; `mutate.spec.ts` (fake) + `OpponentZone.test.tsx`. **Beta real**: el proxy reenvía `mutateView` por reflexión (sin cambio Java, verificado en código); el render está verificado en fake. El play en vivo contra beta desde el harness está BLOQUEADO por el modelo de sesión del proxy (`Mage.Proxy` rechaza el 2º login con el mismo usuario que la página → el `HumanHelper` no conecta). Falta: permitir la 2ª sesión en el proxy o grabar frames reales para un fixture anti-drift. | 2026-08-25 |

### C. Estados globales y contadores de jugador
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Monarch | ✅ | ✅ | `PlayerInfoBar` + `mechanics.spec.ts` (tab Monarca) | 2026-08-24 |
| Initiative / Dungeon | ✅ | ✅ | `CommandZone` + `MechanicsTray` + `mechanics.spec.ts` (Mazmorra) | 2026-08-24 |
| Day / Night | ✅ | ✅ | `PlayerInfoBar` + `MechanicsTray` + `mechanics.spec.ts` | 2026-08-24 |
| El Anillo (Ring) | ✅ | ✅ | `MechanicsTray` + `mechanics.spec.ts` | 2026-08-24 |
| Poison / Energy / Experience / Radiation | ✅ | ✅ | `PlayerInfoBar` badges (`PlayerInfoBar.test.tsx`) | 2026-08-24 |
| City's Blessing | ✅ | ✅ | `PlayerInfoBar` (`PlayerInfoBar.test.tsx`) | 2026-08-24 |
| Emblemas de planeswalker | ✅ | ✅ | `mechanics.spec.ts` (`.emblem-slot`) | 2026-08-24 |

### D. Keyword badges
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Flying / Deathtouch / Trample / Haste / etc. | ✅ | ✅ | `CardSlot` badges `.keyword-badges` + `FloatingCardPreview` hover `.floating-card-keywords`; `keywordExtractor.test.ts` + `CardSlot.test.tsx` + `FloatingCardPreview.test.tsx` + `keywords.spec.ts` (`@keywords`) / `mechanics.ts` `Keyword Beast` | 2026-08-26 |
| Goad (estado "goaded" en criatura) | ✅ | ✅ | `CardIcons.tsx` renderiza `cardIcons.OTHER_HAS_RESTRICTIONS` (texto "Goaded by X (must attack)" vía `rules`+icono); badge de restricción en `CardSlot` + `keywords.spec.ts` | 2026-08-25 |

### E. Información revelada / Known cards
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Revealed hand / Known Info tray | ✅ | ✅ | `mechanics.spec.ts` (`.opponent-zone [data-card-name="Shock"]`) | 2026-08-24 |

### F. Combate
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Atacar / Bloquear / Multi-bloqueo / Asignación de daño | ✅ | ✅ | `combat.spec.ts`, `combat-human.spec.ts`, `combat-multiblock.spec.ts` | 2026-08-24 |

### G. Stack y prioridad
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Pasar / Hold priority / Stop-until-* | ✅ | ✅ | `stack-priority.spec.ts` (+ `USER_REQUEST_DIALOG` para stop) | 2026-08-24 |

### H. Maná y costes
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Pago estándar / X-cost | ✅ | ✅ | `complex-costs`, `stack-priority`, `mechanics` | 2026-08-24 |
| Maná Pirexiano ({U/P}) | ✅ | ✅ | `complex-costs.spec.ts` | 2026-08-24 |
| Kicker / Strive | ✅ | ✅ | `complex-costs.spec.ts` | 2026-08-24 |
| Convoke / Improvise | ✅ | ✅ | `complex-costs.spec.ts` (Chord of Calling) | 2026-08-24 |

### I. Elecciones modales / Voting
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| `GAME_CHOOSE_MODE` / `_ONE` / `_CHOICE` / `_ABILITY` / `_PILE` | ✅ | ✅ | `VotingDialog.tsx` + `feedback.test.ts` (ability/pile/choice) + `missing-prompts.spec.ts` + `voting.spec.ts` (`@voting`) `GAME_ASK` con `isVoting` + `complex-costs.spec.ts` | 2026-08-26 |
| Voting (Council's judgment, Fact or Fiction) | ✅ | ✅ | `VotingDialog.tsx` dedicado (`🗳️ VOTACIÓN`, step `1/2`, `GAME_ASK` `isVoting` → `boolean`); `feedback.test.ts` (`isVoting`) + `VotingDialog.test.tsx` + `voting.spec.ts` (`@voting`) `fixtures/scenarios/voting.ts` | 2026-08-26 |

### J. Biblioteca
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Scry / Surveil / Mill | ✅ | ✅ | `keywordExtractor.test.ts` + `mechanics.spec.ts` (`.library-stack.has-top-revealed`) + `LibraryOrderDialog.test.tsx` (scry) | 2026-08-24 |
| Reordenar biblioteca (`GAME_CHOOSE_CARDS_ORDER`) | ✅ | ✅ | `feedback.test.ts` + `LibraryOrderDialog.test.tsx` | 2026-08-24 |
| Selección de cartas (`GAME_CHOOSE_CARDS`/`GAME_SELECT_CARDS` — tutores, buscar en biblioteca, revelar) en grilla HD | ✅ | ✅ | `FeedbackDialog.test.tsx` enruta a `CardGrid` (buscar, multi-select, `sendPlayerUUID`) | 2026-08-25 |
| Descarte desde mano revelada (Thoughtseize: `GAME_CHOOSE_CARDS`/`GAME_SELECT_TARGETS` con la mano ajena como `cardsView1`) — grilla HD interactiva que envía `sendPlayerUUID` (descarte) | ✅ | ✅ | `reveal.spec.ts` (`@reveal`) + título "Elige una carta para que descarte" en `feedback.test.ts`/`FeedbackDialog.test.tsx` | 2026-08-25 |

### K. Planeswalkers
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Lealtad (render de badge) | ✅ | ✅ | `CardSlot` `.loyalty-badge` + `FloatingCardPreview` `.floating-card-loyalty`; `CardSlot.test.tsx` + `FloatingCardPreview.test.tsx` + `mechanics.spec.ts` (`.loyalty-badge`) | 2026-08-26 |
| Activar habilidad de planeswalker | ✅ | ✅ | `PlaneswalkerAbilityDialog.tsx` dedicado (`✨ PLANESWALKER`, `+2/-3` con `loyaltyDeltas`, `isPlaneswalkerAbility`→`uuid`); `feedback.test.ts` (`loyaltyDeltas`) + `PlaneswalkerAbilityDialog.test.tsx` + `planeswalker.spec.ts` (`@planeswalker`) `fixtures/scenarios/planeswalker.ts` | 2026-08-26 |

### L. Modos de juego
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Commander (zona / tax / eminence / pod 4-max) | ✅ | ✅ | `PodBoard.tsx` (2x2 clamp 4) + `TurnOrderRing` + `CommanderDamageMatrix` (`PodBoard.test.tsx` 12) + `CommandZone` ×4 | 2026-08-26 |
| Draft / Sealed (8-player) | ✅ | ✅ | `DraftScreen.tsx` + `ConstructScreen.tsx` + `DraftScreen.test.tsx` + `draft.spec.ts` (`@draft` 8→4) | 2026-08-26 |
| Torneo Swiss / Bracket | ✅ | ✅ | `TournamentBracket.tsx` + `TournamentPanel.tsx` + `TournamentBracket.test.tsx` + `tournament.spec.ts` | 2026-08-26 |
| Two-Headed Giant / multijugador | ✅ | ✅ | `TwoHeadedBoard` (`PodBoard`) 2×2 pod — Commander FFA 4-max (XMage no soporta >4) | 2026-08-26 |

### M. Miscelánea
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Concede / rendirse | ✅ | ✅ | `concedeGame` en `actions.ts` + `concede.spec.ts` (fake) + `concede.test.ts` | 2026-08-24 |
| Mulligan / Keep (auto) | ✅ | ✅ | UI dedicada `MulliganDialog` (`isMulligan`/`isMulliganLondon` en `feedback.ts`); E2E `mulligan.spec.ts` (fake) ejercita la ventana con mano en abanico + London-bottom (`shots/mulligan-01-window.png`) | 2026-08-24 |
| Sideboard (Bo3 / Bo5) | ✅ | ✅ | `SIDEBOARD` + `best-of-3.spec.ts` / `best-of-5.spec.ts` | 2026-08-24 |
| Replay viewer | ✅ | — | `eventHandler` `REPLAY_*` + `replayViewer` state | 2026-08-26 |
| Sideboard Arena strips (A+B) | ✅ | ✅ | `ArenaCardStrip` swap + agrupación + drag + preview + `validateDeckForFormat` en `SideboardScreen.tsx:376` | 2026-08-26 |

## Planes enlazados (callbacks ✅)
- **Slice A — Draft / Limited** ✅: `START_DRAFT`, `DRAFT_INIT`, `DRAFT_PICK`, `DRAFT_UPDATE`, `DRAFT_OVER`, `CONSTRUCT` → `DraftScreen`/`ConstructScreen`.
- **Slice B — Torneo** ✅: `START_TOURNAMENT`, `TOURNAMENT_INIT`, `TOURNAMENT_UPDATE`, `TOURNAMENT_OVER`, `SHOW_TOURNAMENT` → `TournamentBracket`/`TournamentPanel`.
- **Slice C — Replay viewer** ✅: `REPLAY_GAME`, `REPLAY_INIT`, `REPLAY_UPDATE`, `REPLAY_DONE` → `replayViewer` + `GameView`.
- **Trivial**: `GAME_REDRAW_GUI` (log-only; el tablero ya reacciona a `GAME_UPDATE`).
