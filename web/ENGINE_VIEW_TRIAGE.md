# Triaje engine→view (campos del motor que no viajan en el DTO)

Registro canónico: `web/src/state/engineViewRegistry.ts`. Guarda: `web/src/state/engineViewCoverage.test.ts`
(vitest: `cd web && npx vitest run src/state/engineViewCoverage.test.ts`) + baseline
`web/fixtures/engine-view-gap.baseline.json`, calculado con `scripts/engine-view-schema.mjs`.

Criterio de trabajo: **cliente remoto contra upstream beta.xmage.today, sin parches de vista nuevos en el fork**.
Si un campo solo existe en `mage.game.*` y no se copia al DTO `mage.view.*`, el cliente no puede mostrarlo;
la decisión documenta si eso es una pérdida aceptada, un duplicado de otro campo que sí viaja, o bookkeeping interno.

## Leyenda

| Decisión | Significado |
| --- | --- |
| `rendered` | El dato llega por otra vía del DTO (p. ej. `rules`, `cardIcons`, `designationNames`) y la UI ya lo pinta. Exige `ref` `ruta:línea` del punto que lo renderiza. |
| `accepted` | Limitación conocida y aceptada (sin canal en el DTO). Exige `causa`; puede llevar `ref` si hay una vía parcial. |
| `bookkeeping` | Estado interno del motor (libro mayor, flags, contadores, configuración) sin valor de render. Exige `causa`. |
| `parser-artifact` | No es un campo real de la clase: el parser de campos recorre clases internas (`MarkedDamageInfo`, `ApprovingObjectResult`, `RollDieResult`). Exige `causa`. |
| `duplicado` | El mismo dato ya viaja en otro campo del DTO. Exige `causa` con el campo alternativo. |

Impacto: `alto` (estado visible sin canal), `medio` (canal parcial), `bajo` (reglas/edge cases), `nulo` (sin pérdida).

Reparto actual: `accepted` 27 · `parser-artifact` 8 · `bookkeeping` 54 · `duplicado` 40 · `rendered` 11 — total 140 campos
(PermanentView 60, PlayerView 53, GameView 27).

## Decisiones por campo

| Vista | Campo | Impacto | Decisión | Causa | Ref |
| --- | --- | --- | --- | --- | --- |
| PermanentView | `abilities` | nulo | accepted | objetos Ability del motor; el texto y los iconos llegan en rules/cardIcons | — |
| PermanentView | `addCounters` | nulo | parser-artifact | campo de la inner class MarkedDamageInfo (PermanentImpl.java:55-66), no de PermanentImpl | — |
| PermanentView | `attachedToZoneChangeCounter` | nulo | bookkeeping | contador interno de zona para efectos de vínculo; la relación visible llega por attachedTo | — |
| PermanentView | `attacking` | nulo | duplicado | el atacante y su defensor llegan en GameView.combat | — |
| PermanentView | `beforeResetControllerId` | nulo | bookkeeping | controlador previo para deshacer efectos de control; no se muestra | — |
| PermanentView | `blocking` | nulo | duplicado | los bloqueos llegan en GameView.combat | — |
| PermanentView | `blockingSet` | nulo | duplicado | los bloqueos llegan en GameView.combat | — |
| PermanentView | `canBeSacrificed` | bajo | accepted | restricción usada por el motor; el server ya filtra las acciones ofrecidas | — |
| PermanentView | `cardType` | nulo | duplicado | los tipos llegan en CardView.cardTypes | — |
| PermanentView | `classLevel` | nulo | rendered | la línea "Class level: N" llega en rules y se parsea | `web/src/board/designations.ts:42` |
| PermanentView | `controlledFromStartOfControllerTurn` | nulo | bookkeeping | marca temporal interna para disparos de "desde el inicio del turno" | — |
| PermanentView | `copyFrom` | nulo | duplicado | la copia se marca con CardView.copy/nameOwner | — |
| PermanentView | `counter` | nulo | parser-artifact | campo de la inner class MarkedDamageInfo (PermanentImpl.java:55-66), no de PermanentImpl | — |
| PermanentView | `createOrder` | nulo | bookkeeping | orden interno de creación de permanentes | — |
| PermanentView | `dealtDamageByThisTurn` | nulo | bookkeeping | registro interno de daño para disparos y condiciones | — |
| PermanentView | `deathtouched` | nulo | bookkeeping | marca interna de daño con toque mortal | — |
| PermanentView | `flipCardName` | nulo | duplicado | el nombre alterno llega en CardView.alternateName (PermanentView.java:81) | — |
| PermanentView | `goadingPlayers` | nulo | rendered | goad llega en cardIcons (OTHER_HAS_RESTRICTIONS) + línea "Goaded by..." en rules | `web/src/board/CardIcons.tsx:27` |
| PermanentView | `harnessed` | nulo | rendered | la línea "{this} is harnessed" llega en rules y se parsea | `web/src/board/designations.ts:44` |
| PermanentView | `indirectPhase` | nulo | bookkeeping | faseo indirecto interno; phasedIn ya se emite | — |
| PermanentView | `info` | nulo | duplicado | sus líneas se funden en CardView.rules | — |
| PermanentView | `leftHalfUnlocked` | bajo | accepted | Room (Duskmourn); el motor solo lo informa por chat (PermanentImpl.java:2336-2364) y el desktop tampoco lo lee | — |
| PermanentView | `legendRuleApplies` | nulo | bookkeeping | excepción a la regla de legendarias; afecta al motor, no al render | — |
| PermanentView | `loyaltyActivationsAvailable` | bajo | accepted | el server ya filtra las habilidades de planeswalker jugables (canPlayObjects) | — |
| PermanentView | `manaCost` | nulo | duplicado | el coste llega en CardView.manaCostLeftStr/manaCostRightStr/manaValue | — |
| PermanentView | `markedDamage` | nulo | bookkeeping | daño marcado por fuente (regeneración); el total llega en damage | — |
| PermanentView | `markedLifelink` | nulo | bookkeeping | registro interno de daño con vínculo vital | — |
| PermanentView | `maxBlockedBy` | bajo | accepted | restricción de bloqueos aplicada por el server; el resultado llega por canBlock/cardIcons | — |
| PermanentView | `maxBlocks` | bajo | accepted | restricción de bloqueos aplicada por el server; el resultado llega por canBlock/cardIcons | — |
| PermanentView | `meldsToCard` | nulo | duplicado | la carta meld resultante llega en CardView.secondCardFace (CardView.java:588) | — |
| PermanentView | `minBlockedBy` | bajo | accepted | restricción de bloqueos aplicada por el server; el resultado llega por canBlock/cardIcons | — |
| PermanentView | `monstrous` | nulo | rendered | la línea "{this} is monstrous" llega en rules y se parsea | `web/src/board/designations.ts:36` |
| PermanentView | `morphCard` | nulo | duplicado | el estado boca abajo llega en CardView.faceDown y PermanentView.morphed | — |
| PermanentView | `mutatedAbilities` | nulo | duplicado | las habilidades de la pila mutate se funden en rules | — |
| PermanentView | `mutations` | nulo | duplicado | la pila mutate llega en PermanentView.mutateView | — |
| PermanentView | `mutationsForView` | nulo | duplicado | la pila mutate llega en PermanentView.mutateView (PermanentView.java:74) | — |
| PermanentView | `nightCard` | nulo | duplicado | el lado noche llega en transformable/secondCardFace | — |
| PermanentView | `objectId` | nulo | duplicado | el id llega en CardView.id | — |
| PermanentView | `originalControllerId` | nulo | bookkeeping | controlador original para efectos de control; no se muestra | — |
| PermanentView | `ownerId` | nulo | duplicado | la propiedad llega por controlledByOwner/nameOwner | — |
| PermanentView | `pairedPermanent` | nulo | duplicado | el vínculo llega en CardView.pairedCard y en la designación "paired" | — |
| PermanentView | `prepared` | nulo | rendered | la línea "Prepared" llega en rules y se parsea | `web/src/board/designations.ts:46` |
| PermanentView | `protectorId` | nulo | rendered | la línea "Protected by ..." llega en rules y se parsea | `web/src/board/designations.ts:47` |
| PermanentView | `prototyped` | nulo | bookkeeping | el server ya aplica las características prototipo; el flag no se muestra | — |
| PermanentView | `renowned` | nulo | rendered | la línea "{this} is renowned" llega en rules y se parsea | `web/src/board/designations.ts:36` |
| PermanentView | `rightHalfUnlocked` | bajo | accepted | Room (Duskmourn); el motor solo lo informa por chat (PermanentImpl.java:2336-2364) y el desktop tampoco lo lee | — |
| PermanentView | `ringBearerFlag` | nulo | rendered | el portador llega en cardIcons (RINGBEARER) y se busca por el campo | `web/src/game/MechanicsTray.tsx:61` |
| PermanentView | `roomWasUnlockedOnCast` | bajo | accepted | Room (Duskmourn); el motor solo lo informa por chat (PermanentImpl.java:2336-2364) y el desktop tampoco lo lee | — |
| PermanentView | `secondSideCard` | nulo | duplicado | la otra cara llega en CardView.secondCardFace | — |
| PermanentView | `solved` | nulo | rendered | la línea "Case is solved" llega en rules y se parsea | `web/src/board/designations.ts:43` |
| PermanentView | `sourceObject` | nulo | parser-artifact | campo de la inner class MarkedDamageInfo (PermanentImpl.java:55-66), no de PermanentImpl | — |
| PermanentView | `spellAbility` | nulo | bookkeeping | la habilidad jugable llega por canPlayObjects/stack | — |
| PermanentView | `subtype` | nulo | duplicado | los subtipos llegan en CardView.subTypes | — |
| PermanentView | `supertype` | nulo | duplicado | los supertipos llegan en CardView.superTypes | — |
| PermanentView | `suspected` | nulo | rendered | la línea "Suspected" llega en rules y se parsea | `web/src/board/designations.ts:40` |
| PermanentView | `text` | nulo | duplicado | el texto llega en CardView.rules | — |
| PermanentView | `timesLoyaltyUsed` | nulo | bookkeeping | contador interno de usos de lealtad | — |
| PermanentView | `topMutation` | nulo | duplicado | la carta superior de la pila mutate llega en PermanentView.mutateView | — |
| PermanentView | `transformCount` | nulo | bookkeeping | contador interno de transformaciones | — |
| PermanentView | `turnsOnBattlefield` | nulo | bookkeeping | contador interno de turnos en el campo de batalla | — |
| PlayerView | `abilities` | medio | accepted | habilidades de jugador (emblemas/efectos); el DTO no tiene canal | — |
| PlayerView | `abort` | nulo | bookkeeping | bandera de aborto del hilo de juego | — |
| PlayerView | `alternativeSourceCosts` | bajo | accepted | la superficie jugable llega por canPlayObjects/GAME_CHOOSE_ABILITY | — |
| PlayerView | `approvingObject` | nulo | parser-artifact | campo de la inner class ApprovingObjectResult (PlayerImpl.java:1512-1514) | — |
| PlayerView | `canGainLife` | bajo | accepted | restricción global (efectos que prohíben ganar vida); sin canal | — |
| PlayerView | `canLoseLife` | bajo | accepted | restricción global (efectos que prohíben perder vida); sin canal | — |
| PlayerView | `canPlotFromTopOfLibrary` | bajo | accepted | la oferta de Plot viaja en canPlayObjects | — |
| PlayerView | `commandersIds` | nulo | duplicado | los comandantes llegan en commandList y en CommanderDamageMatrix | — |
| PlayerView | `dateLastAddedToStack` | nulo | bookkeeping | marca temporal interna de prioridad | — |
| PlayerView | `designations` | nulo | rendered | llegan como designationNames (PlayerView.java:156-158) y se pintan en MechanicsTray/PlayerInfoBar | `web/src/game/MechanicsTray.tsx:142` |
| PlayerView | `draws` | nulo | bookkeeping | bandera interna de robo del turno | — |
| PlayerView | `drawsFromBottom` | bajo | accepted | política de robo (formato); no se muestra | — |
| PlayerView | `drawsOnOpponentsTurn` | bajo | accepted | política de robo (formato); no se muestra | — |
| PlayerView | `hand` | nulo | duplicado | la mano llega en myHand/opponentHands/handCount | — |
| PlayerView | `human` | nulo | duplicado | isHuman | — |
| PlayerView | `idleTimeout` | nulo | duplicado | el tiempo visible es priorityTimeLeftSecs | — |
| PlayerView | `inRange` | bajo | accepted | rango de influencia multijugador; el desktop tampoco lo muestra | — |
| PlayerView | `isFastFailInTestMode` | nulo | bookkeeping | flag de modo test | — |
| PlayerView | `isGameUnderControl` | nulo | bookkeeping | el control se deriva en web/src/state/control.ts (opponentHands) | — |
| PlayerView | `isTestMode` | nulo | bookkeeping | flag de modo test | — |
| PlayerView | `justActivatedType` | nulo | bookkeeping | tipo de la última habilidad activada (interno) | — |
| PlayerView | `landsPerTurn` | bajo | accepted | límite de tierras por turno; sin canal | — |
| PlayerView | `landsPlayed` | bajo | accepted | tierras jugadas este turno; sin canal | — |
| PlayerView | `left` | nulo | duplicado | hasLeft | — |
| PlayerView | `library` | nulo | duplicado | libraryCount y topCard (revelado) | — |
| PlayerView | `loseByZeroOrLessLife` | bajo | accepted | regla de derrota por vida 0 o menos; sin canal | — |
| PlayerView | `loses` | nulo | bookkeeping | bandera interna de derrota | — |
| PlayerView | `matchPlayer` | nulo | duplicado | el marcador del match llega en wins/winsNeeded | — |
| PlayerView | `maxAttackedBy` | bajo | accepted | límite de atacantes; el server ya filtra el combate | — |
| PlayerView | `maxHandSize` | bajo | accepted | tamaño máximo de mano (descarte); sin canal | — |
| PlayerView | `modifier` | nulo | parser-artifact | campo de la inner class RollDieResult (PlayerImpl.java:3198-3207) | — |
| PlayerView | `naturalResult` | nulo | parser-artifact | campo de la inner class RollDieResult (PlayerImpl.java:3198-3207) | — |
| PlayerView | `passed` | nulo | duplicado | passedTurn/passedUntilEndOfTurn/passedUntilNextMain/... en PlayerView | — |
| PlayerView | `passedTurnSkipStack` | nulo | bookkeeping | variante interna de pase de prioridad | — |
| PlayerView | `payLifeCostRestrictions` | bajo | accepted | restricciones de pago de vida; el server filtra el pago | — |
| PlayerView | `payManaMode` | nulo | bookkeeping | modo de pago (auto/manual) de la UI; el pago llega por prompts | — |
| PlayerView | `phyrexianColors` | bajo | accepted | superficie de pago pirexiano vía canPlayObjects | — |
| PlayerView | `planarResult` | nulo | parser-artifact | campo de la inner class RollDieResult (PlayerImpl.java:3198-3207) | — |
| PlayerView | `playersUnderYourControl` | nulo | bookkeeping | el control se deriva en web/src/state/control.ts | — |
| PlayerView | `priorityTimeLeft` | nulo | duplicado | priorityTimeLeftSecs | — |
| PlayerView | `quit` | nulo | duplicado | hasLeft | — |
| PlayerView | `range` | bajo | accepted | rango de influencia multijugador; no se muestra | — |
| PlayerView | `reachedNextTurnAfterLeaving` | nulo | bookkeeping | marca interna para reincorporación a la partida | — |
| PlayerView | `skippedAtLeastOnce` | nulo | bookkeeping | marca interna de turnos saltados | — |
| PlayerView | `speed` | medio | accepted | nivel 1-4 no emitido por upstream; la presencia llega vía designationNames y se pinta | `web/src/game/PlayerInfoBar.tsx:201` |
| PlayerView | `status` | nulo | parser-artifact | campo de la inner class ApprovingObjectResult (PlayerImpl.java:1506-1514) | — |
| PlayerView | `storedBookmark` | nulo | duplicado | statesSavedSize | — |
| PlayerView | `timerTimeout` | nulo | duplicado | los badges de timer se derivan de timerActive/priorityTimeLeftSecs | — |
| PlayerView | `topCardRevealed` | nulo | duplicado | topCard | — |
| PlayerView | `turnController` | nulo | bookkeeping | el control de turno se deriva en web/src/state/control.ts | — |
| PlayerView | `turnControllers` | nulo | bookkeeping | el control de turno se deriva en web/src/state/control.ts | — |
| PlayerView | `turns` | nulo | bookkeeping | contador interno de turnos del jugador | — |
| PlayerView | `usersAllowedToSeeHandCards` | nulo | bookkeeping | visibilidad interna de manos (watching); el server ya filtra opponentHands | — |
| GameView | `aiGame` | nulo | bookkeeping | bandera de partida IA vs IA | — |
| GameView | `attackOption` | nulo | bookkeeping | opción de ataque multijugador (config de partida) | — |
| GameView | `checkPlayableState` | nulo | bookkeeping | flag interno de recálculo de jugabilidad | — |
| GameView | `concedingPlayers` | nulo | bookkeeping | cola de concesiones; el efecto llega por hasLeft/GAME_END | — |
| GameView | `endTime` | nulo | bookkeeping | marca temporal de fin; no se muestra | — |
| GameView | `enterWithCounters` | nulo | bookkeeping | contadores de entrada; el resultado llega en counters | — |
| GameView | `gameCards` | nulo | bookkeeping | registro interno de cartas del motor | — |
| GameView | `gameIndex` | nulo | bookkeeping | índice de la partida en el match; el marcador llega en wins/winsNeeded | — |
| GameView | `gameOptions` | nulo | bookkeeping | bolsa de opciones del motor; la UI usa la superficie ya expuesta | — |
| GameView | `gameStopped` | nulo | bookkeeping | flag interno de partida detenida | — |
| GameView | `id` | nulo | duplicado | el gameId llega en GAME_INIT/GAME_UPDATE del proxy | — |
| GameView | `meldCards` | nulo | bookkeeping | registro interno de cartas meld | — |
| GameView | `minimumDeckSize` | nulo | bookkeeping | configuración de mazo mínimo; no se muestra | — |
| GameView | `mulligan` | nulo | bookkeeping | estado del mulligan; la decisión llega por prompt | — |
| GameView | `range` | bajo | accepted | rango de influencia multijugador (config); no se muestra | — |
| GameView | `ready` | nulo | bookkeeping | flag interno de partida lista | — |
| GameView | `saveGame` | nulo | bookkeeping | bandera de guardado; no se muestra | — |
| GameView | `scopeRelevant` | nulo | bookkeeping | caché interna de objetos relevantes | — |
| GameView | `simulation` | nulo | bookkeeping | flag de partida de simulación | — |
| GameView | `startMessage` | nulo | duplicado | se emite como status event al arrancar (GameImpl.java:1258) | — |
| GameView | `startTime` | nulo | bookkeeping | marca temporal de inicio; no se muestra | — |
| GameView | `startingHandSize` | nulo | bookkeeping | configuración inicial; no se muestra tras el arranque | — |
| GameView | `startingLife` | nulo | bookkeeping | la vida actual llega en PlayerView.life | — |
| GameView | `startingPlayerId` | nulo | duplicado | quién empieza se deduce de activePlayerId/turn | — |
| GameView | `state` | nulo | bookkeeping | máquina de estados interna; phase/step/turn ya se emiten | — |
| GameView | `tableId` | nulo | duplicado | el tableId lo gestiona el proxy/lobby (TableClientMessage.tableId) | — |
| GameView | `winnerId` | nulo | duplicado | el ganador llega por el evento de fin de partida (GAME_END) | — |

## Casos notables

- **Speed (nivel)**: el motor guarda el nivel 1-4 en `PlayerImpl.speed`, pero no lo emite; la *presencia* de la
  designación Speed sí llega vía `designationNames` y se pinta en `PlayerInfoBar.tsx:201`. Aceptado sin parche de vista.
- **Rooms (Duskmourn)**: `leftHalfUnlocked` / `rightHalfUnlocked` / `roomWasUnlockedOnCast` solo se comunican por
  chat (`PermanentImpl.java:2336-2364`); el cliente desktop tampoco los lee. Aceptado.
- **Parser-artifacts**: `PermanentImpl.addCounters` / `counter` / `sourceObject` son campos de la inner class
  `MarkedDamageInfo`; `PlayerImpl.approvingObject` / `status` de `ApprovingObjectResult`; `modifier` /
  `naturalResult` / `planarResult` de `RollDieResult`. No son estado de la instancia de `PermanentImpl`/`PlayerImpl`.
- **Duplicados vivos**: `hand`→`myHand`/`opponentHands`/`handCount`; `left`/`quit`→`hasLeft`;
  `priorityTimeLeft`→`priorityTimeLeftSecs`; `objectId`→`id`; `cardType`→`cardTypes`; `attacking`/`blocking`→`GameView.combat`;
  `designations`→`designationNames`; `ringBearerFlag`→`cardIcons` RINGBEARER.
- **Los 5 gaps declarados** (`KNOWN_DISPLAYABLE_GAPS` en la guarda): 4 se renderizan
  (`goadingPlayers` vía restricts de `cardIcons`; `harnessed`, `monstrous`, `renowned` vía `rules` parseado en
  `designations.ts`) y `PlayerView.abilities` queda aceptado (emblemas/efectos sin canal).

## Mantenimiento

Si un cambio de upstream añade o quita campos al gap, `engineViewCoverage.test.ts` falla y obliga a triar:
añade/actualiza la fila aquí y en `web/src/state/engineViewRegistry.ts`, o regenera el baseline con
`node scripts/engine-view-schema.mjs --update-baseline` si el cambio es esperado.
