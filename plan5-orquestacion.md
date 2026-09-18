# PLAN-5 — Orquestación multiagente (diseño de ejecución, 2026-09-18)

> Runbook para implementar `plan5.md`. El agente principal de opencode es
> **orquestador y verificador**: descompone, lanza subagentes con contrato de
> salida, congela el árbol entre oleadas y **re-ejecuta la verificación** sobre
> el resultado. Los subagentes (`explore`, `general`) investigan/implementan
> work packages (WP) con ficheros bloqueados para que puedan correr en paralelo
> sin pisarse. Este documento responde a: quién hace qué, en qué orden, con qué
> evidencia y con qué puertas de decisión.

---

## 0. Reglas de juego (no negociables)

1. Ningún subagente commitea, hace `push` ni toca `git config`. Solo el usuario
   pide commits; por defecto no hay ninguno.
2. Prohibido tocar generados (`dist/`, `.run/`, `target/`, `local-server/`,
   `node_modules/`, `contract.schema.json` + `types.generated.ts` + zod/splash
   generados) y **el fork `../xmage-fork`** (salvo que D1 cambie a parche de
   motor; entonces WP aparte con `mage_build full`).
3. **Un solo escritor por fichero** (matriz §4). Si un agente necesita un
   fichero ajeno, lo pide al orquestador; no lo edita.
4. Cada WP demuestra **red→green**: primero el test que falla con el defecto
   real, luego el fix; el agente reporta ambas salidas. El orquestador repite
   la verde sobre el árbol congelado.
5. La verificación final la ejecuta **siempre** el orquestador; el reporte del
   agente no basta.
6. e2e de subagentes: **solo fake** (FixtureServer). El modo real lo corre el
   orquestador en el Gate final con el stack arriba.
7. Sin comentarios en código nuevo; sin dependencias nuevas sin preguntar; sin
   `npm install` / `mvn`.
8. Estado de partida (baseline real): rama `master`, HEAD `791af62e872` + el
   frame `slicer` **sin commitear** (driver, `slicer.json`, manifest 115,
   docs). Esos cambios son preexistentes: no se revierten y no cuentan como
   entregable de ningún WP. Al cierre:
   `git status --porcelain` = baseline + ficheros listados en la matriz §4.

---

## 1. Agentes, roles y contrato de salida

| Agente | Tipo | Rol en este plan | Escribe |
|---|---|---|---|
| Orquestador | principal | Diseña WPs, sintetiza recon, resuelve/recoge decisiones, **verifica todo**, suite final | docs de plan/registro |
| E1–E3 | `explore` | Recon read-only (parse.ts, hints del fork, galería/e2e) | nada |
| A | `general` | Familia A (prompts) | lock A (§4) |
| B | `general` | Familia B (hints) | lock B (§4) |
| C | `explore` o `general` | Investigación de decisiones V1/V2/P5 (read-only) | nada (brief al orquestador) |
| D | `general` | Opcional P6 `--seed=` (solo si se aprueba) | lock D |
| `bug-hunter` / `xmage-contract` | manual-only | No se lanzan autónomamente; están a disposición del usuario | — |

**Contrato de retorno de cada subagente** (formato fijo, sin prosa extra):
1. `estado`: done | partial | blocked.
2. `ficheros`: ruta + 1 línea de qué cambió.
3. `comandos`: comando exacto + resultado (verde/rojo, conteo).
4. `evidencia`: salida clave (test rojo, test verde, extracto de diff).
5. `bloqueos`: qué falta / qué decisión se necesita.

---

## 2. Oleadas

- **Wave 0 — Congelación y baseline (orquestador).**
  Capturar `git status --porcelain` y `git diff --stat` de partida (texto en el
  hilo), comprobar stack (`mage_stack status`; levantar si hace falta) y correr
  `node scripts/test.mjs unit typecheck` → debe estar verde antes de tocar nada.

- **Wave 1 — Recon paralelo (E1 ∥ E2 ∥ E3, read-only).**
  Tres `explore` en paralelo, sin escrituras. Salida: informes con rutas y
  líneas exactas (briefs §Anexo). Sin este recon no se redacta el lock de A/B.

- **Gate 1 — Síntesis (orquestador).**
  Convertir los informes en especificación de implementación (funciones,
  imports, casos límite, decisiones D1) y resolver con el usuario D1 (default:
  sanear en cliente). Si E1 descarta el post-pase central, elegir el plan B
  (helper aplicado en los 24 cases) y reflejarlo en el brief de A.

- **Wave 2 — Implementación paralela (A ∥ B, `general`).**
  Locks disjuntos (§4): pueden correr a la vez. Cada agente corre solo tests
  dirigidos; la suite es del orquestador.

- **Gate 2 — Verificación de A y B (orquestador).**
  Re-ejecutar comandos de cada WP + guards existentes + revisión de alcance
  (`git status`, `git diff --stat`, sin generados, sin commits, fork limpio).
  Si algo falla: devolución al agente dueño (máx. 2 ciclos) o fix puntual del
  orquestador si está fuera del lock.

- **Wave 3 — Decisiones (C + usuario).**
  C entrega briefs de costo/valor para V1 (specs reales), V2 (baselines Linux),
  P5 (cerrar/construir) y P6 (seed). El usuario decide D2–D5; las que se
  aprueben se convierten en WP pequeños (D2 badges, D6 specs reales, D7 CI
  visual, D8 P6 seed) o en una línea de decisión escrita en `plan5.md`/`PROJECT.md`.

- **Wave 4 — Gate final (orquestador).**
  Stack arriba y `node scripts/test.mjs` completo (incluye real donde aplique),
  `mage_validate_generated`, y (si se tocó la galería) regresión visual opt-in.
  Resumen de evidencia al usuario.

- **Fuera de oleadas (V5–V7):** personas e instalación. El orquestador prepara
  el checklist ejecutable y lo deja en `docs/qa/` o `plan5.md`; no bloquea 1–3.

---

## 2bis. Gate 1 — hallazgos del recon aplicados (2026-09-18)

Decisiones del orquestador sobre E1–E3; sustituyen lo que este runbook decía
antes en los briefs:

1. **Integración A**: el embudo único es `prompt()`
   (`web/src/game/feedback/parse.ts:315-355`): todos los prompts no nulos se
   construyen ahí (los early-returns solo devuelven `null`). Se sanea en la
   construcción — no hay que tocar los 24 `case` ni envolver el switch.
2. **Módulo neutral**: `web/src/utils/` ya existe (no `web/src/lib`).
   `stripTags`+`substituteCardRefs` se mueven a `web/src/utils/textRefs.ts`;
   `board/designations.ts` re-exporta para no tocar `FormattedText.tsx`.
3. **Payload del ASK (A0) resuelto por código, sin corrida nueva**:
   `HumanPlayer.chooseUse` (fork, `Mage.Server.Plugins/Mage.Player.Human`)
   rellena `secondMessage = getRelatedObjectName(source)` cuando el effect no lo
   pasa, y `GameImpl.addMessageToOptions` (`GameImpl.java:4143-4152`) lo publica
   en `options.secondMessage`; `parse.ts` ya lo lee (`secondMessageOf`) y lo pasa
   a `prompt()` en GAME_ASK/GAME_TARGET. Corolario: **D1 = cliente** (confirmada)
   y no hay que patchear el fork; el `{this}` de Slicer se resuelve en `prompt()`.
4. **Corpus**: las frames grabadas no guardan prompts (`{recordedAt, gameId,
   gameView}`); los unit tests usan el string real de la regla
   (`slicer.json:205`) + payloads sintéticos, y la galería añade
   `prompt:ask-slicer` construido vía `parseFeedback` (la galería inyecta el
   feedback directo al store, `GalleryScreen.tsx:114`; saltarse el parser no
   probaría el pipeline).
5. **Alcance B**: solo motor (`Mage/**` + `Mage.Common/**`): 60 clases `*Hint`
   (51 en `hint/` + 9 embebidas), 42 `addHint` reales, 14 textos de `getRules`,
   6 `HINT_ICON_*` + `HINT_START_MARK`, 12 claves literales + 5 constantes + 2
   dinámicas de `addInfo`. `Mage.Sets` (2.383 `addHint`, 50 hints, 60 `addInfo`)
   queda fuera de v1 y se declara en el `meta` del schema.
6. **Determinismo B**: baseline sin líneas ni timestamps; paths relativos al
   fork; arrays ordenados; la guarda compara el JSON completo y falla ante
   cualquier alta/baja.
7. **E3**: galería dev `web/src/dev/galleryFixtures.ts:564`
   (`buildGalleryEntries`), frames autocargados del manifest (`frame:slicer` ya
   existe), prompts sintéticos en `:588-755`; spec `web/e2e/gallery.spec.ts`
   (su test 1 recorre todas las entradas); comando
   `npm run test:e2e:fake -- e2e/gallery.spec.ts`; sin baseline visual salvo
   alta en `VISUAL_ENTRIES`.

**Gate 3 — decisiones (2026-09-18)**: D2 badges de los 5 → WP-D2 implementado y
verificado (unit+typecheck+i18n; 5 filas del registro a `rendered`); D3
subconjunto real de 5 → cableado en `scripts/integration-report.mjs` y
verificado en vivo contra el stack local (5 passed / 2 skipped); D4 CI visual
opt-in; D5 P5 cerrado por decisión; D6 `--seed=` pospuesto. V5–V7
(humanos/instalación) siguen fuera de automatización (plan4 §5.3/§5.5/§5.6/§6).

---

## 3. Work packages

### WP0 — Baseline (orquestador, Wave 0)

- **Pasos:** `git status --porcelain`; `mage_stack status`; `node scripts/test.mjs unit typecheck`.
- **DoD:** unit verde (1825/1825 o el conteo actual) y typecheck limpio, anotados
  como referencia. Cualquier rojo preexistente se documenta y **no** se arregla
  dentro de plan5 sin decidirlo.

### WP-E1 — Recon `parse.ts` y render de prompts (explore, Wave 1)

- **Preguntas:** (a) ¿el renderer de `question`/`message` escapa HTML o usa
  `dangerouslySetInnerHTML` (`FormattedText.tsx`)? (b) ¿`FeedbackPrompt` lleva
  `sourceName` como campo, o solo se pasa a `prompt()`? (c) ¿es viable un
  **post-pase central** en `parseFeedback` (envolver el switch) que sane
  `prompt.message` con `prompt.sourceName`, o hay early-returns que lo impidan?
  (d) lista de tests existentes que aserten texto literal de prompts (para no
  romperlos); (e) imports actuales `game/` → `board/designations` y mejor
  ubicación neutral (`web/src/lib/hintText.ts` candidato).
- **Salida:** informe con rutas:líneas + recomendación de integración (central
  vs 24 cases) + inventario de strings del corpus real (`slicer`, `goad`,
  `class-level`).

### WP-E2 — Recon hints del motor (explore, Wave 1)

- **Preguntas:** (a) clases `*Hint` reales bajo `Mage/src/main/java/mage/abilities/hint/`
  (y las registradas fuera) con ruta; (b) valores literales de `HINT_ICON_*` en
  `HintUtils`; (c) literales de `PermanentImpl.getRules` (restricciones/
  requisitos); (d) claves `addInfo("…")`; (e) qué helpers de
  `scripts/view-schema.mjs` son reutilizables (`fieldsFor`, `forkPath`, walker)
  y cómo los consume `engine-view-schema.mjs`.
- **Salida:** informe + propuesta de extracción (regex y estructura JSON) para
  `scripts/hint-schema.mjs`, con conteos por categoría.

### WP-E3 — Recon galería/e2e (explore, Wave 1)

- **Preguntas:** (a) cómo monta la galería dev los frames/prompts (ruta, registro
  de entradas, cómo se añade una entrada con el prompt de `slicer.json`);
  (b) specs e2e aplicables (`gallery.spec.ts`, `recorded.spec.ts`) y sus greps;
  (c) cómo importan los tests los frames de `web/fixtures/recorded/`;
  (d) comandos exactos para correr un spec fake concreto.
- **Salida:** informe con rutas:líneas + receta concreta para añadir la entrada
  de Slicer y su aserción "sin `{this}`".

### WP-A — Familia A: saneado de prompts (general, Wave 2)

- **A0 (bloqueante, primero):** confirmar el payload real:
  `REC_DUMP_EVENTS=1 node scripts/drivers/slicer.mjs` (stack arriba). ¿El ASK
  trae `secondMessage`/`question` con el texto crudo? Si no trae `sourceName`,
  parar y reportar: cambia la estrategia (fallback: `sourceName` desde
  `options`; si tampoco, dejar `{this}` y documentarlo).
- **A1:** módulo neutral `web/src/lib/hintText.ts` con `stripHintTags`,
  `iconGlyphs`, `substituteCardRefs(text, cardName?)` (movido desde
  `board/designations.ts`, que pasa a re-importarlo; sus tests actuales deben
  seguir verdes sin cambios de expectativas).
- **A2:** `web/src/game/feedback/promptText.ts`:
  `sanitizePromptText(message, sourceName?)` — `{this}`→`sourceName` (case
  insensitive; sin `sourceName` no se toca), `ICON_GOOD|BAD|REQUIRE|RESTRICT`→
  glifos (verificados contra `HintUtils`), `<br/>`→espacio, `<hintstart/>`
  fuera y resto de tags según decida E1 (una sola semántica, testeada).
- **A3:** integración en `parse.ts` según Gate 1 (preferencia: post-pase
  central único que cubre los 24 cases; si no, helper en cada
  `messageWithSource`/`splitSourceSuffix` + los cases restantes). Prohibido
  cambiar textos que no lleven marcadores.
- **A4:** tests: `promptText.test.ts` con strings reales (`slicer.json`,
  `goad.json`, `class-level.json`) que fijen 0 `{this}`, 0 `ICON_*`, 0 `<`; test
  **rojo primero** sobre el string crudo del ASK de Slicer; entrada de galería +
  aserción e2e fake de que el diálogo no contiene `{this}`.
- **DoD:** `npx vitest run src/lib src/game/feedback src/board/designations.test.ts`
  verde; `mage_e2e` del spec de galería verde; replay `@recorded` verde;
  `node scripts/test.mjs typecheck` limpio; evidencia roja→verde en el reporte.
- **Lock:** `web/src/lib/hintText.ts`, `web/src/board/designations.ts`,
  `web/src/game/feedback/promptText.ts`, `web/src/game/feedback/parse.ts`,
  `web/src/game/feedback/promptText.test.ts`, `web/src/board/designations.test.ts`,
  entrada de galería + spec de galería (los que fije E3).

### WP-B — Familia B: hints (general, Wave 2)

- **B1:** `scripts/hint-schema.mjs` (patrón `engine-view-schema.mjs`):
  función pura `computeHintSchema()` que extrae (a) strings de
  `PermanentImpl.getRules`, (b) clases `*Hint` registradas, (c) constantes
  `HINT_ICON_*`, (d) claves `addInfo`; salida JSON ordenada y estable; escribe
  `web/fixtures/hint-schema.json` (baseline); soporte `--update-baseline`.
  Sin dependencia de runtime Java (solo fuentes del fork).
- **B2:** `web/src/board/hintRegistry.ts`: registro declarativo
  `{ id, kind: 'rules'|'hint'|'icon'|'info', status: 'rendered'|'known-unrendered',
  ref?, causa? }` poblado con el inventario del plan5 §2.3 + triage de **todas**
  las claves del schema. `known-unrendered` exige `causa`.
- **B3:** `web/src/state/hintCoverage.test.ts` (patrón `engineViewCoverage`):
  (1) `computeHintSchema()` === baseline; (2) toda clave del schema tiene fila
  en el registro; (3) mensajes de fallo accionables ("hint nuevo del motor: X —
  añade fila o baseline").
- **B4:** entregar al orquestador la tabla de triage de huecos conocidos
  (`CaseSolvedHint`, `Prepared`, `Harnessed`, `City's Blessing`, `Evidence`,
  `Protector`) para la decisión D2. **No** implementar badges en este WP.
- **DoD:** `npx vitest run src/state/hintCoverage.test.ts` verde;
  `node scripts/hint-schema.mjs` idempotente (dos corridas idénticas, `diff`
  vacío); typecheck limpio.
- **Lock:** `scripts/hint-schema.mjs`, `web/fixtures/hint-schema.json`,
  `web/src/board/hintRegistry.ts`, `web/src/state/hintCoverage.test.ts`.

### WP-C — Investigación de decisiones (Wave 3, read-only)

- **C1 (V1):** enumerar specs con rama real (`E2E_BACKEND=real`) y el costo de
  un subconjunto en `integration-report.mjs`; proponer lista o justificación de
  fake+frames.
- **C2 (V2):** requisitos de baselines Linux (webkit en CI, contenedor,
  wiring `pages.yml`/`dashboard-ci.mjs`) + costo; alternativa opt-in documentado.
- **C3 (P5/P6):** resumen costo/valor para cerrar P5 por decisión y para
  `--seed=` en `scripts/fuzz.mjs` (diseño del cambio, ~S).
- **Salida:** brief de media página; sin ficheros salvo que el usuario apruebe.

### WP-D — Opcional (solo si se aprueba)

- D2 badges de hints aprobados (incluye i18n ×9 si hay UI nueva).
- D6/D7/D8 según decisiones V1/V2/P6 (mismo protocolo: lock + red→green +
  verificación del orquestador).

---

## 4. Matriz de propiedad de ficheros (anti-conflicto)

| Fichero / zona | Escritor | Notas |
|---|---|---|
| `web/src/lib/hintText.ts` | A | nuevo; único origen de `substituteCardRefs` |
| `web/src/board/designations.ts` + su test | A | pasa a re-importar de `lib/`; comportamiento intacto |
| `web/src/game/feedback/promptText.ts` + test | A | nuevo |
| `web/src/game/feedback/parse.ts` | A | único cambio de producto en A3 |
| Entrada/spec de galería (los que fije E3) | A | añadir prompt real de Slicer |
| `scripts/hint-schema.mjs` | B | nuevo |
| `web/fixtures/hint-schema.json` | B | baseline nuevo |
| `web/src/board/hintRegistry.ts` | B | nuevo |
| `web/src/state/hintCoverage.test.ts` | B | nueva guarda |
| `scripts/fuzz.mjs` (P6 seed) | D | solo si se aprueba |
| `plan5.md`, `PROJECT.md`, `site/content.json`, `docs/qa/*` | Orquestador | registro y decisiones |
| `web/fixtures/recorded/*` (incl. `slicer.json`), manifest | Nadie | preexistentes de la sesión anterior; no tocar |

A y B no comparten ningún fichero; el único solape potencial es CPU (vitest),
por eso cada agente corre **solo tests dirigidos** y el orquestador corre la
suite.

---

## 5. Protocolo de verificación (orquestador)

**S1 (Gate 1):** baseline WP0 verde; informes E1–E3 con rutas verificables
(spot-check de 2–3 afirmaciones por informe).

**S2 (Gate 2, por WP):**
- Re-ejecutar los comandos del DoD del WP sobre el árbol congelado.
- Guards existentes: `npx vitest run src/state/callbackCoverage.test.ts
  src/state/mechanicsCoverage.test.ts src/state/engineViewCoverage.test.ts
  src/state/serverStateCoverage.test.ts` (que nada se desalineó).
- Alcance: `git status --porcelain` y `git diff --stat` == baseline + lock;
  `git -C ../xmage-fork status --porcelain` vacío; sin generados; sin commits.
- Para B: correr `node scripts/hint-schema.mjs` dos veces y comparar
  (determinismo); inspeccionar el baseline a mano (conteos plausibles vs plan5
  §2.2).
- Para A: verificar el red→green real (el test del string crudo existe y su
  expectativa habría fallado sin el helper — revisar el test, no solo el
  reporte); replay del frame `slicer` y galería en fake.

**S3 (Wave 4, final):** stack arriba (`mage_stack start all`), `node
scripts/test.mjs` completo; `mage_validate_generated`; e2e real smoke solo si
la decisión D3 lo pide; resumen de evidencia y pendientes.

**Abort / reintentos:** máx. 2 ciclos agente→verificación por WP; si el tercero
falla, el orquestador implementa el fix acotado o escala al usuario. Un WP que
rompa tests fuera de su lock se revierte a su estado pre-WP y se reporta.

---

## 6. Puertas de decisión (plan5 §8)

| # | Decisión | Default propuesto | Cuándo | Mecanismo |
|---|---|---|---|---|
| D1 | ¿Cliente o fork? | Cliente (no invasivo, cubre todas las cartas) | Gate 1 | pregunta al usuario |
| D2 | ¿Badges `CaseSolved`/`Prepared`/`Harnessed`? | Solo registry ahora; badges con D2 tras B4 | Gate 2/3 | pregunta + WP-D |
| D3 | ¿Subconjunto real de specs? | C1 propone lista corta; si el costo no compensa, justificación escrita | Wave 3 | brief C1 + decisión |
| D4 | ¿Baselines Linux en CI? | Opt-in documentado hasta que C2 cuantifique | Wave 3 | brief C2 + decisión |
| D5 | ¿P5 se cierra? | Cerrar por decisión (evidencia: auditoría JsonUtil) | Wave 3 | brief C3 + decisión |

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El ASK de Slicer no trae `secondMessage` | A0 lo detecta antes de codificar; fallback documentado o decisión D1 |
| Post-pase central inviable (`sourceName` no viaja en `FeedbackPrompt`) | Plan B de A3: helper en los 24 cases, coordinado en Gate 1 |
| Sanear `<br/>`/tags cambia layout de prompts ya correctos | Corpus + criterio "solo marcadores"; ningún test existente de texto se toca sin justificar |
| Extracción de hints frágil (regex Java) | Mismo patrón ya probado de `view-schema`; salida ordenada; la guarda obliga a triage, no a adivinar |
| Coste de `*Hint` (~60) mayor de lo previsto | B registra `known-unrendered` con causa; badges solo por D2 |
| Paralelismo A∥B (CPU/ficheros) | Locks disjuntos; tests dirigidos; suite solo el orquestador |
| Cambios preexistentes (`slicer`) contaminan la verificación | Baseline WP0 con `git status`; diffs comparados contra él |

---

## 8. Estimación (orientativa)

| WP | Wave | Esfuerzo | Paraleliza con |
|---|---|---|---|
| WP0 | 0 | XS | — |
| E1–E3 | 1 | S (×3) | entre sí |
| A | 2 | S–M | B |
| B | 2 | M | A |
| C | 3 | S | — |
| D (opcional) | 3–4 | S–M | — |
| Gate final (suite completa) | 4 | S (wall-clock ~20 min) | — |

---

## Anexo A — Briefs listos para lanzar

**E1 (explore):** "Lee `web/src/game/feedback/parse.ts` completo,
`web/src/game/FormattedText.tsx`, `web/src/game/feedback/record.ts` y
`web/src/game/feedback/types.ts`. Responde con rutas:líneas: (1) ¿cómo se
renderiza `question`/`message` (¿escapa HTML?); (2) ¿`FeedbackPrompt` expone
`sourceName` o solo se pasa a `prompt()`? (3) ¿es viable un post-pase central en
`parseFeedback` que sane `prompt.message` con `prompt.sourceName`, o hay
early-returns? Propón el punto exacto; (4) lista de tests que aserten texto
literal de prompts; (5) importadores de `board/designations` y mejor módulo
neutral para `substituteCardRefs`. No escribas ficheros."

**E2 (explore):** "En `../xmage-fork` (solo lectura): (1) enumera clases
`*Hint` bajo `Mage/src/main/java/mage/abilities/hint/` (+ registradas fuera) con
ruta; (2) valores de `HINT_ICON_*` en `HintUtils`; (3) literales de
`PermanentImpl.getRules` que generan restricciones/requisitos; (4) claves
`addInfo("…")`; (5) qué exporta `scripts/view-schema.mjs` (`fieldsFor`,
`forkPath`) y cómo lo reutiliza `engine-view-schema.mjs`. Entrega conteos y una
propuesta de regex/estructura JSON para `scripts/hint-schema.mjs`. No escribas."

**E3 (explore):** "Localiza la galería dev (ruta de la página y registro de
entradas; busca `gallery` en `web/src` y `web/e2e/gallery.spec.ts`) y
`web/e2e/recorded.spec.ts`. Reporta: (1) cómo se añade una entrada que monte el
frame `web/fixtures/recorded/slicer.json` con su prompt; (2) cómo los tests
importan frames grabados; (3) comando exacto para correr un spec fake
concreto. No escribas."

**A (general):** "Implementa WP-A del `plan5-orquestacion.md` §3 (A0→A4) con
los hallazgos de E1. Ficheros: solo el lock A. Reglas: red→green (test crudo
primero), sin comentarios, sin commits, sin tocar generados ni el fork, tests
dirigidos únicamente. Reporta con el contrato de salida §1."

**B (general):** "Implementa WP-B del `plan5-orquestacion.md` §3 (B1→B4) con
los hallazgos de E2. Ficheros: solo el lock B. Reglas: sin comentarios, sin
commits, script determinista (dos corridas idénticas), tests dirigidos
únicamente; no implementes badges. Reporta con el contrato de salida §1."
