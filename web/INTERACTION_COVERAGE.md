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
| `START_TOURNAMENT` | ❌ (Slice B) | — | — | — | 2026-08-24 |
| `TOURNAMENT_INIT` | ❌ (Slice B) | — | — | — | 2026-08-24 |
| `TOURNAMENT_UPDATE` | ❌ (Slice B) | — | — | — | 2026-08-24 |
| `TOURNAMENT_OVER` | ❌ (Slice B) | — | — | — | 2026-08-24 |
| `START_DRAFT` | ❌ (Slice A) | — | — | — | 2026-08-24 |
| `SIDEBOARD` | ✅ | — | ✅ | best-of-3.spec.ts / best-of-5.spec.ts | 2026-08-24 |
| `CONSTRUCT` | ❌ (Slice A) | — | — | — | 2026-08-24 |
| `DRAFT_OVER` | ❌ (Slice A) | — | — | — | 2026-08-24 |
| `DRAFT_INIT` | ❌ (Slice A) | — | — | — | 2026-08-24 |
| `DRAFT_PICK` | ❌ (Slice A) | — | — | — | 2026-08-24 |
| `DRAFT_UPDATE` | ❌ (Slice A) | — | — | — | 2026-08-24 |
| `SHOW_TOURNAMENT` | ❌ (Slice B) | — | — | — | 2026-08-24 |
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
| `REPLAY_GAME` | ❌ (Slice C) | — | — | — | 2026-08-24 |
| `REPLAY_INIT` | ❌ (Slice C) | — | — | — | 2026-08-24 |
| `REPLAY_UPDATE` | ❌ (Slice C) | — | — | — | 2026-08-24 |
| `REPLAY_DONE` | ❌ (Slice C) | — | — | — | 2026-08-24 |

## Catálogo de mecánicas de juego

Enumeración exhaustiva de mecánicas de MTG que el cliente debe soportar, con estado
real auditado en `web/src` (componentes/handlers) y los specs E2E. Cruza con el
blueprint de `ROADMAP.md` §7. Leyenda: ✅ = sí · ⚠️ = parcial · ❌ = no.

**Cobertura automática de campos (reverse-drift):** `web/src/state/mechanicsCoverage.test.ts`
difumina el oráculo `web/fixtures/server-view-schema.json` (generado por
`scripts/view-schema.mjs` desde las clases `mage.view.*` del server) contra los
campos modelados en `contract.schema.json`. Cualquier campo que el server *puede*
emitir y el cliente no modela hace fallar el test. Ejecutado en CI como parte de
`unit`. Tras esto, los únicos campos de carta no modelados eran 16 de datos/ayuda
de render (split-cards, selección, arte) — ya añadidos al contrato y tipos.

**Gap de exposición server (no detectable por el cliente):** algunas mecánicas
existen en el motor XMage pero **no se serializan** en las clases `mage.view.*`
que el proxy reenvía, así que el cliente ni recibe el estado. El detector
reverse-drift NO las captura (no hay campo que emitir) y requieren que el
server/proxy exponga el estado. Ejemplo conocido: **`goad`/`goaded`** — el motor
lleva `goadingPlayers` en `PermanentImpl`, pero `mage.view.PermanentView` no lo
expone, por lo que ni el proxy ni el cliente ven que una criatura está goaded.

### A. Morfologías de carta
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| MDFC / Transform (cara 2) | ✅ | ✅ | `CardPreview.secondCardFace`; `complex-costs.spec.ts` | 2026-08-24 |
| Adventures (modo criatura vs hechizo) | ✅ | ✅ | `complex-costs.spec.ts` | 2026-08-24 |
| Split / Fuse | ✅ | ✅ | `complex-costs.spec.ts` | 2026-08-24 |
| Sagas (badge de capítulo / lore) | ⚠️ | ⚠️ | `CardSlot` renderiza `lore`; sin spec dedicada | 2026-08-24 |
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
| Flying / Deathtouch / Trample / Haste / etc. | ✅ | ⚠️ | `keywordExtractor` + `FloatingCardPreview`; sin spec dedicada | 2026-08-24 |
| Goad (estado "goaded" en criatura) | ❌ | — | Server no expone `goadingPlayers` en `mage.view` (gap de exposición server, ver nota al inicio); el cliente no recibe el estado | 2026-08-25 |

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
| `GAME_CHOOSE_MODE` / `_ONE` / `_CHOICE` / `_ABILITY` / `_PILE` | ✅ | ⚠️ | `feedback.test.ts` (ability/pile/choice) + `complex-costs`; voting sin spec dedicada | 2026-08-24 |
| Voting (Council's judgment, Fact or Fiction) | ⚠️ | ❌ | vía `GAME_CHOOSE_ONE`; sin spec dedicada | 2026-08-24 |

### J. Biblioteca
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Scry / Surveil / Mill | ✅ | ✅ | `keywordExtractor.test.ts` + `mechanics.spec.ts` (`.library-stack.has-top-revealed`) + `LibraryOrderDialog.test.tsx` (scry) | 2026-08-24 |
| Reordenar biblioteca (`GAME_CHOOSE_CARDS_ORDER`) | ✅ | ✅ | `feedback.test.ts` + `LibraryOrderDialog.test.tsx` | 2026-08-24 |

### K. Planeswalkers
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Lealtad (render de badge) | ✅ | ✅ | `mechanics.spec.ts` (`.loyalty-badge`) | 2026-08-24 |
| Activar habilidad de planeswalker | ⚠️ | ⚠️ | vía `GAME_CHOOSE_ABILITY`; sin UI dedicada | 2026-08-24 |

### L. Modos de juego
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Commander (zona / tax / eminence) | ✅ | ✅ | `mechanics.spec.ts` (`.commander-slot`) | 2026-08-24 |
| Two-Headed Giant / multijugador | ❌ | ❌ | solo 1v1 implícito; sin soporte | 2026-08-24 |

### M. Miscelánea
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Concede / rendirse | ✅ | ✅ | `concedeGame` en `actions.ts` + `concede.spec.ts` (fake) + `concede.test.ts` | 2026-08-24 |
| Mulligan / Keep (auto) | ✅ | ✅ | UI dedicada `MulliganDialog` (`isMulligan`/`isMulliganLondon` en `feedback.ts`); E2E `mulligan.spec.ts` (fake) ejercita la ventana con mano en abanico + London-bottom (`shots/mulligan-01-window.png`) | 2026-08-24 |
| Sideboard (Bo3 / Bo5) | ✅ | ✅ | `SIDEBOARD` + `best-of-3.spec.ts` / `best-of-5.spec.ts` | 2026-08-24 |
| Replay viewer | ❌ | ❌ | Slice C (ver Tabla A) | 2026-08-24 |

## Planes enlazados (callbacks ❌)
- **Slice A — Draft / Limited**: `START_DRAFT`, `DRAFT_INIT`, `DRAFT_PICK`, `DRAFT_UPDATE`, `DRAFT_OVER`, `CONSTRUCT`.
- **Slice B — Torneo**: `START_TOURNAMENT`, `TOURNAMENT_INIT`, `TOURNAMENT_UPDATE`, `TOURNAMENT_OVER`, `SHOW_TOURNAMENT`.
- **Slice C — Replay viewer**: `REPLAY_GAME`, `REPLAY_INIT`, `REPLAY_UPDATE`, `REPLAY_DONE`.
- **Trivial**: `GAME_REDRAW_GUI` (log-only; el tablero ya reacciona a `GAME_UPDATE`).
