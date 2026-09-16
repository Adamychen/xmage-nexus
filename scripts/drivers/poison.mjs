import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — Contadores de jugador (§3.10 veneno, energía, radiación): Glistener Elf
// ({G} 1/1 infect) al campo propio vía cheatSetup (el permanente cheateado
// entra con summoningSickness:false, así que ataca el mismo T1). El SIM lleva
// el mazo pasivo de SOLO tierras (50 Forest + 50 Island), sin bloqueadores: el
// Elf conecta seguro y el daño de infect a un jugador NO es daño: se aplica
// como contadores de veneno (CounterType.POISON = "poison" vía
// PlayerImpl.addCounters). La vida del rival sigue en 20.
//
// La captura llega en el GAME_UPDATE del paso de daño de combate
// (FIRST_COMBAT_DAMAGE en la vista view) cuando el contador ya aparece en
// sim.counters ([{name:'poison',count:1}], CounterView {name,count}) con la
// vida intacta (prueba directa de que infect no daña al jugador).
function makePoisonDriver() {
  return {
    name: 'poison',
    outFile: 'poison.json',
    deck: {
      name: 'Mage Web poison rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
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
      // Declarar atacantes: el Elf cheateado no tiene mareo. Confirmar como en
      // combat/menace/vigilance (sendPlayerUUID del atacante + 'special' a los
      // 300 ms).
      if (gv.step === 'DECLARE_ATTACKERS' && me.isActive === true && this._attackedTurn !== gv.turn) {
        const elves = Object.values(me.battlefield ?? {}).filter(
          (c) => /glistener elf/i.test(c?.name ?? '') && !c.tapped && c.summoningSickness !== true,
        )
        if (elves.length === 0) {
          ctx.pass()
          return
        }
        this._attackedTurn = gv.turn
        for (const a of elves) {
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
        ctx.log('onSelect: cheatSetup (Glistener Elf al campo propio)')
        void ctx.cheatSetup({ battlefield: ['Glistener Elf'] })
        return
      }
      ctx.pass()
    },
    // Descarte de limpieza: una carta de mano distinta por prompt para no
    // repetir UUID (mismo UUID = rechazo en bucle); false solo si no queda
    // carta nueva (aquí no debería pasar con mano llena de Bosques).
    onTarget(ctx, question) {
      if (/discard/i.test(String(question ?? ''))) {
        this._spent = this._spent ?? []
        const hand = ctx.gv?.myHand ?? ctx.gv?.hand ?? {}
        const pick = Object.entries(hand).find(([id]) => !this._spent.includes(id))
        if (pick) {
          this._spent.push(pick[0])
          ctx.log('onTarget: descarte limpieza', pick[1]?.name)
          return pick[0]
        }
        return false
      }
      return undefined
    },
    // Invariante: el rival tiene >=1 contador de jugador "poison" y su vida
    // sigue 20 (infect a jugador = veneno, no daño).
    captureWhen(gv) {
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      if (!sim) return false
      const poison = (sim.counters ?? []).find((c) => /^poison$/i.test(String(c?.name ?? '')))
      return Number(poison?.count ?? 0) >= 1 && Number(sim.life) === 20
    },
  }
}

export const drivers = { poison: makePoisonDriver }

export const meta = {
  mechanic: 'poison',
  kind: 'game',
  assert: 'hasPoison',
  note: 'Glistener Elf ({G} 1/1 infect) al campo propio vía cheatSetup (T1 tras la tierra; el permanente cheateado entra con summoningSickness:false y ataca el mismo turno); el SIM lleva el mazo pasivo de solo tierras y no puede bloquear, así que el Elf conecta: el daño de infect a jugador se aplica como contadores de veneno (CounterType.POISON = "poison" en PlayerImpl.addCounters) y NO resta vida. Captura en el GAME_UPDATE del daño de combate: sim.counters contiene {name:"poison",count:1} (CounterView) y sim.life sigue 20 — prueba directa de que infect no daña al jugador. Driver poison con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makePoisonDriver())
}
