import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — §3.8 "Tutor con fallar la búsqueda" (la fila estaba en R parcial: el
// frame `tutor.json` usa Demonic Tutor y allí declinar NO falla la búsqueda;
// re-pregunta en bucle). LA VÍA CORRECTA es una búsqueda con filtro CON
// predicados: la regla 701.15b ("buscar en zona oculta con una calidad
// declarada: no estás obligado a encontrar") se implementa en
// TargetCardInLibrary:
//   this.setRequired(!filter.hasPredicates());
// con lo que una búsqueda de "tierra básica" (FILTER_CARD_BASIC_LAND añade el
// predicado SuperType.BASIC) nace con required=false. En
// HumanPlayer.chooseTarget, al llegar sendPlayerBoolean(false) el UUID de
// respuesta es null y, al no ser required, el bucle rompe ("done or cancel
// button pressed" → break) en vez de re-preguntar; searchLibrary devuelve
// false, SearchLibraryPutInPlayEffect no mueve nada y baraja.
// Demonic Tutor usa FILTER_CARD sin predicados → required=true → declinar
// re-pregunta (el hallazgo previo). El cliente Swing tampoco tiene un botón
// "fail to find": el botón derecho del FeedbackPanel (texto de
// options["UI.right.btn.text"] = "Done" añadido por HumanPlayer.getOptions
// cuando ya hay min objetivos) manda exactamente el mismo
// sendPlayerBoolean(false).
//
// Carta: Evolving Wilds (tierra; "{T}, Sacrifice Evolving Wilds: Search your
// library for a basic land card, put it onto the battlefield tapped, then
// shuffle"). Cheateada al campo (es una tierra, sin decisión al entrar y sin
// mareo) y activada en T1 tras jugar la tierra normal (regla P1 del cheat).
// El GAME_TARGET de la búsqueda se declina con false; el permanente queda
// sacrificado en el cementerio, la biblioteca intacta y el campo sin tierra
// nueva.
function makeFailToFindDriver() {
  return {
    name: 'fail-to-find',
    outFile: 'fail-to-find.json',
    deck: {
      name: 'Mage Web fail-to-find rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    _cheated: false,
    _activateAttempts: 0,
    _activateClickedAt: 0,
    _declinedAt: 0,
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
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra T', turn)
          return
        }
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Evolving Wilds al campo)')
        void ctx.cheatSetup({ battlefield: ['Evolving Wilds'] }).then((r) => {
          if (!r?.ok) {
            this._cheated = false
            ctx.log('onSelect: cheatSetup falló, se reintentará')
          }
        })
        return
      }
      // Activar "{T}, Sacrifice: Search…" clicando el permanente (clic =
      // sendPlayerUUID del objeto; habilidad única en el bucket `other`).
      const ew = Object.values(me.battlefield ?? {}).find((c) => /evolving wilds/i.test(c?.name ?? ''))
      if (ew && ew.tapped !== true && !this._declinedAt && this._activateAttempts < 10) {
        const stale = Date.now() - this._activateClickedAt > 300
        if (stale) {
          this._activateAttempts += 1
          this._activateClickedAt = Date.now()
          ctx.log('onSelect: activo Evolving Wilds (buscar tierra básica), intento', this._activateAttempts)
          ctx.playAbility('Evolving Wilds', ['other', 'basicPlayAbilities'])
          return
        }
      }
      ctx.pass()
    },
    // LA VÍA: sendPlayerBoolean(false) sobre el GAME_TARGET de la búsqueda
    // (el mensaje real del servidor es "Select a basic land card" — no
    // "Search your library…"). TargetCardInLibrary con filtro de tierra básica
    // → required=false → HumanPlayer.chooseTarget rompe el bucle y la búsqueda
    // falla. Se contabiliza por si el servidor re-preguntara (no debe).
    onTarget(ctx, question) {
      const q = String(question ?? '')
      ctx.log('onTarget:', q.slice(0, 110))
      if (/discard/i.test(q)) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const first = Object.keys(hand)[0]
        if (first) {
          ctx.log('onTarget: descarte de limpieza')
          return first
        }
      }
      if (this._activateAttempts > 0 || /search|basic land/i.test(q)) {
        this._declinedAt = Date.now()
        this._declines = (this._declines ?? 0) + 1
        // Biblioteca ANTES de la búsqueda (no siempre es 53: si empieza el SIM,
        // nuestro primer turno es el T2 y ya robamos una carta → 52).
        this._preSearchLibrary = Number(ctx.me?.libraryCount)
        ctx.log('onTarget: declino la búsqueda (false) —', q.slice(0, 90), 'library=', this._preSearchLibrary)
        return false
      }
      return undefined
    },
    // Invariante (hasFailToFind): Evolving Wilds en el PROPIO cementerio
    // (sacrificada como coste), exactamente UNA tierra en el campo (la jugada
    // de la mano; si la búsqueda hubiera tenido éxito habría 2: la
    // biblioteca-land entraría girada), biblioteca intacta (mismo
    // libraryCount que justo antes de declinar; se baraja pero no se mueve
    // ninguna carta) y pila vacía.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      const ewGy = Object.values(me.graveyard ?? {}).some((c) => /evolving wilds/i.test(String(c?.name ?? '')))
      const lands = Object.values(me.battlefield ?? {}).filter((c) => (c?.cardTypes ?? []).includes('LAND'))
      return ewGy
        && lands.length === 1
        && this._preSearchLibrary != null
        && Number(me.libraryCount) === this._preSearchLibrary
        && Object.keys(gv.stack ?? {}).length === 0
    },
  }
}

export const drivers = { 'fail-to-find': makeFailToFindDriver }

export const meta = {
  mechanic: 'fail-to-find',
  kind: 'game',
  assert: 'hasFailToFind',
  note: 'Fail-to-find REAL vía cheatSetup (§3.8): Evolving Wilds al campo + activación "{T}, Sacrifice: Search your library for a basic land card" y el GAME_TARGET se declina con sendPlayerBoolean(false). Vía: TargetCardInLibrary nace required=false cuando el filtro tiene predicados (setRequired(!filter.hasPredicates()); FILTER_CARD_BASIC_LAND añade SuperType.BASIC, regla 701.15b), así que HumanPlayer.chooseTarget rompe el bucle ("done or cancel" → break) y searchLibrary devuelve false; Demonic Tutor (FILTER_CARD sin predicados) es required=true y por eso declinar re-preguntaba en bucle. El GAME_TARGET llega con message "Select a basic land card", flag=false (= required: GameClientMessage.flag) y options.possibleTargets con las 53 tierras de la biblioteca — ese flag=false es lo que el web necesita para ofrecer el "fail to find" (hoy no lo usa). El Swing no tiene botón especial: el botón derecho del FeedbackPanel manda el mismo sendPlayerBoolean(false) (texto "Done" de options[UI.right.btn.text] cuando ya hay min objetivos). Captura: Evolving Wilds en el cementerio, 1 sola tierra en el campo (la jugada de la mano; si fallara al revés habría 2), libraryCount intacto (53 en el frame: 60-7, sin robar; 52 si empieza el SIM) y pila vacía. Driver fail-to-find con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeFailToFindDriver())
}
