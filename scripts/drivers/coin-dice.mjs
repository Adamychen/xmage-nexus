import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — §3.7 dados/moneda ("Resultado visible en el log y en pantalla") vía
// cheatSetup:
// - Moneda: Tavern Swindler ({1}{B} 2/2, "{T}, Pay 3 life: Flip a coin. If you
//   win the flip, you gain 6 life"; TavernSwindler.java: SimpleActivatedAbility
//   + TapSourceCost + PayLifeCost(3) + TavernSwindlerEffect →
//   PlayerImpl.flipCoin(winnable=true)). Al ser "winnable" el motor pregunta
//   chooseUse("Heads or tails?") = GAME_ASK antes de tirar; y cada paso lo
//   narra con game.informPlayers (chose/flipped/won|lost the flip). Vida
//   resultante SIEMPRE distinta de 20: 17 (perder: 20-3) o 23 (ganar:
//   20-3+6).
// - Dado: Recruitment Drive ({2}{W} sorcery, "Roll a d20", 1-9 dos Soldier
//   Token 1/1, 10-19 dos Knight Token 2/2, 20 tres Knight Token).
//
// HALLAZGO DE CONTRATO: ni la tirada ni el resultado del dado/moneda son
// eventos estructurados del view: GameView no tiene campos de roll/dice/coin
// (grep en types.generated.ts por roll/dice/coin: 0). Llegan SOLO como TEXTO
// al CHAT DE LA PARTIDA: game.informPlayers → GameImpl.fireInformEvent →
// tableEventSource INFO → GameController lo difunde con
// chatManager.broadcast(chatId de la partida, MessageType.GAME) → callback
// CHATMESSAGE (el web une el chat de partida con getGameChatId + joinChat y
// handleChatMessage lo pinta con addLog(..., channel 'game')). NO llega como
// GAME_INFORM/GAME_UPDATE_AND_INFORM: ese callback solo lo usan los
// "Waiting for X" (GameController.informOthers) y los espectadores. El efecto
// APLICADO sí se ve en el GameView (vida propia y fichas), y es lo único que
// el frame capturado puede asertar: vida 17/23 (moneda aplicada) + fichas de
// la d20.
//
// Secuencia: T1 tierra (acción normal P1) + UN cheatSetup con Tavern Swindler
// y 3 Plains al CAMPO (cheatear el Swindler a la mano y lanzarlo lo dejaría
// mareado: no podría activar {T} este turno; los permanentes cheateados entran
// sin mareo, hallazgo ya bisecado) y Recruitment Drive a la mano. Se activa el
// {T} (clic = ctx.playAbility; sin coste de maná), se responde la moneda y
// luego se lanza la d20 con las 3 Plains.
function makeCoinDiceDriver() {
  return {
    name: 'coin-dice',
    outFile: 'coin-dice.json',
    deck: {
      name: 'Mage Web coin-dice rec',
      cards: [{ cardName: 'Plains', setCode: 'iko', cardNumber: '266', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _sawAsk: false,
    _flipAttempts: 0,
    _flipClickedAt: 0,
    _castAttempts: 0,
    _castClickedAt: 0,
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
        ctx.log('onSelect: cheatSetup (Tavern Swindler + 3 Plains al campo, Recruitment Drive a la mano)')
        void ctx.cheatSetup({
          hand: ['Recruitment Drive'],
          battlefield: ['Tavern Swindler', 'Plains', 'Plains', 'Plains'],
        }).then((r) => {
          if (!r?.ok) {
            this._cheated = false
            ctx.log('onSelect: cheatSetup falló, se reintentará')
          }
        })
        return
      }
      const swindler = Object.values(me.battlefield ?? {}).find((c) => /tavern swindler/i.test(c?.name ?? ''))
      // 1) Moneda: activar "{T}, Pay 3 life: Flip a coin…" clicando el
      // permanente (GAME_CHOOSE_ABILITY con la habilidad {T}). La partida va
      // rapidísima (los dos mazos son solo tierras y los dos pasan), así que un
      // clic puede caer fuera de la ventana de prioridad y perderse: se
      // reintenta mientras el Swindler siga desgirado y no haya llegado la
      // pregunta del flip.
      if (swindler && swindler.tapped !== true && !this._sawAsk && this._flipAttempts < 10) {
        const stale = Date.now() - this._flipClickedAt > 300
        if (stale) {
          this._flipAttempts += 1
          this._flipClickedAt = Date.now()
          ctx.log('onSelect: activo {T} de Tavern Swindler (flip a coin), intento', this._flipAttempts)
          ctx.playAbility('Tavern Swindler', ['other', 'basicPlayAbilities'])
          return
        }
      }
      // 2) d20: tras la moneda (el ASK ya llegó y la habilidad se resolvió:
      // Swindler girado + pila vacía) se lanza Recruitment Drive con las Plains
      // cheateadas. No se puede lanzar antes: es un conjuro y la habilidad del
      // flip sigue en la pila (el clic se ignoraba).
      const stackEmpty = Object.keys(gv.stack ?? {}).length === 0
      if (this._sawAsk && swindler?.tapped === true && stackEmpty && ctx.cardInHand('Recruitment Drive') && this._castAttempts < 10) {
        const stale = Date.now() - this._castClickedAt > 300
        if (stale) {
          this._castAttempts += 1
          this._castClickedAt = Date.now()
          ctx.log('onSelect: lanzo Recruitment Drive (roll a d20), intento', this._castAttempts)
          ctx.playCardByName('Recruitment Drive')
          return
        }
      }
      ctx.pass()
    },
    // El clic en el Swindler abre GAME_CHOOSE_ABILITY (AbilityPickerView con
    // choices = Map<UUID,label>); esta vez hay una sola habilidad y el harness
    // responde el UUID por defecto, pero se explicita para el picker.
    onChooseAbility(opts, ctx) {
      const hit = (opts ?? []).find((o) => /flip a coin/i.test(String(o?.label ?? '')))
      ctx.log('onChooseAbility:', JSON.stringify(opts).slice(0, 200))
      return (hit ?? (opts ?? [])[0])?.value
    },
    // La moneda "winnable" pregunta chooseUse("Heads or tails?", "Heads",
    // "Tails") = GAME_ASK; se elige Heads (true). El resto de ASKs (mulligan,
    // "pass anyway") caen al default del harness.
    onAsk(question, ctx) {
      if (/heads or tails/i.test(String(question ?? ''))) {
        this._sawAsk = true
        ctx.log('onAsk: "Heads or tails?" → Heads (true)')
        return true
      }
      return undefined
    },
    // Pago {2}{W} girando Plains sin voltear (los flags de la vista no son
    // fiables durante el pago: pago manual, patrón class-level/energy).
    onPlayMana(ctx) {
      const bf = Object.values(ctx.me?.battlefield ?? {})
      const plains = bf.find((c) => !c.tapped && /plains/i.test(c?.name ?? ''))
      if (plains) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: plains.id })
        ctx.log('onPlayMana: giro', plains.name)
      }
    },
    // Descarte de limpieza, solo si la partida se alargara.
    onTarget(ctx, question) {
      if (/discard/i.test(String(question ?? ''))) {
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const first = Object.keys(hand)[0]
        if (first) {
          ctx.log('onTarget: descarte de limpieza')
          return first
        }
      }
      return undefined
    },
    // Invariante (el frame solo contiene el GameView, sin el texto de inform):
    // (a) moneda aplicada → vida propia 17 (perdida) o 23 (ganada), nunca 20, y
    // Tavern Swindler girado (coste {T}+3 vidas pagado, habilidad resuelta);
    // (b) d20 aplicada → fichas de Recruitment Drive en el campo propio
    // (Soldier Token 1/1 o Knight Token 2/2, isToken:true), y pila vacía.
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      const life = Number(me.life)
      const coinApplied = life === 17 || life === 23
      const swindler = Object.values(me.battlefield ?? {}).find((c) => /tavern swindler/i.test(String(c?.name ?? '')))
      const d20Token = Object.values(me.battlefield ?? {}).find(
        (c) => c?.isToken === true && /soldier|knight/i.test(String(c?.name ?? '')),
      )
      return coinApplied && swindler?.tapped === true && !!d20Token && Object.keys(gv.stack ?? {}).length === 0
    },
  }
}

export const drivers = { 'coin-dice': makeCoinDiceDriver }

export const meta = {
  mechanic: 'coin-dice',
  kind: 'game',
  assert: 'hasCoinDice',
  note: 'Moneda + d20 vía cheatSetup (§3.7): Tavern Swindler ({1}{B} 2/2) cheateado al campo (sin mareo; lanzarlo lo dejaría mareado y no podría activar {T} este turno) activa "{T}, Pay 3 life: Flip a coin. If you win the flip, you gain 6 life" → GAME_ASK "Heads or tails?" (chooseUse del flip winnable; se responde Heads) y vida 17/23 (17 = 20-3 perdida, 23 = 20-3+6 ganada) + Recruitment Drive ({2}{W}, "Roll a d20") lanzada después → fichas Soldier Token 1/1 (1-9) o Knight Token 2/2 (10-19 dos; 20 tres) en el campo. HALLAZGO DE CONTRATO: dado y moneda NO son eventos estructurados ni campos del GameView (types.generated.ts no tiene roll/dice/coin); el resultado llega SOLO como TEXTO al CHAT DE LA PARTIDA (game.informPlayers → GameImpl.fireInformEvent → GameController INFO → chatManager.broadcast MessageType.GAME → callback CHATMESSAGE; el web lo pinta con handleChatMessage → addLog channel "game"), NO por GAME_INFORM/GAME_UPDATE_AND_INFORM (eso es solo "Waiting for X" y espectadores). El frame debe asertar el efecto aplicado (vida 17/23 + Swindler girado + fichas d20 + pila vacía). Driver coin-dice con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeCoinDiceDriver())
}
