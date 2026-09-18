import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Truco de combate (§3.6, "otros trucos de combate siguen"): Giant Growth
// ({G} instant, +3/+3 hasta el final del turno) lanzado sobre nuestro atacante
// EN EL PASO DE BLOQUEADORES (tras declarar atacantes), con el SIM pasivo de
// tierras. Prueba que la ventana de combate es jugable de verdad: el instant
// se lanza con prioridad real durante DECLARE_BLOCKERS, el objetivo se
// auto-resuelve (único legal) y el P/T del atacante sube hasta el final del
// turno.
function makeCombatTrickDriver() {
  return {
    name: 'combat-trick',
    outFile: 'combat-trick.json',
    deck: {
      name: 'Mage Web combat-trick rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _attackedTurn: -1,
    _trickTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return

      // Declarar atacante: nuestro Grizzly sin mareo.
      if (gv.step === 'DECLARE_ATTACKERS' && me.isActive === true && this._attackedTurn !== gv.turn) {
        const bear = Object.entries(me.battlefield ?? {}).find(
          ([, c]) => /grizzly bears/i.test(c?.name ?? '') && !c.tapped && c.summoningSickness !== true,
        )
        if (bear) {
          this._attackedTurn = gv.turn
          ctx.log('onSelect: ataco con Grizzly Bears')
          ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: bear[0] })
          setTimeout(() => {
            ctx.sendAction('sendPlayerString', { gameId: ctx.gameId, value: 'special' })
            ctx.log('onSelect: confirmar ataque (special)')
          }, 300)
          return
        }
        ctx.pass()
        return
      }

      // Ventana tras declarar bloqueadores: Giant Growth sobre el atacante.
      if (gv.step === 'DECLARE_BLOCKERS' && this._trickTurn !== gv.turn) {
        if (ctx.cardInHand('Giant Growth')) {
          this._trickTurn = gv.turn
          ctx.log('onSelect: lanzo Giant Growth en DECLARE_BLOCKERS')
          ctx.playCardByName('Giant Growth')
          return
        }
        ctx.pass()
        return
      }

      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      if (!this._acted) {
        if (ctx.playLand()) {
          this._acted = true
          ctx.log('onSelect: tierra inicial')
        } else ctx.pass()
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Grizzly + Giant Growth en mano + 2 Bosques)')
        void ctx.cheatSetup({ hand: ['Giant Growth'], battlefield: ['Grizzly Bears', 'Forest', 'Forest'] })
        return
      }
      ctx.pass()
    },
    onPlayMana(ctx) {
      const forest = Object.values(ctx.me?.battlefield ?? {}).find((c) => !c.tapped && /forest/i.test(c?.name ?? ''))
      if (forest) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: forest.id })
        ctx.log('onPlayMana: giro', forest.name)
      }
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const bear = Object.values(me?.battlefield ?? {}).find((c) =>
        /grizzly bears/i.test(String(c?.name ?? '')),
      )
      const gy = Object.values(me?.graveyard ?? {}).some((c) =>
        /giant growth/i.test(String(c?.name ?? '')),
      )
      const buffed = Number(bear?.power) === 5 && Number(bear?.toughness) === 5
      const inCombat = (gv.combat ?? []).some((group) =>
        Object.keys(group?.attackers ?? {}).length > 0,
      )
      return buffed && gy && inCombat
    },
  }
}

export const drivers = { 'combat-trick': makeCombatTrickDriver }

export const meta = {
  mechanic: 'combat-trick',
  kind: 'game',
  assert: 'hasCombatTrick',
  note: 'Truco de combate (Giant Growth {G}, +3/+3 hasta el final del turno) lanzado en DECLARE_BLOCKERS sobre el propio Grizzly atacante (GAME_SELECT de combate con prioridad real; el objetivo se AUTO-RESUELVE al ser el único legal). Captura: atacante en gv.combat[].attackers con P/T 5/5 (2/2 +3/+3), Giant Growth en el cementerio y pila vacía — la prueba de que la ventana post-bloqueadores es jugable.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeCombatTrickDriver())
}
