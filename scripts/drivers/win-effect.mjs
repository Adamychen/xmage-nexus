import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — §3.10 ganar/perder por efecto: Approach of the Second Sun (AKH {6}{W};
// ../xmage-fork/.../a/ApproachOfTheSecondSun.java). Efecto: si el hechizo se
// lanzó desde la mano y YA se había lanzado otro Approach este juego → ganas
// la partida (controller.won(game)); si no, ganas 7 vidas y la carta vuelve a
// la biblioteca 7ª desde arriba.
//
// Secuencia: mazo 60 Plains; T1 tierra + UN cheatSetup (2 copias de Approach a
// la mano + 14 Plains al campo: 7 maná por lanzamiento). Primera: resuelve
// (+7 vidas, 20→27; queda 7ª desde arriba, por eso NO entra al cementerio) →
// segunda desde la mano: al resolver dispara la victoria.
//
// RESUELTO (2026-09-16): el estado de victoria solo llega en GAME_UPDATE
// "planos" (GameView aplanado dentro de `data`, sin la clave `gameView`) y en
// GAME_OVER (gameView + message "… is the winner"); rec-lib ahora acepta
// `m.data` aplanado (si trae `players`) y GAME_OVER → frame capturado.
function makeWinEffectDriver() {
  return {
    name: 'win-effect',
    outFile: 'win-effect.json',
    deck: {
      name: 'Mage Web win rec',
      cards: [{ cardName: 'Plains', setCode: 'm20', cardNumber: '261', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 180_000,
    _landTurn: -1,
    _cheated: false,
    _cast1: false,
    _cast2: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Tierra por turno (y "≥1 acción normal" de la regla P1 del cheat).
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra')
          return
        }
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (2 Approach a la mano, 14 Plains al campo)')
        void ctx.cheatSetup({
          hand: ['Approach of the Second Sun', 'Approach of the Second Sun'],
          battlefield: Array(14).fill('Plains'),
        })
        return
      }
      // 1ª copia: {6}{W} (7 maná) → +7 vidas y vuelve 7ª desde arriba.
      if (!this._cast1 && ctx.cardInHand('Approach of the Second Sun') && ctx.untappedMana() >= 7) {
        this._cast1 = true
        ctx.log('onSelect: lanzo la 1ª Approach ({6}{W})')
        ctx.playCardByName('Approach of the Second Sun')
        return
      }
      // 2ª copia SOLO cuando la 1ª ya resolvió (vida 27): lanzarlas juntas
      // también ganaría, pero no es el flujo del efecto (put 7ª desde arriba).
      if (
        this._cast1 &&
        !this._cast2 &&
        Number(me.life ?? 0) >= 27 &&
        ctx.cardInHand('Approach of the Second Sun') &&
        ctx.untappedMana() >= 7
      ) {
        this._cast2 = true
        ctx.log('onSelect: lanzo la 2ª Approach ({6}{W}) → victoria')
        ctx.playCardByName('Approach of the Second Sun')
        return
      }
      ctx.pass()
    },
    // Pago {6}{W}: una Plains sin voltear por cada GAME_PLAY_MANA.
    onPlayMana(ctx) {
      const plains = Object.values(ctx.me?.battlefield ?? {}).find(
        (c) => !c.tapped && /plains/i.test(c?.name ?? ''),
      )
      if (plains) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: plains.id })
        ctx.log('onPlayMana: giro', plains.name)
      }
    },
    // Descarte de limpieza, si llegara: una carta de la mano.
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
    // Firma de la victoria: +7 vidas de la 1ª (27) y la 2ª Approach ya en el
    // cementerio (la 1ª quedó en la biblioteca, 7ª desde arriba). El frame
    // final llega como GAME_UPDATE plano (GameView APLANADO en `data`, sin
    // clave gameView) tras el fix de rec-lib (2026-09-16).
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      if (!me) return false
      const gy = Object.values(me.graveyard ?? {})
      return (
        Number(me.life ?? 0) === 27 &&
        gy.some((c) => /approach of the second sun/i.test(String(c?.name ?? '')))
      )
    },
  }
}

export const drivers = { 'win-effect': makeWinEffectDriver }

export const meta = {
  mechanic: 'win-effect',
  file: 'win-effect.json',
  kind: 'game',
  assert: 'hasWinEffect',
  note: 'Approach of the Second Sun ({6}{W}) x2 vía cheatSetup: la 1ª sube 7 vidas (20→27) y va 7ª desde arriba; la 2ª gana la partida (el servidor declara "Player <u> is the winner" en GAME_OVER). Frame final: GameView con vida 27, la 2ª Approach en el cementerio y pila vacía. **Hallazgo/fix 2026-09-16**: el estado de victoria solo llega en un GAME_UPDATE PLANO (GameView aplanado en `data`, sin clave gameView) y en GAME_OVER; `rec-lib` solo evaluaba `m.data.gameView` en GAME_UPDATE/AND_INFORM → se amplió para aceptar `m.data` aplanado (si trae `players`) y `GAME_OVER` con gameView. Mismo camino sirve para cualquier "ganas/pierdes la partida" (won()/lostForced() → game.end() sin inform posterior).',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeWinEffectDriver())
}
