import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — "no puede bloquear" (§3.6, misma fila que menace/must-block) vía
// cheatSetup: Tormented Soul (M12 114, {B} 1/1 Spirit: "Tormented Soul can't
// block and can't be blocked."; CantBlockAbility + CantBeBlockedSourceEffect
// en una única habilidad) al campo propio. El SIM (mazo pasivo de tierras)
// recibe un Grizzly Bears 2/2 con el segundo cheat (encadenado a 800 ms: dos
// cheats casi simultáneos revientan el servidor; el retardo es de reloj real y
// el juego avanza turnos rápidos entre medias) y en SU turno ataca con todo.
// Nuestra única criatura está destapada pero NO es elegible como bloqueadora
// por regla (no es una decisión de la IA), así que el ataque entra sin
// bloqueo: nuestra vida 20→18.
//
// El lado "can't be blocked" de la carta queda documentado en el rules del
// frame; este fixture demuestra el lado "can't block" (el prioritario).
function makeCantBlockDriver() {
  return {
    name: 'cant-block',
    outFile: 'cant-block.json',
    deck: {
      name: 'Mage Web cant-block rec',
      cards: [{ cardName: 'Swamp', setCode: 'iko', cardNumber: '266', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _chainStarted: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Tierra por turno (mazo todo Pantanos): acción normal previa al cheat
      // y evita el descarte de limpieza.
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra T', turn)
          return
        }
      }
      // Regla P1: el cheat va tras ≥1 acción normal (la tierra del T1).
      if (!this._chainStarted) {
        this._chainStarted = true
        const rival = (gv.players ?? []).find((p) => !p?.controlled)
        const rid = rival?.playerId ?? rival?.id
        ctx.log('onSelect: cheatSetup (Tormented Soul propio, luego Grizzly rival)')
        void ctx
          .cheatSetup({ battlefield: ['Tormented Soul'] })
          .then((r1) =>
            new Promise((r) => setTimeout(r, 800)).then(() =>
              r1?.ok && rid ? ctx.cheatSetup({ battlefield: ['Grizzly Bears'] }, rid) : null,
            ),
          )
          .then((r2) => {
            ctx.log('onSelect: cheats →', JSON.stringify({ r2: r2?.ok === true }))
          })
        return
      }
      ctx.pass()
    },
    // Invariante: la Tormented Soul DESTAPADA en nuestro campo (única criatura,
    // no elegible como bloqueadora por regla), el Grizzly del SIM vivo en el
    // suyo (atacó sin bloqueo) y nuestra vida 18 (los 2 del Grizzly). El frame
    // trae el rules de la Soul con "can't block".
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      if (!me || !sim) return false
      const soul = Object.values(me.battlefield ?? {}).find((c) => /tormented soul/i.test(c?.name ?? ''))
      const grizzly = Object.values(sim.battlefield ?? {}).find((c) => /grizzly bears/i.test(c?.name ?? ''))
      return Number(me.life) === 18 && Number(sim.life) === 20 && Boolean(soul) && soul.tapped !== true && Boolean(grizzly)
    },
  }
}

export const drivers = { 'cant-block': makeCantBlockDriver }

export const meta = {
  mechanic: 'cant-block',
  kind: 'game',
  assert: 'hasCantBlock',
  note: 'Restricción estática "can\'t block" (Tormented Soul, M12 114: {B} 1/1 Spirit con CantBlockAbility + CantBeBlockedSourceEffect, "can\'t block and can\'t be blocked") cheateada al campo propio; Grizzly Bears 2/2 cheateado al del SIM con el segundo cheat (encadenado a 800 ms; el retardo es de reloj real y el juego avanza turnos rápidos entre medias — en la captura el Grizzly entró en el T18 y atacó en el T19). En el turno del SIM este ataca con todo: la Tormented Soul está destapada y es nuestra ÚNICA criatura, pero por regla no es elegible como bloqueadora (no es una decisión de la IA), así que el ataque entra sin bloqueo (combat[].isBlocked=false, blockers vacío) y nuestra vida cae 20→18. Captura: vida 18, Grizzly atacante vivo y girado en el campo rival y Tormented Soul destapada en el nuestro; su CardView.rules incluye "{this} can\'t block and can\'t be blocked." + el icono "ICON_RESTRICTCan\'t block (Tormented Soul [62f])". El otro lado de la carta (can\'t be blocked) no se ejercita en este fixture (prioridad: can\'t block). Driver cant-block con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeCantBlockDriver())
}
