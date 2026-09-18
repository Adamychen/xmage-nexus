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
| `JOINED_TABLE` | ✅ | ✅ | ✅ | eventHandler.test.ts / staging.spec.ts · multi-user.spec.ts (real) | 2026-09-06 |
| `START_TOURNAMENT` | ✅ | — | ✅ | tournament.spec.ts / TournamentBracket | 2026-08-26 |
| `TOURNAMENT_INIT` | ✅ | ✅ | ✅ | TournamentBracket.test.tsx / tournament.spec.ts | 2026-08-26 |
| `TOURNAMENT_UPDATE` | ✅ | ✅ | ✅ | TournamentBracket.test.tsx / tournament.spec.ts | 2026-08-26 |
| `TOURNAMENT_OVER` | ✅ | — | ✅ | tournament.spec.ts | 2026-08-26 |
| `START_DRAFT` | ✅ | — | ✅ | draft.spec.ts | 2026-08-26 |
| `SIDEBOARD` | ✅ | — | ✅ | best-of-3.spec.ts / best-of-5.spec.ts | 2026-08-24 |
| `CONSTRUCT` | ✅ | — | ✅ | ConstructScreen / draft.spec.ts | 2026-08-26 |
| `DRAFT_OVER` | ✅ | — | ✅ | draft.spec.ts | 2026-08-26 |
| `DRAFT_INIT` | ✅ | ✅ | ✅ | DraftScreen.test.tsx (recarga en mitad del pick) / draft.spec.ts (fake) / vivo 2026-09-14 (2×HUMAN real, local y beta.xmage.today) / resync por instantánea + `joinDraft` (sin `DRAFT_INIT` del server en join tardío; vivo 2ª recarga `draft-live3-resync.png`) | 2026-09-14 |
| `DRAFT_PICK` | ✅ | ✅ | ✅ | DraftScreen.test.tsx (acuse + espera + anti doble pick) / draft.spec.ts `el pick acusa al instante` / vivo 2026-09-14 (2×HUMAN real en local y beta: espera larga y re-habilitación) | 2026-09-14 |
| `DRAFT_UPDATE` | ✅ | — | ✅ | merge `picking:false` (draft.test.ts) / draft.spec.ts / vivo 2026-09-14 | 2026-09-14 |
| `SHOW_TOURNAMENT` | ✅ | — | ✅ | resolve tableId→tournamentId del watch (lobby) / TournamentBracket; unit store.test + vivo 2026-09-14 | 2026-09-14 |
| `WATCHGAME` | ✅ | — | ✅ | self-test (real) | 2026-08-24 |
| `VIEW_LIMITED_DECK` | ✅ | ✅ | ✅ | eventHandler.test.ts / verify-hand-permission.mjs (real) | 2026-09-08 |
| `VIEW_SIDEBOARD` | ✅ | ✅ | ✅ | eventHandler.test.ts / player-menu.spec.ts / verify-hand-permission.mjs (real) | 2026-09-08 |
| `USER_REQUEST_DIALOG` | ✅ | ✅ | ✅ | eventHandler.test.ts / missing-prompts.spec.ts / UserRequestDialog.test.tsx / verify-hand-permission.mjs (real: permiso de mano) | 2026-09-08 |
| `GAME_REDRAW_GUI` | ➖ fuera de alcance | — | — | Decisión 2026-09-14: log-only permanente; el tablero ya reacciona a `GAME_UPDATE` | 2026-09-14 |
| `START_GAME` | ✅ | — | ✅ | full-flow.spec.ts | 2026-08-24 |
| `GAME_INIT` | ✅ | — | ✅ | full-flow.spec.ts / spells.spec.ts | 2026-08-24 |
| `GAME_UPDATE_AND_INFORM` | ✅ | — | ✅ | (partidas E2E) | 2026-08-24 |
| `GAME_INFORM_PERSONAL` | ✅ | — | — | — | 2026-08-24 |
| `GAME_ERROR` | ✅ | ✅ | — | eventHandler.test.ts | 2026-08-24 |
| `GAME_UPDATE` | ✅ | — | ✅ | (todas las partidas E2E) | 2026-08-24 |
| `GAME_TARGET` | ✅ | ✅ | ✅ | feedback.test.ts / targeting.spec.ts / combat*.spec.ts + en vivo 2026-09-12: Bolt a criatura rival (5 opciones) y GAME_TARGET por bloqueador en gang-block (selfplay-1 + gang-block-1) | 2026-09-12 |
| `GAME_CHOOSE_ABILITY` | ✅ | ✅ | ✅ | feedback.test.ts / complex-costs.spec.ts | 2026-08-24 |
| `GAME_CHOOSE_PILE` | ✅ | ✅ | — | feedback.test.ts + `PileDialog.tsx` (`pile-visual.spec.ts`, `interactions.spec.ts` §3); frame real `recorded/fof.json` (respuesta booleana true=pile1). **Fix 2026-09-16**: el SIM ya separa de verdad con la sobrecarga `Cards` de `fireSelectTargetEvent` (`targets=null`, ids en `options.possibleTargets`; `SimPlayer.onTarget` elige carta por `sendPlayerUUID` y cierra con `sendPlayerBoolean(false)` cuando el server marca "Done") — antes hacía `cancel()` y pile1 quedaba vacía; re-grabado con pile1=[Grizzly Bears] | 2026-09-16 |
| `GAME_CHOOSE_CHOICE` | ✅ | ✅ | — | feedback.test.ts + sort/hints/remember (`choice-memory.spec.ts`) + grid search/Enter (`grid-search.spec.ts`) | 2026-09-08 |
| `GAME_ASK` | ✅ | ✅ | ✅ | feedback.test.ts / spells.spec.ts / combat*.spec.ts | 2026-09-02 |
| `GAME_SELECT` | ✅ | — | ✅ | full-flow.spec.ts / interactions.spec.ts | 2026-08-24 |
| `GAME_PLAY_MANA` | ✅ | — | ✅ | complex-costs.spec.ts / stack-priority.spec.ts / mechanics.spec.ts | 2026-08-24 |
| `GAME_PLAY_XMANA` | ✅ | ✅ | ✅ | feedback.test.ts / missing-prompts.spec.ts | 2026-08-24 |
| `GAME_GET_AMOUNT` | ✅ | ✅ | ✅ | feedback.test.ts / complex-costs.spec.ts | 2026-08-24 |
| `GAME_GET_MULTI_AMOUNT` | ✅ | ✅ | — | feedback.test.ts + en vivo 2026-09-12: reparto de daño de gang-block capturado verbatim (multiString con defaults en orden de declaración, sin prompt de orden previo) | 2026-09-12 |
| `GAME_OVER` | ✅ | — | ✅ | full-flow.spec.ts / defeat.spec.ts | 2026-08-24 |
| `END_GAME_INFO` | ✅ | — | ✅ | best-of-3.spec.ts / best-of-5.spec.ts. **Espectadores 2026-09-17**: el server solo informaba a `getGameSessions()`; parche aditivo en el fork (`GameSessionWatcher.endGameInfo(Table)` + llamada desde `GameController.endGameInfo()`, GameSessionWatcher.java:125-129 / GameController.java:899-901) verificado con `scripts/verify-spectator-end.mjs` (espectador en partida en curso recibe `GameEndView` no nulo con `clientPlayer:null`; el web ya lo maneja en `handleEndGameInfo`) | 2026-09-17 |
| `REPLAY_GAME` | ✅ | — | — | eventHandler `REPLAY_GAME` (log). **En vivo 2026-09-14**: `getFinishedMatches` real devuelve `games:[]` y `replayAvailable:false` (server con `saveGameActivated="false"`; upstream lo marca «not working correctly yet») → el `replayGame` del Historial nunca se dispara con la config por defecto | 2026-09-14 |
| `REPLAY_INIT` | ✅ | — | — | eventHandler `REPLAY_INIT` + replayViewer (pinta el frame en GameScreen vía `{game, phase:'game'}`) | 2026-08-26 |
| `REPLAY_UPDATE` | ✅ | — | — | eventHandler `REPLAY_UPDATE` | 2026-08-26 |
| `REPLAY_DONE` | ✅ | — | — | eventHandler `REPLAY_DONE` (log + `replayViewer.result`; no sale del tablero) | 2026-08-26 |

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
- **Harnessed** (Unfinity): `PermanentImpl.harnessed` — invisible. `HarnessedHint`
  existe pero nada lo adjunta y no hay contadores/iconos: sin señal cliente.
  **Fuera de alcance por decisión (2026-09-14)**: requeriría cambio en el fork
  (adjuntar la hint por carta + rebuild del motor); el proxy no puede inferirlo
  de `rules`/iconos.
- **Soulbond** (pareja) — **visible vía línea `info` + badge (2026-09-08)**: `PermanentImpl.setPairedWith` añade `addInfo("soulbond", "Paired with <nombre>")` en ambas criaturas (y `setUnpaired` la retira); `getRules` la vuelca en `rules`. El web parsea el partner (`pairedPartnerName`) a `.designation-badge.is-paired` con tooltip "Emparejada con X" (i18n ×9). Las stats llegan computadas.
- **Solved** (Casos MKM): `CaseSolvedHint` existe pero está huérfano — nada lo
  adjunta en `CaseAbility`. **Fuera de alcance por decisión (2026-09-14)**:
  requeriría cambio en el fork + rebuild; el proxy no puede inferirlo.
- **Can't be targeted** (criatura y jugador): `canBeTargetedBy` es gate por método,
  no campo — invisible. Aceptado: el servidor rechaza objetivos ilegales.
- **Habilidades de jugador** (hexproof/shroud/daño/vida): `PlayerImpl` sin campo
  `rules`/abilities — invisible. Aceptado (baja frecuencia, el servidor lo impone).
- **Monstrous / Renowned — NO son gaps de campo** (verificado en vivo 2026-09-08):
  `MonstrosityAbility:69` y `RenownAbility:28` adjuntan `MonstrousHint`/`RenownedHint`;
  `ConditionHint` emite siempre una rama en `rules`: `ICON_GOOD{this} is monstrous` /
  `ICON_BAD{this} isn't monstrous` (idem renowned). El web parsea la rama positiva
  (`board/designations.ts`) a badges `.designation-badge` en `CardSlot` (i18n ×9) y
  sustituye `{this}`/`ICON_GOOD|BAD` en `FormattedText` (hover + pila).
- **Suspect — visible vía línea `info` (verificado en código)**: `setSuspected`
  añade `IS_SUSPECTED` ("Suspected (has menace and can't block)") y `getRules`
  vuelca `info.values()` en `rules`; menace llega como habilidad concedida
  (`ApplyStatusEffect`). Badge propio solo-cliente: `cardDesignations` parsea la
  línea a `.designation-badge.is-suspected` (`keywords.spec.ts`, Keyword Beast).
- **ClassLevel — badge solo-cliente**: `ClassLevelHint` (`"Class level: N"`,
  adjunto en `ClassReminderAbility`) parseado a `.designation-badge.is-classlevel`
  con nivel (`Nv. 2`, tooltip `…/3`).
- **Resto del baseline, descartado como bookkeeping o cubierto**: `deathtouched`,
  `markedDamage/markedLifelink`, `dealtDamageByThisTurn` (bookkeeping de combate);
  `attacking/blocking` (vía `gv.combat`), `summoningSickness` (campo propio),
  `flipped/nightCard/morphCard/mutateView` (caras/mutate), `ringBearerFlag`
  (icono RINGBEARER), `maxBlockedBy/minBlockedBy/maxBlocks` (texto estático de la
  carta), `prototyped` (inferible por características), `roomWasUnlockedOnCast`
  (mazmorra interna), `loyaltyActivationsAvailable/canBeSacrificed` (el servidor
  lo impone; se descubre por oferta/rechazo), resto de `PlayerView`/`GameView`
  (timers, zonas ocultas, ids).
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
| Sagas (badge de capítulo / lore) | ✅ | ✅ | `CardSlot` renderiza contador `lore` (📖 + nº de capítulo); `CardSlot.test.tsx` cubre contadores; frame real `recorded/saga.json` (History of Benalia lore:1 + ficha Caballero, driver P4) | 2026-09-16 |
| Clases (Class level) | ✅ | ✅ | El web parsea el hint de `rules` (`CLASS_LEVEL_RE`); frame real `recorded/class-level.json` (Wizard Class a nivel 3: dos clics directos, pagos {U}+{2}{U}+{4}{U}, nivel expuesto solo en `rules`: "Class level: 3"; invariante `hasClassLevel`) | 2026-09-16 |
| Boca abajo (morph / megamorph / manifest / disguise / cloak) | ✅ | ✅ | `CardSlot` usa la cara trasera/placeholder si `faceDown`; frames reales `recorded/morph.json` (Den Protector boca abajo 2/2; el picker de lanzamiento llega como `GAME_CHOOSE_ABILITY`, la habilidad en `canPlayObjects.other`), `recorded/manifest-mechanic.json` (Soul Summons manifiesta un Elite Vanguard boca abajo; girarla boca arriba es clic directo sin picker → `GAME_PLAY_MANA "Pay {W} <face down creature>"`, la habilidad en `canPlayObjects.other`; `TurnFaceUpAbility` NO está en acciones especiales, `sendPlayerString('special')` no vale), `recorded/disguise.json` (Unyielding Gatekeeper con Disguise: 2/2 `faceDown:true` + **`disguised:true`**, nombre "Disguise: …", `manaValue:0`; **ward {2} solo en `rules`**, NO en `cardIcons` [medido]; girar boca arriba por `TurnFaceUpAbility` = mismo camino que manifest; invariante `hasDisguise`) y `recorded/cloak.json` (Vannifar, Evolved Enigma: el trigger **modal llega como `GAME_CHOOSE_ABILITY`** con "1. Cloak a card from your hand."/"2. Put a +1/+1 counter…"/"Cancel" [se responde `sendPlayerUUID`]; la carta de la mano es un `GAME_TARGET "Select a card"` con `targetZone:"HAND"`; resultado: 2/2 boca abajo con **`cloaked:true`** y nombre "Cloak: Grizzly Bears", ward {2} solo en `rules`; invariante `hasCloak`) | 2026-09-16 |
| Battles (cartas batalla) | ✅ | ✅ | `mechanics.spec.ts` (`.defense-badge`) | 2026-08-24 |
| Tokens (Treasure/Food/Clue/Map/Blood) | ✅ | ✅ | `cardImages.tokenScryfallKey` + `gameEventParser` + `mechanics.spec.ts` (render); frame real `recorded/mass-tokens.json` (Krenko, Mob Boss → 51 fichas `Goblin Token` 1/1 `isToken:true`, 103 permanentes en total — el frame más pesado del registro, 811 KB) | 2026-09-16 |

### B. Adjuntos
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Auras / Equipment (render de adjuntos) | ✅ | ✅ | `OpponentZone` (`.attachment-subcard`) + `mechanics.spec.ts` | 2026-08-24 |
| Mutate (apilar bajo/sobre host) | ✅ | ✅ | `PermanentView.mutateView` (MutateView) + `.card-mutate-pile`/`.mutated-badge`/`.mutate-part` en `PlayerZone`/`OpponentZone`; activación vía `canPlayObjects`→`GAME_CHOOSE_ABILITY`; `mutate.spec.ts` (fake) + `OpponentZone.test.tsx` + fixture real `recorded/mutate.json`. **En vivo 2026-09-14 (local, mesa 2×HUMAN `mutate-live-1`, espectada)**: Gemrazer mutado sobre Elvish Mystic con `GAME_ASK` Under/Over; costo de mutate `{1}{G}{G}`; ambas direcciones renderizadas: Over → partes `[Gemrazer, Elvish Mystic]` 4/4, Under → `[Elvish Mystic, Gemrazer]` 1/1 (P/T del top, habilidades del conjunto: RE+TR en ambos). Pila + badge visibles en el observador (spectator) y en el GameView. | 2026-09-14 |

### C. Estados globales y contadores de jugador
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Monarch | ✅ | ✅ | `PlayerInfoBar` + `mechanics.spec.ts` (tab Monarca); frame real `fixtures/recorded/monarch.json` (Palace Sentinels → `players[].monarch:true`; ojo: `designationNames` NO refleja Monarch [designación global del GameState], usar el booleano `players[].monarch`, invariante `hasMonarch`) | 2026-09-16 |
| Initiative / Dungeon | ✅ | ✅ | `CommandZone` + `MechanicsTray`/`DungeonMap` + `mechanics.spec.ts` (Mazmorra). 2026-09-05: mapa ramificado real (`game/dungeons.ts`, grafos 1:1 del servidor incl. salas antes ausentes: Muiral's/Deep Mines/Fungi/Catacombs/Oubliette) + tracking propio vía prompt *"Choose which room to go to in"* (`recordDungeonRoom`) + tracking de TODOS los jugadores vía broadcast del servidor *"X has entered Y (dungeon: Z)"* (`sniffDungeonEntry` en `GAME_UPDATE_AND_INFORM`/`GAME_INFORM_PERSONAL`, clave por jugador); `dungeons.test.ts` + `MechanicsTray.test.tsx`. **Frames reales 2026-09-16**: `recorded/initiative.json` (White Plume Adventurer → **`players[].initiative:boolean`** [PlayerView.java:60/155]; `designationNames` vacío; de paso crea `Undercity` en `commandList` y el venture pide `GAME_TARGET "Select a basic land card"`) y `recorded/dungeon.json` (Find the Path → **dungeon estructurado**: `players[].commandList` con DungeonView `{name,rules}` donde `rules[0]` = `"<i>(Currently in Goblin Lair)</i>"` y salidas con prefijos `ICON_DUNGEON_ROOM_CURRENT/_NEXT`; sin `currentRoom` ni grafo en el wire — el web ya no necesita sniffear para la sala actual; `selectDungeon` = `GAME_CHOOSE_CHOICE` string mode "Choose a dungeon to venture into", sala = `GAME_ASK` "Choose which room to go to in"; invariantes `hasInitiative`/`hasDungeon`) | 2026-09-16 |
| Day / Night | ✅ | ✅ | `PlayerInfoBar` + `MechanicsTray` + `mechanics.spec.ts` (fake); frame real `recorded/day-night.json` (Reckless Stormseeker daybound cheateado en T1 sin hechizos → en el destapado del SIM se hace NOCHE y el DFC transforma en Storm-Charged Slasher). **Hallazgo (2026-09-16)**: el flag day/night **no existe como campo de `GameView`** (`GameState.hasDayNight` no se serializa) ni en `designationNames` (no hay `DesignationType`); la evidencia estructurada es el hint en `rules` del DFC ("It's currently night, active player has cast 0 spells this turn. It will not become day next turn.") y el chat recibe "It has become day/night"; la heurística de `MechanicsTray`/`PlayerInfoBar` que busca 'day'/'night' en `designationNames` **nunca dispara en 1.4.61** → pendiente usar el hint/rules; invariante `hasDayNight` | 2026-09-16 |
| El Anillo (Ring) | ✅ | ✅ | `MechanicsTray` + `mechanics.spec.ts`. **Frame real 2026-09-16** `recorded/the-ring.json` (Call of the Ring): **ni nivel ni portador tienen campo propio** — el nivel es `EmblemView "The Ring".rules.length` en `players[].commandList` (clamp 1..4) y el portador es el permanente con `cardIcons[] {cardIconType:"RINGBEARER",hint:"Ring-bearer"}` (`PermanentView` no expone `isRingBearer`/`ringBearer`); **bug corregido**: `MechanicsTray.findRingBearer` buscaba esos campos inexistentes → ahora resuelve por `cardIcons` con test unit sobre el propio frame (14/14); invariante `hasTheRing` | 2026-09-16 |
| Poison / Energy / Experience / Radiation | ✅ | ✅ | `PlayerInfoBar` badges (`PlayerInfoBar.test.tsx`); frames reales `recorded/energy.json` (Attune with Aether → `PlayerView.counters` `{name:"energy",count:2}`, invariante `hasEnergy`), `recorded/poison.json` (Glistener Elf infect → `{name:"poison",count:1}` con la vida aún a 20, invariante `hasPoison`) y `recorded/radiation.json` (Mariposa Military Base: el contador se llama **`rad`**, no "radiation" [`CounterType.RAD`]; su trigger es **al comienzo de la fase principal precombate de cada jugador** — `RadiationEmblem`, sin tirada de dado: muele N y por cada no-tierra pierde 1 vida y quita 1 rad; en el frame Grizzly+Forest → vida 19 y rad 2→1; el ETB "may" llega como `GAME_ASK`; invariante `hasRadiation`) | 2026-09-16 |
| City's Blessing | ✅ | ✅ | `PlayerInfoBar` (`PlayerInfoBar.test.tsx`) | 2026-08-24 |
| Emblemas de planeswalker | ✅ | ✅ | `mechanics.spec.ts` (`.emblem-slot`) + `CommandZone.tsx` (`.emblem-slot` por `nameLower.startsWith('emblem ')`). **Frame real 2026-09-16** `recorded/emblem.json` (Gideon of the Trials, habilidad 3 del `GAME_CHOOSE_ABILITY`): los emblemas de planeswalker llegan por **`players[].commandList`** como `EmblemView` `{name:"Emblem Gideon",expansionSetCode,rules,…}` (**sin `mageObjectType`**) — `myHelperEmblems` es solo para helper emblems del motor (Radiation/storm/day-night); invariante `hasEmblem` | 2026-09-16 |

### D. Keyword badges
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Flying / Deathtouch / Trample / Haste / etc. | ✅ | ✅ | `CardSlot` badges `.keyword-badges` + `FloatingCardPreview` hover `.floating-card-keywords`; 267 keywords con nombre+resumen ×9 en `i18n.keywords` (`scripts/keywords-i18n/*.mjs` + `gen-keywords-i18n.mjs`, wording oficial verificado vía `printed_text` de Scryfall con `verify-keywords-scryfall.py`); display vía `data/keywordI18n.ts` (plantillas `{param}`, fallback EN); `keywordExtractor.test.ts` + `keywordI18n.test.ts` + `CardSlot.test.tsx` + `FloatingCardPreview.test.tsx` + `keywords.spec.ts` (`@keywords`) / `mechanics.ts` `Keyword Beast` | 2026-09-08 |
| Goad (estado "goaded" en criatura) | ✅ | ✅ | `CardIcons.tsx` renderiza `cardIcons.OTHER_HAS_RESTRICTIONS` (texto "Goaded by X (must attack)" vía `rules`+icono); badge de restricción en `CardSlot` + `keywords.spec.ts`; frame real `fixtures/recorded/goad.json` (Disrupt Decorum goadea al Grizzly del SIM: `cardIcons[].hint` "Goaded by … (must attack)" + `rules` `ICON_REQUIRE…`, invariante `hasGoad`) | 2026-09-16 |
| Hexproof (objetivo no elegible) | ✅ | ✅ | Frame real `fixtures/recorded/hexproof.json`: con Slippery Bogle en el campo rival, el `GAME_TARGET "Select any target"` del Bolt trae SOLO las dos caras (`targets` sin el Bogle; a diferencia de ward, el permanente ni es objetivo legal); el Bolt va a la cara (SIM 17) y el Bogle queda `damage:0` con `rules:["Hexproof"]` (invariante `hasHexproof`) | 2026-09-16 |
| Monstrous / Renowned / Suspected / Paired (designaciones en vivo) | ✅ | ✅ | `board/designations.ts` parsea la hint (`ICON_GOOD{this} is monstrous/renowned`, línea `info` "Suspected (…)", "Paired with X" con partner) a `.designation-badge` en `CardSlot` (i18n `board.designation_*` ×9) + sustitución `{this}`/`ICON_*` en `FormattedText`; `designations.test.ts` + `CardSlot.test.tsx` + `keywords.spec.ts` (Keyword Beast + Consul's Lieutenant) | 2026-09-08 |

### E. Información revelada / Known cards
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Revealed hand / Known Info tray | ✅ | ✅ | `mechanics.spec.ts` (`.opponent-zone [data-card-name="Shock"]`) | 2026-08-24 |

### F. Combate
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Atacar / Bloquear / Multi-bloqueo / Asignación de daño | ✅ | ✅ | `combat.spec.ts`, `combat-human.spec.ts`, `combat-multiblock.spec.ts` | 2026-08-24 |
| Rotación tapped de atacantes (incl. espectador) + nudge de combate | ✅ | ✅ | `combatActorsFrom` deriva atacantes de `game.combat` (funciona sin ventana propia); `combat.spec.ts` aserta `.card-slot.tapped` del atacante del Sim; frame real `fixtures/recorded/combat.json` (invariante `hasAttackingTappedCreature`) confirma `tapped:true` en battlefield y en `combat.attackers` | 2026-08-31 |
| Flechas de combate apuntando al defensor (avatar) | ✅ | ✅ | `CombatArrowsOverlay.getCenter` prefiere `[data-player-anchor]`/elemento más profundo; `CombatArrowsOverlay.test.tsx` (arrows aim at deepest player element) | 2026-08-31 |
| Vigilancia (atacar sin girarse) | ✅ | ✅ | El atacante queda `tapped:false` en el grupo de combate; frame real `fixtures/recorded/vigilance.json` (Vanguard of Brimaz, invariante `hasVigilance`) | 2026-09-16 |
| Daño primero (first strike) | ✅ | ✅ | Frame real `fixtures/recorded/first-strike.json` (el Grizzly Bears bloqueador muere en `FIRST_COMBAT_DAMAGE` y el atacante queda `damage:0`, invariante `hasFirstStrike`); bug corregido: `gameSoundDispatcher` comprobaba `FIRST_STRIKE_DAMAGE` (step inexistente) en vez de `FIRST_COMBAT_DAMAGE` | 2026-09-16 |
| Daño doble (dos pasos de daño) | ✅ | ✅ | Frame real `fixtures/recorded/double-strike.json` (Fencing Ace a la cara: en `FIRST_COMBAT_DAMAGE` el rival ya está a 19 y el atacante `damage:0` con `ABILITY_DOUBLE_STRIKE`; el segundo golpe llega en el paso regular; invariante `hasDoubleStrike`) | 2026-09-16 |
| Ninjutsu (ventana post-bloqueos) | ✅ | ✅ | Frame real `fixtures/recorded/ninjutsu.json` (el Ninja entra girado y atacando devolviendo el atacante a la mano; la habilidad va en `canPlayObjects.other` y con un único atacante legal el motor auto-elige; invariante `hasNinjutsu`) | 2026-09-16 |
| Bloqueo forzado ("debe bloquear", Lure) | ✅ | ✅ | Frame real `fixtures/recorded/must-block.json` (Lure como adjunto real y el bloqueador del SIM forzado por `MustBeBlockedByAllAttachedEffect`; invariante `hasMustBlock`; el replay permite `.card-attachment-group` para este frame) | 2026-09-16 |
| Trample + deathtouch (letal mínimo y exceso) | ✅ | ✅ | Frame real `fixtures/recorded/trample-deathtouch.json` (Elvish Warrior 2/3 + Rancor 4/3 con deathtouch por Basilisk Collar y Lure forzando bloqueo: `GAME_GET_MULTI_AMOUNT` con un único ítem `max:4, defaultValue:1` [letal 1 por deathtouch] → Grizzly muerto, SIM 20→17, lifelink 20→24; invariante `hasTrampleDeathtouch`; el replay permite adjuntos) | 2026-09-16 |
| "No puede bloquear" (restricción de regla) | ✅ | ✅ | Frame real `fixtures/recorded/cant-block.json` (Tormented Soul destapada y única criatura propia; el Grizzly del SIM ataca y por regla la Soul no es elegible como bloqueadora — `rules` "can't block and can't be blocked", icono de restricción, ataque sin bloqueo y vida 20→18; invariante `hasCantBlock`) | 2026-09-16 |
| Atacar a planeswalker o batalla | ✅ | ✅ | Frames reales `fixtures/recorded/attack-pw.json` (Grizzly ataca a Tibalt del SIM: `GAME_TARGET "Select a player, planeswalker, or battle to attack"` con 2 opciones → `sendPlayerUUID` del PW + confirmar con booleano; lealtad 5→3 en `permanent.loyalty` y en `combat[].defenderId`; invariante `hasAttackPlaneswalker`) y `fixtures/recorded/attack-battle.json` (Invasion of Gobakhan {1}{W} Battle—Siege con `startingDefense:"3"`, `defense:"1"` y `counters [{name:"defense",count:1}]`; **hallazgo**: la batalla debe estar en el campo **propio** — `Combat.setDefenders` exige `ProtectedByOpponentPredicate` (protector ∈ oponentes del atacante), y con la batalla propia el protector es el SIM; `combat[].defenderId`/`defenderName` apuntan a la batalla; invariante `hasAttackBattle`) | 2026-09-16 |
| "Ataca cada combate" (must attack) | ✅ | ✅ | Frame real `fixtures/recorded/always-attack.json` (Rubblebelt Recluse del SIM: ataca en `DECLARE_ATTACKERS` [el SIM manda "All attack"], `tapped:true` en `combat[].attackers` y la restricción en `cardIcons[] OTHER_HAS_RESTRICTIONS` con `hint:"Must attack (Rubblebelt Recluse [b22])"` [misma vía que goad: `HintUtils.HINT_ICON_REQUIRE`; `text` vacío]; invariante `hasAlwaysAttack`) | 2026-09-16 |

### G. Stack y prioridad
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Pasar / Hold priority / Stop-until-* | ✅ | ✅ | `stack-priority.spec.ts` (+ `USER_REQUEST_DIALOG` para stop) | 2026-08-24 |
| Pasar prioridad en nombre del jugador controlado (Mindslaver) | ✅ | ✅ | `state/control.ts` (`isControllingPriority`: `opponentHands` + `priorityPlayerName`/`activePlayerName`) habilita `canPass` y el botón (`game.controlling_turn` ×9); guarda en `maybeAutoPass` (`store.test.ts`); `ActionButton.control.test.tsx` + e2e `control.spec.ts` (`@control`, fake, click al botón envía `sendPlayerBoolean`) | 2026-09-17 |
| Orden de triggers (`GAME_TARGET` PICK_ABILITY) | ✅ | ✅ | `TriggerOrderDialog` (Elegir + ⏫/⏬ por carta o texto + reset; `sendTriggerAutoOrder`; proxy String→UUID en ability) + `TriggerOrderDialog.test.tsx` + `trigger-order.spec.ts` (`@triggers`) | 2026-09-05 |
| Auto-respuestas Sí/No (`GAME_ASK` texto exacto) | ✅ | ✅ | Solo-cliente: `autoAnswers.ts` + `prompts.ts handleGameAsk` (excluye mulligan/voting/starting) + checkbox `GenericDialog` + sección `GameMenu` ⋯; `autoAnswers.test.ts` + `prompts.autoAnswers.test.ts` + `auto-answers.spec.ts` (`@autoanswers`) | 2026-09-05 |
| Cascade / Discover | ✅ | ✅ | Frames reales `recorded/cascade.json` (Bloodbraid Elf lanza el Bolt de la cima) y `recorded/discover.json` (Trumpeting Carnosaur: `GAME_ASK "Cast spell without paying its mana cost (Giant Growth [9ab])?"` → sí ⇒ lanzada gratis del exilio con objetivo auto-elegido; las exiliadas restantes van al fondo; invariante `hasDiscover`) | 2026-09-16 |
| Prefs pago de maná (`sendPlayerAction` MANA_*/USE_FIRST_* + `sendPlayerManaType` + `updatePreferences {confirmEmptyManaPool}`) | ✅ | ✅ | `manaPayment.ts` + sección `GameMenu` ⋯ + re-emisión en `GAME_INIT` (`events/game.ts`) + pips clicables (`ResourceBar`/`PlayerResourcePanel`); el confirm lo emite el servidor (`GAME_ASK` en `passWithManaPoolCheck`, se apaga con el flag); `manaPayment.test.ts` + `mana-payment.spec.ts` (`@manapayment`); frame real `fixtures/recorded/floating-mana.json` (Forest activado → `manaPool {green:1}` y al pasar prioridad llega el `GAME_ASK` con el texto exacto `<font color='#D2691E'>You still have mana in your mana pool and it will be lost. Pass anyway?</font>` [requiere `confirmEmptyManaPool=true`, default del proxy]; el frame es el estado inmediatamente posterior con el maná aún en el pool; invariante `hasFloatingMana`) | 2026-09-16 |
| Copiar hechizo (Twincast) | ✅ | ✅ | Frame real `recorded/twincast.json` (Twincast {U}{U} sobre nuestro propio Bolt: el objetivo de la copia se auto-resuelve con un único hechizo en la pila y al crearla llega `GAME_ASK "Change this 1 of 1 target: <sim>?"` — `StackObjectImpl.chooseNewTarget`; false mantiene el objetivo; resuelven copia y original, SIM 20→14; invariante `hasTwincastCopy`) | 2026-09-16 |
| Ward (pagar y NO pagar) | ✅ | ✅ | Frame real `recorded/ward-no-pay.json` (Bolt al Thornfist Striker, Ward {1}: el trigger pregunta `"Pay {1}?"` — `chooseUse`, SIN la palabra "ward"; false ⇒ contrarrestado por reglas: Thornfist vivo y `damage:0`); **corrección 2026-09-16**: Sythis, Harvest's Hand NO tiene Ward en el fork y el viejo `recorded/ward.json` es un Bolt normal matándolo | 2026-09-16 |

### H. Maná y costes
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Pago estándar / X-cost | ✅ | ✅ | `complex-costs`, `stack-priority`, `mechanics` | 2026-08-24 |
| Maná Pirexiano ({U/P}) | ✅ | ✅ | `complex-costs.spec.ts` | 2026-08-24 |
| Kicker / Strive | ✅ | ✅ | `complex-costs.spec.ts`; frame real `recorded/kicker.json` (Bushwhacker con kicker {R} pagado vía `GAME_ASK`, driver P4) | 2026-09-16 |
| Convoke / Improvise | ✅ | ✅ | `complex-costs.spec.ts` (Chord of Calling); frames reales `recorded/convoke.json` (3 Mystics girados) y `recorded/improvise.json` (Reverse Engineer {3}{U}{U} con 3 Islas: el botón especial abre `GAME_CHOOSE_ABILITY` con la `ImproviseSpecialAction` y los giros llegan como `GAME_TARGET "Select artifact to tap as Improvise's pay (selected N of 3, min 1)"`; las Islas van primero porque tras improvise el motor bloquea más habilidades de maná) | 2026-09-16 |
| Delve / Overload / Evoke / Dash / Emerge (costes alternativos) | ✅ | ✅ | `complex-costs.spec.ts`; frames reales `recorded/delve.json` (Treasure Cruise por delve), `recorded/overload.json` (Cyclonic Rift {6}{U}), `recorded/evoke.json` (Solitude), `recorded/dash.json` (Lightning Berserker; el chooser llega como `GAME_CHOOSE_CHOICE` con keyChoices "Cast with Dash alternative cost…"/"Cast with no alternative cost…", entra con prisa — `rules` Haste + `summoningSickness:false`; invariante `hasDash`) y `recorded/emerge.json` (Wretched Gryff por Emerge {5}{U} sacrificando al Grizzly, reducción por MV {5}{U}→{3}{U}) | 2026-09-16 |
| Maná híbrido ({G/W}) | ✅ | ✅ | `complex-costs.spec.ts`; frame real `recorded/hybrid.json` (Kitchen Finks 3/2 pagado con Bosques — sin pregunta de color, driver P4) | 2026-09-16 |
| Maná de cualquier color (Birds / Treasure) | ✅ | ✅ | `complex-costs.spec.ts`; frame real `recorded/anycolor.json` (Birds paga el {U} de Opt; el servidor auto-resuelve el color con un solo color pagable, driver P4) | 2026-09-16 |
| Reducción de coste (Goblin Electromancer) | ✅ | ✅ | Frame real `recorded/reduce-cost.json` (Lightning Strike {1}{R} pagado con {R}: el `GAME_PLAY_MANA` pide ya el coste reducido y las 3 tierras quedan giradas para Electromancer+Strike; invariante `hasReduceCost`) | 2026-09-16 |

### I. Elecciones modales / Voting
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| `GAME_CHOOSE_MODE` / `_ONE` / `_CHOICE` / `_ABILITY` / `_PILE` | ✅ | ✅ | `VotingDialog.tsx` + `feedback.test.ts` (ability/pile/choice) + `missing-prompts.spec.ts` + `voting.spec.ts` (`@voting`) `GAME_ASK` con `isVoting` + `complex-costs.spec.ts` + `grid-search.spec.ts` / `choice-memory.spec.ts` / `pile-visual.spec.ts` (`@feedback`) | 2026-09-08 |
| Nombrar carta / elegir tipo con lista larga y búsqueda | ✅ | ✅ | `GAME_CHOOSE_CHOICE` en modo string (`choice.choices` con ~25k nombres para Pithing Needle: el hook recibe `opts=[]` porque la lista NO va en `keyChoices`) y en modo clave (`ChoiceCreatureType` de Cavern: 396 `keyChoices` con relevance-sort tipo "Elf (me)"); frames reales `recorded/pithing-needle.json` y `recorded/cavern.json` (el resultado queda en `rules` como "Chosen name:/type: …") | 2026-09-16 |
| Voting (Council's judgment, Fact or Fiction) | ✅ | ✅ | `VotingDialog.tsx` dedicado (`🗳️ VOTACIÓN`, step `1/2`, `GAME_ASK` `isVoting` → `boolean`); `feedback.test.ts` (`isVoting`) + `VotingDialog.test.tsx` + `voting.spec.ts` (`@voting`) `fixtures/scenarios/voting.ts` | 2026-08-26 |
| Elegir color / número | ✅ | ✅ | Frame real `fixtures/recorded/choice-color.json` (Story Circle + Sanctum Prelate): **en 1.4.61 NO existen los callbacks `GAME_CHOOSE_COLOR`/`GAME_CHOOSE_NUMBER`** (verificado en `ClientCallbackMethod`; el manejo del web es legado/fake): el color llega como `GAME_CHOOSE_CHOICE` en string mode con `ChoiceColor` (`choice.choices=[White…Green]`, `keyChoices` vacío) → `sendPlayerString "Red"`, y el número como `GAME_GET_AMOUNT` (`min:0, max:INT_MAX`) → `sendPlayerInteger 3`; el resultado queda en `rules` ("Chosen color: Red" / "Chosen Number: 3", invariante `hasChoiceColorOrNumber`) | 2026-09-16 |

### J. Biblioteca
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Scry / Surveil / Mill | ✅ | ✅ | `keywordExtractor.test.ts` + `mechanics.spec.ts` (`.library-stack.has-top-revealed`) + `LibraryOrderDialog.test.tsx` (scry); frames reales `recorded/scry.json` (Opt: TARGET "PUT on the BOTTOM (Scry)") y `recorded/surveil.json` (Consider: TARGET "PUT into your GRAVEYARD (Surveil)", misma forma con filtro distinto) | 2026-09-16 |
| Reordenar biblioteca (`GAME_CHOOSE_CARDS_ORDER`) | ✅ | ✅ | `feedback.test.ts` + `LibraryOrderDialog.test.tsx` | 2026-08-24 |
| Mirar N y ordenar (Brainstorm) | ✅ | ✅ | Frame real `recorded/brainstorm-order.json`: el orden NO usa `GAME_CHOOSE_CARDS_ORDER`; son DOS `GAME_TARGET "Select a card"` secuenciales con los ids de la mano en `data.targets` (uno por carta, cada elección va arriba al instante); el orden se prueba encadenando el robo de Opt (invariante `hasBrainstorm`) | 2026-09-16 |
| Mirar N y ordenar (Ponder) | ✅ | ✅ | Frame real `recorded/ponder.json`: el mismo patrón de TARGETs secuenciales con "Select a card ORDER to put on the TOP of your library (last one chosen will be topmost)" (miradas en `cardsView1`, jugables en `options.possibleTargets`), después `GAME_ASK "Shuffle your library?"` → NO; orden probado con doble robo (Ponder roba Grizzly, el siguiente robo natural trae Forest; invariante `hasPonder`) | 2026-09-16 |
| Selección de cartas (`GAME_CHOOSE_CARDS`/`GAME_SELECT_CARDS` — tutores, buscar en biblioteca, revelar) en grilla HD | ✅ | ✅ | `FeedbackDialog.test.tsx` enruta a `CardGrid` (buscar, multi-select, `sendPlayerUUID`) | 2026-08-25 |
| Fallar la búsqueda (fail to find) | ❌ | ⚠️ | Frame real `recorded/fail-to-find.json` (Evolving Wilds + declinar): **la vía existe** — `TargetCardInLibrary.setRequired(!filter.hasPredicates())` (regla 701.15b) hace que una búsqueda de básica (`FILTER_CARD_BASIC_LAND`) nazca `required=false`, su `GAME_TARGET` llega con **`flag:false`** y `sendPlayerBoolean(false)` rompe el bucle sin mover carta (biblioteca intacta); `Demonic Tutor` es `FILTER_CARD` sin predicados → `required=true` y por eso re-preguntaba. **Pendiente del web**: `flag` (el `required`) no se usa hoy para ofrecer "fallar la búsqueda" en la UI; invariante `hasFailToFind` | 2026-09-16 |
| Descarte desde mano revelada (Thoughtseize: `GAME_CHOOSE_CARDS`/`GAME_SELECT_TARGETS` con la mano ajena como `cardsView1`) — grilla HD interactiva que envía `sendPlayerUUID` (descarte) | ✅ | ✅ | `reveal.spec.ts` (`@reveal`) + título "Elige una carta para que descarte" en `feedback.test.ts`/`FeedbackDialog.test.tsx` | 2026-08-25 |

### K. Planeswalkers
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Lealtad (render de badge) | ✅ | ✅ | `CardSlot` `.loyalty-badge` + `FloatingCardPreview` `.floating-card-loyalty`; `CardSlot.test.tsx` + `FloatingCardPreview.test.tsx` + `mechanics.spec.ts` (`.loyalty-badge`) | 2026-08-26 |
| Activar habilidad de planeswalker | ✅ | ✅ | `PlaneswalkerAbilityDialog.tsx` dedicado (`✨ PLANESWALKER`, `+2/-3` con `loyaltyDeltas`, `isPlaneswalkerAbility`→`uuid`); `feedback.test.ts` (`loyaltyDeltas`) + `PlaneswalkerAbilityDialog.test.tsx` + `planeswalker.spec.ts` (`@planeswalker`) `fixtures/scenarios/planeswalker.ts`; frame real `recorded/planeswalker.json` (Teferi +1 robar, lealtad 4→5, driver P4) | 2026-09-16 |

### L. Modos de juego
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Commander (zona / tax / eminence / pod 4-max en tablero) | ✅ | ✅ | `PodBoard.tsx` (2x2 clamp 4 SOLO de pintado — el servidor soporta FFA 3-10, `CommanderFreeForAllType.java`) + `TurnOrderRing` + `CommanderDamageMatrix` (`PodBoard.test.tsx` 12) + `CommandZone` ×4. **Frame real 2026-09-16** `recorded/commander-zone.json` (mesa variant "Commander Two Player Duel" + deck con `commanders`): Krenko, Mob Boss vive en `players[].commandList` como `{mageObjectType:"COMMANDER"}` y **el impuesto viaja en su `rules`** — `"<b>Commander</b> 2 times played from the command zone."` (el `castCount` no existe en el wire); el 2º lanzamiento pide `GAME_PLAY_MANA "Pay {2}{R}{R}{2}"` (+{2} literal); el retorno al morir es un **`GAME_ASK`** "Move … to the command zone or leave it in current zone (GRAVEYARD)?" (botones `UI.left/right.btn.text`, `true`=comando); invariante `hasCommanderZone` | 2026-09-16 |
| Draft / Sealed (8-player) | ✅ | ✅ | `DraftScreen.tsx` + `ConstructScreen.tsx` + `DraftScreen.test.tsx` + `draft.spec.ts` (`@draft` 8→4; +acuse de pick/espera) + vivo 2026-09-14 (draft real 2×HUMAN, M21) | 2026-09-14 |
| Torneo Swiss / Bracket | ✅ | ✅ | `TournamentBracket.tsx` + `TournamentPanel.tsx` + `TournamentBracket.test.tsx` + `tournament.spec.ts` | 2026-08-26 |
| Two-Headed Giant / multijugador | ✅ | ✅ | `TwoHeadedBoard` (`PodBoard`) 2×2 pod — clamp 4 solo de pintado web (el servidor XMage soporta FFA 3-10) | 2026-08-26 |

### M. Miscelánea
| Mecánica | Implementado | Testeado | Ref | Última verif. |
|---|---|---|---|---|
| Concede / rendirse | ✅ | ✅ | `concedeGame` en `actions.ts` + `concede.spec.ts` (fake) + `concede.test.ts`. **Conceder durante el mulligan (frame real 2026-09-16 `recorded/concede-mulligan.json`)**: el server **sí lo honra** (`GameImpl.setConcedingPlayer` usa `state.getChoosingPlayerId()` → `signalPlayerConcede` → `checkConcede→leave→end`; `players[].hasLeft:true` en ~3 ms); **gap de UI**: el `MulliganDialog` no ofrece Conceder y su backdrop tapa el menú ⋯; ese fin de partida emite `phase`/`step`/`activePlayerId` a `null` — contrato ampliado a nullable (2026-09-16) y smoke de replay admite frames de fin sin cartas; invariante `hasConcedeMulligan` | 2026-09-16 |
| Reiniciar la partida (Karn Liberated) | ✅ | ✅ | Frame real `recorded/karn-restart.json` (Karn con 6 contadores vía cheatSetup, +4 → 10 → 14 y −14): **el reinicio llega SOLO como `GAME_UPDATE`** — mismo `gameId`, sin `GAME_INIT` nuevo ni `GAME_OVER` (`KarnLiberatedEffect` → `clearOnGameRestart` + `Player.init/useDeck` + `game.start(null)`), con el `GAME_ASK` de mulligan de nuevo; frame: turno 1 con el dueño de Karn activo, manos 7/7, bibliotecas 53/93, mesa/cementerio/pila vacíos y Karn barajado; las cartas exiliadas con Karn no se recolocan de forma fiable [run con `exiles` vacío vs 1 Forest del SIM] → la UI no debe fiarse; el web se re-inicializa (GAME_INIT-like handling) — invariante `hasKarnRestart` | 2026-09-16 |
| Elegir quién empieza | ✅ | ✅ | Frame real `recorded/starting-player.json` (con `skipStartingPlayerChoice:false` el servidor sortea y **solo el ganador** recibe `GAME_TARGET "Select a starting player"` con `targets=[SIM,yo]` y `flag:true` → `sendPlayerUUID`; si gana el SIM su `ComputerPlayer.makeChoice` se elige a sí mismo sin prompt; `startResponseIdleTimeout` hasta responder; el web ya traduce el prompt [serverMessageTranslation] y lo auto-resuelve con auto-keep; invariante `hasStartingPlayerChoice`) | 2026-09-16 |
| Ganar/perder por efecto (fin de partida) | ✅ | ✅ | Frame real `fixtures/recorded/win-effect.json` (Approach of the Second Sun ×2: 1ª +7 vidas [27], 2ª gana; `GAME_OVER "… is the winner"`); **hallazgo**: el estado de victoria solo llega en `GAME_UPDATE` PLANO (GameView aplanado en `data`, sin clave `gameView`) y en `GAME_OVER` — `rec-lib` ampliado para capturarlos; invariante `hasWinEffect` | 2026-09-16 |
| Contadores de permanente (stun, oil, …) | ✅ | ✅ | `CardSlot` pinta `permanent.counters`; frame real `fixtures/recorded/stun-oil.json` (Incubation Sac `counters {name:"oil",count:3}` + Grizzly del SIM girado con `{name:"stun",count:1}`; hallazgos: Rime Chill en 1.4.61 es vivid `{6}{U}` "hasta dos" y vivid cuenta 1 color → "Pay {5}{U}"); invariante `hasStunOil` | 2026-09-16 |
| Dados / moneda (d20, flip) | ⚠️ | ✅ | Frame real `fixtures/recorded/coin-dice.json`: Tavern Swindler (`{T}, Pay 3 life`) → `GAME_ASK "Heads or tails?"` y vida 17/23; Recruitment Drive d20 → fichas. **Hallazgo de contrato**: dado/moneda NO son eventos estructurados (ningún campo en `GameView`); el resultado viaja solo como texto al chat de partida y el web lo pinta por `CHATMESSAGE` → `addLog` (fila A); el frame solo asertará el efecto; invariante `hasCoinDice` | 2026-09-16 |
| Phasing (permanente faseado) | ✅ | ✅ | `BoardZone` oculta los permanentes con `phasedIn:false` (el PlayerView no los filtra); frame real `fixtures/recorded/phasing.json` (Reality Ripple sobre Runeclaw Bear: sigue en el battlefield con `phasedIn:false`, invariante `hasPhasing`) | 2026-09-16 |
| Intercambio de control (Switcheroo) | ✅ | ✅ | Frame real `fixtures/recorded/switcheroo.json` (Switcheroo {4}{U} con exactamente 2 criaturas legales se AUTO-elige [sin GAME_TARGET]: mi Grizzly pasa al SIM y su Elvish Mystic al mío; `controllerName`/zona confirman el volteo; invariante `hasSwitcheroo`) | 2026-09-16 |
| Control total del turno ajeno (Mindslaver): ver/actuar su mano y sus permanentes | ✅ | ✅ | `opponentHands` como indicador (`state/control.ts`, clave presente durante todo el turno aunque su mano esté vacía), Switch Hands en el store (`switchedHandKey`) alimentando la `handBar` del shell (`switchedHandCards`, botón por portal sobre el abanico), zona del controlado con `playableIds`/combate (`handleCardClick`) y su mano clicable; unit `control.test.ts`/`GameBoard.control.test.tsx`/`BoardZone.handSwitch.test.tsx` + e2e `control.spec.ts` (`@control`, incluye combate); **en vivo 2026-09-17**: pase desde el botón (seq 40→41), Switch Hands (mano controlada en la barra) y clic en su Isla jugable (`tapped:true` + `manaPool blue:1`, seq 42→43) | 2026-09-17 |
| Mulligan / Keep (auto) | ✅ | ✅ | UI dedicada `MulliganDialog` (`isMulligan`/`isMulliganLondon` en `feedback.ts`); E2E `mulligan.spec.ts` (fake) ejercita la ventana con mano en abanico + London-bottom (`shots/mulligan-01-window.png`) | 2026-08-24 |
| Sideboard (Bo3 / Bo5) | ✅ | ✅ | `SIDEBOARD` + `best-of-3.spec.ts` / `best-of-5.spec.ts` | 2026-08-24 |
| Replay viewer | ✅ | — | `eventHandler` `REPLAY_*` + `replayViewer` state + `GameScreen` pinta los frames. **Límites (probado en vivo 2026-09-14)**: (1) el server por defecto no guarda replays (`saveGameActivated="false"`), así que `MatchView.games` llega vacío y el botón del Historial no aparece; (2) `replayNext`/`replayPrevious`/`replaySkipForward` existen en `commands.ts` pero **sin UI** (no hay controles de transporte); (3) `REPLAY_DONE` no vuelve al lobby. **APLAZADO por decisión 2026-09-14** (el oficial no guarda replays y el motor upstream lo marca sin arreglar); reactivar si upstream lo soporta | 2026-09-14 |
| Sideboard Arena strips (A+B) | ✅ | ✅ | `ArenaCardStrip` swap + agrupación + drag + preview + `validateDeckForFormat` en `SideboardScreen.tsx:376` | 2026-08-26 |
| Flashback / Jump-start / Suspend / Escape / Foretell / Plot (lanzar desde cementerio o exilio) | ✅ | ✅ | Frames reales `recorded/flashback.json` (Faithless Looting), `recorded/jump-start.json` (Radical Idea; el descarte del coste llega como `GAME_TARGET "Select a card"` con los ids legales en `data.targets`, sin `possibleTargets`), `recorded/suspend.json` (Rift Bolt exiliado con contador `time:1`; la `SpecialAction` de suspend no aparece en `GameView.special` — se clica la carta en mano), `recorded/escape.json` (Phoenix of Ash desde el cementerio; el exilio del coste se auto-elige con exactamente el mínimo legal), `recorded/foretell.json` (Saw It Coming exiliada boca abajo y lanzada después; clicarla dispara `GAME_ASK` "Look at …" → false, mismo turno prohibido) y `recorded/plot.json` (Rictus Robber {3}{B} con Plot {2}{B}: el plot se activa con una **SpecialAction directa sin chooser**, el pago es manual [3 Swamps giradas] y la carta acaba en la zona "Plots of `<jugador>`"; **ojo**: en el exilio llega con `faceDown:false` y `zone:null` [la ocultación al rival es implícita]; el lanzamiento gratis pide `GAME_CHOOSE_ABILITY` con la opción única "Cast … using Plot" y resuelve por `{0}` sin girar tierras; invariante `hasPlot`) | 2026-09-16 |

## Planes enlazados (callbacks ✅)
- **Slice A — Draft / Limited** ✅: `START_DRAFT`, `DRAFT_INIT`, `DRAFT_PICK`, `DRAFT_UPDATE`, `DRAFT_OVER`, `CONSTRUCT` → `DraftScreen`/`ConstructScreen`.
- **Slice B — Torneo** ✅: `START_TOURNAMENT`, `TOURNAMENT_INIT`, `TOURNAMENT_UPDATE`, `TOURNAMENT_OVER`, `SHOW_TOURNAMENT` → `TournamentBracket`/`TournamentPanel`.
- **Slice C — Replay viewer** ⚠️ (solo cliente): `REPLAY_GAME`, `REPLAY_INIT`, `REPLAY_UPDATE`, `REPLAY_DONE` → `replayViewer` + `GameView`. En vivo 2026-09-14 no es verificable de punta a punta: el servidor por defecto lleva `saveGameActivated="false"` → nunca hay `games[]`/`replayAvailable`; y el cliente no tiene controles (siguiente/anterior/skip) ni salida del tablero. **APLAZADO por decisión (2026-09-14)** hasta que el motor lo soporte.
- **Slice D — Sala de espera de jugador** ✅: `JOINED_TABLE` → fase `staging` (`SpectatorStagingScreen mode="player"`), paridad con el `TableWaitingDialog` de desktop: salto automático al crear/unirse, Empezar (dueño+ready), Salir (`leaveTable`), Eliminar mesa (dueño, `removeTable`), toggle Listo/No listo (`staging-toggle-ready` con badges 🟢/🟡 y sincronización reactiva por chat de sala), cambiar baraja en vivo (`staging-change-deck`) y re-entrada "Ir a la mesa" desde la tarjeta (asiento propio o `stagingTableId`). Cierre U4 2026-09-06: reordenar asientos (`swapSeats`, ↑/↓ dueño en READY), bypass de torneo limitado sin password (`joinTournamentTable` directo), `startTournament` en torneo (flag `JOINED_TABLE`→`stagingIsTournament`), start con confirm si falta ready, roster con rating/history/flag. E2E: staging.spec.ts (fake, 8/8) / multi-user.spec.ts (real). Nota desktop: si el join falla tras crear, el dueño limpia con `removeTable` (mismo flujo en `NewTableDialog`).
- **Trivial**: `GAME_REDRAW_GUI` (fuera de alcance por decisión 2026-09-14; log-only permanente, el tablero ya reacciona a `GAME_UPDATE`).
