import { pathToFileURL } from 'node:url'
import { runRecorder, getMe } from '../rec-lib.mjs'

// P4 — segundo caso del mismo patrón que attack-cost (bug reportado por el
// usuario, 2026-09-23): coste de maná pedido FUERA del flujo normal de
// prioridad/cast. Citanul Centaurs ({3}{G} 6/3, Shroud, Echo {3}{G}) cheateado
// directo al campo propio: EchoAbility dispara en UPKEEP_STEP_PRE (nuestro
// upkeep) → EchoEffect.apply pregunta "Pay {3}{G}?" (GAME_ASK) y si se acepta,
// paga vía el mismo game.firePlayManaEvent → GAME_PLAY_MANA que usa cualquier
// otro pago de maná (HumanPlayer.playManaHandling) — igual que el coste de
// Propaganda para atacar, pero esta vez el disparador es un trigger de
// upkeep resolviendo, no una declaración de ataque.
//
// Objetivo: confirmar si canPlayObjects también llega vacío aquí (mismo
// mecanismo que attack-cost.json) — si es así, el fix ya aplicado en
// useBoardPresenter.ts (reenviar cualquier click de permanente durante
// feedback.mode === 'mana') cubre este caso también sin cambios adicionales,
// porque no depende de por qué canPlayObjects vino vacío.
function untappedForest(gv) {
  const me = getMe(gv)
  for (const [id, c] of Object.entries(me?.battlefield ?? {})) {
    if (!c?.tapped && (c?.cardTypes ?? []).includes('LAND')) return id
  }
  return null
}

function hasCentaurs(gv) {
  const me = getMe(gv)
  return Object.values(me?.battlefield ?? {}).some((c) => /citanul centaurs/i.test(c?.name ?? ''))
}

function makeEchoUpkeepDriver() {
  return {
    name: 'echo-upkeep',
    outFile: 'echo-upkeep.json',
    deck: {
      name: 'Mage Web echo-upkeep rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _echoTurn: -1,
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
          ctx.log('onSelect: tierra')
          return
        }
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Citanul Centaurs + 4 Forest al campo)')
        void ctx.cheatSetup({
          battlefield: ['Citanul Centaurs', 'Forest', 'Forest', 'Forest', 'Forest'],
        })
        return
      }
      ctx.pass()
    },
    onAsk(question) {
      // "Pay {3}{G}?" (EchoEffect, chooseUse en nuestro upkeep): aceptar, si
      // no el permanente se sacrifica.
      if (/pay \{3\}\{g\}/i.test(String(question ?? ''))) return true
      return undefined
    },
    onPlayMana(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (me?.isActive !== true || me?.hasPriority !== true) return
      const land = untappedForest(gv)
      if (land) ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: land })
    },
    captureWhen(gv) {
      if (!hasCentaurs(gv)) return false
      const turn = gv.turn ?? 0
      // El cheat entra en turno 2 (tras la 1ª tierra); nuestro upkeep
      // SIGUIENTE (donde dispara Echo) es turno 4 (turno 3 es del SIM).
      // Exigimos haber pasado ESE upkeep con la pila vacía.
      return turn >= 4 && Object.keys(gv.stack ?? {}).length === 0 && gv.step !== 'UPKEEP'
    },
  }
}

export const drivers = { 'echo-upkeep': makeEchoUpkeepDriver }

export const meta = {
  mechanic: 'echo-upkeep',
  kind: 'game',
  assert: 'hasEchoUpkeepPaid',
  note: 'Citanul Centaurs ({3}{G} 6/3, Shroud, Echo {3}{G}) cheateado directo al campo propio; en nuestro siguiente upkeep EchoAbility dispara EchoEffect (GAME_ASK "Pay {3}{G}?" → sí) y el pago sale por el mismo game.firePlayManaEvent que cualquier GAME_PLAY_MANA (HumanPlayer.playManaHandling), igual que el coste de Propaganda para atacar pero disparado por un trigger de upkeep, no por declarar un ataque. Segundo caso confirmado del mismo patrón que attack-cost.json: el fix de useBoardPresenter.ts (reenviar cualquier click de permanente durante feedback.mode === "mana", sin depender de canPlayObjects) cubre ambos sin cambios específicos por mecánica. Captura: Citanul Centaurs vivo en el campo (no sacrificado) tras pagar, pila vacía. Driver echo-upkeep con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeEchoUpkeepDriver())
}
