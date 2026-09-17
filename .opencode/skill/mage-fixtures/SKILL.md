---
name: mage-fixtures
description: Flujo de frames reales grabados (golden frames, anti-drift): grabar con scripts/record.mjs y los drivers, sincronizar el manifest, validar contra el contrato y replay en el FakeServer. Úsalo al añadir/actualizar una mecánica, al re-grabar frames tras tocar proxy/contrato/fork, o si fallan recorded.test.ts / recorded.spec.ts. Keywords: fixtures, recorded, goldens, record.mjs, drivers, manifest, record-sync, replay, FakeServer, mechanicsCoverage, captureWhen, cheatSetup.
---

# Frames grabados (golden frames) y anti-drift

## Para qué sirve / quién consume qué

```
scripts/record.mjs + scripts/drivers/*.mjs   (stack real local, testMode)
        |  escribe web/fixtures/recorded/<frame>.json  {recordedAt, gameId, gameView}
        v
scripts/record-sync.mjs  -> web/fixtures/recorded/manifest.json (file/mechanic/kind/assert/note)
        v
web/fixtures/recorded.test.ts (vitest, sin stack): zod gameViewFromAndValidate + invariante
        v
web/fixtures/scenarios/replay-recorded.ts -> web/e2e/recorded.spec.ts (Playwright fake)
```

Estado (2026-09): ~106 frames + manifest (104 `game`, 1 `construct` sealed-pool, 1 `tournament`).
El replay es SOLO fake: en modo real los tests de `recorded.spec.ts` salen skipped.

## Requisitos y comandos

- Stack local: `node scripts/ctl.mjs restart all` (server 17171 testMode + proxy 8787).
  Beta NO vale como oráculo (login anónimo intermitente); ver skill `mage-stack`.
- Un driver: `node scripts/record.mjs <driver>`; todos: `node scripts/record.mjs` (o `all`).
  Módulo directo (sin pasar por el registro): `node scripts/drivers/<x>.mjs`.
- `game-clock-timeout` está FUERA del registro: solo `node scripts/drivers/game-clock-timeout.mjs`
  (reimplementa el recorder para configurar timeLimit/bufferTime).
- `node scripts/record-sync.mjs` vuelca los `meta` de los drivers al manifest y avisa de
  asserts pendientes en `recorded.test.ts`.
- Validar (sin stack): `npm --prefix web run test -- fixtures/recorded.test.ts` (o capa `unit`).
  Replay: en `web/`, `npx playwright test recorded.spec.ts` (tag `@recorded`).
- Vía MCP: tool `mage_record_fixture { mechanic, timeoutSec }` (default `all`, 300 s).
- Env: `E2E_SERVER_HOST`/`E2E_SERVER_PORT` = servidor XMage destino (default `localhost:17171`;
  el WS del proxy está hardcodeado a `ws://127.0.0.1:8787`). `REC_DUMP_EVENTS=1` vuelca un
  sidecar `<driver>.events.jsonl` (gitignored) para depurar; `E2E_DEBUG` logs del recorder.
- OJO: `record.mjs all` lanza un hijo por driver pero IGNORA su exit code (siempre 0) y emite
  probes no commiteadas; verifica mirando el manifest/ficheros o el vitest.

## Añadir o re-grabar un driver

1. Plantilla: `scripts/drivers/dash.mjs` (mínimo) o `scripts/drivers/manifest.mjs` (cheatSetup + onTarget).
2. El módulo exporta `export const drivers = { nombre: factory }` y
   `export const meta = { mechanic, assert, note, file?, kind? }`, más un runner directo al
   final (`if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
   await runRecorder(factory())`). `file` default `${mechanic}.json`; `kind` default `'game'`.
   Nunca `outFile: 'manifest.json'` (es el índice).
3. Driver: `{ name, outFile, deck, simDeck(s), playerTypes, tableGameType, freeMulligans,
   skipStartingPlayerChoice, maxMs, onSelect/onAsk/onTarget/..., captureWhen }`.
   Mazo: `{ name, cards: [{ cardName, setCode, cardNumber, amount }], sideboard, commanders? }`
   (Sim por defecto: 50 Forest + 50 Island; Commander va con `commanders`).
4. `onSelect`: actuar SOLO con prioridad propia y main propia (`me.hasPriority === true`,
   `gv.phase` PRECOMBAT_MAIN/POSTCOMBAT_MAIN), jugar 1 tierra/turno, lanzar con
   `ctx.cardInHand(nombre)` + `ctx.untappedMana()`, si no `ctx.pass()`. Usa flags de instancia
   (`_cast`, `_cheated`) para idempotencia.
5. Hooks: `onAsk`, `onChooseAbility` (elegir por label), `onChooseChoice`, `onChoosePile`
   (booleano, true = pile1), `onTarget` (devolver `false` declina un objetivo opcional "hasta uno"),
   `onTargetAmount`, `onMultiAmount` (valores separados por espacio), `onPlayMana`, `onSelect`.
   `ctx`: `cheatSetup`, `playLand`, `playCardByName`, `playAbility` (clic del permanente, NO su
   UUID), `pass`, `findOnBattlefield`, `cardInHand`, `untappedMana`, `log`.
6. `captureWhen(gv)`: se evalúa tras CADA evento que traiga gameView (incluye `GAME_UPDATE`
   plano y `GAME_OVER`); se guarda el PRIMER match, termina y cierra el WS.
7. Assert: añadirlo A MANO al union `AssertKind` y a su `case` en `runAssert` de
   `web/fixtures/recorded.test.ts` (`record-sync` solo avisa; no edita el test). Si aplica,
   rama DOM específica en `web/e2e/recorded.spec.ts`.
8. `node scripts/record-sync.mjs` -> vitest -> replay Playwright.

## Reglas del cheatSetup (solo testMode)

- Solo en TU turno y tras >=1 acción normal; en la primera prioridad de la partida o en turno
  ajeno congela el hilo. Watchdog: 60 s sin eventos tras un cheat ok -> aborta y reintenta.
- `library`: el ÚLTIMO nombre de la lista queda ARRIBA. Con `skipInitShuffling` (deck apilado),
  el PRIMER `cardName` del deck es la mano.
- Tras el cheat puede quedar un SELECT pendiente: `rec-lib` lo auto-pasa si no hubo re-prompt.
- No cheatear permanentes con decisión "as it enters" al campo: revienta el WorkerThread del proxy.

## Trampas

- Mulligan: `sendPlayerBoolean(false)` = keep; no responder el ASK deja la partida sin arrancar.
  `freeMulligans` solo se pasa a la mesa si el driver lo define.
- Maná: un `GAME_PLAY_MANA` por ask, `sendPlayerUUID(sourceId)`; si el server rechaza la fuente
  (p.ej. criatura mareada) se entra en bucle infinito -> girar solo tierras / guardar con
  `untappedMana()`; el color del coste viene en el prompt ("Pay {W}").
- Descarte/sacrificio llegan también como `GAME_TARGET`: discrimina por texto y no repitas UUID
  (UUID repetido = rechazo en bucle). `GAME_CHOOSE_PILE` es booleano; `GAME_CHOOSE_ABILITY` se
  elige por label (el orden no es fiable).
- `playAbility`: enviar el UUID de la habilidad no hace nada; hay que clicar el permanente y
  resolver `GAME_CHOOSE_ABILITY`.
- No se puede grabar lo que no viaja en un `GameView`: `END_GAME_INFO`, chat (dados/moneda),
  flag day/night (solo hint en `rules`), timeouts de reloj (requieren recorder propio).
- `maxMs` default 240 s (game) / 480 s (torneo); el connect reintenta 6x5 s. Torneos/limitado
  usan `runTournamentRecorder` + `driver.kind='tournament'`.
- Re-grabar con campos nuevos puede romper `mechanicsCoverage` (cross-check de frames) o el zod:
  ver skill `mage-contract-codegen`.

## Checklist al tocar fixtures

1. Frames + manifest sincronizados (`record-sync.mjs`); assert en `recorded.test.ts` y replay verde.
2. `npm --prefix web run test` (guardas incluidas) + `npx playwright test recorded.spec.ts`.
3. `web/INTERACTION_COVERAGE.md`: fila de la mecánica con `fixtures/recorded/<x>.json` +
   invariante + fecha.
4. `PROJECT.md` (log con fecha y hallazgos) y `docs/qa/p4-frames-log.md` si es una tanda P4.
