import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — ninjutsu (§3.6): Ninja of the Deep Hours ({3}{U} 2/2, ninjutsu {1}{U})
// al campo desde la mano clicando la carta en la ventana post-bloqueos. El
// atacante no bloqueado es un Runeclaw Bear cheateado (el SIM lleva el mazo
// pasivo de tierras: nunca hay bloqueadores). El clic en la carta de la mano
// abre su habilidad jugable (canPlayObjects.other, regla "Ninjutsu {1}{U}"),
// se paga {1}{U} girando Islas y el coste pide como objetivo el atacante no
// bloqueado (GAME_TARGET "unblocked attacker you control") al que devuelve a
// la mano; el Ninja entra girado y atacando el mismo defensor.
//
// La habilidad solo es legal en DECLARE_BLOCKERS/PRIORITY (UnblockedPredicate:
// el atacante aún no está "unblocked" durante DECLARE_ATTACKERS), así que la
// sonda natural es canPlayObjects: si la carta no aparece como jugable, se pasa
// la ventana y se reintenta en el siguiente paso de combate/turno (el Oso y el
// Ninja siguen disponibles si el primer intento no llegó a activarse).
function makeNinjutsuDriver() {
  return {
    name: 'ninjutsu',
    outFile: 'ninjutsu.json',
    deck: {
      name: 'Mage Web ninjutsu rec',
      cards: [{ cardName: 'Island', setCode: 'iko', cardNumber: '265', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 240_000,
    _landTurn: -1,
    _cheated: false,
    _attackedTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return

      // Ventana post-bloqueos: activar ninjutsu clicando la carta en la mano.
      // playAbility localiza el id en myHand y comprueba que el objeto esté en
      // canPlayObjects (categoría 'other': NinjutsuAbility no es SpellAbility
      // ni mana ni tierra) antes de clicar; si aún no es jugable, se pasa.
      if (gv.step === 'DECLARE_BLOCKERS') {
        const ninja = ctx.cardInHand('Ninja of the Deep Hours')
        if (ninja) {
          const clicked = ctx.playAbility('Ninja of the Deep Hours', ['other', 'basicPlayAbilities'], /ninjutsu/i)
          if (clicked) {
            ctx.log('onSelect: clic en Ninja (ninjutsu); espero maná + objetivo')
            return
          }
          ctx.log('onSelect: Ninja en mano pero sin habilidad jugable aún, paso')
        }
        ctx.pass()
        return
      }

      // Declarar atacantes: el Oso, entrando ya sin mareo (cheat). El Ninja debe
      // seguir en la mano y la confirmación va con 'special' (driver combat).
      if (gv.step === 'DECLARE_ATTACKERS' && me.isActive === true && this._attackedTurn !== gv.turn) {
        const bear = Object.values(me.battlefield ?? {}).find((c) => /runeclaw bear/i.test(c?.name ?? '') && !c.tapped)
        const ninja = ctx.cardInHand('Ninja of the Deep Hours')
        if (!bear || !ninja) {
          ctx.log('onSelect: falta Oso o Ninja, paso (bear=', Boolean(bear), 'ninja=', Boolean(ninja), ')')
          ctx.pass()
          return
        }
        this._attackedTurn = gv.turn
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: bear.id })
        ctx.log('onSelect: ataco con', bear.name)
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
        ctx.log('onSelect: cheatSetup (Ninja en mano + Oso y 2 Islas al campo)')
        void ctx.cheatSetup({
          hand: ['Ninja of the Deep Hours'],
          battlefield: ['Runeclaw Bear', 'Island', 'Island'],
        })
        return
      }
      ctx.pass()
    },
    // Ninjutsu puede preguntar la habilidad (si hubiera más de una jugable).
    onChooseAbility(opts, ctx) {
      ctx.log('onChooseAbility ninjutsu:', JSON.stringify(opts).slice(0, 250))
      const nj = (opts ?? []).find((o) => /ninjutsu/i.test(String(o?.label ?? '')))
      if (nj) return nj.value
      return (opts ?? [])[0]?.value
    },
    // Pagar {1}{U}: girar Islas sin voltear (solo Islas en nuestro campo).
    onPlayMana(ctx) {
      const isle = Object.values(ctx.me?.battlefield ?? {}).find((c) => !c.tapped && /island/i.test(c?.name ?? ''))
      if (isle) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: isle.id })
        ctx.log('onPlayMana: giro', isle.name)
      }
    },
    // Objetivo del coste: el atacante no bloqueado (nuestro Oso). El descarte de
    // limpieza también llega como GAME_TARGET a la misma ventana.
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      const pt = data?.options?.possibleTargets ?? data?.targets ?? []
      const ids = Array.isArray(pt)
        ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : Object.keys(pt ?? {})
      if (/discard/i.test(q)) {
        const land = ctx.cardInHand('Island')
        ctx.log('onTarget: descarte limpieza')
        return ids[0] ?? land
      }
      const bear = Object.values(ctx.me?.battlefield ?? {}).find((c) => /runeclaw bear/i.test(c?.name ?? ''))
      if (bear && (ids.length === 0 || ids.includes(bear.id))) {
        ctx.log('onTarget: devuelvo el Oso a la mano (coste ninjutsu)')
        return bear.id
      }
      if (bear?.id) return bear.id
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      // El atacante original ya está de vuelta en la mano...
      const bearInHand = Object.values(gv.myHand ?? {}).some((c) =>
        /runeclaw bear/i.test(c?.name ?? c?.displayName ?? ''),
      )
      if (!bearInHand) return false
      // ...y el Ninja está en el campo, girado y en el grupo de combate.
      const ninja = Object.values(me?.battlefield ?? {}).find((c) => /ninja of the deep hours/i.test(c?.name ?? ''))
      if (!ninja || ninja.tapped !== true) return false
      return (gv.combat ?? []).some((group) =>
        Object.values(group?.attackers ?? {}).some((c) => /ninja of the deep hours/i.test(c?.name ?? '')),
      )
    },
  }
}

export const drivers = { ninjutsu: makeNinjutsuDriver }

export const meta = {
  mechanic: 'ninjutsu',
  kind: 'game',
  assert: 'hasNinjutsu',
  note: 'Ninja of the Deep Hours ({3}{U} 2/2, ninjutsu {1}{U}) en mano y Runeclaw Bear (2/2 vanilla) al campo propio vía un único cheatSetup (más 2 Islas para el coste), contra el SIM pasivo de tierras. El Oso ataca sin bloqueadores y en la ventana DECLARE_BLOCKERS/PRIORITY se clica la carta en la mano: el NinjutsuAbility (canPlayObjects.other, regla "Ninjutsu {1}{U}") solo es legal cuando UnblockedPredicate ve un atacante no bloqueado; se paga {1}{U} girando Islas y el coste pide el atacante no bloqueado por GAME_TARGET para devolverlo a la mano, tras lo cual el Ninja entra al campo girado y atacando (NinjutsuEffect.addAttackerToCombat). Captura: Oso en myHand + Ninja en el campo tapped:true dentro de gv.combat[].attackers. Driver ninjutsu con cheatSetup.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeNinjutsuDriver())
}
