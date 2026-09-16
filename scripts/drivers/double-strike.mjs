import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — daño doble vía cheatSetup (§3.6): Fencing Ace ({1}{W}, 1/1 con daño
// doble) ataca al SIM pasivo (mazo de tierras, sin bloqueadores). Si el golpe
// doble hace DOS pasos de daño, en el GAME_UPDATE del paso
// FIRST_COMBAT_DAMAGE (enum real; ver first-strike.mjs) el rival ya ha perdido
// 1 vida (20 → 19) y el atacante sigue intacto (damage:0): el segundo golpe
// llegará después, en el paso regular. La prueba es el frame intermedio: vida
// del rival 19 en FIRST_COMBAT_DAMAGE (un atacante sin daño doble no produciría
// ese paso y la vida ya estaría en 18 cuando se emite la primera actualización
// de daño de combate).
//
// Mismo montaje que vigilance: T1, tierra primero (regla P1: el cheat va tras
// ≥1 acción normal), cheatSetup del Ace al campo propio (el permanente
// cheateado entra con summoningSickness:false y puede atacar el mismo turno) y
// ataque en DECLARE_ATTACKERS confirmando con el botón especial "special".
// Contra el SIM pasivo (mazo de tierras del proxy) no hay bloqueadores.
function makeDoubleStrikeDriver() {
  return {
    name: 'double-strike',
    outFile: 'double-strike.json',
    deck: {
      name: 'Mage Web double strike rec',
      cards: [{ cardName: 'Plains', setCode: 'm20', cardNumber: '261', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    _cheated: false,
    _attackedTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      // Atacar en cuanto el Ace esté visible y sin giro (summoningSickness:false
      // por el cheat: puede atacar ya en T1).
      if (gv.step === 'DECLARE_ATTACKERS' && me.isActive === true && this._attackedTurn !== gv.turn) {
        const aces = Object.values(me.battlefield ?? {}).filter(
          (c) => /fencing ace/i.test(c?.name ?? '') && !c.tapped && c.summoningSickness !== true,
        )
        if (aces.length === 0) {
          ctx.pass()
          return
        }
        this._attackedTurn = gv.turn
        for (const a of aces) {
          ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: a.id })
          ctx.log('onSelect: ataco con', a.name)
        }
        setTimeout(() => {
          ctx.sendAction('sendPlayerString', { gameId: ctx.gameId, value: 'special' })
          ctx.log('onSelect: confirmar ataque (special)')
        }, 300)
        return
      }
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el cheat va tras ≥1 acción normal (aquí, la tierra del T1).
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
        ctx.log('onSelect: cheatSetup (Fencing Ace al campo propio)')
        void ctx.cheatSetup({ battlefield: ['Fencing Ace'] })
        return
      }
      ctx.pass()
    },
    onTarget(ctx, question) {
      if (/discard/i.test(String(question ?? ''))) return false
      return undefined
    },
    captureWhen(gv) {
      // Solo el paso de daño primero: el rival ya perdió 1 vida (primer golpe
      // del doble) y el atacante sigue a damage 0 (segundo golpe aún no).
      if (gv.step !== 'FIRST_COMBAT_DAMAGE') return false
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const rival = (gv.players ?? []).find((p) => !p?.controlled)
      const ace = Object.values(me?.battlefield ?? {}).find((c) => /fencing ace/i.test(c?.name ?? ''))
      if (!ace || (ace.damage ?? 0) !== 0) return false
      const attacking = (gv.combat ?? []).some((group) =>
        Object.values(group?.attackers ?? {}).some((c) => /fencing ace/i.test(c?.name ?? '')),
      )
      if (!attacking) return false
      return Number(rival?.life ?? 20) === 19
    },
  }
}

export const drivers = { 'double-strike': makeDoubleStrikeDriver }

export const meta = {
  mechanic: 'double-strike',
  kind: 'game',
  assert: 'hasDoubleStrike',
  note: 'Fencing Ace ({1}{W} 1/1 con daño doble) al campo propio vía cheatSetup (T1, tras jugar la primera tierra; el permanente cheateado entra con summoningSickness:false y ataca el mismo turno) contra el SIM pasivo de tierras: sin bloqueadores. Captura en el GAME_UPDATE del paso FIRST_COMBAT_DAMAGE (el enum real; el host web comprobaba por error FIRST_STRIKE_DAMAGE): el rival ya está en 19 vidas (primer golpe del doble) y el Ace sigue en gv.combat[].attackers con damage:0 y cardIcons ABILITY_DOUBLE_STRIKE — el segundo golpe llega después, en el paso regular, prueba de que el daño doble hace dos pasos. Driver double-strike con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeDoubleStrikeDriver())
}
