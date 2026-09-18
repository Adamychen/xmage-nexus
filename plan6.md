# PLAN-6 — huecos fuera del plan4/plan5: estados de motor sin representar, UI pendiente, deudas del plan2 y drift documental (2026-09-18)

> ESTADO AL CREAR: rama `master`, commit `bda3b7e4372`, árbol limpio (plan5
> cerrado y commiteado en `dd17ed3ddd8` + fix del proxy en `bda3b7e4372`).
> Este plan nace de la pregunta "¿hay algo que no esté contemplado en los
> planes?" y de un rastreo de exclusiones e2e, baselines de guardas,
> `COMPONENT_PARITY.md`, TODOs y roadmap.
>
> **Qué NO es este plan**: no reabre plan4/plan5. Los frentes humanos e
> instalación (plan5 V5–V7 = plan4 §5.2 evaluador 3, §5.3/§5.5/§5.6, §6) y las
> decisiones ya tomadas (P5/P6/CI visual) siguen donde están. Esto es el
> **triage de lo que ninguna guarda, plan ni doc de deuda mira hoy**.
>
> **Naturaleza**: inventario de triage. Cada fila necesita una **decisión**
> (implementar / documentar como aceptado / cerrar). No todas se implementan.

---

## 0.bis. Estado de ejecución (2026-09-18, orquestación multiagente)

> Criterio rector: **trabajar contra upstream `beta.xmage.today`**; sin parches
> de vista nuevos en el fork. Decisiones cerradas en §8.

| WP | Estado | Evidencia |
|---|---|---|
| WP-D (D1–D4 + B3) | ✅ | `AGENTS.md`, `ROADMAP.md`, `web/AGENTS.md`, `INTERACTION_COVERAGE.md` corregidos; `callbackCoverage` verde |
| WP-B1 (fail-to-find) | ✅ | `web/e2e/fail-to-find.spec.ts` (red→green con mutación del `flag`), escenario `required:false`, caso unit `flag:'false'` |
| WP-B2 (day/night) | ✅ | `web/src/board/dayNight.ts` + tests; heurística muerta retirada de `MechanicsTray`/`PlayerInfoBar`/`GameScreen`; `hintRegistry` actualizado |
| WP-G (guarda de causas) | ✅ | `web/src/state/engineViewRegistry.ts` (140/140), `ENGINE_VIEW_TRIAGE.md`, guarda extendida (rojo→verde sobre `PlayerView.speed`) |
| WP-C6 (FloatingChat) | ✅ | `LobbyScreen.css` (panel z-4 / pie z-6 solo con panel abierto; FAB conserva z-60), caso e2e 1000×800 (falla sin el fix) |
| WP-D5 (flakes) | ✅ | `printing-preview` (leave+enter forzado), `auto-pod` (waitForFunction); estrés 4 workers verde |
| WP-A (speed/rooms/A3) | ✅ docs | triage en `ENGINE_VIEW_TRIAGE.md` + filas de `INTERACTION_COVERAGE.md`; nivel de speed no emitido upstream |
| WP-C (C1–C5) | ✅ | C1 pass (submit sideboard UI, biblioteca 54 en game 2), C2 pass (visor de exilio), C3 aceptada con causa (mismo flujo que U5), C4 pass (replay + jugabilidad), C5 pass (staging + bracket en vivo). Evidencia: `docs/qa/p6-live-validations.md` + screenshots en `docs/qa/p6-live-validations/`; filas U4/U5/U10/U11/U12 de `COMPONENT_PARITY.md` |
| F1 (hallazgo WP-C) | ✅ | Tablero congelado en la partida 2 de Bo3: `eventHandler.ts` descartaba el `GAME_INIT` nuevo (guard temprano + `switchingGame` solo eximía `START_GAME`); fix + 3 tests rojo→verde en `store.test.ts`; `best-of-3`/`best-of-5` fake verdes |
| F2 (hallazgo WP-C) | ✅ | Default de `mage_create_tournament_table` cambiado a `Constructed Elimination` (+ descripción); test en `mcp/test/tournament.test.ts`; `mcp` test/typecheck verdes; README del MCP actualizado |

**Cierre (2026-09-18)**: verificación del orquestador sobre árbol congelado —
guardas rojo→verde demostradas (mutación del `flag` en B1, `PlayerView.speed`
en WP-G, CSS de C6 sin el fix, `hand-bar` neutralizado); estrés e2e 4 workers
verde; validaciones C1–C5 con evidencia leída; stack reiniciado y
`node scripts/test.mjs` **9/9** (unit 1870, coverage, typecheck, build, java,
self-test, human-test, e2e 262 passed/4 skipped, i18n);
`mage_validate_generated` al día. Sin commits (el usuario decide).

---

## 0. Diagnóstico: por qué plan4/plan5 no los cazaron

| Guarda / fuente | Qué cubre | Qué NO cubre |
|---|---|---|
| `callbackCoverage` | Todo callback tiene `case` | Contenido del payload |
| `mechanicsCoverage` | Todo campo de `mage.view.*` modelado | Campos que **nunca llegan** al view |
| `engineViewCoverage` | Detecta cambios en el gap engine→view contra un baseline | **El baseline no tiene causa por ítem**: un campo puede quedarse ahí para siempre sin decisión escrita (a diferencia de `hintRegistry`, que sí exige `causa`) |
| `hintCoverage` | Todo hint del motor tiene fila (rendered/known-unrendered + causa) | Estados del motor que **no emiten hint** (p. ej. `speed`, rooms) |
| Frames P4/P5 | Estado real pintado por el web | Estados sin frame (mecánicas recientes no grabadas) |
| `COMPONENT_PARITY.md` | Deudas por unidad (U1–U15) | Las deudas viven en notas de fila; no hay guarda ni plan que las recoja |
| `ROADMAP.md` / `site/content.json` | Dashboard público | `ROADMAP.md` quedó desactualizado respecto a PROJECT/plan4 |

Tres patrones de escape:
1. **Estado de motor que no viaja por ningún canal** (ni campo, ni hint, ni
   `info`, ni chat útil): invisible en web **y** en desktop.
2. **UI pendiente con frame/oráculo ya existente**: el protocolo lo soporta y
   el frame lo demuestra, pero falta el código de UI (nadie lo reclamó).
3. **Validación en vivo heredada del plan2**: quedó anotada en
   `COMPONENT_PARITY.md` y nunca entró en plan4/plan5.

---

## 1. Familia A — estados del motor sin representación

### A1. Velocidad (Aetherdrift, "Start your engines!") — el hueco fuerte

| Evidencia | Detalle |
|---|---|
| Motor | `../xmage-fork/Mage/src/main/java/mage/players/PlayerImpl.java:159` (`speed`), `:4866` `getSpeed()`, `:4872` `initSpeed()` (speed=1 + `addDesignation(new Speed())` + `informPlayers`), `:4882` `increaseSpeed()` (máx 4), `decreaseSpeed()` |
| Designación | `Mage/src/main/java/mage/designations/Speed.java:20` (`DesignationType.SPEED`) con trigger "si un oponente pierde vida en tu turno, +1 velocidad (1/turno, máx 4)" (`:49-98`) y lookup de imagen `XMAGE_IMAGE_NAME_SPEED` |
| Cartas | `StartYourEnginesAbility` (`mage/abilities/keyword/`); p. ej. `Mage.Sets/.../SpikeshellHarrier.java:93-96` lee `Player::getSpeed`, `OutpaceOblivion.java`, `PointTheWay.java` |
| Lo que llega hoy | **Presencia** en `players[].designationNames` (`PlayerView.java:61,157,323` vuelca designaciones) — el nivel **no** |
| Lo que NO llega | `PlayerView` no tiene `speed` (grep vacío); `contract.schema.json` sin `speed`; `hint-schema.json` sin `SpeedHint` (no existe en `abilities/hint/`); `web/src` sin manejo; `Mage.Client` tampoco llama `getSpeed()` → el desktop solo muestra la designación, no el nivel |
| Triage actual | `engine-view-gap.baseline.json:114` lista `speed` en `PlayerView.missing` **sin causa**; ni plan4 ni plan5 ni `INTERACTION_COVERAGE` lo nombran |

**Opciones**: (a) badge de presencia con `designationNames` (solo-cliente, sin
nivel); (b) exponer el nivel (parche aditivo de vista en el fork + contrato +
badge 1–4 + frame `speed.json` con `cheatSetup` de un permanente con start your
engines y pérdida de vida del rival); (c) documentar como aceptado.
Decisión en §8-D1.

### A2. Rooms (Duskmourn) — puertas desbloqueadas

| Evidencia | Detalle |
|---|---|
| Motor | `PermanentImpl.java:2318/2323` (`leftHalfUnlocked`/`rightHalfUnlocked`), `:2331` (`roomWasUnlockedOnCast`), `:2336-2364` `unlockDoor()` → **solo** `game.informPlayers("X unlocked the left door of Y")` + restaura stats/abilities |
| Hints | `RoomAbility.java:23-24` solo texto recordatorio; no hay `RoomHint` ni `addInfo` |
| Lo que llega hoy | La **acción** de desbloquear (habilidad activada ofrecida en `canPlayObjects`) y el cambio de características de la mitad desbloqueada; la línea de chat |
| Lo que NO llega | Qué puerta está desbloqueada (ni view, ni hint, ni desktop: `Mage.Client`/`Mage.Common` no leen los flags) |
| Triage actual | `INTERACTION_COVERAGE.md:135` lo mete en "resto del baseline" y lo llama **"mazmorra interna"** — etiqueta errónea: dungeon (Initiative) y Room (Duskmourn) son mecánicas distintas |

**Opciones**: (a) parche aditivo de vista/hint en el fork + contrato + badge;
(b) documentar como aceptado (el estado se infiere de características + chat);
(c) corregir solo el triage. Decisión en §8-D2.

### A3. Estados de jugador sin triage explícito (catch-all del baseline)

`engine-view-gap.baseline.json:67-123` (PlayerView.missing) y
`INTERACTION_COVERAGE.md:130-138` ("resto de `PlayerView`/`GameView` (timers,
zonas ocultas, ids)") mezclan en un cajón cosas de impacto distinto:

| Campo engine | Impacto de UX | Nota |
|---|---|---|
| `maxHandSize` | "Sin límite de mano" (Reliquary Tower) no se indica | El descarte lo pregunta el servidor |
| `landsPlayed`/`landsPerTurn` | Drops de tierra extra (Azusa/Exploration) no se indican | Las jugables se resaltan |
| `canGainLife`/`canLoseLife`/`payLifeCostRestrictions` | "No puedes ganar/perder vida / pagar vida" (Solemnity, Angel of Jubilation) no se indica | El servidor lo impone |
| `range`/`inRange` | Rango de ataque en FFA no se visualiza | El servidor filtra objetivos legales |
| `phyrexianColors` | K'rrik / maná pirexiano por vida | `canPlayObjects` suele exponerlo |
| `naturalResult`, `storedBookmark`, `approvingObject`, … | Bookkeeping / mecánicas exóticas | Probablemente aceptados |

**Trabajo**: decidir por ítem (mostrar vs aceptar) y escribirlo, en vez del
cajón actual. Decisión en §8-D3.

---

## 2. Familia B — UI pendiente con frame/oráculo ya existente

### B1. "Fallar la búsqueda" (fail to find) en la UI

- `web/INTERACTION_COVERAGE.md:242` lo marca **"Pendiente del web"**: el
  `GAME_TARGET` de una búsqueda con filtro con predicados nace
  `required=false` (`flag:false`), y `sendPlayerBoolean(false)` rompe el bucle
  (regla 701.15b).
- El frame real ya existe: `web/fixtures/recorded/fail-to-find.json` (Evolving
  Wilds) con invariante `hasFailToFind`; documentado en `plan4.md:173`.
- Cliente (verificado en el recon 2026-09-18): el botón **ya existía** —
  `TargetBar.tsx:40-42` y `CardGrid.tsx:142-148` pintan "Terminar" cuando
  `required === false`, y `useFeedbackForm.ts:99-101` envía
  `sendPlayerBoolean(false)`. Lo que faltaba era la **cobertura**: escenario
  fake con `flag:false`, spec e2e, caso unit del `flag` string y corregir el
  doc. Cerrado en WP-B1 (`web/e2e/fail-to-find.spec.ts`; mutación del `flag`
  deja el spec en rojo).

### B2. Indicador day/night pendiente del hint

- `web/INTERACTION_COVERAGE.md:167`: la heurística de `MechanicsTray`/
  `PlayerInfoBar` que busca "day"/"night" en `designationNames` **nunca
  dispara** en 1.4.61; pendiente usar el hint en `rules` del permanente
  daybound/nightbound (que ya se usa en `CommandZone.tsx`, ver `:141-142`).
- Trabajo: leer el hint de `rules` para el indicador global (o retirar la
  heurística muerta y documentar que basta el DFC en la zona de mando), + test.

### B3. "Casos" — línea obsoleta tras el plan5 D2

- `web/INTERACTION_COVERAGE.md:110-111` sigue diciendo que "casos" está fuera
  de alcance "requeriría cambio en el fork; el proxy no puede inferirlo".
- Falso desde plan5 D2: `CaseSolvedHint` ("Case is solved.") se parsea a badge
  `CaseSolved` (registro `hint:CaseSolvedHint` → `rendered`). Solo hay que
  corregir el doc (no requiere trabajo de código).

---

## 3. Familia C — validaciones en vivo heredadas del plan2

Todas viven en `web/COMPONENT_PARITY.md` como notas de fila, sin plan que las
recoja. El harness actual (MCP + web + `mage_submit_deck`) las hace viables.

| # | Validación | Evidencia de la deuda | Trabajo |
|---|---|---|---|
| C1 | **Submit de `SideboardScreen` por UI** (Bo3 real entre partidas) | `COMPONENT_PARITY.md:29` (U4) y `:36` (U11): en vivo se usó WS crudo porque el harness no tenía `submitDeck`; ahora MCP expone `mage_submit_deck` | Bo3 real 2×HUMAN (o HUMAN+SIM): jugar partida 1, abrir sideboard, mover cartas, submit por UI y verificar bibliotecas/partida 2 |
| C2 | **Visor de exilio interactivo** | `COMPONENT_PARITY.md:37,238` (U12): "solo con tests (plan2 A.5)" | Sesión real: exiliar cartas (p. ej. `escape`/`foretell`) y abrir/cerrar el visor, clic en carta |
| C3 | **`UserActionModal` humano↔humano** | `COMPONENT_PARITY.md:37,239` (plan2 A.6); ojo: U5 (`:30`) marca el modal de usuario de chat como ✅ — aclarar alcance real antes | Verificar en vivo 2×HUMAN si el flujo de "acción sobre usuario" tiene camino real distinto del ya cubierto |
| C4 | **Reconexión web mid-game** | `COMPONENT_PARITY.md:36` (U11, plan2 A.7): el harness MCP cubre el resync del proxy, pero la web en vivo no se verificó | Con partida en curso: recargar la pestaña / cortar WS y comprobar replay + banner + jugabilidad |
| C5 | **Staging de torneo + bracket con torneo vivo de 2** | `COMPONENT_PARITY.md:35` (U10, plan2 A.4); el watch en vivo ya se cerró el 2026-09-14 | Torneo real de 2: staging, arranque y cuadro con partida en curso |
| C6 | **`FloatingChat` tapa botones en Mazos** (fix, no validación) | `COMPONENT_PARITY.md:30` (U5, deuda plan2 B.9): z-order `FloatingChat` z-60 vs contenido de `DecksGallery`; repro en plan §4 | Fix de z-order/colapso en la pantalla de Mazos + test de regresión (unit o e2e) |

Nota: A.8 (FFA 3+ en vivo) quedó cubierto por plan4 §3.11 (`pod-combat`,
`commander-4`, `ffa-six`); no entra.

---

## 4. Familia D — drift documental y flakes

| # | Drift | Evidencia | Trabajo |
|---|---|---|---|
| D1 | AGENTS.md afirma que los 2 e2e de `invite-link` siguen excluidos "pendiente de triage" | `web/e2e/known-broken.ts:5-11` (lista **vacía** desde 2026-09-12) y `COMPONENT_PARITY.md:27` (U2: pasan) | Corregir el known-failure de `AGENTS.md` (y el paréntesis viejo del header de `PROJECT.md` que repite "solo quedan 2 tests de deep-links") |
| D2 | `ROADMAP.md` desactualizado vs realidad | `ROADMAP.md:64-66` (paradas ❌, sideboarding ❌, multi-blocker 🟡) y `:69-71` (distribución 🟡, Commander 4P ❌, draft ❌) contra PROJECT/plan4 (todo cerrado) | Re-sincronizar la matriz con `site/content.json` (canónico) o marcar ROADMAP como histórico |
| D3 | `INTERACTION_COVERAGE.md:110-111` "casos fuera de alcance" obsoleto | plan5 D2 (badge `CaseSolved`) | Corregir la fila |
| D4 | `web/AGENTS.md` dice 151 entradas de galería | El builder lee `manifest.json` (115 frames) + prompts + pantallas; el número real lo da el smoke | Actualizar el texto sin fijar número (o "160+") |
| D5 | Flakes e2e de hover bajo carga (`printing-preview`, `auto-pod`) | Fallan en la suite completa (4 workers) y pasan aislados (medido 2026-09-18); precedente de hardening: `decks-gallery` | Endurecer los specs (hover+visible+`dispatchEvent`, patrón ya usado) y estresar con `--repeat-each` |

---

## 5. Guarda propuesta: causas por entrada en el baseline engine→view

`engine-view-gap.baseline.json` es una lista de campos sin causa; `hintRegistry`
ya demostró el patrón bueno (`rendered`/`known-unrendered` + `causa` + guarda).
Propuesta (S, docs + test):

1. Documento `web/ENGINE_VIEW_TRIAGE.md` con una fila por campo del baseline:
   `campo | impacto | decisión (render/aceptado/bookkeeping) | causa | ref`.
2. Extender `engineViewCoverage.test.ts` para exigir que **todo campo del
   baseline tenga fila** (y que no haya filas huérfanas), igual que
   `hintCoverage`.
3. Regenerar el baseline con el fork actual y triar de una pasada (incluye
   `speed`, rooms, A3).

Con esto, el siguiente "speed" que aparezca no se entierra: o se pinta o se
acepta con causa escrita.

---

## 6. Criterios de aprobado

| Área | Umbral |
|---|---|
| Familia A | Cada ítem con decisión escrita y, si es "render", contrato+UI+frame/test verdes |
| Familia B | `flag`/`required` usado en la UI con test; indicador day/night sin heurística muerta; docs corregidos |
| Familia C | Cada validación ejecutada en vivo con evidencia (o degradada a "aceptada" con causa) |
| Familia D | Docs sin afirmaciones falsas; flakes endurecidos con estrés verde |
| Guarda | `engineViewCoverage` falla ante campo sin fila de triage |

---

## 7. Orden de trabajo (work packages)

| WP | Qué | Tamaño | Depende de |
|---|---|---|---|
| WP-D | Barrido documental D1–D4 (AGENTS, ROADMAP, INTERACTION_COVERAGE ×2, web/AGENTS, PROJECT) | S | — |
| WP-B1 | Fail-to-find UI + tests (unit + e2e fake) | S | — |
| WP-B2 | Day/night por hint de `rules` (o retirada de la heurística) + test | S | — |
| WP-G | `ENGINE_VIEW_TRIAGE.md` + guarda de causas + re-triage del baseline | S | — |
| WP-A | Implementar lo decidido en D1/D2/D3 (speed/rooms/estados de jugador) | M | §8-D1..D3 |
| WP-C | Validaciones en vivo C1–C5 (una sesión MCP+web cada una) | M total | stack |
| WP-C6 | Fix `FloatingChat` z-order en Mazos + test | S | — |
| WP-D5 | Hardening de flakes hover (`printing-preview`, `auto-pod`) | S | — |

---

## 8. Decisiones (RESUELTAS 2026-09-18)

> Criterio rector fijado por el usuario: **el objetivo es funcionar contra el
> server real upstream (`beta.xmage.today`); no se añaden parches de vista al
> fork para representar estado que upstream no emite.**

1. **D1 — Speed**: **presencia ya renderizada** vía `designationNames`
   (`PlayerInfoBar.tsx:201-207,452-465`; tab en `MechanicsTray`), el **nivel
   1–4 no lo emite upstream** → `accepted` con causa en
   `web/ENGINE_VIEW_TRIAGE.md` (`PlayerView.speed`) y fila nueva en
   `INTERACTION_COVERAGE.md` (2026-09-18). Sin parche de fork, sin frame nuevo.
2. **D2 — Rooms**: **solo triage corregido** (`INTERACTION_COVERAGE.md`: Room de
   Duskmourn, no "mazmorra interna"); `leftHalfUnlocked`/`rightHalfUnlocked`/
   `roomWasUnlockedOnCast` → `accepted` con causa en `ENGINE_VIEW_TRIAGE.md`.
3. **D3 — Estados de jugador A3**: **aceptados todos con causa** en
   `web/src/state/engineViewRegistry.ts` + `web/ENGINE_VIEW_TRIAGE.md`
   (maxHandSize, landsPlayed/landsPerTurn, canGainLife/canLoseLife/
   payLifeCostRestrictions/loseByZeroOrLessLife, range/inRange,
   phyrexianColors, bookkeeping…).
4. **D4 — Validaciones C1–C5**: **hechas ahora** con MCP+web (WP-C en ejecución;
   evidencia en `docs/qa/p6-live-validations.md` y filas de
   `web/COMPONENT_PARITY.md`).
5. **D5 — Guarda de causas**: **implementada** — `engineViewCoverage.test.ts`
   exige fila por campo del baseline (140), detecta huérfanas y exige
   `ref`/`causa` según decisión; demostración rojo→verde sobre
   `PlayerView.speed`.
6. **D6 — B.9 `FloatingChat`**: **fix z-index puntual** en `LobbyScreen.css`
   (panel a z-4 y pie elevado a z-6 solo con panel abierto; el FAB cerrado
   conserva z-60) + caso nuevo en `web/e2e/chat-overlap.spec.ts`
   (viewport 1000×800, panel arrastrado sobre el pie).

---

## 9. Evidencia y referencias

- Speed: `PlayerImpl.java:159,4866-4890`; `Speed.java:20-98`;
  `StartYourEnginesAbility.java`; `SpikeshellHarrier.java:93-96`;
  `PlayerView.java:61,157,323`; `engine-view-gap.baseline.json:114`.
- Rooms: `PermanentImpl.java:2318-2364`; `RoomAbility.java:23-24`;
  `INTERACTION_COVERAGE.md:135` (etiqueta errónea).
- Fail-to-find: `INTERACTION_COVERAGE.md:242`; `plan4.md:173`;
  `web/fixtures/recorded/fail-to-find.json` (`hasFailToFind`).
- Day/night: `INTERACTION_COVERAGE.md:141-142,167`.
- Casos: `INTERACTION_COVERAGE.md:110-111` vs plan5 D2 (`hintRegistry`
  `hint:CaseSolvedHint`).
- Deudas plan2: `COMPONENT_PARITY.md:27,29,30,35,36,37,238-239`.
- Drift: `web/e2e/known-broken.ts:5-11`; `ROADMAP.md:64-66,69-71`;
  `web/AGENTS.md` (galería).
- Guardas existentes: `web/src/state/engineViewCoverage.test.ts`,
  `hintCoverage.test.ts`, `callbackCoverage.test.ts`, `mechanicsCoverage.test.ts`.
- Método del triage: `rg` sobre `TODO/FIXME`, baselines, `known-broken`,
  `COMPONENT_PARITY`, `INTERACTION_COVERAGE`, `ROADMAP` + verificación directa
  en el fork (solo lectura) el 2026-09-18.
