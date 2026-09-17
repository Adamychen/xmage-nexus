---
name: mage-e2e-sim
description: Contexto completo de los E2E del Mage con oponentes simulados (Sim) y helper WS: SimPlayer, HumanHelper, librerías support/, fake vs real, trampas conocidas, depuración y lecciones cerradas. Úsalo al tocar o depurar web/e2e (spells, targeting, combat, full-flow, wshelper), al investigar flakes de e2e, o al trabajar en el bot Sim del proxy (SimPlayer.java). Keywords: e2e, playwright, Sim, HumanHelper, wshelper, spells.spec, targeting.spec, combat.spec, full-flow, fake, real, __mageScene, support, wshelper.
---

# E2E con oponente Simulado (Sim) y helper WS

## Arquitectura (4 piezas)

1. **Bot Sim en el proxy** (`Mage.Proxy/src/main/java/org/mage/proxy/SimPlayer.java`):
   Oponente determinista con su PROPIA sesión de servidor (el servidor oficial ve un asiento
   humano normal). El web pide asientos `SIM` en `createTable` (`playerTypes: ['HUMAN','SIM']`),
   el proxy los convierte a `HUMAN` para el servidor y une un `SimPlayer` por asiento con su
   propia conexión. Mazos por asiento vía `simDecks` (array de decks en createTable); por defecto
   solo tierras. Reglas del bot: jugar 1 tierra/turno en su main phase; lanzar el primer
   criatura/instantáneo/conjuro **pagable en COLOR** apuntando al oponente; atacar siempre
   ("All attack" = `sendPlayerString(gameId,"special")` en DECLARE_ATTACKERS con opción
   `specialButton`); bloquear siempre (1 bloqueador por select de DECLARE_BLOCKERS); mulligan =
   keep (`sendPlayerBoolean(false)`); descarte = primer id; "pass anyway" = true.
   Rebuild: `node scripts/build.mjs proxy` + `node scripts/ctl.mjs restart all`.
   **OJO**: tras reiniciar SOLO el proxy, el primer login suele colgarse (sesiones huérfanas del
   servidor).

2. **HumanHelper** (`web/e2e/wshelper.ts`): conexión WS de NODE al proxy con el MISMO usuario que
   la página (el connect idempotente del proxy añade la conexión sin reiniciar la sesión). Juega
   el "desarrollo" del humano y mantiene la partida en movimiento. Reglas de `handleSelect`:
   - solo actúa en GAME_SELECT con `hasPriority === true`;
   - main phase (`isActive && PRECOMBAT_MAIN`): jugar 1 tierra/turno si hay en mano y **NO
     durante un pago de maná** (`payingUntil` = última GAME_PLAY_MANA + 3s — jugar tierra o
     pasar a mitad de pago CANCELA el hechizo);
   - stack no vacío y fuera de pago → pasar (el hechizo resuelve);
   - main phase sin actuar → `armFallback()` (timer de 1.5s que pasa si la ventana sigue abierta
     y no se está pagando); **el timer es OBLIGATORIO**: sin él, tras un select sin respuesta no
     llegan más eventos y la partida se congela;
   - no-main → pasar al instante;
   - GAME_TARGET con "discard" → primer id (descarte); el resto de targets NO se responden (los
     responde el test);
   - GAME_ASK → **NO responde el mulligan** (el auto-keep del web ya lo hace; un segundo
     `sendPlayerBoolean(false)` pasa la prioridad del main y pierde la ventana del test — era la
     flake de targeting, resuelta 2026-08-17); el resto de asks → true.
   El helper se conecta ANTES del `startMatch` (lo arranca `startGame`): captura el
   START_GAME/GAME_INIT desde el primer evento y espera `waitGameId`. Métodos públicos:
   `start()`, `stop()`, `waitGameId(timeoutMs)`, `playCard(id)` (= `sendPlayerUUID` — vale para
   lanzar cartas, elegir objetivo y pagar maná). Se registran en `cleanup.ts` (`registerHelper`)
   y se cierran en `test.afterEach`.

3. **Diseño híbrido WS+UI**: las acciones "aburridas" y las que causan carreras van por WS
   (desarrollo, lanzar el hechizo, elegir objetivo, pagar maná); la UI se usa para lo que se
   VERIFICA (login, lobby, mesa, diálogos "Pagar maná"/"Elige objetivo"/X, render del tablero,
   pageerrors). **Los tests NO activan el auto-pase del web**: sus pases aleatorios compiten con
   la ventana de lanzamiento y la cierran. El helper + sus reglas mantienen la partida en
   movimiento.

4. **Arquitectura modular + doble backend** (2026-08-17): specs por dominio con tags
   `@spells/@targeting/@combat/@fullflow/@mechanics/...`; librerías comunes en `web/e2e/support/`
   (`frames.ts`, `start-game.ts` → `GameSession`, `game-screen.ts`, `scene.ts`, `canvas.ts`,
   `fake-backend.ts` → `withFakeServer`, `fake-mode.ts` → `fakeOnly()`, `fake-port.ts`); y
   escenarios declarativos del FixtureServer en `web/fixtures/scenarios/` (mini-motor
   `humanGame.ts`). Todo corre en fake (sin stack, vite 5175 + FixtureServer 8789) y en real
   (contrato, vite 5173 + proxy 8787). En real los specs marcados `fakeOnly()` se saltan.
   Al tocar `support/` o los escenarios: fake completo + real.
   El estado del tablero se publica en `window.__mageScene` (solo DEV,
   `web/src/board/sceneBridge.ts`, refresco cada 500 ms salvo vuelos): `cards`, `playable`,
   `click(id)`, `targeting`, `combat`, `game`, `gameView`.

## Protocolo (verificado contra el servidor)

- Jugar carta/tierra de la mano: `sendPlayerUUID(gameId, cardId)`.
- Elegir objetivo de GAME_TARGET: `sendPlayerUUID(gameId, playerId/cardId)`.
- Pagar maná: cada ask GAME_PLAY_MANA se paga con `sendPlayerUUID(gameId, sourceId)` (un source
  por ask; el servidor re-pregunta mientras quede coste).
- X-cost: `sendPlayerInteger(gameId, X)` desde el diálogo GAME_GET_AMOUNT.
- Pasar prioridad: `sendPlayerBoolean(gameId, false)`. Mulligan keep: false.
- Ataque "All attack": `sendPlayerString(gameId, "special")`.
- **Los frames pueden llegar sin gameView o con canPlayObjects vacío/desactualizado**: usar
  SIEMPRE el último view (`lastGameView`) para leer battlefield/hand/maná.

## Trampas conocidas (NO repetir la arqueología)

- **gameId del helper**: solo se setea con objectId de eventos `START_GAME`/`GAME_*`.
  CHATMESSAGE y JOINED_TABLE también traen objectId (chat/mesa) y contaminan el id.
- **X-cost jugable con X=0**: el servidor lista el Blaze como jugable aunque no haya maná (X=0).
  `waitPlayable` exige `minUntapped` (y `needPlains`) + MI main phase (isActive &&
  PRECOMBAT_MAIN) + jugabilidad leída de los FRAMES (`playableInView`, no de la escena). Blaze
  necesita 3, Arc Trail 2, Boros 2 (+Plains), Ballista 8.
- **`hasPriority` en el gameView es poco fiable** (a menudo false en MI propio turno); la escena
  (`__mageScene`) va un render por detrás en partidas rápidas. No depender de ellos para acciones
  del test.
- **El auto-pase del web compite con las ventanas**: los tests lo desactivan.
- **Pagar/pasar durante un pago de maná cancela el hechizo**: el helper lo evita con
  `payingUntil`; el bucle de pago del test espera el SIGUIENTE ask (5s de timeout = pago
  completo), nunca sale por hasMyPriority.
- **Views stale en asks de maná**: `nextManaSource` usa `lastGameView`, con reintento
  (lecturas cada ~150 ms) y fallback a tierras básicas sin girar por nombre (Mountain→R, Plains→W).
- **Cursor estricto de asks**: no re-matchear el mismo ask con lookback (`parsedLen-10`) o se
  paga una segunda fuente.
- **El retry del test mata la partida anterior**: cuando un intento falla, el connect del
  siguiente usuario hace `connectStop` de la sesión anterior → la partida vieja termina con
  victoria del rival (parece "el Sim gana" pero es el session swap).
- **Un comentario JSDoc sin cerrar comenta el resto del archivo** (bug real sufrido: funciones
  "no definidas" en runtime). Cuidado al borrar funciones con edit.

## Lecciones históricas (casos CERRADOS — contexto, no re-investigar)

- **Demo congelada (2026-08-16)**: `SimPlayer.tryCast` mandaba el UUID del Bolt aunque sus
  tierras fueran ISLANDs; el servidor lo rechaza y re-otorga prioridad con la misma vista →
  GAME_SELECT infinito (~48/s al watcher). Fix: `tryCast` color-aware (`colorsOf` +
  `canProduceColors`) + dedup por firma `(turno, paso, mano, tierras)`.
- **Sesiones huérfanas**: reiniciar solo el proxy corrompe el bridge (primer login colgado,
  partidas humanas degradadas, "victoria del Sim" espuria). Fix operativo: `restart all` tras
  cualquier reinicio del proxy.
- **Doble mulligan (flake de targeting, 2026-08-17)**: auto-keep del web + helper respondiendo
  el ASK del mulligan = 2 falses; el 2º pasaba la prioridad del main y el hechizo nunca se
  lanzaba (partida en turno 22 sin GAME_TARGET). Fix: el helper no responde el mulligan.
- **Pago con fuente stale (spells/targeting)**: `payMana` seleccionaba la fuente una sola vez;
  si el ask llegaba con la vista vieja, throw "sin fuente de maná". Fix: reintento de
  `nextManaSource` + cursor estricto (arriba).
- **Contrato del fake (lecciones del diseño)**: IDs de mano ÚNICOS (`human-<i>`; keys repetidas
  truncaban la mano); `battlefield` como `Record<UUID, PermanentView>` (nunca array:
  `nextManaSource` busca por id); el fake no emite el 2º target de Arc Trail (el spec lo tolera).

## Workflow de depuración

- Test aislado: `npm --prefix web run test:e2e:spells -- --grep "Blaze" --reporter=list`
  (o `test:e2e:targeting|combat|fullflow`; añade `E2E_BACKEND=real` para el contrato real).
- Frames/sent del test: se capturan en `frames`/`sent` (page.on websocket). Para verlos en un
  fallo: dump temporal con `fs.writeFileSync('/tmp/x.jsonl', ...)` en el punto del fallo.
- Decisiones del Sim: `.run/proxy.err.log` (formato "INFORMACIÓN:" — stderr de JUL; los INFO van
  a `.run/proxy.out.log` con otro formato).
- Servidor: `.run/server.out.log` (gameId del match para correlacionar).
- Error context: `web/test-results/<test>/error-context.md` (snapshot de página + error).
- Tras tocar web: `npm --prefix web run test` + `npm --prefix web run typecheck`.
- Tras tocar Java del proxy: `mvn -q -o -pl Mage.Proxy test-compile` →
  `node scripts/build.mjs proxy` → `node scripts/ctl.mjs restart all`.

## Conocimiento del servidor (para no volver a buscar)

- El fin de partida por "idle" es `onResponseIdleTimeout` → `game.idleTimeout` → concede; en
  testMode el timeout es 3600s, no es la causa de partidas cortas.
- `GameController.startResponseIdleTimeout` se arma en cada `perform` (cada ask).
- El forced-join de 10s (`GAME_TIMEOUTS_CHECK_JOINING_STATUS_EVERY_SECS=10`) se evita con
  `joinGame(gameId)` en START_GAME (el web ya lo hace en store.ts).
- El `sendPlayerUUID` con un UUID inválido se ignora en silencio (no rompe nada).
- Cartas: Blaze = 6ED 168; Arc Trail = SOM 81; Boros Charm = FDN 721; Walking Ballista = 2XM 306;
  Lightning Bolt = M10 146; Raging Goblin = M10 153 (1/1 haste); Mountain = LEA 292;
  Plains = LEA 287; Island = LEA 288.
