import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — §3.10 "Reiniciar la partida | Karn Liberated | La UI se re-inicializa".
//
// Karn Liberated ({7}, planeswalker Karn, lealtad inicial 6):
//   +4: Target player exiles a card from their hand.
//   -3: Exile target permanent.
//   -14: Restart the game, leaving in exile all non-Aura permanent cards
//        exiled with Karn Liberated. Then put those cards onto the battlefield
//        under your control.
//
// Plan: mazo todo-Bosques vs SIM pasivo. T1 tierra (acción normal previa al
// cheat, regla P1) + cheatSetup con Karn DIRECTO al campo (el motor llama a
// PermanentImpl.entersBattlefield por putCardOntoBattlefieldWithEffects →
// PayLoyaltyCost/addCounters: entra con sus 6 contadores de lealtad; no hay
// decisión "as it enters", que es lo único prohibido por la regla P4).
// Después, una activación de lealtad por turno propio (canLoyaltyBeUsed):
// +4 (6→10), +4 (10→14) y con 14 ya es pagable el -14 (PayLoyaltyCost.canPay:
// loyalty + cost >= 0). El clic en el permanente abre GAME_CHOOSE_ABILITY
// (AbilityPickerView.choices: abilityId → "N. +4: …"/"N. -14: …") y el picker
// de lealtad se responde por texto en onChooseAbility.
//
// El -14 NO pasa por la pila como un hechizo normal: KarnLiberatedEffect.apply
// llama a GameState.clearOnGameRestart() + Player.init/useDeck + game.start(null)
// DENTRO de la resolución. El juego reiniciado conserva el MISMO gameId (no hay
// GAME_INIT nuevo para el proxy) y el primer GAME_UPDATE del nuevo juego llega
// con turno 1 (fireUpdatePlayersEvent al empezar la prioridad en playPriority),
// las manos re-repartidas (mulligan del init: los ASK de keep los contesta el
// default de rec-lib) y el battlefield limpio (Karn barajado de vuelta a la
// biblioteca). Ese frame es la prueba de la re-inicialización que capturamos.
function makeKarnRestartDriver() {
  return {
    name: 'karn-restart',
    outFile: 'karn-restart.json',
    deck: {
      name: 'Mage Web karn rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _acted: false,
    _cheated: false,
    _landTurn: -1,
    _pwTurn: -1,
    _pendingAbility: null,
    _ultimated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      // Tras pulsar -14 ya no se hace nada: el reinicio ocurre dentro de la
      // resolución y la captura llega en el primer GAME_UPDATE del nuevo juego.
      if (this._ultimated) {
        ctx.pass()
        return
      }
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: al menos una acción normal (la tierra del T1) antes del cheat.
      if (!this._acted) {
        const land = ctx.playLand()
        if (land) {
          this._acted = true
          this._landTurn = gv.turn ?? 0
          ctx.log('onSelect: tierra inicial')
        } else {
          ctx.pass()
        }
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Karn Liberated directo al campo)')
        void ctx.cheatSetup({ battlefield: ['Karn Liberated'] })
        return
      }
      const karn = Object.values(me.battlefield ?? {}).find((c) => /karn liberated/i.test(String(c?.name ?? '')))
      if (karn) {
        const fromCounters = (karn.counters ?? []).find((k) => /loyalty/i.test(String(k?.name ?? '')))?.count
        const loy = Number(karn.loyalty ?? 0) || Number(fromCounters ?? 0) || 0
        const turn = gv.turn ?? 0
        // Una sola habilidad de lealtad por turno (canLoyaltyBeUsed).
        if (this._pwTurn !== turn) {
          if (loy >= 14) {
            const id = ctx.playAbility('Karn Liberated', ['other', 'basicPlayAbilities'], /-14|restart/i)
            if (id) {
              this._pwTurn = turn
              this._pendingAbility = 'minus14'
              this._ultimated = true
              ctx.log('onSelect: clic en Karn → -14 (reinicio), lealtad', loy)
              return
            }
          } else if (loy >= 6) {
            const id = ctx.playAbility('Karn Liberated', ['other', 'basicPlayAbilities'], /\+4/)
            if (id) {
              this._pwTurn = turn
              this._pendingAbility = 'plus4'
              ctx.log('onSelect: clic en Karn → +4, lealtad', loy)
              return
            }
          }
        }
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      ctx.pass()
    },
    // Picker de lealtad (GAME_CHOOSE_ABILITY): el label es "N. +4: …" / "N. -14: …".
    onChooseAbility(opts, ctx) {
      ctx.log('onChooseAbility:', JSON.stringify(opts).slice(0, 300))
      const list = opts ?? []
      const minus = list.find((o) => /-14|restart the game/i.test(o.label ?? ''))
      if (this._pendingAbility === 'minus14' || (!this._pendingAbility && minus)) {
        if (minus) {
          this._pendingAbility = null
          ctx.log('onChooseAbility: -14 (reinicio)')
          return minus.value
        }
      }
      const plus = list.find((o) => /\+4/.test(o.label ?? ''))
      if (plus) {
        this._pendingAbility = null
        ctx.log('onChooseAbility: +4')
        return plus.value
      }
      this._pendingAbility = null
      return list[0]?.value
    },
    // Único objetivo que elegimos: el jugador del +4 ("target player exiles a
    // card from their hand") → el SIM (su IA elige qué carta exiliar). El
    // descarte de limpieza llega aquí como GAME_TARGET con "discard": se
    // devuelve una carta de la mano sin repetir la ya usada.
    onTarget(ctx, question) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) {
        this._spent = this._spent ?? []
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const pick = Object.entries(hand).find(([id]) => !this._spent.includes(id))
        if (pick) {
          this._spent.push(pick[0])
          ctx.log('onTarget: descarte de limpieza')
          return pick[0]
        }
        return undefined
      }
      const sim = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
      const id = sim?.playerId ?? sim?.id
      if (id) {
        ctx.log('onTarget: +4 apunta al SIM')
        return id
      }
      return undefined
    },
    // Invariante del frame: tras pulsar el -14, el primer GAME_UPDATE del juego
    // reiniciado (turno 1) con Karn YA fuera del campo (barajado de vuelta a la
    // biblioteca por clearOnGameRestart + game.start(null)).
    captureWhen(gv) {
      if (!this._ultimated) return false
      if (Number(gv?.turn ?? 0) > 1) return false
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      const karnAlive = Object.values(me.battlefield ?? {}).some((c) => /karn liberated/i.test(String(c?.name ?? '')))
      return !karnAlive
    },
  }
}

export const drivers = { 'karn-restart': makeKarnRestartDriver }

export const meta = {
  mechanic: 'karn-restart',
  kind: 'game',
  assert: 'hasKarnRestart',
  note: 'Karn Liberated ({7}, lealtad 6) cheateado directo al campo con cheatSetup (entra con sus 6 contadores de lealtad; sin decisión "as it enters" el cheat es seguro) contra SIM pasivo: +4 legal en el T1 (6→10, GAME_CHOOSE_ABILITY con "+4: Target player exiles a card from their hand" respondido por texto; el GAME_TARGET "Select a player" se apunta al SIM, que exilia una carta de su mano) y +4 después (10→14); con 14 de lealtad exacta se activa el -14 (legible por PayLoyaltyCost.canPay: loyalty + cost >= 0). El reinicio NO llega como GAME_INIT ni como GAME_OVER: KarnLiberatedEffect.apply llama a GameState.clearOnGameRestart() + Player.init/useDeck + game.start(null) DENTRO de la resolución del -14, y el juego se re-inicializa con el MISMO gameId (el proxy no ve GAME_INIT nuevo; el rec-lib lo confirma: solo GAME_UPDATE). El primer GAME_UPDATE del juego reiniciado trae turno 1, activePlayerId = controlador de Karn, las manos re-repartidas por el init (7/7 tras el mulligan ASK, resuelto por el default del rec-lib), bibliotecas frescas (yo 53, SIM 93) y battlefield/cementerio/pila vacíos sin Karn (barajado de vuelta a la biblioteca); ese frame es la captura. Hallazgo del "dirty hack" del motor: las cartas exiliadas con Karn en el juego viejo NO se re-colocan en el battlefield en el primer frame y su rastro es inconsistente entre runs (run 2: exiles vacío; run 3: 1 Forest del SIM aún en exile) — la UI no debe fiarse de ellas. La UI debe re-inicializarse con ese GAME_UPDATE (no esperar GAME_INIT) y aceptar turn=1 tras una partida avanzada. Driver karn-restart con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeKarnRestartDriver())
}
