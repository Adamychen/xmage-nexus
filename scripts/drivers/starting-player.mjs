import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — §3.1 "Elegir quién empieza | Ganar la tirada | Diálogo con jugadores,
// timeout | S". El harness crea las mesas con skipStartingPlayerChoice:true
// (atajo determinista del fork), pero rec-lib acepta el opt-out: el driver
// declara skipStartingPlayerChoice:false y la mesa usa el flujo real.
//
// Forma REAL del prompt (GameImpl.init, fork 1.4.61-V1):
//   TargetPlayer targetPlayer = new TargetPlayer();
//   targetPlayer.withTargetName("starting player");
//   choosingPlayerId = pickChoosingPlayer(); // SORTEO ALEATORIO entre los que
//                                            // pueden responder ("won the toss")
//   choosingPlayer.choose(Outcome.Benefit, targetPlayer, null, this);
// El ganador del sorteo recibe un GAME_TARGET con message "Select a starting
// player" (HumanPlayer → ChooseTarget) y responde con sendPlayerUUID del
// playerId elegido (mismo camino que usa runTournamentRecorder para
// /starting player/i). Lo recibe UN solo jugador (el ganador del sorteo), no
// ambos; si el sorteo lo gana el SIM, su ComputerPlayer.makeChoice elige él
// mismo sin consultar (target.getMessage(game).equals("Select a starting
// player") → target.add(this.getId())). Timeout: GameController arranca un
// responseIdleTimeout sobre el choosingPlayerId.
//
// Captura: el primer GAME_UPDATE del turno 1 con nosotros activos (hemos
// elegido empezar), tierra jugada y pila vacía. Si el SIM gana el sorteo, no
// llega prompt (no respondemos nada): la run termina por maxMs y se reintenta.
function makeStartingPlayerDriver() {
  return {
    name: 'starting-player',
    outFile: 'starting-player.json',
    deck: {
      name: 'Mage Web starting rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    // Opt-out del atajo del harness: mesa con elección real de starting player.
    skipStartingPlayerChoice: false,
    // Si el sorteo lo gana el SIM (~50%), no hay prompt y no capturamos:
    // timeout corto para reintentar barato.
    maxMs: 90_000,
    _landTurn: -1,
    _sawPrompt: false,
    onTarget(ctx, question) {
      const q = String(question ?? '')
      if (/starting player/i.test(q)) {
        this._sawPrompt = true
        const me = ctx.gv?.myPlayerId ?? ctx.me?.playerId ?? ctx.me?.id
        ctx.log('onTarget: GAME_TARGET "Select a starting player" → me elijo a mí mismo', me)
        return me
      }
      return undefined
    },
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra T', turn)
          return
        }
      }
      ctx.pass()
    },
    // Invariante: tras la elección (solo si vimos el prompt y nos elegimos),
    // primer turno con nosotros como jugador activo, tierra en juego y pila
    // vacía (el estado posterior a la elección, no el diálogo).
    captureWhen(gv) {
      if (this._sawPrompt !== true) return false
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      const land = Object.values(me.battlefield ?? {}).some((c) => (c.cardTypes ?? []).includes('LAND'))
      return (
        gv.turn === 1 &&
        me.isActive === true &&
        gv.activePlayerId === me.playerId &&
        land &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    },
  }
}

export const drivers = { 'starting-player': makeStartingPlayerDriver }

export const meta = {
  mechanic: 'starting-player',
  kind: 'game',
  assert: 'hasStartingPlayerChoice',
  note: 'Elección real de quién empieza con el opt-out skipStartingPlayerChoice:false (sin el atajo determinista del fork, rec-lib lo reenvía en createTable): GameImpl.init hace el sorteo aleatorio (pickChoosingPlayer, inform "won the toss") y SOLO el ganador del sorteo recibe el prompt — UN jugador, no ambos. Payload exacto del prompt: GAME_TARGET con message "Select a starting player" y targets=[simPlayerId, myPlayerId], options={queryType:"PICK_TARGET", chosenTargets:[]}, flag=true; se responde sendPlayerUUID del playerId elegido (mismo camino que runTournamentRecorder para /starting player/i). Al rival no le llega nada: si el sorteo lo gana el SIM, su ComputerPlayer.makeChoice compara target.getMessage(game)=="Select a starting player" y se elige a sí mismo sin consultar (la run no captura y se reintenta; ~50% de sorteo). Timeout: GameController.startResponseIdleTimeout(choosingPlayerId) queda corriendo hasta que el elegido responde. Tras la elección el servidor emite sendStartMessage ("X chooses that Y will start") solo como inform en el log. Captura del estado posterior: turno 1, nosotros activos (nos elegimos) con gv.activePlayerId == me.playerId, tierra jugada (Forest) y pila vacía. Driver starting-player.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeStartingPlayerDriver())
}
