# PLAN-5 — presentación del protocolo y validación restante (2026-09-18)

> **PLAN CERRADO (2026-09-19)**: lo que quedaba abierto (V5–V7: evaluador 3,
> pruebas con personas e instalación en máquinas limpias) pasa a la lista viva
> única de `plan7.md` §4.

> ESTADO AL CREAR: rama `master`, último commit `791af62e872` + el frame
> `slicer` sin commitear (driver `scripts/drivers/slicer.mjs`, manifest
> 114→115). El plan4 cerró §3 (mecánicas) y §5.1 (prompts) declarando "0 ❌ de
> UI"; al grabar Slicer aparecieron **dos familias que el plan4 no cubría**
> porque sus guardas miran campos, no textos. Este plan las detalla, define
> guardas para que no vuelvan a escaparse y ordena lo que queda de validación
> no-software.
>
> **Qué NO es este plan**: no reabre §3/§5 del plan4 (se dan por cerrados), ni
> las dimensiones humanas/instalación (se referencian en §5). Es el **cierre de
> completitud de la capa de presentación** + las decisiones pendientes de CI y
> specs reales.

> **ESTADO AL CIERRE (2026-09-18)**: Familia A implementada y verificada
> (saneado en `prompt()` de `{this}`/`ICON_*`/tags con el corpus real de Slicer,
> pipeline `parseFeedback` y entrada de galería); Familia B con oráculo
> `scripts/hint-schema.mjs` + baseline + `hintRegistry` + guarda
> `hintCoverage` (roja ante drift del motor y ante filas sin triage); D2 badges
> de los 5 huecos (i18n ×9); D3 subconjunto real de 5 specs cableado en el
> nightly y verificado; D4 CI visual opt-in; D5 P5 cerrado; D6 `--seed=`
> pospuesto. Pendiente: V5–V7 (humanos/instalación, plan4 §5/§6).

---

## 0. Diagnóstico: por qué el plan4 no cazó esto

El método del plan4 encontró ~40 hallazgos reales en las primeras tandas de P4
y ~0–2 por frame al final: el catálogo de mecánicas está agotado. Lo que queda
ya no son mecánicas sino **textos que el motor emite** y que ninguna guarda
vigila:

| Guarda actual | Qué cubre | Qué NO cubre |
|---|---|---|
| `callbackCoverage` | Todo callback tiene `case` o allowlist (hoy vacía) | Contenido del payload |
| `mechanicsCoverage` | Todo campo de `mage.view.*` modelado en el contrato | Strings de `rules`/`cardIcons`/`question` |
| `engineViewCoverage` | Campos de `mage.game.*` no copiados al view (baseline) | Igual: campos, no textos |
| Frames P4 | Estado real pintado por el web | Texto de los prompts (el recorder captura estado, no valida texto) |
| Checklist §5.1 | Calidad por **tipo** de prompt (20 tipos) | Defectos de formato dentro de un tipo ya ✅ |

Evidencia de las dos familias (caso Slicer, 2026-09-18):
1. **Placeholder sin resolver**: el `GAME_ASK` del trigger de Slicer llega como
   `"…you may have that player gain control of {this} until end of turn…"`.
   El motor tiene `CardUtil.replaceSourceName()` (`{this}` → nombre) y varios
   effects lo aplican (`DoUnlessControllerPaysEffect`, `DoWhenCostPaid`,
   `ExileSourceUnlessPaysEffect`…), pero `SlicerHiredMuscleUpkeepEffect` pasa
   `source.getRule()` crudo. **3.887 ficheros de cartas de `Mage.Sets` usan
   `{this}`**: no es un caso de una carta, es una familia.
2. **Hints textuales**: goad llegó a existir como texto en `rules`
   (`ICON_REQUIREGoaded by … (must attack)`) + `cardIcons`; el cliente los
   reconoce con regex a mano. Cada hint que el motor añada y el web no conozca
   se pierde en silencio.

**Cómo se detectó** (queda como método): el `onAsk` del driver no matcheó (el
texto decía `{this}`, no el nombre) → nadie respondió → el watchdog
`STALL post-cheat` lo cazó a los 60 s; `E2E_DEBUG=1` imprimió el `GAME_ASK`
crudo. Un matcher laxo habría dejado pasar el frame **sin ver** el defecto.

---

## 1. Familia A — placeholders y residuos en textos de prompt

### 1.1 Alcance
Todo texto que el servidor manda como pregunta/instrucción y el web pinta:
`question`/`message` de los 24 `case 'GAME_*'` de
`web/src/game/feedback/parse.ts`, más los mensajes de `feedback.ts` y
`gameEventParser`.

### 1.2 Inventario (medido)
- `parse.ts` tiene **24 methods**; solo **5** pasan por `messageWithSource()`
  (CHOOSE_CARDS, CHOOSE_ABILITY, CHOOSE_PILE, PLAY_XMANA, GET_MULTI_AMOUNT) y
  1 por `splitSourceSuffix` (GET_AMOUNT). El resto pasa el texto **crudo**,
  incluido `GAME_ASK` — que sí extrae `sourceName` de `secondMessage` pero no
  lo usa para sustituir nada.
- Placeholders conocidos que el motor puede emitir en textos de prompt/reglas:
  `{this}` (masivo), y textos con HTML (`<br/><hintstart/>`, `<font …>`,
  `ICON_GOOD`/`ICON_BAD`/`ICON_REQUIRE`/`ICON_RESTRICT`) que hoy se limpian
  solo en las reglas de carta (`substituteCardRefs`, `stripTags`).
- El motor tiene la función de sustitución (`CardUtil.replaceSourceName`) pero
  su uso es **opt-in por effect**: no hay garantía upstream.

### 1.3 Trabajo propuesto
1. **Helper único** `web/src/game/feedback/promptText.ts`:
   `sanitizePromptText(message, sourceName?)` → sustituye `{this}` (case
   insensitive) por `sourceName` si existe; convierte los `ICON_*` a ✓/✗/⚠;
   quita `<br/>`/`<hintstart/>` sobrantes. Reutiliza la lógica ya probada de
   `board/designations.ts` (`substituteCardRefs`), movida/exportada a un sitio
   neutral para no importar board desde game.
2. **Aplicarlo en todos los cases de `parse.ts`** (incluido `GAME_ASK`,
   `GAME_TARGET`, `GAME_CHOOSE_CHOICE`, `GAME_CHOOSE_ONE`, …), no solo en los
   que ya pasan por `messageWithSource`. Si no hay `sourceName`, no se toca el
   texto (mejor `{this}` visible que un nombre inventado).
3. **Confirmar el payload real** del ask de Slicer con
   `REC_DUMP_EVENTS=1 node scripts/drivers/slicer.mjs` (¿trae `secondMessage`?)
   antes de dar por buena la sustitución; si no lo trae, el fallback es
   `sourceName` desde `options` o dejar el texto tal cual y documentarlo.
4. **Tests**: unit con textos reales (`slicer.json` + `goad.json` +
   `class-level.json` como corpus) que fijen: 0 `{this}` visible, 0 `ICON_*`
   visible, HTML tolerable; e2e de la galería montando el prompt real de
   Slicer (ya entra por `manifest`) y aserción de que el diálogo no contiene
   `{this}`.
5. **Opcional (fork)**: parchear `SlicerHiredMuscleUpkeepEffect` (y similares)
   con `CardUtil.replaceSourceName` en `../xmage-fork`. **No es necesario** si
   el cliente sanea; se decide en §8.

### 1.4 Criterio de aprobado
Ningún prompt del catálogo muestra `{...}` ni marcadores `ICON_*`/`<br/>`;
test de corpus verde; el caso Slicer verificado en el frame/replay.

---

## 2. Familia B — hints textuales (`rules`, `cardIcons`, `info`)

### 2.1 Los dos canales (clave para no sobreactuar)
- **`cardIcons`** (`CardView.generateCardIconsForPermanent`): el web los pinta
  **genéricos** (tipo + `hint` tal cual, `CardIcons.tsx`) → cubierto por
  construcción. Goad, "Must attack", keywords, RINGBEARER, etc. viajan aquí.
- **`rules` / `info`**: texto libre que el web **parsea con regex** para
  derivar badges/estados → esta es la familia frágil.

### 2.2 Inventario del motor (fuentes de hints)
- `PermanentImpl.getRules(game)` — **~12 restricciones/requisitos** generados
  desde `RestrictionEffect`/`RequirementEffect`: `Can't attack`, `Can't
  block`, `Can't untap`, `Can't use activated abilities`, `Can't transform`,
  `Must attack`, `Must block`, `Must block any`, `Must block all attackers`,
  `Must attack defender X`, `Must block attacker X`, `Must block attacker if
  able`, `Goaded by X (must attack)`.
- `addInfo(key, value)` en el engine (`PermanentImpl`): `attachedTo`,
  `suspected`, `ringbearer`, `prepared`, `protector`, `soulbond`, …
- **~60 clases `*Hint`** en `Mage/src/.../abilities/hint/` + `mage/abilities/`
  (DayNightHint, ClassLevelHint, CaseSolvedHint, HarnessedHint,
  MonstrousHint, RenownedHint, InitiativeHint, MonarchHint,
  CurrentDungeonHint, EvidenceHint, CitysBlessingHint, …).
- `HintUtils.HINT_ICON_*`: 6 constantes (`GOOD`, `BAD`, `REQUIRE`,
  `RESTRICT`, `DUNGEON_ROOM_CURRENT`, `DUNGEON_ROOM_NEXT`).

### 2.3 Inventario del web (medido)
- `board/designations.ts`: `monstrous`, `renowned`, `suspected`, `paired`,
  `classlevel` (regex ancladas a la línea completa).
- `game/MechanicsTray.tsx`: ring-bearer (cardIcons), dungeon
  (`commandList.rules[0]`), The Ring (nivel = `rules.length`), day/night.
- `game/CommanderDamageMatrix.tsx`: `"Commander did N combat damage to player
  X."` (regla del comandante).
- `gameEventParser`: mensajes de chat (fizzle, etc.).
- **Huecos conocidos sin parser**: `CaseSolvedHint` ("Case is solved."),
  `HarnessedHint` (sí está en el baseline de `engineViewCoverage` como campo
  de engine no expuesto, pero el hint existe), `Prepared`/`prepared`
  (addInfo), `City's Blessing`, `Evidence`, `Protector`, y las ~50 clases
  Hint restantes (ascensiones, condiciones de arquetipo…).

### 2.4 Trabajo propuesto
1. **`scripts/hint-schema.mjs`** (patrón `scripts/view-schema.mjs`): extrae del
   fork las fuentes de hints —
   (a) strings de `PermanentImpl.getRules`,
   (b) clases `*Hint` registradas vía `addHint`/`HintUtils`,
   (c) constantes `HINT_ICON_*`,
   (d) claves `addInfo("…")` —
   y vuelca `web/fixtures/hint-schema.json` (baseline, ordenado).
2. **`web/src/board/hintRegistry.ts`**: registro declarativo
   `{ hint, estado: 'rendered' | 'known-unrendered', ref?, causa? }` con lo
   que el web reconoce hoy (2.3) y lo que se decide no pintar (con causa:
   "el motor no lo relevante", "cosmético", "pendiente de badge").
3. **Guarda `web/src/state/hintCoverage.test.ts`** (patrón
   `engineViewCoverage`): el schema del fork debe estar contenido en el
   registro; un hint nuevo del motor falla hasta triage → **misma mecánica de
   baseline** que ya funcionó con `engine-view-gap.baseline.json`.
4. **Badges nuevos solo si el repaso lo pide**: candidatos naturales
   `CaseSolvedHint` (el motor lo emite y el plan4 declaró "casos" fuera de
   alcance de campaña, no de motor), `Prepared`, `Harnessed`. Decidir en §8.

### 2.5 Criterio de aprobado
`hint-schema.json` generado y estable; guarda verde; 0 hints sin fila en el
registro; los `known-unrendered` con causa escrita; ninguno de los hints de
la lista "huecos conocidos" queda sin decisión.

---

## 3. Validación restante (no-software)

| # | Frente | Estado | Trabajo |
|---|---|---|---|
| V1 | **Specs reales en nightly** | ✅ **Decidido y cableado (2026-09-18)**: subconjunto real de 5 ficheros en `integration-report.mjs` (`deckvalidation`, `multi-user`, `priority-stop-real`, `skips`, `full-flow`) contra el stack local (`E2E_SERVER_HOST=127.0.0.1`, puerto 17171). Lobby/staging/mulligan/targeting/draft quedan cubiertos por fake+frames+`human-test` (son `fakeOnly()` por diseño; reescribirlos = coste M sin valor anti-drift) | Verificado con la corrida real del subconjunto |
| V2 | **CI visual** | ✅ **Decidido: opt-in documentado (2026-09-18)** — los 336 baselines macOS se mantienen y se regeneran on-demand (`test:e2e:visual`, `scripts/gallery-visual.mjs`); los pageerrors de la galería ya corren en CI vía e2e fake. Sin baselines Linux (mantenimiento doble sin presupuesto) | Si el nightly gana presupuesto: chromium 1366×768 (~48 baselines, 1-3 min/noche) |
| V3 | **P5 original (cliente Java)** | ✅ **Cerrado por decisión (2026-09-18)**: el riesgo lo cubren `callbackCoverage` + auditoría `JsonUtil` (con bug real corregido) + 3 guardas + 115 frames; el harness diferencial costaría M-L y no es determinista | — |
| V4 | **P6 fuzzer `--seed=`** | ✅ **Documentado y pospuesto (2026-09-18)**: el stall candidato ya se cerró (era bug del propio fuzzer); método de repro `--humanDeck/--simDeck` | Implementar seed (S) si vuelve una campaña de fuzzing |
| V5 | **§5.2** | 2 evaluadores; falta el 3 | Evaluador 3 en vivo (teclado + vista del rival) |
| V6 | **§5.3/5.5/5.6** | Pendientes | Personas (5 s, rondas de jugadores, dogfooding) |
| V7 | **§6 instalación** | Pendiente; bloqueantes JRE mac-arm64 y firma del updater | Máquinas limpias (Win/macOS/Ubuntu), SmartScreen/Gatekeeper, updater |

---

## 4. Guardas nuevas (resumen de lo que cambia en CI)

| Guarda | Tipo | Baseline | Falla si… |
|---|---|---|---|
| `hintCoverage.test.ts` | vitest + `scripts/hint-schema.mjs` | `web/fixtures/hint-schema.json` | el motor añade un hint sin fila en `hintRegistry` |
| `promptText` (unit + e2e gallery) | vitest/Playwright | corpus de frames (`slicer`, `goad`, `class-level`) | un prompt muestra `{this}`/`ICON_*`/`<br/>` |
| (existente) `engineViewCoverage` | vitest | `engine-view-gap.baseline.json` | campos de engine no copiados cambian |
| (existente) `mechanicsCoverage` | vitest | `contract.schema.json` | un campo del view queda sin modelar |

---

## 5. Heredado del plan4 (no se re-planifica)
- §5.3 (prueba de 5 s), §5.5 (jugadores), §5.6 (dogfooding): requieren personas.
- §6 (instalación/launcher): checklist completo en plan4 §6.
- Anexo §10 (wss, contraseña local, 10 usuarios, legal): baja prioridad.

---

## 6. Criterios de aprobado (plan5)

| Área | Umbral |
|---|---|
| Familia A (prompts) | 0 placeholders/residuos visibles en el corpus de tests; fix aplicado a los 24 methods |
| Familia B (hints) | `hint-schema.json` + `hintCoverage` verdes; 0 hints sin decisión |
| Specs reales | subconjunto real en nightly o justificación escrita |
| CI visual | baselines Linux + workflow (o decisión de dejarlo opt-in documentada) |
| P5/P6 | decisión escrita (cerrado o planificado con coste) |

---

## 7. Orden de trabajo

1. **Familia A** (S): helper + aplicación en `parse.ts` + corpus de tests +
   verificación del payload real del ask de Slicer. Cierra el hallazgo actual.
2. **Familia B** (M): `hint-schema.mjs` + `hintRegistry` + guarda; triage de
   los huecos conocidos; badges nuevos solo si el triage lo pide.
3. **Decisiones V1/V2** (S): specs reales y CI visual (pueden quedar
   documentadas como opt-in).
4. **P5/P6** (opcional, M): declarar o construir.
5. **V5–V7** (humanos/instalación): según disponibilidad; no bloquea 1–3.

---

## 8. Decisiones (resueltas 2026-09-18)

1. **Cliente, no fork** ✅ — saneado en `prompt()`; el ASK de Slicer resuelve
   `{this}` con `options.secondMessage` (el motor lo rellena con el nombre de la
   fuente en `HumanPlayer.chooseUse` + `GameImpl.addMessageToOptions`).
2. **Badges para los 5 huecos** ✅ — `CaseSolved`, `Harnessed`, `Evidence`,
   `Prepared` y `Protector` implementados en `designations.ts`/`CardSlot.tsx`
   (i18n ×9); `City's Blessing` se cierra como cubierto vía `designationNames`.
3. **Subconjunto real de 5 specs** ✅ — cableado en `integration-report.mjs`
   (contra `127.0.0.1:17171`), verificado en vivo (5 passed / 2 skipped).
4. **CI visual opt-in** ✅ — documentado; se revisará si el nightly gana
   presupuesto (opción chromium 1366×768).
5. **P5 cerrado por decisión** ✅ — evidencia: `callbackCoverage` + auditoría
   `JsonUtil` + 3 guardas + 115 frames.
6. **P6 `--seed=` pospuesto** ✅ — repro por `--humanDeck/--simDeck`; el stall
   candidato ya se cerró (bug del fuzzer).

---

## 9. Evidencia y referencias

- Caso Slicer: `web/fixtures/recorded/slicer.json` (manifest 115),
  `scripts/drivers/slicer.mjs`, invariante `hasSlicerCeded`; hallazgo del
  `{this}` en el log de grabación (stall + `E2E_DEBUG`).
- `CardUtil.replaceSourceName` — `../xmage-fork/Mage/src/main/java/mage/util/CardUtil.java:541`.
- `PermanentImpl.getRules` — `../xmage-fork/Mage/src/main/java/mage/game/permanent/PermanentImpl.java:313`.
- `HintUtils` — `../xmage-fork/Mage/src/main/java/mage/abilities/hint/HintUtils.java`.
- Parser web — `web/src/game/feedback/parse.ts:87` (GAME_ASK) y los 24 cases;
  `web/src/board/designations.ts` (`substituteCardRefs` ya existe).
- Guardas existentes — `web/src/state/callbackCoverage.test.ts`,
  `mechanicsCoverage.test.ts`, `engineViewCoverage.test.ts`.
