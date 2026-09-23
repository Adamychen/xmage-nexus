import { pathToFileURL } from 'node:url'
import { runRecorder, getMe } from '../rec-lib.mjs'

// P4 — coste para atacar (Propaganda-like): Propaganda ({2}{U}, "Creatures
// can't attack you or a planeswalker you control unless their controller
// pays {2} for each of those creatures.") cheateada al campo del SIM.
// Nosotros cheateamos Grizzly Bears (vanilla) al campo propio (sin mareo,
// puede atacar el mismo turno) y Prosperous Innkeeper ({1}{G}, "When ~
// enters, create a Treasure token") LANZADO de verdad (el cheat directo no
// dispara ETB) para tener un Treasure token sin girar cuando declaramos el
// ataque.
//
// Objetivo: verificar si el servidor ofrece el Treasure en `canPlayObjects`
// durante el GAME_PLAY_MANA del coste de Propaganda (que es lo que el web
// usa para decidir qué permanentes son clicables — ver playableUtils.ts /
// useBoardPresenter.ts) — reporte de usuario: al declarar el ataque con
// Treasure sin girar disponible, el pago de {2} no dejaba clicarlo.
//
// HALLAZGO (medido en vivo, 2026-09-23): durante el GAME_PLAY_MANA del coste
// de Propaganda, `canPlayObjects.objects` llega VACÍO (`{}`) aunque haya un
// Treasure Y varias Forest sin girar en el campo — a diferencia del pago de
// maná normal al lanzar un hechizo (donde el Treasure SÍ aparece bajo la
// clave "other": "{T}, Sacrifice this artifact: Add one mana of any..."). El
// servidor SÍ acepta `sendPlayerUUID(treasureId)` como pago válido (la
// mecánica de activación no depende de canPlayObjects), pero el web gateaba
// el click de cualquier permanente en `playableIds` (derivado 1:1 de
// canPlayObjects) — así que ningún permanente, ni el Treasure ni una Forest
// sin girar, era clicable para pagar este coste. El cliente oficial
// (Mage.Client `CardPanel.mouseClicked`) NO gatea el click en `isPlayable`:
// siempre reenvía el UUID y deja que el servidor decida. Fix aplicado en
// `useBoardPresenter.ts` (`manaFeedbackActive`): durante un feedback de maná
// se reenvía cualquier click de permanente aunque no esté en playableIds.
//
// onPlayMana: si hay un Treasure sin girar en el campo, se manda SU uuid
// (igual que un clic); si no, cae al comportamiento por defecto (tierra sin
// girar) — así el Innkeeper se paga con Forest y solo el resto del coste de
// Propaganda usa el Treasure (Treasure sac cost cubre {1}; el {1} restante lo
// paga una Forest).
function isTreasure(c) {
  // El token real llega con name "Treasure Token" (no "Treasure"); el
  // subtipo TREASURE es el campo estable.
  return (c?.subTypes ?? []).includes('TREASURE') && (c?.cardTypes ?? []).includes('ARTIFACT')
}

function untappedTreasure(gv) {
  const me = getMe(gv)
  for (const [id, c] of Object.entries(me?.battlefield ?? {})) {
    if (!c?.tapped && isTreasure(c)) return id
  }
  return null
}

function untappedForest(gv) {
  const me = getMe(gv)
  for (const [id, c] of Object.entries(me?.battlefield ?? {})) {
    if (!c?.tapped && (c?.cardTypes ?? []).includes('LAND')) return id
  }
  return null
}

function rivalHasPropaganda(gv) {
  const rival = (gv?.players ?? []).find((p) => !p?.controlled)
  return Object.values(rival?.battlefield ?? {}).some((c) => /propaganda/i.test(c?.name ?? ''))
}

function makeAttackCostDriver() {
  return {
    name: 'attack-cost',
    outFile: 'attack-cost.json',
    deck: {
      name: 'Mage Web attack-cost rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cheated: false,
    _bothCheated: false,
    _cast1: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      if (gv.step === 'DECLARE_ATTACKERS' && me.isActive === true) {
        const attacking = (gv.combat ?? []).some((g) =>
          Object.values(g?.attackers ?? {}).some((c) => /grizzly bears/i.test(c?.name ?? '')),
        )
        if (attacking) {
          ctx.log('onSelect: ataque ya declarado, confirmo (false)')
          ctx.pass()
          return
        }
        const grizzly = Object.entries(me.battlefield ?? {}).find(
          ([, c]) => /grizzly bears/i.test(c?.name ?? '') && !c.tapped,
        )
        const ready = this._cast1 && rivalHasPropaganda(gv) && untappedTreasure(gv)
        if (grizzly && ready) {
          ctx.log('onSelect: ataco con Grizzly (coste de Propaganda vendrá por GAME_PLAY_MANA)')
          ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: grizzly[0] })
          return
        }
        // Setup aún no listo (carrera cheat vs. combate): no ataco este turno,
        // reintento en el siguiente (Grizzly sigue sin mareo).
        ctx.log('onSelect: setup no listo (cast1=', this._cast1, 'propaganda=', rivalHasPropaganda(gv), 'treasure=', !!untappedTreasure(gv), '), no ataco todavía')
        ctx.pass()
        return
      }
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
        ctx.log('onSelect: cheatSetup (Grizzly + 2 Forest al campo, Innkeeper en mano; luego Propaganda al SIM)')
        const rival = (gv.players ?? []).find((p) => !p?.controlled)
        const rid = rival?.playerId ?? rival?.id
        void ctx
          .cheatSetup({
            battlefield: ['Grizzly Bears', 'Forest', 'Forest'],
            hand: ['Prosperous Innkeeper'],
          })
          .then(
            (r1) =>
              new Promise((r) => setTimeout(r, 800)).then(() =>
                r1?.ok && rid ? ctx.cheatSetup({ battlefield: ['Propaganda'] }, rid) : null,
              ),
          )
          .then(() => {
            this._bothCheated = true
            ctx.log('onSelect: ambos cheats listos')
          })
        return
      }
      const stackEmpty = Object.keys(gv.stack ?? {}).length === 0
      if (stackEmpty && !this._cast1 && ctx.cardInHand('Prosperous Innkeeper')) {
        this._cast1 = true
        ctx.log('onSelect: lanzo Innkeeper')
        ctx.playCardByName('Prosperous Innkeeper')
        return
      }
      ctx.pass()
    },
    onAsk(question) {
      // "Pay {2} to attack?" (DeclareAttackersCostEffect, chooseUse antes del
      // GAME_PLAY_MANA real): aceptar pagar, si no el ataque se cancela.
      if (/pay.*to attack/i.test(String(question ?? ''))) return true
      return undefined
    },
    onPlayMana(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (me?.isActive !== true || me?.hasPriority !== true) return
      const treasure = untappedTreasure(gv)
      if (treasure) {
        ctx.log('onPlayMana: pago con Treasure', treasure)
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: treasure })
        return
      }
      const land = untappedForest(gv)
      if (land) ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: land })
    },
    onChooseChoice(opts) {
      // Elección de color del maná "de cualquier color" del Treasure (si el
      // motor la pide; con un coste puramente genérico suele auto-resolver).
      return opts[0]?.value ?? opts[0]?.label
    },
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) {
        const hand = ctx.gv?.myHand ?? {}
        return Object.keys(hand)[0] ?? false
      }
      if (/pick triggered ability/i.test(q)) {
        const keys = Object.keys(data?.cardsView1 ?? {})
        return keys[0]
      }
      return undefined
    },
    captureWhen(gv) {
      if (!rivalHasPropaganda(gv)) return false
      const me = getMe(gv)
      const innkeepers = Object.values(me?.battlefield ?? {}).filter((c) => /prosperous innkeeper/i.test(c?.name ?? '')).length
      if (innkeepers < 1) return false
      const treasures = Object.values(me?.battlefield ?? {}).filter(isTreasure).length
      const attacking = (gv.combat ?? []).some((g) =>
        Object.values(g?.attackers ?? {}).some((c) => /grizzly bears/i.test(c?.name ?? '') && c?.tapped),
      )
      // Captura tras pagar: la Grizzly ya está atacando y el Treasure se
      // sacrificó (0 en el campo).
      return attacking && treasures === 0
    },
  }
}

export const drivers = { 'attack-cost': makeAttackCostDriver }

export const meta = {
  mechanic: 'attack-cost',
  kind: 'game',
  assert: 'hasAttackCostPaid',
  note: 'Propaganda ({2}{U}, "Creatures can\'t attack you or a planeswalker you control unless their controller pays {2} for each of those creatures.") cheateada al campo del SIM; Grizzly Bears propio cheateado (sin mareo) ataca y un Treasure token (creado por Prosperous Innkeeper lanzado de verdad con Forest) se sacrifica para cubrir parte del coste (el resto lo paga una Forest). HALLAZGO: durante el GAME_PLAY_MANA del coste de Propaganda, canPlayObjects llega VACÍO ({}) aunque haya Treasure y Forest sin girar — a diferencia del pago normal de un hechizo, donde el Treasure sí aparece en canPlayObjects.other. El servidor igualmente acepta sendPlayerUUID(treasureId) como pago válido; el bug estaba en el web, que gateaba el click de cualquier permanente en playableIds (1:1 con canPlayObjects) — reporte de usuario: con 2 Treasure disponibles, el pago de {2} para atacar no dejaba clicarlos. Fix: useBoardPresenter.ts reenvía cualquier click de permanente durante un feedback de maná (mode "mana"), igual que el cliente oficial (CardPanel.mouseClicked no gatea en isPlayable). Driver attack-cost con cheatSetup + spell real.',
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runRecorder(makeAttackCostDriver())
}
