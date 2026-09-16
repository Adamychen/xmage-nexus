import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — vigilance vía cheatSetup (§3.6): Vanguard of Brimaz ({W}{W} 2/2 con
// vigilancia) al campo propio. El SIM lleva el mazo pasivo de tierras, así que
// no hay bloqueadores: la prueba es puramente sobre el giro del atacante. Al
// declarar el ataque, la criatura debe quedar en gv.combat[].attackers con
// tapped:false + cardIcons ABILITY_VIGILANCE (contraste directo con
// combat.json, donde el atacante vanilla queda tapped:true). Se cheatea en T1
// tras la tierra; el permanente cheateado llega con summoningSickness:false
// (observado en vivo 2026-09-16, el cheat lo añade como si ya estuviera en el
// campo), así que ataca en el mismo T1 en cuanto está visible.
function makeVigilanceDriver() {
  return {
    name: 'vigilance',
    outFile: 'vigilance.json',
    deck: {
      name: 'Mage Web vigilance rec',
      cards: [{ cardName: 'Plains', setCode: 'm20', cardNumber: '261', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _attackedTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      // Atacar en cuanto el Vanguard esté visible y sin giro (el permanente
      // cheateado entra con summoningSickness:false: puede atacar ya en T1).
      if (gv.step === 'DECLARE_ATTACKERS' && me.isActive === true && this._attackedTurn !== gv.turn) {
        const vanguard = Object.values(me.battlefield ?? {}).filter(
          (c) => /vanguard of brimaz/i.test(c?.name ?? '') && !c.tapped && c.summoningSickness !== true,
        )
        if (vanguard.length === 0) {
          ctx.pass()
          return
        }
        this._attackedTurn = gv.turn
        for (const a of vanguard) {
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
        ctx.log('onSelect: cheatSetup (Vanguard of Brimaz al campo propio)')
        void ctx.cheatSetup({ battlefield: ['Vanguard of Brimaz'] })
        return
      }
      ctx.pass()
    },
    onTarget(ctx, question) {
      if (/discard/i.test(String(question ?? ''))) return false
      return undefined
    },
    captureWhen(gv) {
      if (gv.step !== 'DECLARE_ATTACKERS') return false
      for (const group of gv.combat ?? []) {
        for (const c of Object.values(group?.attackers ?? {})) {
          if (/vanguard of brimaz/i.test(c?.name ?? '') && c?.tapped === false) return true
        }
      }
      return false
    },
  }
}

export const drivers = { vigilance: makeVigilanceDriver }

export const meta = {
  mechanic: 'vigilance',
  kind: 'game',
  assert: 'hasVigilance',
  note: 'Vanguard of Brimaz ({W}{W} 2/2 con vigilancia) al campo propio vía cheatSetup (T1, tras jugar la primera tierra; el permanente cheateado entra con summoningSickness:false y puede atacar el mismo turno); ataca contra el SIM pasivo (mazo de tierras) y la captura llega en el GAME_UPDATE de DECLARE_ATTACKERS: el atacante está en gv.combat[].attackers con tapped:false y cardIcons ABILITY_VIGILANCE — contraste directo con combat.json (atacante vanilla tapped:true). Driver vigilance con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeVigilanceDriver())
}
