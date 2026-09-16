import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — elegir tipo de criatura (§3.7) vía cheatSetup: Cavern of Souls a la
// MANO y jugada como tierra. Hallazgo P4 (2026-09-16): cheatearla DIRECTA al
// campo revienta — el "as enters" (EntersBattlefieldEffect →
// ChooseCreatureTypeEffect → HumanPlayer.choose → prepareForResponse) exige el
// hilo GAME, pero game.cheat corre en el WorkerThread del proxy → FATAL "Wrong
// code usage: game related code must run in GAME thread" y la tierra no entra:
// no hay prompt. Por eso va a la mano (colocarla no pide decisión) y se juega
// como la tierra de un turno posterior: la resolución corre en el hilo GAME.
// ChooseCreatureTypeEffect usa ChoiceCreatureType: clave=valor=SubType.toString()
// ("Elf"), keyChoices CON datos + searchEnabled=true + sortData que en
// onChooseStart anota qué tipos tienen los jugadores ("Elf (me)" si la
// mano/campo/cementerio propia tiene Elfos). Al ser key-choice se responde
// sendPlayerString con la CLAVE ("Elf"), no con el label; el motor guarda
// choiceKey y añade el info "Chosen type: Elf". Mazo todo Bosques: la tierra
// del T1 es la acción normal previa al cheat (regla P1).
function makeCavernDriver() {
  return {
    name: 'cavern',
    outFile: 'cavern.json',
    deck: {
      name: 'Mage Web cavern rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _acted: false,
    _cheated: false,
    _played: false,
    _landTurn: -1,
    _typed: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el cheat va tras ≥1 acción normal (la tierra del T1).
      const turn = gv.turn ?? 0
      if (!this._acted) {
        if (ctx.playLand()) {
          this._acted = true
          this._landTurn = turn
          ctx.log('onSelect: tierra (acción normal previa al cheat)')
        } else ctx.pass()
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Cavern of Souls a la mano; se jugará como tierra)')
        void ctx.cheatSetup({ hand: ['Cavern of Souls'] })
        return
      }
      // La Cavern se juega como la tierra del siguiente turno (una por turno;
      // si esta turnada ya se usó, se espera). El chooser corre en el hilo GAME.
      if (!this._played && ctx.cardInHand('Cavern of Souls') && turn !== this._landTurn) {
        this._played = true
        this._landTurn = turn
        ctx.log('onSelect: juego Cavern of Souls como tierra')
        ctx.playCardByName('Cavern of Souls')
        return
      }
      if (turn !== this._landTurn && ctx.playLand()) {
        this._landTurn = turn
        return
      }
      ctx.pass()
    },
    // Lista larga filtrable: keyChoices = {Elf: "Elf", ...}; el label puede
    // venir anotado por ChoiceCreatureType.onChooseStart ("Elf (me)"), pero la
    // RESPUESTA es la clave (setChoiceByKey en HumanPlayer).
    onChooseChoice(opts, ctx) {
      ctx.log('onChooseChoice tipos=', optionsSummary(opts))
      if (this._typed) return undefined
      const elf = (opts ?? []).find((o) => /^elf\b/i.test(String(o?.label ?? '')))
      if (!elf) return undefined
      this._typed = true
      ctx.log('onChooseChoice: elijo key', elf.value)
      return elf.value
    },
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) {
        // El descarte de limpieza es obligatorio (flag=true): devolver false
        // re-pregunta en bucle (visto en vivo); hay que elegir una carta.
        const ids = Array.isArray(data?.targets) ? data.targets : Object.keys(data?.targets ?? {})
        if (ids.length > 0) return ids[0]
        return false
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      return Object.values(me?.battlefield ?? {}).some((c) => /cavern of souls/i.test(c?.name ?? ''))
    },
  }
}

function optionsSummary(opts) {
  const list = opts ?? []
  const sample = list.slice(0, 8).map((o) => o.label)
  return JSON.stringify({ n: list.length, sample })
}

export const drivers = { cavern: makeCavernDriver }

export const meta = {
  mechanic: 'cavern',
  kind: 'game',
  assert: 'hasCavern',
  note: 'Cavern of Souls cheateada a la mano y jugada como tierra (cheatearla directa al campo NO funciona: el chooser del "as enters" corre en el WorkerThread del proxy y el servidor aborta con "Wrong code usage: game related code must run in GAME thread"). ChooseCreatureTypeEffect abre un GAME_CHOOSE_CHOICE con ChoiceCreatureType cuyos keyChoices son SubType→SubType ("Elf"→"Elf"+" (me)" si la mano/campo/cementerio propia tiene Elfos), con searchEnabled=true y sortData por relevancia — key-choice: se responde sendPlayerString con la CLAVE ("Elf"). Captura: Cavern en el battlefield propio; su CardView lleva en rules el info "<font color = \'blue\'>Chosen type: Elf</font>" (getRules añade el mapa info del permanente, añadido por ChooseCreatureTypeEffect), prueba de que el tipo quedó fijado. Interés UI: lista larga filtrable de tipos. Driver P4 con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeCavernDriver())
}
