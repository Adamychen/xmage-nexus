import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Contadores de jugador (§3.10 veneno, energía, radiación): radiación con
// Mariposa Military Base (tierra de Fallout): "You may have Mariposa Military
// Base enter the battlefield tapped. If you do, you get two rad counters."
// + "{T}: Add {C}."
//
// Montaje: T1 tierra (Forest, acción normal previa al cheat) + cheatSetup con
// Mariposa en MANO y 3 Grizzly Bears encima de la biblioteca (no-tierras para
// que el trigger tenga algo que moler). T2: se juega Mariposa como tierra del
// turno → su ETB "may" llega como GAME_ASK → SÍ → la tierra entra girada y el
// jugador recibe 2 contadores "rad" (CounterType.RAD("rad") vía
// AddCountersPlayersEffect, NO "radiation"). T3: en el paso de robo se roba 1
// Grizzly (el 2º), y al empezar la precombat main dispara el emblem Radiation
// (helper emblem siempre presente en gv.myHelperEmblems): con 2 rad muele 2
// cartas = Grizzly + tierra → pierde 1 vida (20→19) y quita 1 rad (2→1).
//
// HALLAZGO (RadiationEmblem.java): el trigger inherente de los rad counters NO
// es un upkeep sino "At the beginning of each player's precombat main phase";
// el texto real (regla 725.1) está en el rules del emblem: muele tantas cartas
// como rad counters y por cada NO-tierra pierde 1 vida y quita 1 rad (no hay
// tirada de dado). El emblem se ve en la vista para ambos jugadores.
//
// El plan inicial con Glowing One (daño de combate → 4 rad al SIM) se descartó
// en vivo: el SIM recibía 4 rad por turno y el trigger le molía 4 tierras cada
// turno (su mazo es solo tierras, sin vida perdida), agotándole la biblioteca
// en ~16 turnos antes de poder capturar. Mariposa evita el combate y el pago.
function makeRadiationDriver() {
  return {
    name: 'radiation',
    outFile: 'radiation.json',
    deck: {
      name: 'Mage Web radiation rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _mariposaPlayed: false,
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
      // Regla P1: el cheat va tras ≥1 acción normal (la tierra del T1).
      if (!this._cheated) {
        if (turn !== this._landTurn && ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra T', turn)
          return
        }
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Mariposa en mano, 3 Grizzly Bears en la biblioteca)')
        void ctx
          .cheatSetup({ hand: ['Mariposa Military Base'], library: ['Grizzly Bears', 'Grizzly Bears', 'Grizzly Bears'] })
          .then((r) => {
            if (r?.ok !== true) this._cheated = false // ok:false → reintentar la próxima ventana
            ctx.log('onSelect: cheat →', JSON.stringify({ ok: r?.ok === true }))
          })
        return
      }
      ctx.log('counters', JSON.stringify(me.counters ?? []), 'life', me.life, 'lib', me.libraryCount)
      if (turn !== this._landTurn) {
        // Mariposa es la tierra del turno: se juega con su ETB "may" pendiente
        // de responder (onAsk → SÍ). Solo si aún no hemos jugado tierra este
        // turno (jugar dos tierras = acción rechazada en silencio).
        if (!this._mariposaPlayed && ctx.cardInHand('Mariposa Military Base')) {
          this._mariposaPlayed = true
          ctx.log('onSelect: juego Mariposa Military Base (ETB may → 2 rad)')
          ctx.playCardByName('Mariposa Military Base')
          return
        }
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra T', turn)
          return
        }
      }
      ctx.pass()
    },
    // ETB "may" de Mariposa: entra girada y da 2 rad counters. El resto de
    // preguntas caen al default de la librería (mulligan → keep).
    onAsk(question, ctx) {
      const q = String(question ?? '')
      if (/mariposa|enter the battlefield tapped|rad/i.test(q)) {
        ctx.log('onAsk: ETB de Mariposa → SÍ (entra girada, +2 rad)', JSON.stringify(q).slice(0, 120))
        return true
      }
      return undefined
    },
    // Descarte de limpieza: una carta de mano distinta por prompt para no
    // repetir UUID (mismo UUID = rechazo en bucle).
    onTarget(ctx, question) {
      if (/discard/i.test(String(question ?? ''))) {
        this._spent = this._spent ?? []
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const pick = Object.entries(hand).find(([id]) => !this._spent.includes(id))
        if (pick) {
          this._spent.push(pick[0])
          ctx.log('onTarget: descarte limpieza', pick[1]?.name)
          return pick[0]
        }
        return false
      }
      return undefined
    },
    // Invariante: tras resolver el trigger de precombat main queda >=1 contador
    // de jugador "rad" (2−1 por la no-tierra molida), la vida bajó 20→19 por
    // esa misma carta, hay un Grizzly Bears molido en el cementerio y la pila
    // está vacía.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      const rad = (me.counters ?? []).find((c) => /^rad$/i.test(String(c?.name ?? '')))
      const n = Number(rad?.count ?? 0)
      const bearGy = Object.values(me.graveyard ?? {}).some((c) => /grizzly bears/i.test(String(c?.name ?? '')))
      return n >= 1 && n <= 3 && Number(me.life) === 19 && bearGy && Object.keys(gv.stack ?? {}).length === 0
    },
  }
}

export const drivers = { radiation: makeRadiationDriver }

export const meta = {
  mechanic: 'radiation',
  kind: 'game',
  assert: 'hasRadiation',
  note: 'Radiación con Mariposa Military Base (tierra de Fallout) cheateada a la mano en T1 (3 Grizzly Bears no-tierra encima de la biblioteca): al jugarla como tierra del turno su ETB "may" llega como GAME_ASK ("you may have it enter tapped") y al responder SÍ el jugador recibe 2 contadores de jugador "rad" (CounterType.RAD = "rad", NO "radiation"; PlayerView.counters [{name:"rad",count:N}]). HALLAZGO fuente: el trigger inherente de los rad counters NO es un upkeep sino el inicio de cada precombat main del jugador radiado (RadiationEmblem, regla 725.1: muele tantas cartas como rad counters tenga y por cada NO-tierra pierde 1 vida y quita 1 rad; sin dado). Captura tras resolver ese trigger: me.counters rad=1 (2−1), vida 19, el Grizzly molido en el cementerio, pila vacía. El emblem "Radiation" con su rules text aparece siempre en gv.myHelperEmblems. Driver radiation con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeRadiationDriver())
}
