import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — menace vía cheatSetup (§3.6): Ripscale Predator (5/4 menace, sin más
// habilidades) al campo propio; un único Grizzly Bears (2/2 vanilla) al
// campo rival. Con menace el atacante solo puede ser bloqueado por 2+
// criaturas: al haber un único bloqueador posible, el servidor no ofrece
// ninguna configuración de bloqueo legal (no depende de que la IA "quiera"
// bloquear — un bloqueo de 1 sería ilegal). Se ataca y se captura el combate
// resuelto sin bloqueadores pese a haber una criatura rival disponible.
function makeMenaceDriver() {
  return {
    name: 'menace',
    outFile: 'menace.json',
    deck: {
      name: 'Mage Web menace rec',
      cards: [{ cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _bothCheated: false,
    _attackedTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      // Esperar a que el segundo cheat (Grizzly Bears al rival) resuelva
      // antes de atacar (ver trample-deathtouch): si no, atacaríamos sin
      // bloqueador disponible y no se probaría nada sobre menace.
      if (gv.step === 'DECLARE_ATTACKERS' && me.isActive === true && this._bothCheated && this._attackedTurn !== gv.turn) {
        const preds = Object.values(me.battlefield ?? {}).filter(
          (c) => /ripscale predator/i.test(c?.name ?? '') && !c.tapped,
        )
        if (preds.length === 0) {
          ctx.pass()
          return
        }
        this._attackedTurn = gv.turn
        for (const a of preds) {
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
      // Ver comentario en trample-deathtouch: sin jugar tierra la mano se
      // llena y el descarte de limpieza entra en bucle.
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
        ctx.log('onSelect: cheatSetup (Ripscale Predator propio, Grizzly Bears rival)')
        const rival = (gv.players ?? []).find((p) => !p?.controlled)
        const rid = rival?.playerId ?? rival?.id
        // Ver comentario en trample-deathtouch: dos criaturas por cheatSetup
        // casi simultáneo (una por jugador) puede disparar un
        // ConcurrentModificationException real en el servidor.
        void ctx.cheatSetup({ battlefield: ['Ripscale Predator'] }).then(
          () => new Promise((r) => setTimeout(r, 800)).then(() => (rid ? ctx.cheatSetup({ battlefield: ['Grizzly Bears'] }, rid) : null)),
        ).then(() => {
          this._bothCheated = true
          ctx.log('onSelect: ambos cheats listos')
        })
        return
      }
      ctx.pass()
    },
    onTarget(ctx, question) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) return false
      return undefined
    },
    captureWhen(gv) {
      const rival = (gv.players ?? []).find((p) => !p?.controlled)
      const bearAlive = Object.values(rival?.battlefield ?? {}).some((c) => /grizzly bears/i.test(c?.name ?? ''))
      return bearAlive && Number(rival?.life ?? 20) < 20
    },
  }
}

export const drivers = { menace: makeMenaceDriver }

export const meta = {
  mechanic: 'menace',
  kind: 'game',
  assert: 'hasMenaceUnblocked',
  note: 'Ripscale Predator (6/5 Menace) propio ataca con un único Grizzly Bears (2/2 vanilla) disponible en el campo rival vía cheatSetup: con menace el atacante solo puede ser bloqueado por 2+ criaturas, así que con un único bloqueador posible el servidor no ofrece ninguna configuración de bloqueo legal — no depende de que la IA "quiera" bloquear, es una restricción de regla. Captura: combate resuelto con blockers:{} pese al Grizzly Bears rival intacto (vivo, sin tocar) y su vida 20→14 (6 de daño directo). Driver menace con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeMenaceDriver())
}
