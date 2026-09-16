import { pathToFileURL } from 'node:url'
import { runRecorder } from '../rec-lib.mjs'

// P4 — "debe bloquear" (§3.6) vía cheatSetup + Lure real: Lure ({1}{G}{G} aura
// encantada a nuestro Runeclaw Bear: "All creatures able to block enchanted
// creature do so") obliga al Grizzly Bears del SIM a bloquear.
//
// Hallazgo: el cheatSetup no puede adjuntar auras (GameImpl.cheat →
// putCardOntoBattlefieldWithEffects sin attachment; un aura sin encantar muere
// a las SBA), así que el Lure viaja como carta real del mazo (4 copias
// intercaladas en las primeras 12 para garantizar una en la mano inicial con
// skipInitShuffling) y se lanza de verdad sobre el Oso.
//
// Secuencia en T1 (todo el combo en el mismo turno, como first-strike):
//   tierra → cheats raw con la main aparcada (Oso + 3 Bosques propios; 800 ms
//   después el Grizzly rival) → cast del Lure (id conocido de la mano inicial,
//   responde al SELECT aparcado) → {1}{G}{G} girando Bosques → objetivo el Oso
//   → aura adjunta (attachedTo/attachments con UUID real) → pasar → atacar con
//   el Oso. El bloqueador debe montarse en el MISMO turno del ataque: el SIM
//   ataca con todo en su turno y un Grizzly cheateado antes quedaría girado e
//   incapaz de bloquear (regla bisecada en first-strike). Si el T1 falla, el
//   driver reintenta en turnos posteriores chequeando un Grizzly fresco en la
//   main previa al ataque.
//
// El bloqueo no depende de la IA: Combat.selectBlockers llama a
// retrieveMustBlockAttackerRequirements (RequirementEffect mustBlock → true) y
// el motor asigna el bloqueador con defender.declareBlocker antes de que el
// defensor declare; es una restricción de regla (MustBeBlockedByAllAttached).
const LURE = { cardName: 'Lure', setCode: 'CHK', cardNumber: '226' }

function makeMustBlockDriver() {
  return {
    name: 'must-block',
    outFile: 'must-block.json',
    deck: {
      name: 'Mage Web must-block rec',
      cards: [
        LURE,
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 1 },
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 1 },
        LURE,
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 1 },
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 1 },
        LURE,
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 1 },
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 1 },
        LURE,
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 1 },
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 1 },
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 48 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    _chainStarted: false,
    _cheatsOk: false,
    _castLure: false,
    _cheatTurn: -1,
    _attackedTurn: -1,
    lureOn(ctx) {
      const me = ctx.me
      const lure = Object.entries(me?.battlefield ?? {}).find(([, c]) => /^lure$/i.test(c?.name ?? ''))
      if (!lure) return null
      const bear = Object.entries(me?.battlefield ?? {}).find(([, c]) => /runeclaw bear/i.test(c?.name ?? ''))
      if (!bear) return null
      const attached = lure[1].attachedTo === bear[0] || (bear[1].attachments ?? []).includes(lure[0])
      return attached ? { lureId: lure[0], bearId: bear[0], bear: bear[1] } : null
    },
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return

      // Declarar atacantes: solo con el Oso encantado por Lure y un Grizzly
      // rival SIN girar disponible (mismo turno). Confirmar con 'special'.
      if (gv.step === 'DECLARE_ATTACKERS' && me.isActive === true && this._attackedTurn !== gv.turn) {
        const on = this.lureOn(ctx)
        const rival = (gv.players ?? []).find((p) => !p?.controlled)
        const grizzly = Object.values(rival?.battlefield ?? {}).find(
          (c) => /grizzly bears/i.test(c?.name ?? '') && !c.tapped,
        )
        if (!on || !grizzly || on.bear?.tapped) {
          ctx.log('onSelect: sin Lure adjunto o sin Grizzly sin girar, paso')
          ctx.pass()
          return
        }
        this._attackedTurn = gv.turn
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: on.bearId })
        ctx.log('onSelect: ataco con', on.bear.name, '(Lure adjunta)')
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
      // Tierra por turno (mazo casi todo Bosques): T1 tras ella va el combo.
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          ctx.log('onSelect: tierra T', turn)
          return
        }
      }
      // T1: cheats raw (NO auto-pasan: la main queda aparcada) y, en cuanto
      // ambos ok, cast del Lure con el id de la mano inicial; el cast responde
      // al SELECT aparcado. Regla P1: tras ≥1 acción normal (la tierra).
      if (!this._chainStarted) {
        this._chainStarted = true
        const myId = gv.myPlayerId ?? me.playerId ?? me.id
        const rival = (gv.players ?? []).find((p) => !p?.controlled)
        const rid = rival?.playerId ?? rival?.id
        ctx.log('onSelect: cheats raw (Oso + 3 Bosques propios, luego Grizzly rival)')
        void ctx
          .send('cheatSetup', {
            gameId: ctx.gameId,
            playerId: myId,
            zones: { battlefield: ['Runeclaw Bear', 'Forest', 'Forest', 'Forest'] },
          })
          .then((r1) =>
            new Promise((r) => setTimeout(r, 800)).then(() =>
              r1?.ok && rid
                ? ctx.send('cheatSetup', {
                    gameId: ctx.gameId,
                    playerId: rid,
                    zones: { battlefield: ['Grizzly Bears'] },
                  })
                : null,
            ),
          )
          .then((r2) => {
            this._cheatsOk = r2?.ok === true
            ctx.log('onSelect: cheats →', JSON.stringify({ ok: this._cheatsOk }))
            if (!this._cheatsOk) {
              // Cadena fallida: desbloquear la main y reintentar en otra ventana.
              this._chainStarted = false
              ctx.pass()
              return
            }
            if (!this._castLure && ctx.cardInHand('Lure')) {
              this._castLure = true
              ctx.log('onSelect: lanzo Lure (id de la mano inicial) sobre el Oso')
              ctx.playCardByName('Lure')
            } else {
              ctx.pass()
            }
          })
        return
      }
      // Reintento del cast (si el de la cadena no salió): la vista viva ya
      // confirma que el Lure sigue en la mano y el Oso en el campo.
      if (!this._castLure && ctx.cardInHand('Lure') && ctx.findOnBattlefield('Runeclaw Bear')) {
        this._castLure = true
        ctx.log('onSelect: lanzo Lure sobre el Oso')
        ctx.playCardByName('Lure')
        return
      }
      // Aura adjunta en main: garantizar un Grizzly sin girar ESTE turno (el
      // SIM ataca con todo en su turno) y pasar a combate.
      if (this.lureOn(ctx)) {
        const rival = (gv.players ?? []).find((p) => !p?.controlled)
        const fresh = Object.values(rival?.battlefield ?? {}).some(
          (c) => /grizzly bears/i.test(c?.name ?? '') && !c.tapped,
        )
        if (!fresh && this._cheatTurn !== turn) {
          this._cheatTurn = turn
          const rid = rival?.playerId ?? rival?.id
          if (rid) {
            ctx.log('onSelect: cheatSetup (Grizzly fresco al campo rival)')
            void ctx.cheatSetup({ battlefield: ['Grizzly Bears'] }, rid)
          }
          return
        }
        ctx.pass()
        return
      }
      ctx.pass()
    },
    // Pagar {1}{G}{G} solo con Bosques sin girar.
    onPlayMana(ctx) {
      const forest = Object.values(ctx.me?.battlefield ?? {}).find((c) => !c.tapped && /forest/i.test(c?.name ?? ''))
      if (forest) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: forest.id })
        ctx.log('onPlayMana: giro', forest.name)
      }
    },
    // Objetivo del Lure: nuestro Oso. El descarte de limpieza también llega
    // como GAME_TARGET ("Select a card to discard") y nunca debe responderse
    // con un permanente del campo (rechazo en bucle).
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) {
        const pt = data?.options?.possibleTargets ?? data?.targets ?? []
        const ids = Array.isArray(pt)
          ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
          : Object.keys(pt ?? {})
        ctx.log('onTarget: descarte limpieza')
        return ctx.cardInHand('Forest') ?? ids[0]
      }
      const bear = ctx.findOnBattlefield('Runeclaw Bear')
      if (bear) {
        ctx.log('onTarget: Lure → Oso')
        return bear
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      for (const group of gv.combat ?? []) {
        for (const [bearId, bear] of Object.entries(group?.attackers ?? {})) {
          if (!/runeclaw bear/i.test(bear?.name ?? '')) continue
          const blocked = Object.values(group?.blockers ?? {}).some((c) => /grizzly bears/i.test(c?.name ?? ''))
          if (!blocked) continue
          const lure = Object.entries(me?.battlefield ?? {}).find(([, c]) => /^lure$/i.test(c?.name ?? ''))
          const attached = Boolean(lure) && (lure[1].attachedTo === bearId || (bear.attachments ?? []).includes(lure[0]))
          return attached
        }
      }
      return false
    },
  }
}

export const drivers = { 'must-block': makeMustBlockDriver }

export const meta = {
  mechanic: 'must-block',
  kind: 'game',
  assert: 'hasMustBlock',
  note: 'Lure ({1}{G}{G} aura: "All creatures able to block enchanted creature do so", 4 copias reales del mazo) lanzado sobre un Runeclaw Bear propio (2/2 vanilla) y Grizzly Bears (2/2 vanilla) cheateado al campo del SIM en el MISMO turno T1 del ataque, contra el SIM pasivo de tierras. Hallazgo: cheatSetup no puede adjuntar auras (GameImpl.cheat → putCardOntoBattlefieldWithEffects sin attachment; un aura sin encantar muere a las SBA), así que el aura se lanza de verdad: T1 tierra + cheats raw (Oso + 3 Bosques propios; 800 ms después el Grizzly rival) con la main aparcada + cast del Lure con el id de la mano inicial (responde al SELECT aparcado), {1}{G}{G} girando Bosques y GAME_TARGET al Oso; el aura viaja como attachment real (attachedTo del Lure = UUID del Oso; attachments del Oso contiene el UUID del Lure). El bloqueo es una restricción de regla, no decisión de la IA: Combat.selectBlockers llama a retrieveMustBlockAttackerRequirements (MustBeBlockedByAllAttached → mustBlock) y el motor asigna el bloqueador con defender.declareBlocker. Captura: en gv.combat[].attackers el Oso con el Lure adjunto y en blockers el Grizzly del SIM (DECLARE_BLOCKERS). El bloqueador debe montarse en el mismo turno del ataque: el SIM ataca con todo en su turno y un Grizzly cheateado antes quedaría girado (regla bisecada en first-strike). Driver must-block con cheatSetup + Lure real.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeMustBlockDriver())
}
