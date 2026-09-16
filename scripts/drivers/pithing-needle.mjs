import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — nombrar carta (§3.7) vía cheatSetup: Pithing Needle ({1}) a la MANO y
// lanzada desde la mano. Hallazgo P4 (2026-09-16): cheatearla DIRECTA al campo
// revienta — el "as enters" (EntersBattlefieldEffect → ChooseACardNameEffect →
// HumanPlayer.choose → prepareForResponse) exige el hilo GAME, pero game.cheat
// corre en el WorkerThread del proxy → FATAL "Wrong code usage: game related
// code must run in GAME thread" (MageServerImpl.handleException) y la carta no
// llega a entrar: no hay prompt. Por eso va a la mano (colocarla no pide
// decisión) y se lanza de verdad: la resolución corre en el hilo GAME y el
// chooser llega normal. ChooseACardNameEffect(TypeOfName.ALL) abre un
// GAME_CHOOSE_CHOICE con ChoiceImpl(required=true, hintType=CARD) y
// choices = CardRepository.getNames() (~25.000 nombres): es STRING MODE
// (isKeyChoice()=false porque keyChoices queda VACÍO) → se responde
// sendPlayerString con el nombre EXACTO (validado por choices.contains(val));
// no con un key. Mazo todo Islas: la tierra del T1 es la acción normal previa
// al cheat y una Isla cheateada al campo da los 2 manás del {1}.
function makePithingNeedleDriver() {
  return {
    name: 'pithing-needle',
    outFile: 'pithing-needle.json',
    deck: {
      name: 'Mage Web pithing needle rec',
      cards: [{ cardName: 'Island', setCode: 'iko', cardNumber: '271', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _acted: false,
    _cheated: false,
    _cast: false,
    _named: false,
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
      if (!this._acted) {
        if (ctx.playLand()) {
          this._acted = true
          ctx.log('onSelect: tierra (acción normal previa al cheat)')
        } else ctx.pass()
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Pithing Needle a la mano + Isla al campo para pagar {1})')
        void ctx.cheatSetup({ hand: ['Pithing Needle'], battlefield: ['Island'] })
        return
      }
      if (!this._cast && ctx.cardInHand('Pithing Needle') && ctx.untappedMana() >= 2) {
        this._cast = true
        ctx.log('onSelect: lanzo Pithing Needle desde la mano (el chooser corre en el hilo GAME)')
        ctx.playCardByName('Pithing Needle')
        return
      }
      ctx.pass()
    },
    // El prompt de nombre llega como string mode: rec-lib lo entrega con opts
    // VACÍO (prueba de que keyChoices={} y que la lista vive en choice.choices,
    // no en keyChoices). Se responde con el nombre exacto; el servidor lo
    // valida con choices.contains(val) y guarda el valor (info "Chosen name").
    onChooseChoice(opts, ctx) {
      ctx.log('onChooseChoice opts=', JSON.stringify(opts).slice(0, 120))
      if (this._named) return undefined
      this._named = true
      ctx.log('onChooseChoice: respondo "Lightning Bolt" (nombre exacto, string mode)')
      return 'Lightning Bolt'
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
      return Object.values(me?.battlefield ?? {}).some((c) => /pithing needle/i.test(c?.name ?? ''))
    },
  }
}

export const drivers = { 'pithing-needle': makePithingNeedleDriver }

export const meta = {
  mechanic: 'pithing-needle',
  kind: 'game',
  assert: 'hasPithingNeedle',
  note: 'Pithing Needle ({1}) cheateada a la mano + Isla al campo y lanzada de verdad (cheatearla directa al campo NO funciona: el chooser del "as enters" corre en el WorkerThread del proxy y el servidor aborta con "Wrong code usage: game related code must run in GAME thread"). ChooseACardNameEffect abre un GAME_CHOOSE_CHOICE con ChoiceImpl(required=true, hintType=CARD) cuyas choices son CardRepository.getNames() (~25.000 nombres) y keyChoices VACÍO — string mode, se responde sendPlayerString con el nombre exacto ("Lightning Bolt"), validado por choices.contains(val). Captura: Needle en el battlefield propio; su CardView lleva en rules el info "<font color = \'blue\'>Chosen name: Lightning Bolt</font>" (getRules añade el mapa info del permanente, añadido por ChooseACardNameEffect), prueba de que el nombre quedó fijado. Interés UI: búsqueda por texto sobre ~25k nombres. Driver P4 con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makePithingNeedleDriver())
}
