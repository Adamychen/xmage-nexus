#!/usr/bin/env node
// Grabador de frames reales del protocolo XMage. Conecta al proxy (que a su
// vez va al servidor real: local por defecto o beta vía E2E_SERVER_HOST/PORT)
// y reproduce una mecánica mediante un "driver". Vuelca el primer GAME_UPDATE
// que cumple captureWhen a web/fixtures/recorded/<outFile>.
//
// Uso:
//   node scripts/record.mjs            # graba todas las mecánicas registradas
//   node scripts/record.mjs mutate     # graba solo mutate
//   E2E_SERVER_HOST=localhost node scripts/record.mjs all
//
// El oráculo "protocolo real" para CI es el servidor XMage LOCAL (mismo fork
// 1.4.61-V1): arrancar con `node scripts/ctl.mjs restart all` y grabar.

import { spawn } from 'node:child_process'
import { runRecorder, runTournamentRecorder, getMe } from './rec-lib.mjs'

const MUTATE_DECK = {
  name: 'Mage Web mutate',
  cards: [
    { cardName: 'Elvish Mystic', setCode: 'm14', cardNumber: '169', amount: 1 },
    { cardName: 'Gemrazer', setCode: 'iko', cardNumber: '155', amount: 1 },
    { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 54 },
    { cardName: 'Elvish Mystic', setCode: 'm14', cardNumber: '169', amount: 2 },
    { cardName: 'Gemrazer', setCode: 'iko', cardNumber: '155', amount: 2 },
  ],
  sideboard: [],
}

const CREATURE_DECK = {
  name: 'Mage Web creature',
  cards: [
    { cardName: 'Elvish Mystic', setCode: 'm14', cardNumber: '169', amount: 1 },
    { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 56 },
    { cardName: 'Elvish Mystic', setCode: 'm14', cardNumber: '169', amount: 3 },
  ],
  sideboard: [],
}

// Ordenado (skipInitShuffling): mano inicial con Mountain x4 + Goblin x2 →
// turno 1: tierra + Goblin (haste) + declarar ataque.
const COMBAT_DECK = {
  name: 'Mage Web combat rec',
  cards: [
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 4 },
    { cardName: 'Raging Goblin', setCode: 'M10', cardNumber: '153', amount: 2 },
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 26 },
  ],
  sideboard: [],
}

function makeMutateDriver() {
  return {
    name: 'mutate',
    outFile: 'mutate.json',
    deck: MUTATE_DECK,
    gameType: 'Constructed - Pioneer',
    _landTurn: -1,
    _elvish: false,
    _gem: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.log('onSelect: no main, pass')
        ctx.pass()
        return
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          ctx.log('onSelect: jugar tierra')
          return
        }
      }
      if (!this._elvish && ctx.cardInHand('Elvish Mystic')) {
        this._elvish = true
        ctx.log('onSelect: jugar Elvish')
        ctx.playCardByName('Elvish Mystic')
        return
      }
      if (!this._gem && ctx.cardInHand('Gemrazer') && ctx.findOnBattlefield('Elvish Mystic') && ctx.untappedMana() >= 3) {
        this._gem = true
        ctx.log('onSelect: jugar Gemrazer (mutate)')
        ctx.playCardByName('Gemrazer')
        return
      }
      ctx.log('onSelect: nada que hacer, pass (turn=', turn, 'untappedMana=', ctx.untappedMana(), ')')
      ctx.pass()
    },
    onTarget(ctx) {
      return ctx.findOnBattlefield('Elvish Mystic')
    },
    captureWhen(gv) {
      const me = getMe(gv)
      for (const c of Object.values(me?.battlefield ?? {})) {
        if (c?.mutated && c?.mutateView && Object.keys(c.mutateView).length) return true
      }
      return false
    },
  }
}

function makeCreatureDriver() {
  return {
    name: 'creature',
    outFile: 'creature.json',
    deck: CREATURE_DECK,
    gameType: 'Constructed - Pioneer',
    _landTurn: -1,
    _played: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) {
        return
      }
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      const turn = gv.turn ?? 0
      const landsInPlay = Object.values(me.battlefield ?? {}).filter((c) => (c.cardTypes ?? []).includes('LAND') && !c.tapped).length
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      if (!this._played && ctx.cardInHand('Elvish Mystic') && ctx.untappedMana() >= 1) {
        this._played = true
        ctx.playCardByName('Elvish Mystic')
        return
      }
      ctx.pass()
    },
    captureWhen(gv) {
      const me = getMe(gv)
      for (const c of Object.values(me?.battlefield ?? {})) {
        if ((c.cardTypes ?? []).includes('CREATURE') && !c.mutated) return true
      }
      return false
    },
  }
}

// Sonda de señal Monstruosidad (no es fixture de CI): Polukranos en cabeza +
// Forests. Turnos: tierra, castear (2GG), activar Monstruosidad X=1 (1GG).
const MONSTROSITY_DECK = {
  name: 'Mage Web monstrosity probe',
  cards: [
    { cardName: 'Polukranos, World Eater', setCode: 'THS', cardNumber: '172', amount: 3 },
    { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 57 },
  ],
  sideboard: [],
}

function makeCombatDriver() {
  return {
    name: 'combat',
    outFile: 'combat.json',
    deck: COMBAT_DECK,
    gameType: 'Constructed - Pioneer',
    _landTurn: -1,
    _goblin: false,
    _attacked: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return

      // Declarar atacantes: enviar cada atacante disponible y confirmar con 'special'
      if (gv.step === 'DECLARE_ATTACKERS' && me.isActive === true && !this._attacked) {
        const attackers = Object.values(me.battlefield ?? {}).filter(
          (c) => (c.cardTypes ?? []).includes('CREATURE') && !c.tapped
        )
        if (attackers.length === 0) {
          ctx.pass()
          return
        }
        this._attacked = true
        for (const a of attackers) {
          ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: a.id })
          ctx.log('onSelect: declarar atacante', a.name)
        }
        // confirmar la declaración (acción especial del diálogo de ataque)
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
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          ctx.log('onSelect: jugar tierra')
          return
        }
      }
      if (!this._goblin && ctx.cardInHand('Raging Goblin') && ctx.untappedMana() >= 1) {
        this._goblin = true
        ctx.log('onSelect: jugar Raging Goblin')
        ctx.playCardByName('Raging Goblin')
        return
      }
      ctx.pass()
    },
    captureWhen(gv) {
      const combat = gv.combat
      if (!Array.isArray(combat) || combat.length === 0) return false
      for (const group of combat) {
        const attackers = group?.attackers
        const ids = Array.isArray(attackers)
          ? attackers
          : attackers && typeof attackers === 'object'
          ? Object.keys(attackers)
          : []
        if (ids.length > 0) return true
      }
      return false
    },
  }
}

function makeMonstrosityDriver() {
  return {
    name: 'monstrosity',
    outFile: 'monstrosity.probe.json',
    deck: MONSTROSITY_DECK,
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _cast: false,
    _activated: false,
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
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      const poloId = ctx.findOnBattlefield('Polukranos, World Eater')
      if (!this._cast && !poloId && ctx.cardInHand('Polukranos') && ctx.untappedMana() >= 4) {
        this._cast = true
        ctx.playCardByName('Polukranos')
        return
      }
      if (this._cast && poloId && !this._activated && ctx.untappedMana() >= 4) {
        this._activated = true
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: poloId })
        return
      }
      ctx.pass()
    },
    onChooseAbility(opts) {
      return (opts.find((o) => /monstrosity/i.test(o.label)) ?? opts[0])?.value
    },
    onTarget(ctx) {
      ctx.sendAction('sendPlayerBoolean', { gameId: ctx.gameId, value: false })
      return undefined
    },
    onTargetAmount() {
      return 1
    },
    captureWhen(gv) {
      const me = getMe(gv)
      for (const c of Object.values(me?.battlefield ?? {})) {
        if ((c?.name ?? '') === 'Polukranos, World Eater' && (c?.counters ?? []).some((k) => (k?.count ?? 0) >= 1)) return true
      }
      return false
    },
  }
}

// P4 — aura determinista vía cheatSetup: mazo todo-Bosques vs SIM pasivo.
// T1 tierra + setup (Mystic + Rancor en mano, Bosque al campo); T1 Mystic;
// T2 Rancor sobre el Mystic propio. Sin cheatSetup dependería de robar el
// aura y la criatura en orden.
const AURA_DECK = {
  name: 'Mage Web aura rec',
  cards: [
    { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 },
  ],
  sideboard: [],
}

function makeAuraDriver() {
  return {
    name: 'aura',
    outFile: 'aura.json',
    deck: AURA_DECK,
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _landTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el setup va tras ≥1 acción normal (ver counterspell).
      if (!this._acted) {
        const land = ctx.playLand()
        if (land) {
          this._acted = true
          this._landTurn = gv.turn ?? 0
          ctx.log('onSelect: tierra inicial')
        } else {
          ctx.pass()
        }
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Mystic + Rancor en mano, Bosque al campo)')
        void ctx.cheatSetup({ hand: ['Elvish Mystic', 'Rancor'], battlefield: ['Forest'] })
      }
      const mysticBf = ctx.findOnBattlefield('Elvish Mystic')
      if (!mysticBf && ctx.cardInHand('Elvish Mystic')) {
        ctx.log('onSelect: juego Elvish Mystic')
        ctx.playCardByName('Elvish Mystic')
        return
      }
      if (mysticBf && ctx.cardInHand('Rancor')) {
        ctx.log('onSelect: lanzo Rancor sobre el Mystic')
        ctx.playCardByName('Rancor')
        return
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      ctx.pass()
    },
    // Único objetivo que elegimos: nuestro Mystic para el Rancor.
    onTarget(ctx) {
      return ctx.findOnBattlefield('Elvish Mystic')
    },
    // Pagar solo con Bosques sin voltear: el pago por defecto prioriza la
    // criatura de maná (Elvish Mystic) y con mareo de invocación el servidor
    // lo rechaza → bucle GAME_PLAY_MANA sin fin (visto en vivo 2026-09-15).
    onPlayMana(ctx) {
      const forest = Object.values(ctx.me?.battlefield ?? {}).find((c) => !c.tapped && /forest/i.test(c?.name ?? ''))
      if (forest) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: forest.id })
        ctx.log('onPlayMana: giro', forest.name)
      }
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      return Object.values(me?.battlefield ?? {}).some((c) => /rancor/i.test(c?.name ?? ''))
    },
  }
}

// P4 — fichas deterministas vía cheatSetup: mazo todo-Montañas vs SIM pasivo.
// T1 tierra + setup (Dragon Fodder en mano, 2 Montañas al campo); en cuanto
// hay 2 manás se lanza el Fodder → 2 Goblin Token.
const TOKEN_DECK = {
  name: 'Mage Web token rec',
  cards: [
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 },
  ],
  sideboard: [],
}

function makeTokenDriver() {
  return {
    name: 'tokens',
    outFile: 'tokens.json',
    deck: TOKEN_DECK,
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _landTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el setup va tras ≥1 acción normal (ver counterspell).
      if (!this._acted) {
        const land = ctx.playLand()
        if (land) {
          this._acted = true
          this._landTurn = gv.turn ?? 0
          ctx.log('onSelect: tierra inicial')
        } else {
          ctx.pass()
        }
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Dragon Fodder en mano, 2 Montañas al campo)')
        void ctx.cheatSetup({ hand: ['Dragon Fodder'], battlefield: ['Mountain', 'Mountain'] })
      }
      if (ctx.cardInHand('Dragon Fodder') && ctx.untappedMana() >= 2) {
        ctx.log('onSelect: lanzo Dragon Fodder')
        ctx.playCardByName('Dragon Fodder')
        return
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      ctx.pass()
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const toks = Object.values(me?.battlefield ?? {}).filter((c) => (c?.isToken === true) || /goblin token/i.test(c?.name ?? ''))
      return toks.length >= 2
    },
  }
}

// P4 — modal determinista vía cheatSetup: Boros Charm (elige modo + objetivo
// a jugador) vs SIM pasivo. Mazo Montañas+Llanuras; T1 tierra + setup (Charm
// en mano, Llanura+Montaña al campo); en cuanto hay {R}{W} se lanza el Charm,
// se elige el modo de daño y se apunta al rival.
const MODAL_DECK = {
  name: 'Mage Web modal rec',
  cards: [
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 30 },
    { cardName: 'Plains', setCode: 'm20', cardNumber: '261', amount: 30 },
  ],
  sideboard: [],
}

function makeModalDriver() {
  return {
    name: 'modal',
    outFile: 'modal.json',
    deck: MODAL_DECK,
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _landTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el setup va tras ≥1 acción normal (ver counterspell).
      if (!this._acted) {
        const land = ctx.playLand()
        if (land) {
          this._acted = true
          this._landTurn = gv.turn ?? 0
          ctx.log('onSelect: tierra inicial')
        } else {
          ctx.pass()
        }
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Boros Charm en mano, Llanura+Montaña al campo)')
        void ctx.cheatSetup({ hand: ['Boros Charm'], battlefield: ['Plains', 'Mountain'] })
      }
      if (ctx.cardInHand('Boros Charm') && ctx.untappedMana() >= 2) {
        ctx.log('onSelect: lanzo Boros Charm')
        ctx.playCardByName('Boros Charm')
        return
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      ctx.pass()
    },
    // Modo de daño (4 al jugador). OJO: los modos de un modal llegan como
    // GAME_CHOOSE_ABILITY (son habilidades), no como CHOICE — elegir por texto
    // porque el orden no está garantizado (visto en vivo 2026-09-15: la 1ª era
    // daño por suerte).
    onChooseAbility(opts, ctx) {
      const dmg = (opts ?? []).find((o) => /4 damage/i.test(o.label ?? ''))
      if (dmg) {
        ctx.log('onChooseAbility: modo daño')
        return dmg.value
      }
      return (opts ?? [])[0]?.value
    },
    // Fallback por si algún modal futuro usa CHOICE para los modos.
    onChooseChoice(opts, ctx) {
      const dmg = (opts ?? []).find((o) => /4 damage/i.test(o.label ?? ''))
      if (dmg) {
        ctx.log('onChooseChoice: modo daño')
        return dmg.value
      }
      return (opts ?? [])[0]?.value
    },
    // Pagar {R}{W} con la tierra del color que pide cada prompt (el mensaje
    // trae el símbolo, p.ej. "Pay {W}").
    onPlayMana(ctx, m) {
      const msg = String(m?.data?.message ?? '')
      const wantW = /\{W\}/.test(msg)
      const wantR = /\{R\}/.test(msg)
      const bfs = Object.values(ctx.me?.battlefield ?? {}).filter((c) => !c.tapped && (c.cardTypes ?? []).includes('LAND'))
      const pick = bfs.find((c) => wantW ? /plains/i.test(c?.name ?? '') : wantR ? /mountain/i.test(c?.name ?? '') : true)
        ?? bfs.find((c) => !/plains|mountain/i.test(c?.name ?? ''))
        ?? bfs[0]
      if (pick) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: pick.id })
        ctx.log('onPlayMana: giro', pick.name, 'para', msg.slice(0, 40))
      }
    },
    // Único objetivo que elegimos: el jugador rival (modo daño).
    onTarget(ctx) {
      const opp = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
      const id = opp?.playerId ?? opp?.id
      if (id) ctx.log('onTarget: objetivo = rival')
      return id
    },
    captureWhen(gv) {
      return Object.values(gv?.stack ?? {}).some((s) => /boros charm/i.test(s?.name ?? ''))
    },
  }
}

// P4 — coste X determinista vía cheatSetup: Walking Ballista con X=2
// ({X}{X} = XX cuenta doble) vs SIM pasivo. Mazo todo-Montañas; T1 tierra +
// setup (Ballista en mano, 3 Montañas al campo); en cuanto hay 4 manás se
// lanza con X=2 → criatura 2/2 con 2 contadores +1/+1. Cubre §3.2 (X/XX) y
// de paso §3.9 (contadores). Sin cheatSetup dependería de robarla + tierras.
const XCOST_DECK = {
  name: 'Mage Web xcost rec',
  cards: [
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 },
  ],
  sideboard: [],
}

function makeXcostDriver() {
  return {
    name: 'xcosts',
    outFile: 'xcosts.json',
    deck: XCOST_DECK,
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _landTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el setup va tras ≥1 acción normal (ver counterspell).
      if (!this._acted) {
        const land = ctx.playLand()
        if (land) {
          this._acted = true
          this._landTurn = gv.turn ?? 0
          ctx.log('onSelect: tierra inicial')
        } else {
          ctx.pass()
        }
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Ballista en mano, 3 Montañas al campo)')
        void ctx.cheatSetup({ hand: ['Walking Ballista'], battlefield: ['Mountain', 'Mountain', 'Mountain'] })
      }
      if (ctx.cardInHand('Walking Ballista') && ctx.untappedMana() >= 4) {
        ctx.log('onSelect: lanzo Walking Ballista')
        ctx.playCardByName('Walking Ballista')
        return
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      ctx.pass()
    },
    // X=2 (verificado en QA counters-1: el prompt admite el entero directo).
    onTargetAmount(data, ctx) {
      ctx.log('onTargetAmount: X=2 (min=', data?.min, 'max=', data?.max, ')')
      return 2
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      return Object.values(me?.battlefield ?? {}).some((c) => /walking ballista/i.test(c?.name ?? ''))
    },
  }
}

// P4 — respuesta en pila vía cheatSetup (§3.5): Hornet Sting a nuestro propio
// Mystic + Giant Growth en respuesta (+3/+3 → sobrevive al daño). Todo NUESTRO
// (sin depender de la IA): el SIM solo lanza su Bolt a la cara con el tablero
// vacío y lo retiene con criaturas fuera (108 turnos sin lanzarlo, visto en
// vivo 2026-09-15) — así que la respuesta se monta sobre hechizo propio, que
// es legal y deja la misma traza de pila (orden + resolución una a una).
function makeResponseDriver() {
  return {
    name: 'response',
    outFile: 'response.json',
    deck: AURA_DECK,
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _landTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')

      const stingOnStack = stackSpells(gv).some((s) => /hornet sting/i.test(s?.name ?? ''))
      const growth = ctx.cardInHand('Giant Growth')
      const mysticBf = ctx.findOnBattlefield('Elvish Mystic')

      // Sting propio en pila + Growth en mano → responder (somos el jugador
      // activo en nuestra main: la prioridad vuelve a nosotros tras lanzar).
      if (stingOnStack && growth && mysticBf) {
        ctx.log('onSelect: Growth en respuesta al Sting')
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: growth })
        return
      }

      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el setup va tras ≥1 acción normal (ver counterspell).
      if (!this._acted) {
        const land = ctx.playLand()
        if (land) {
          this._acted = true
          this._landTurn = gv.turn ?? 0
          ctx.log('onSelect: tierra inicial')
        } else {
          ctx.pass()
        }
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Mystic + Sting + Growth en mano, 2 Bosques al campo)')
        void ctx.cheatSetup({ hand: ['Elvish Mystic', 'Hornet Sting', 'Giant Growth'], battlefield: ['Forest', 'Forest'] })
      }
      if (!mysticBf && ctx.cardInHand('Elvish Mystic')) {
        ctx.log('onSelect: juego Elvish Mystic')
        ctx.playCardByName('Elvish Mystic')
        return
      }
      // Con Mystic fuera y maná: Sting al propio Mystic para montar la pila.
      const sting = ctx.cardInHand('Hornet Sting')
      if (mysticBf && sting && !stingOnStack) {
        ctx.log('onSelect: Sting al propio Mystic (monto la pila)')
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: sting })
        return
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      ctx.pass()
    },
    // Pagar {G} también en turnos del rival; solo Bosques (el Mystic puede
    // estar mareado — ver driver aura).
    onPlayMana(ctx) {
      const forest = Object.values(ctx.me?.battlefield ?? {}).find((c) => !c.tapped && /forest/i.test(c?.name ?? ''))
      if (forest) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: forest.id })
        ctx.log('onPlayMana: giro', forest.name)
      }
    },
    // Único objetivo que elegimos: nuestro Mystic (Sting y Growth). Y el
    // descarte de limpieza (GAME_TARGET "Select a card to discard", visto en
    // vivo 2026-09-15): un Bosque de la mano, nunca las piezas del combo.
    onTarget(ctx, question) {
      if (/discard/i.test(question ?? '')) {
        this._spent = this._spent ?? []
        const hand = ctx.gv?.myHand ?? {}
        const forest = Object.entries(hand).find(([id, c]) => /forest/i.test(c?.name ?? '') && !this._spent.includes(id))
        if (forest) {
          this._spent.push(forest[0])
          ctx.log('onTarget: descarto', forest[1].name)
          return forest[0]
        }
        return undefined
      }
      return ctx.findOnBattlefield('Elvish Mystic')
    },
    captureWhen(gv) {
      const names = stackSpells(gv).map((s) => String(s?.name ?? ''))
      return names.some((n) => /giant growth/i.test(n)) && names.some((n) => /hornet sting/i.test(n))
    },
  }
}

// P4 — triggers simultáneos vía cheatSetup (§3.5): 2 Soul Warden al campo +
// Mystic en mano; al entrar el Mystic disparan las 2 Wardens a la vez → el
// servidor pide orden (tipo de prompt por descubrir en el log) → vidas 22.
// Todo nuestro salvo el orden, que resuelve igual en cualquier caso.
function makeTriggerOrderDriver() {
  return {
    name: 'trigger-order',
    outFile: 'trigger-order.json',
    deck: AURA_DECK,
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _landTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el setup va tras ≥1 acción normal (ver counterspell).
      if (!this._acted) {
        const land = ctx.playLand()
        if (land) {
          this._acted = true
          this._landTurn = gv.turn ?? 0
          ctx.log('onSelect: tierra inicial')
        } else {
          ctx.pass()
        }
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (2 Wardens + Bosque al campo, Mystic en mano)')
        void ctx.cheatSetup({ hand: ['Elvish Mystic'], battlefield: ['Soul Warden', 'Soul Warden', 'Forest'] })
      }
      if (!ctx.findOnBattlefield('Elvish Mystic') && ctx.cardInHand('Elvish Mystic')) {
        ctx.log('onSelect: juego Elvish Mystic (dispara 2 Wardens)')
        ctx.playCardByName('Elvish Mystic')
        return
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      ctx.pass()
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const wardens = Object.values(me?.battlefield ?? {}).filter((c) => /soul warden/i.test(c?.name ?? ''))
      const mystic = Object.values(me?.battlefield ?? {}).some((c) => /elvish mystic/i.test(c?.name ?? ''))
      return wardens.length >= 2 && mystic && (me?.life ?? 0) >= 22
    },
  }
}

// P4 — trigger "may" + búsqueda vía cheatSetup (§3.5): Solemn Simulacrum {4}
// en mano (+3 Bosques al campo + tierra del turno = 4 manás); al entrar, el
// "may" llega como GAME_ASK (Sí → se busca Bosque en la biblioteca).
function makeMayTriggerDriver() {
  return {
    name: 'may-trigger',
    outFile: 'may-trigger.json',
    deck: AURA_DECK,
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _landTurn: -1,
    _askedMay: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el setup va tras ≥1 acción normal (ver counterspell).
      if (!this._acted) {
        const land = ctx.playLand()
        if (land) {
          this._acted = true
          this._landTurn = gv.turn ?? 0
          ctx.log('onSelect: tierra inicial')
        } else {
          ctx.pass()
        }
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Solemn en mano, 3 Bosques al campo)')
        void ctx.cheatSetup({ hand: ['Solemn Simulacrum'], battlefield: ['Forest', 'Forest', 'Forest'] })
      }
      if (!ctx.findOnBattlefield('Solemn Simulacrum') && ctx.cardInHand('Solemn Simulacrum') && ctx.untappedMana() >= 4) {
        ctx.log('onSelect: juego Solemn Simulacrum')
        ctx.playCardByName('Solemn Simulacrum')
        return
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      ctx.pass()
    },
    // El "you may search" del Solemn es pregunta Sí/No.
    onAsk(question, ctx) {
      if (/search|may/i.test(question ?? '')) {
        this._askedMay = true
        ctx.log('onAsk: may del Solemn → SÍ')
        return true
      }
      return undefined
    },
    // La búsqueda ("Select a basic land card") es GAME_TARGET con los ids en
    // data.options.possibleTargets (visto en vivo 2026-09-15) — se elige el
    // primero (todo el mazo son Bosques).
    onTarget(ctx, question, data) {
      if (/basic land/i.test(question ?? '')) {
        const pt = data?.options?.possibleTargets ?? data?.targets ?? []
        const ids = Array.isArray(pt)
          ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
          : Object.keys(pt ?? {})
        if (ids[0]) {
          ctx.log('onTarget: Bosque de la búsqueda')
          return ids[0]
        }
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const solemn = Object.values(me?.battlefield ?? {}).some((c) => /solemn simulacrum/i.test(c?.name ?? ''))
      return solemn && this._askedMay === true
    },
  }
}

// P4 — convoke vía cheatSetup (§3.2): Chord of Calling con X=0 ({G}{G}{G}
// girando 3 Mystics) + tutor a campo (§3.8 de paso). Mazo todo-Bosques vs SIM
// pasivo: T1 tierra + setup (Chord en mano, 3 Mystics al campo, 1 Mystic en
// biblioteca); se lanza el Chord, X=0, se giran criaturas y se trae el Mystic.
function makeConvokeDriver() {
  return {
    name: 'convoke',
    outFile: 'convoke.json',
    deck: AURA_DECK,
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _landTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el setup va tras ≥1 acción normal (ver counterspell).
      if (!this._acted) {
        const land = ctx.playLand()
        if (land) {
          this._acted = true
          this._landTurn = gv.turn ?? 0
          ctx.log('onSelect: tierra inicial')
        } else {
          ctx.pass()
        }
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Chord en mano, 3 Mystics al campo, Mystic en biblioteca)')
        void ctx.cheatSetup({
          hand: ['Chord of Calling'],
          battlefield: ['Elvish Mystic', 'Elvish Mystic', 'Elvish Mystic'],
          library: ['Elvish Mystic'],
        })
      }
      if (ctx.cardInHand('Chord of Calling')) {
        ctx.log('onSelect: lanzo Chord of Calling')
        ctx.playCardByName('Chord of Calling')
        return
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      ctx.pass()
    },
    // X=1: CMC≤1 trae al Mystic (con X=0 no hay objetivo legal: 0 targets,
    // visto en vivo 2026-09-15). Cuesta {1}{G}{G}{G}: 3 Mystics por convoke +
    // 1 Bosque para el {1}.
    onTargetAmount(data, ctx) {
      ctx.log('onTargetAmount: X=1')
      return 1
    },
    // Girar Mystics para convoke + elegir el Mystic de la biblioteca. Los
    // prompts exactos se descubren en el log (primera vez que se ejercitan).
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      if (/convoke|tap/i.test(q)) {
        const mystic = Object.values(ctx.me?.battlefield ?? {}).find((c) => !c.tapped && /elvish mystic/i.test(c?.name ?? ''))
        if (mystic) {
          ctx.log('onTarget: giro Mystic para convoke')
          return mystic.id
        }
        return undefined
      }
      if (/creature/i.test(q)) {
        const pt = data?.options?.possibleTargets ?? data?.targets ?? []
        const ids = Array.isArray(pt)
          ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
          : Object.keys(pt ?? {})
        if (ids[0]) {
          ctx.log('onTarget: criatura del Chord')
          return ids[0]
        }
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const mystics = Object.values(me?.battlefield ?? {}).filter((c) => /elvish mystic/i.test(c?.name ?? ''))
      return mystics.length >= 4
    },
  }
}

// P4 — flashback vía cheatSetup (§3.3): Faithless Looting en el cementerio se
// lanza por su coste de flashback {R} (roba 2, descarta 2) y acaba exiliada.
// Mazo todo-Montañas vs SIM pasivo.
function makeFlashbackDriver() {
  return {
    name: 'flashback',
    outFile: 'flashback.json',
    deck: TOKEN_DECK,
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _landTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el setup va tras ≥1 acción normal (ver counterspell).
      if (!this._acted) {
        const land = ctx.playLand()
        if (land) {
          this._acted = true
          this._landTurn = gv.turn ?? 0
          ctx.log('onSelect: tierra inicial')
        } else {
          ctx.pass()
        }
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Looting al cementerio, 2 Montañas al campo)')
        void ctx.cheatSetup({ graveyard: ['Faithless Looting'], battlefield: ['Mountain', 'Mountain'] })
      }
      const looting = ctx.cardInGraveyard('Faithless Looting')
      if (looting) {
        ctx.log('onSelect: lanzo Looting por flashback')
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: looting })
        return
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      ctx.pass()
    },
    // El descarte del Looting (roba 2, descarta 2): Montañas, una por prompt,
    // sin repetir la ya descartada (el servidor repite el prompt y devolver
    // el mismo UUID = rechazo en bucle, visto en vivo 2026-09-15).
    onTarget(ctx, question) {
      if (/discard/i.test(question ?? '')) {
        this._spent = this._spent ?? []
        const hand = ctx.gv?.myHand ?? {}
        const mtn = Object.entries(hand).find(([id, c]) => /mountain/i.test(c?.name ?? '') && !this._spent.includes(id))
        if (mtn) {
          this._spent.push(mtn[0])
          ctx.log('onTarget: descarto', mtn[1].name)
          return mtn[0]
        }
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const ex = me?.exile ?? gv?.exiles ?? {}
      return Object.values(ex).some((c) => /faithless looting/i.test(c?.name ?? (typeof c === 'string' ? c : '')))
    },
  }
}

// P1/P4 — escenario determinista vía cheatSetup: el mazo propio son todo
// Islas y el SIM lleva Montañas + Lightning Bolt. En la primera prioridad se
// colocan Counterspell en mano + 2 Islas al campo; a partir de ahí solo tierra
// + pasar con maná abierto hasta que el SIM lance su Bolt, que se
// contrarresta. Sin cheatSetup esto dependería de robar el counter a tiempo.
const COUNTER_DECK = {
  name: 'Mage Web counter rec',
  cards: [
    { cardName: 'Island', setCode: 'iko', cardNumber: '271', amount: 60 },
  ],
  sideboard: [],
}

const BOLT_SIM_DECK = {
  name: 'Mage Web bolt AI',
  cards: [
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 4 },
    { cardName: 'Lightning Bolt', setCode: 'M10', cardNumber: '146', amount: 4 },
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 52 },
  ],
  sideboard: [],
}

function stackSpells(gv) {
  return Object.entries(gv?.stack ?? {}).map(([id, s]) => ({ id, ...(s ?? {} ) }))
}

function makeCounterspellDriver() {
  return {
    name: 'counterspell',
    outFile: 'counterspell.json',
    deck: COUNTER_DECK,
    simDeck: BOLT_SIM_DECK,
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _cheated: false,
    _landPlayed: false,
    _landTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return

      // 1. Bolt rival en la pila + Counterspell en mano → contrarrestar.
      const bolt = stackSpells(gv).find((s) => /lightning bolt/i.test(s?.name ?? ''))
      const cs = ctx.cardInHand('Counterspell')
      if (bolt && cs) {
        ctx.log('onSelect: lanzo Counterspell contra el Bolt')
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: cs })
        return
      }

      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')

      // 2. Bolt en pila sin counter (llegó antes del setup): intentar el setup
      // en nuestra main (a esas alturas el juego ya procesó acciones).
      if (bolt && !cs) {
        if (isMyMain && !this._cheated) {
          this._cheated = true
          ctx.log('onSelect: cheatSetup tardío (Bolt ya en pila)')
          void ctx.cheatSetup({ hand: ['Counterspell'], battlefield: ['Island', 'Island'] })
        }
        ctx.pass()
        return
      }

      // Fuera de nuestra main solo pasar (jugar tierra ahí sería ilegal y el
      // servidor repetiría el prompt con la misma vista).
      if (!isMyMain) {
        ctx.pass()
        return
      }

      // 3. REGLA P1 (bisecada en vivo 2026-09-15): el cheat corre fuera del
      // hilo de juego y en la PRIMERA prioridad de la partida congela el loop
      // (ok:true pero sin más GAME_UPDATEs). Tras ≥1 acción normal (aquí, la
      // tierra del T1) es seguro — igual que el cliente desktop, que cheatea
      // mid-game. Por eso el setup va en la SEGUNDA ventana como muy pronto.
      if (!this._landPlayed) {
        const land = ctx.playLand()
        if (land) {
          this._landPlayed = true
          this._landTurn = gv.turn ?? 0
          ctx.log('onSelect: tierra inicial (el cheat va en la siguiente ventana)')
        } else {
          ctx.pass()
        }
        return
      }

      // 4. Setup determinista: con el mazo todo-Islas la mano nunca pasa de 8
      // y siempre hay tierra que jugar, así que no hay descarte de limpieza
      // que nos quite el counter mientras esperamos el Bolt con maná abierto.
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Counterspell + 2 Islas)')
        void ctx.cheatSetup({ hand: ['Counterspell'], battlefield: ['Island', 'Island'] })
      }

      // 5. Tierra por turno y pasar con el maná abierto.
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      ctx.pass()
    },
    // Pagar UU también en turnos del rival (isActive=false): girar Islas sin
    // voltear, nunca la fuente equivocada (solo hay Islas en nuestro campo).
    onPlayMana(ctx) {
      const gv = ctx.gv
      const bf = Object.values(ctx.me?.battlefield ?? {})
      const isle = bf.find((c) => !c.tapped && /island/i.test(c?.name ?? ''))
      if (isle) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: isle.id })
        ctx.log('onPlayMana: giro', isle.name)
      }
    },
    // Único objetivo que elegimos en la partida: el Bolt de la pila para
    // nuestro Counterspell (los objetivos del SIM los resuelve su IA).
    onTarget(ctx) {
      const bolt = stackSpells(ctx.gv).find((s) => /lightning bolt/i.test(s?.name ?? ''))
      if (bolt) {
        ctx.log('onTarget: objetivo = Bolt en pila')
        return bolt.id
      }
      return undefined
    },
    captureWhen(gv) {
      const names = stackSpells(gv).map((s) => String(s?.name ?? ''))
      return names.some((n) => /counterspell/i.test(n)) && names.some((n) => /lightning bolt/i.test(n))
    },
  }
}

const REGISTRY = {
  mutate: makeMutateDriver,
  creature: makeCreatureDriver,
  combat: makeCombatDriver,
  counterspell: makeCounterspellDriver,
  aura: makeAuraDriver,
  tokens: makeTokenDriver,
  modal: makeModalDriver,
  xcosts: makeXcostDriver,
  response: makeResponseDriver,
  'trigger-order': makeTriggerOrderDriver,
  'may-trigger': makeMayTriggerDriver,
  convoke: makeConvokeDriver,
  flashback: makeFlashbackDriver,
  monstrosity: makeMonstrosityDriver,
  'combat-probe': makeCombatProbeDriver,
  delve: makeDelveDriver,
  scry: makeScryDriver,
  overload: makeOverloadDriver,
  'gang-block': makeGangBlockDriver,
  kicker: makeKickerDriver,
  evoke: makeEvokeDriver,
  clones: makeClonesDriver,
  treason: makeTreasonDriver,
  dfc: makeDfcDriver,
  adventure: makeAdventureDriver,
  split: makeSplitDriver,
  seize: makeSeizeDriver,
  tutor: makeTutorDriver,
  vote: makeVoteDriver,
  dismember: makeDismemberDriver,
  snow: makeSnowDriver,
  madness: makeMadnessDriver,
  shock: makeShockDriver,
  cascade: makeCascadeDriver,
  warp: makeWarpDriver,
  hybrid: makeHybridDriver,
  anycolor: makeAnyColorDriver,
  planeswalker: makePlaneswalkerDriver,
  saga: makeSagaDriver,
  morph: makeMorphDriver,
  'sealed-pool': makeSealedPoolDriver,
  'tournament-end': makeTournamentEndDriver,
}

// P4 — cascade vía cheatSetup (§3.3): Bloodbraid Elf en mano + 2 Bosques +
// 2 Montañas; Lightning Bolt en la cima (putOnTop de 1). Al entrar: cascade
// encuentra el Bolt → pregunta si lanzarlo → SÍ → 3 daños al rival.
function makeCascadeDriver() {
  return {
    name: 'cascade',
    outFile: 'cascade.json',
    deck: {
      name: 'Mage Web cascade rec',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
        ctx.log('onSelect: cheatSetup (Elf en mano, 2F+2M al campo, Bolt en la cima)')
        void ctx.cheatSetup({
          hand: ['Bloodbraid Elf'],
          battlefield: ['Forest', 'Forest', 'Mountain', 'Mountain'],
          library: ['Lightning Bolt'],
        })
        return
      }
      if (ctx.cardInHand('Bloodbraid Elf') && ctx.untappedMana() >= 4) {
        ctx.log('onSelect: lanzo Bloodbraid Elf')
        ctx.playCardByName('Bloodbraid Elf')
        return
      }
      ctx.pass()
    },
    // Cascade: lanzar la carta encontrada SÍ.
    onAsk(q, ctx) {
      if (/cast/i.test(String(q ?? ''))) {
        ctx.log('onAsk: cascade SÍ')
        return true
      }
      return undefined
    },
    onTarget(ctx) {
      const opp = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
      const id = opp?.playerId ?? opp?.id
      if (id) {
        ctx.log('onTarget: Bolt de cascade a la cara')
        return id
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const bf = Object.values(me?.battlefield ?? {})
      return (
        bf.some((c) => /bloodbraid elf/i.test(c?.name ?? '')) && Number(sim?.life ?? 20) < 20
      )
    },
  }
}

// P4 — turno extra vía cheatSetup (§3.10): Time Warp en mano + 5 Islas.
// Se lanza ({3}{U}{U}) y va al cementerio; el turno extra sigue.
function makeWarpDriver() {
  return {
    name: 'warp',
    outFile: 'warp.json',
    deck: {
      name: 'Mage Web warp rec',
      cards: [
        { cardName: 'Island', setCode: 'iko', cardNumber: '265', amount: 60 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    _cheated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Tierra por turno (como counterspell/vote): con el mazo todo-Islas
      // evita el descarte de limpieza si el cast tarda más de un turno.
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          return
        }
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Warp en mano, 5 Islas al campo)')
        void ctx.cheatSetup({
          hand: ['Time Warp'],
          battlefield: ['Island', 'Island', 'Island', 'Island', 'Island'],
        })
        return
      }
      if (ctx.cardInHand('Time Warp') && ctx.untappedMana() >= 5) {
        ctx.log('onSelect: lanzo Time Warp')
        ctx.playCardByName('Time Warp')
        return
      }
      ctx.pass()
    },
    // Time Warp pide "target player" (se lo damos a nosotros mismos: turno
    // extra propio); el descarte de limpieza también llega como GAME_TARGET
    // (mismo patrón que el driver vote) — hay que discriminar por el texto
    // de la pregunta, un onTarget ciego que solo mira data.targets/options
    // responde con el id equivocado a CUALQUIER GAME_TARGET posterior (visto
    // en vivo 2026-09-16: contestaba "discard" con el primer target de
    // "select a player" y viceversa).
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      const pt = data?.options?.possibleTargets ?? data?.targets ?? []
      const ids = Array.isArray(pt)
        ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : Object.keys(pt ?? {})
      if (/discard/i.test(q)) {
        if (ids[0]) {
          ctx.log('onTarget: descarte limpieza', ids[0])
          return ids[0]
        }
        return undefined
      }
      const me = ctx.me
      const mine = ids.find((id) => id === me?.playerId || id === me?.id)
      const pick = mine ?? ids[0]
      if (pick) {
        ctx.log('onTarget: Time Warp → yo mismo (turno extra)')
        return pick
      }
      return undefined
    },
    captureWhen(gv) {
      // HALLAZGO (2026-09-16): el comentario original decía "se exilia al
      // resolver" — falso, Time Warp (texto real: "Target player takes an
      // extra turn after this one.") no tiene exilio ni "draw a card"; va al
      // cementerio como cualquier hechizo. Comprobarlo en exile nunca capturó
      // nada (partida completa hasta GAME_OVER en el turno 107 sin disparar).
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const gyz = me?.graveyard ?? {}
      const vals = Array.isArray(gyz) ? gyz : Object.values(gyz)
      return vals.some((c) => /time warp/i.test(c?.name ?? (typeof c === 'string' ? c : '')))
    },
  }
}

// P4 — madness vía cheatSetup (§3.3): Faithless Looting + Fiery Temper en
// mano + 4 Montañas. Looting (roba 2) descarta el Temper PRIMERO → ventana
// de madness → se lanza por {R} a la cara del rival (vida 17).
function makeMadnessDriver() {
  return {
    name: 'madness',
    outFile: 'madness.json',
    deck: {
      name: 'Mage Web madness rec',
      cards: [
        { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _looting: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
        ctx.log('onSelect: cheatSetup (Looting+Temper en mano, 4 Montañas)')
        void ctx.cheatSetup({
          hand: ['Faithless Looting', 'Fiery Temper'],
          battlefield: ['Mountain', 'Mountain', 'Mountain', 'Mountain'],
        })
        return
      }
      // El Temper en madness se ofrece por ASK ("you may cast it..."): ver
      // onAsk. Sin ramas raras aquí.
      if (!this._looting && ctx.cardInHand('Faithless Looting')) {
        this._looting = true
        ctx.log('onSelect: lanzo Faithless Looting')
        ctx.playCardByName('Faithless Looting')
        return
      }
      ctx.pass()
    },
    // Descarte del Looting: el Temper PRIMERO (madness), luego lo que sea.
    onTarget(ctx, question) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) {
        this._dspent = this._dspent ?? []
        const hand = ctx.gv?.myHand ?? {}
        const temper = Object.entries(hand).find(([id, c]) => /fiery temper/i.test(c?.name ?? '') && !this._dspent.includes(id))
        const pick = temper ?? Object.entries(hand).find(([id]) => !this._dspent.includes(id))
        if (pick) {
          this._dspent.push(pick[0])
          ctx.log('onTarget: descarto', pick[1]?.name)
          return pick[0]
        }
        return undefined
      }
      const opp = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
      const id = opp?.playerId ?? opp?.id
      if (id) {
        ctx.log('onTarget: Temper a la cara')
        return id
      }
      return undefined
    },
    // Ventana de madness: ASK "you may cast it by paying {R}..." → SÍ.
    onAsk(q, ctx) {
      if (/cast it by paying|madness/i.test(String(q ?? ''))) {
        ctx.log('onAsk: madness SÍ')
        return true
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const gy = Object.values(me?.graveyard ?? {})
      return (
        gy.some((c) => /fiery temper/i.test(c?.name ?? '')) && Number(sim?.life ?? 20) < 20
      )
    },
  }
}

// P4 — split second vía cheatSetup (§3.5): Sudden Shock en mano + 2 Montañas,
// a la cara del rival. Captura: Shock en la pila (con split second nadie
// puede responder; el SIM no podría de todos modos).
function makeShockDriver() {
  return {
    name: 'shock',
    outFile: 'shock.json',
    deck: {
      name: 'Mage Web shock rec',
      cards: [
        { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
        ctx.log('onSelect: cheatSetup (Shock en mano, 2 Montañas)')
        void ctx.cheatSetup({
          hand: ['Sudden Shock'],
          battlefield: ['Mountain', 'Mountain'],
        })
        return
      }
      if (ctx.cardInHand('Sudden Shock')) {
        ctx.log('onSelect: lanzo Sudden Shock')
        ctx.playCardByName('Sudden Shock')
        return
      }
      ctx.pass()
    },
    onTarget(ctx) {
      const opp = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
      const id = opp?.playerId ?? opp?.id
      if (id) {
        ctx.log('onTarget: Shock a la cara')
        return id
      }
      return undefined
    },
    captureWhen(gv) {
      return Object.values(gv?.stack ?? {}).some((s) => /sudden shock/i.test(s?.name ?? ''))
    },
  }
}

// P4 — maná pirexiano vía cheatSetup (§3.2): Dismember en mano + Bosque al
// campo (sin maná negro: hay que pagar 4 vidas). SIM con Mystics (objetivo).
// Flujo de pago vida-vs-maná por descubrir en el log.
function makeDismemberDriver() {
  return {
    name: 'dismember',
    outFile: 'dismember.json',
    deck: {
      name: 'Mage Web dismember rec',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 },
      ],
      sideboard: [],
    },
    simDeck: {
      name: 'Mage Sim mystics',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 4 },
        { cardName: 'Elvish Mystic', setCode: 'm14', cardNumber: '169', amount: 2 },
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 54 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    simMystic(ctx) {
      return Object.values((ctx.gv?.players ?? []).find((p) => !p?.controlled)?.battlefield ?? {})
        .find((c) => /elvish mystic/i.test(c?.name ?? ''))
    },
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
        ctx.log('onSelect: cheatSetup (Dismember en mano, Bosque al campo)')
        void ctx.cheatSetup({
          hand: ['Dismember'],
          battlefield: ['Forest'],
        })
        return
      }
      if (ctx.cardInHand('Dismember')) {
        if (!this.simMystic(ctx)) {
          ctx.log('onSelect: espero criatura del SIM')
          ctx.pass()
          return
        }
        ctx.log('onSelect: lanzo Dismember')
        ctx.playCardByName('Dismember')
        return
      }
      ctx.pass()
    },
    onTarget(ctx) {
      const m = this.simMystic(ctx)
      if (m) {
        ctx.log('onTarget: Dismember → Mystic SIM')
        return m.id
      }
      return undefined
    },
    // Pirexiano: pagar 2 vidas por cada {B} (siempre, sin maná negro).
    onAsk(q, ctx) {
      if (/pay 2 life|phyrexian/i.test(String(q ?? ''))) {
        ctx.log('onAsk: pirexiano SÍ (2 vidas)')
        return true
      }
      return undefined
    },
    captureWhen(gv) {
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const simGy = Object.values(sim?.graveyard ?? {})
      return simGy.some((c) => /elvish mystic/i.test(c?.name ?? '')) && Number(me?.life ?? 20) < 20
    },
  }
}

// P4 — maná nevado vía cheatSetup (§3.2): Blizzard Brawl en mano +
// Snow-Covered Forest al campo + Oso nuestro + Mystic del SIM (pelea).
// Flujo de objetivos de pelea por descubrir.
function makeSnowDriver() {
  return {
    name: 'snow',
    outFile: 'snow.json',
    deck: {
      name: 'Mage Web snow rec',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 },
      ],
      sideboard: [],
    },
    simDeck: {
      name: 'Mage Sim mystics',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 4 },
        { cardName: 'Elvish Mystic', setCode: 'm14', cardNumber: '169', amount: 2 },
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 54 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    simMystic(ctx) {
      return Object.values((ctx.gv?.players ?? []).find((p) => !p?.controlled)?.battlefield ?? {})
        .find((c) => /elvish mystic/i.test(c?.name ?? ''))
    },
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
        ctx.log('onSelect: cheatSetup (Brawl en mano, Snow-Forest + Oso al campo)')
        void ctx.cheatSetup({
          hand: ['Blizzard Brawl'],
          battlefield: ['Snow-Covered Forest', 'Runeclaw Bear'],
        })
        return
      }
      if (ctx.cardInHand('Blizzard Brawl')) {
        if (!this.simMystic(ctx)) {
          ctx.log('onSelect: espero criatura del SIM')
          ctx.pass()
          return
        }
        ctx.log('onSelect: lanzo Blizzard Brawl')
        ctx.playCardByName('Blizzard Brawl')
        return
      }
      ctx.pass()
    },
    // Pelea: primero la nuestra, luego la del SIM (orden por descubrir).
    onTarget(ctx) {
      this._used = this._used ?? []
      const mine = ctx.findOnBattlefield('Runeclaw Bear')
      if (mine && !this._used.includes(mine)) {
        this._used.push(mine)
        ctx.log('onTarget: Brawl → mi Oso')
        return mine
      }
      const m = this.simMystic(ctx)
      if (m && !this._used.includes(m.id)) {
        this._used.push(m.id)
        ctx.log('onTarget: Brawl → Mystic SIM')
        return m.id
      }
      return undefined
    },
    captureWhen(gv) {
      return Object.values(gv?.stack ?? {}).some((s) => /blizzard brawl/i.test(s?.name ?? ''))
    },
  }
}

// P4 — fallar la búsqueda vía cheatSetup (§3.8): Demonic Tutor en mano +
// Pantano. Se declina la búsqueda (false = "fail to find"): el Tutor va al
// cementerio sin traer nada. Cubre el flujo opcional del tutor.
function makeTutorDriver() {
  return {
    name: 'tutor',
    outFile: 'tutor.json',
    deck: {
      name: 'Mage Web tutor rec',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
        ctx.log('onSelect: cheatSetup (Tutor en mano, Pantano al campo)')
        void ctx.cheatSetup({
          hand: ['Demonic Tutor'],
          battlefield: ['Swamp'],
        })
        return
      }
      if (ctx.cardInHand('Demonic Tutor')) {
        ctx.log('onSelect: lanzo Demonic Tutor')
        ctx.playCardByName('Demonic Tutor')
        return
      }
      ctx.pass()
    },
    // El decline (false) NO falla la búsqueda (el motor re-pregunta "Select
    // a card" en bucle, visto en vivo 2026-09-16): se coge la primera opción
    // (éxito del tutor). El "fail to find" queda pendiente (S).
    onTarget(ctx, question, data) {
      const pt = data?.options?.possibleTargets ?? data?.targets ?? []
      const ids = Array.isArray(pt)
        ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : Object.keys(pt ?? {})
      if (ids[0]) {
        ctx.log('onTarget tutor: cojo primera opción')
        return ids[0]
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      return Object.values(me?.graveyard ?? {}).some((c) => /demonic tutor/i.test(c?.name ?? ''))
    },
  }
}

// P4 — votación vía cheatSetup (§3.7): Council's Judgment en mano + 3
// Llanuras; SIM con Mystics (candidatos al exilio). Flujo de votos por
// descubrir en el log (el SIM vota solo).
function makeVoteDriver() {
  return {
    name: 'vote',
    outFile: 'vote.json',
    deck: {
      name: 'Mage Web vote rec',
      cards: [
        { cardName: 'Plains', setCode: 'iko', cardNumber: '260', amount: 60 },
      ],
      sideboard: [],
    },
    simDeck: {
      name: 'Mage Sim mystics',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 4 },
        { cardName: 'Elvish Mystic', setCode: 'm14', cardNumber: '169', amount: 2 },
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 54 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _landTurn: -1,
    _cheated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Tierra por turno (como counterspell/response): con el mazo
      // todo-Llanuras nunca hay descarte de limpieza mientras esperamos que
      // el rival tenga un permanente que no controlemos para votar.
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        if (ctx.playLand()) {
          this._landTurn = turn
          return
        }
      }
      // HALLAZGO (2026-09-16): cheatear solo nuestra mano no basta — el SIM
      // no tiene ningún permanente sin tierras tan pronto (2 Mystics en 60
      // cartas), así que el voto de Council's Judgment no tiene candidato y
      // el hechizo se resuelve sin exiliar nada (la partida sigue sin rumbo
      // ~10+ turnos hasta que los Mystics naturales del SIM la ganan a golpes
      // mientras nosotros solo jugamos Llanuras). Fix: cheatear también un
      // Mystic al campo del rival (encadenado, no en paralelo — dos cheats en
      // el mismo tick congelan el loop, P1) para garantizar un candidato.
      if (!this._cheated) {
        this._cheated = true
        ctx.log("onSelect: cheatSetup (Judgment en mano) + Mystic votable al rival")
        const rival = (gv.players ?? []).find((p) => !p?.controlled)
        const rid = rival?.playerId ?? rival?.id
        void ctx.cheatSetup({
          hand: ["Council's Judgment"],
          battlefield: ['Plains', 'Plains', 'Plains'],
        }).then(() => (rid ? ctx.cheatSetup({ battlefield: ['Elvish Mystic'] }, rid) : null))
        return
      }
      if (ctx.cardInHand("Council's Judgment")) {
        ctx.log('onSelect: lanzo Council\'s Judgment')
        ctx.playCardByName("Council's Judgment")
        return
      }
      ctx.pass()
    },
    // Voto: primera opción (el log dirá el texto exacto).
    onChooseChoice(opts, ctx) {
      ctx.log('onChooseChoice voto:', JSON.stringify(opts).slice(0, 250))
      return undefined
    },
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      if (/discard/i.test(q)) {
        // Usar los ids reales de la pregunta (como seize), no un escaneo
        // propio de myHand: devolver un id que no venga en
        // options.possibleTargets hace que el servidor repita la misma
        // pregunta en bucle (visto en vivo: 10x el mismo prompt).
        const pt = data?.options?.possibleTargets ?? data?.targets ?? []
        const ids = Array.isArray(pt)
          ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
          : Object.keys(pt ?? {})
        if (ids[0]) {
          ctx.log('onTarget: descarte limpieza', ids[0])
          return ids[0]
        }
        return undefined
      }
      const simMystic = Object.values((ctx.gv?.players ?? []).find((p) => !p?.controlled)?.battlefield ?? {})
        .find((c) => /elvish mystic/i.test(c?.name ?? ''))
      if (simMystic) {
        ctx.log('onTarget: voto → Mystic SIM')
        return simMystic.id
      }
      return undefined
    },
    captureWhen(gv) {
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const simEx = sim?.exile ?? {}
      const vals = Array.isArray(simEx) ? simEx : Object.values(simEx)
      return vals.some((c) => /elvish mystic/i.test(c?.name ?? (typeof c === 'string' ? c : '')))
    },
  }
}

// P4 — daño dividido vía cheatSetup (§3.4): Arc Trail en mano + 2 Montañas;
// SIM con Mystics (2 objetivos). 2 daños a un Mystic + 1 a otro (con memoria
// para no repetir objetivo). Captura: Trail en la pila con 2 objetivos.
function makeSplitDriver() {
  return {
    name: 'split',
    outFile: 'split.json',
    deck: {
      name: 'Mage Web split rec',
      cards: [
        { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 },
      ],
      sideboard: [],
    },
    simDeck: {
      name: 'Mage Sim mystics',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 4 },
        { cardName: 'Elvish Mystic', setCode: 'm14', cardNumber: '169', amount: 2 },
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 54 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    simTargets(ctx) {
      return Object.values((ctx.gv?.players ?? []).find((p) => !p?.controlled)?.battlefield ?? {})
        .filter((c) => /elvish mystic/i.test(c?.name ?? ''))
    },
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
        ctx.log('onSelect: cheatSetup (Trail en mano, 2 Montañas al campo)')
        void ctx.cheatSetup({
          hand: ['Arc Trail'],
          battlefield: ['Mountain', 'Mountain'],
        })
        return
      }
      if (ctx.cardInHand('Arc Trail')) {
        if (this.simTargets(ctx).length < 1) {
          ctx.log('onSelect: espero criaturas del SIM')
          ctx.pass()
          return
        }
        ctx.log('onSelect: lanzo Arc Trail')
        ctx.playCardByName('Arc Trail')
        return
      }
      ctx.pass()
    },
    // Dos objetivos distintos: el segundo con memoria del primero; si no hay
    // segundo Mystic, cara del rival (Arc Trail admite criatura o jugador).
    onTarget(ctx) {
      this._used = this._used ?? []
      const tgt = this.simTargets(ctx).find((c) => !this._used.includes(c.id))
      if (tgt) {
        this._used.push(tgt.id)
        ctx.log('onTarget: Trail → Mystic SIM')
        return tgt.id
      }
      const opp = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
      const id = opp?.playerId ?? opp?.id
      if (id && !this._used.includes(id)) {
        this._used.push(id)
        ctx.log('onTarget: Trail → cara del rival')
        return id
      }
      return undefined
    },
    captureWhen(gv) {
      return Object.values(gv?.stack ?? {}).some((s) => /arc trail/i.test(s?.name ?? ''))
    },
  }
}

// P4 — descarte dirigido vía cheatSetup (§3.8): Thoughtseize en mano +
// Pantano al campo (mazo todo-Bosques: el Pantano solo viene del cheat);
// SIM con mano llena de tierras. TARGET una carta de la mano rival.
function makeSeizeDriver() {
  return {
    name: 'seize',
    outFile: 'seize.json',
    deck: {
      name: 'Mage Web seize rec',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 },
      ],
      sideboard: [],
    },
    simDeck: {
      name: 'Mage Sim mystics',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 4 },
        { cardName: 'Elvish Mystic', setCode: 'm14', cardNumber: '169', amount: 2 },
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 54 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
        ctx.log('onSelect: cheatSetup (Seize en mano, Pantano al campo)')
        void ctx.cheatSetup({
          hand: ['Thoughtseize'],
          battlefield: ['Swamp'],
        })
        return
      }
      if (ctx.cardInHand('Thoughtseize')) {
        ctx.log('onSelect: lanzo Thoughtseize')
        ctx.playCardByName('Thoughtseize')
        return
      }
      ctx.pass()
    },
    // Thoughtseize (visto en vivo 2026-09-16): primero "Select a player" →
    // playerId del rival; luego la carta de su mano (primera opción).
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      if (/player/i.test(q)) {
        const opp = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
        const id = opp?.playerId ?? opp?.id
        if (id) {
          ctx.log('onTarget: Seize → jugador rival')
          return id
        }
        return undefined
      }
      const pt = data?.options?.possibleTargets ?? data?.targets ?? []
      const ids = Array.isArray(pt)
        ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
        : Object.keys(pt ?? {})
      if (ids[0]) {
        ctx.log('onTarget: Seize → carta rival')
        return ids[0]
      }
      return undefined
    },
    captureWhen(gv) {
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      return Object.values(sim?.graveyard ?? {}).length >= 1
    },
  }
}

// P4 — DFC vía cheatSetup (§3.9): Delver of Secrets al campo + Moonmist en
// mano ({1}{G}). Moonmist transforma a todos los humanos: Delver →
// Insectile Aberration (cara trasera en el campo).
function makeDfcDriver() {
  return {
    name: 'dfc',
    outFile: 'dfc.json',
    deck: {
      name: 'Mage Web dfc rec',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
        ctx.log('onSelect: cheatSetup (Delver al campo, Moonmist en mano)')
        void ctx.cheatSetup({
          hand: ['Moonmist'],
          battlefield: ['Delver of Secrets', 'Forest'],
        })
        return
      }
      if (ctx.cardInHand('Moonmist')) {
        ctx.log('onSelect: lanzo Moonmist')
        ctx.playCardByName('Moonmist')
        return
      }
      ctx.pass()
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      return Object.values(me?.battlefield ?? {}).some((c) => /insectile aberration/i.test(c?.name ?? ''))
    },
  }
}

// P4 — aventura vía cheatSetup (§3.3): Bonecrusher Giant en mano + 4 Montañas.
// T1 aventura (Stomp a la cara del rival) → se exilia → T2+ criatura desde
// el exilio. Cubre el loop completo aventura→exilio→lanzamiento.
function makeAdventureDriver() {
  return {
    name: 'adventure',
    outFile: 'adventure.json',
    deck: {
      name: 'Mage Web adventure rec',
      cards: [
        { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
        ctx.log('onSelect: cheatSetup (Giant en mano, 4 Montañas al campo)')
        void ctx.cheatSetup({
          hand: ['Bonecrusher Giant'],
          battlefield: ['Mountain', 'Mountain', 'Mountain', 'Mountain'],
        })
        return
      }
      // Criatura desde el exilio (tras la aventura): UUID directo.
      const meP = (ctx.gv?.players ?? []).find((p) => p?.controlled)
      const ex = meP?.exile ?? {}
      const entries = Array.isArray(ex) ? ex.map((c) => [c?.id, c]) : Object.entries(ex)
      const giantEx = entries.find(([, c]) => /bonecrusher giant/i.test(c?.name ?? ''))
      if (giantEx?.[0] && ctx.untappedMana() >= 3) {
        ctx.log('onSelect: lanzo Giant desde el exilio')
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: giantEx[0] })
        return
      }
      if (giantEx) {
        ctx.pass()
        return
      }
      if (ctx.cardInHand('Bonecrusher Giant') && ctx.untappedMana() >= 2) {
        // La aventura (Stomp) es una spell ability separada: se elige por
        // texto como el overload (el UUID de la carta lanzaría la criatura).
        ctx.log('onSelect: lanzo Stomp (aventura)')
        const objs = ctx.gv?.canPlayObjects?.objects ?? {}
        const rid = ctx.cardInHand('Bonecrusher Giant')
        const cands = objs[rid ?? '']?.basicCastAbilities ?? []
        ctx.log('onSelect: cands aventura:', JSON.stringify(cands.map((r) => String(r?.value ?? '').slice(0, 60))))
        const stomp = cands.find((r) => /stomp|adventure/i.test(String(r?.value ?? '')))
        if (stomp?.id) ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: stomp.id })
        else ctx.playCardByName('Bonecrusher Giant')
        return
      }
      ctx.pass()
    },
    // Stomp hace 2 daños a cualquier objetivo: cara del rival.
    onTarget(ctx) {
      const opp = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
      const id = opp?.playerId ?? opp?.id
      if (id) {
        ctx.log('onTarget: Stomp a la cara del rival')
        return id
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      return Object.values(me?.battlefield ?? {}).some((c) => /bonecrusher giant/i.test(c?.name ?? ''))
    },
  }
}

// P4 — clones vía cheatSetup (§3.9): Phantasmal Image en mano + 2 Islas; SIM
// con Mystics. El Image entra como copia del Mystic del SIM (TARGET). El
// lanzamiento se difiere hasta que el SIM tenga criatura (si entra sin
// objetivo es 0/0 y muere).
function makeClonesDriver() {
  return {
    name: 'clones',
    outFile: 'clones.json',
    deck: {
      name: 'Mage Web clones rec',
      cards: [
        { cardName: 'Island', setCode: 'iko', cardNumber: '265', amount: 60 },
      ],
      sideboard: [],
    },
    simDeck: {
      name: 'Mage Sim mystics',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 4 },
        { cardName: 'Elvish Mystic', setCode: 'm14', cardNumber: '169', amount: 2 },
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 54 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    simHasCreature(ctx) {
      const sim = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
      return Object.values(sim?.battlefield ?? {}).some((c) => (c.cardTypes ?? []).includes('CREATURE'))
    },
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
        ctx.log('onSelect: cheatSetup (Image en mano, 2 Islas al campo)')
        void ctx.cheatSetup({
          hand: ['Phantasmal Image'],
          battlefield: ['Island', 'Island'],
        })
        return
      }
      if (ctx.cardInHand('Phantasmal Image')) {
        if (!this.simHasCreature(ctx)) {
          ctx.log('onSelect: espero criatura del SIM')
          ctx.pass()
          return
        }
        ctx.log('onSelect: lanzo Phantasmal Image')
        ctx.playCardByName('Phantasmal Image')
        return
      }
      ctx.pass()
    },
    onTarget(ctx) {
      const simMystic = Object.values((ctx.gv?.players ?? []).find((p) => !p?.controlled)?.battlefield ?? {})
        .find((c) => /elvish mystic/i.test(c?.name ?? ''))
      if (simMystic) {
        ctx.log('onTarget: copio Mystic del SIM')
        return simMystic.id
      }
      return undefined
    },
    // La copia es optativa: ASK "Use effect of Phantasmal Image?" → SÍ.
    onAsk(q, ctx) {
      if (/phantasmal image/i.test(String(q ?? ''))) {
        ctx.log('onAsk: copiar SÍ')
        return true
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      return Object.values(me?.battlefield ?? {}).some(
        (c) => /elvish mystic/i.test(c?.name ?? '') && c?.copy === true,
      )
    },
  }
}

// P4 — robo de control vía cheatSetup (§3.10): Act of Treason en mano + 3
// Montañas; SIM con Mystics. Se difiere hasta que el SIM tenga criatura.
// Captura: Mystic en NUESTRO campo (nuestro mazo es todo-Montañas).
function makeTreasonDriver() {
  return {
    name: 'treason',
    outFile: 'treason.json',
    deck: {
      name: 'Mage Web treason rec',
      cards: [
        { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 },
      ],
      sideboard: [],
    },
    simDeck: {
      name: 'Mage Sim mystics',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 4 },
        { cardName: 'Elvish Mystic', setCode: 'm14', cardNumber: '169', amount: 2 },
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 54 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    simMystic(ctx) {
      return Object.values((ctx.gv?.players ?? []).find((p) => !p?.controlled)?.battlefield ?? {})
        .find((c) => /elvish mystic/i.test(c?.name ?? ''))
    },
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
        ctx.log('onSelect: cheatSetup (Act en mano, 3 Montañas al campo)')
        void ctx.cheatSetup({
          hand: ['Act of Treason'],
          battlefield: ['Mountain', 'Mountain', 'Mountain'],
        })
        return
      }
      if (ctx.cardInHand('Act of Treason')) {
        if (!this.simMystic(ctx)) {
          ctx.log('onSelect: espero criatura del SIM')
          ctx.pass()
          return
        }
        ctx.log('onSelect: lanzo Act of Treason')
        ctx.playCardByName('Act of Treason')
        return
      }
      ctx.pass()
    },
    onTarget(ctx) {
      const m = this.simMystic(ctx)
      if (m) {
        ctx.log('onTarget: robo Mystic del SIM')
        return m.id
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      return Object.values(me?.battlefield ?? {}).some((c) => /elvish mystic/i.test(c?.name ?? ''))
    },
  }
}

// P4 — kicker vía cheatSetup (§3.2): Goblin Bushwhacker en mano con 6
// Montañas al campo. Al lanzar se pregunta el kicker (flujo por descubrir;
// precedente overload: spell ability separada o ASK). Se paga siempre.
function makeKickerDriver() {
  return {
    name: 'kicker',
    outFile: 'kicker.json',
    deck: {
      name: 'Mage Web kicker rec',
      cards: [
        { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 60 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
        ctx.log('onSelect: cheatSetup (Bushwhacker en mano, 6 Montañas al campo)')
        void ctx.cheatSetup({
          hand: ['Goblin Bushwhacker'],
          battlefield: ['Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain', 'Mountain'],
        })
        return
      }
      if (ctx.cardInHand('Goblin Bushwhacker')) {
        ctx.log('onSelect: lanzo Goblin Bushwhacker')
        ctx.playCardByName('Goblin Bushwhacker')
        return
      }
      ctx.pass()
    },
    // Kicker: sí siempre (hay maná de sobra).
    onAsk(q, ctx) {
      if (/kick/i.test(String(q ?? ''))) {
        ctx.log('onAsk: kicker SÍ')
        return true
      }
      return undefined
    },
    onChooseAbility(opts, ctx) {
      ctx.log('onChooseAbility kicker:', JSON.stringify(opts).slice(0, 300))
      const kc = (opts ?? []).find((o) => /kick/i.test(String(o?.label ?? o?.value ?? '')))
      if (kc) return kc.id ?? kc.value
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      return Object.values(me?.battlefield ?? {}).some((c) => /goblin bushwhacker/i.test(c?.name ?? ''))
    },
  }
}

// P4 — evoke vía cheatSetup (§3.2): Solitude en mano + Swords to Plowshares
// (carta blanca para exiliar) + Llanura al campo; SIM con Mystics (objetivo
// del ETB). Al lanzar se elige evoke, se exilia la carta blanca (TARGET en
// mano) y el ETB exilia un rival (TARGET).
function makeEvokeDriver() {
  return {
    name: 'evoke',
    outFile: 'evoke.json',
    deck: {
      name: 'Mage Web evoke rec',
      cards: [
        { cardName: 'Plains', setCode: 'iko', cardNumber: '260', amount: 60 },
      ],
      sideboard: [],
    },
    simDeck: {
      name: 'Mage Sim mystics',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 4 },
        { cardName: 'Elvish Mystic', setCode: 'm14', cardNumber: '169', amount: 2 },
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 54 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
        ctx.log('onSelect: cheatSetup (Solitude+Swords en mano, Llanura al campo)')
        void ctx.cheatSetup({
          hand: ['Solitude', 'Swords to Plowshares'],
          battlefield: ['Plains'],
        })
        return
      }
      if (ctx.cardInHand('Solitude')) {
        ctx.log('onSelect: lanzo Solitude')
        ctx.playCardByName('Solitude')
        return
      }
      ctx.pass()
    },
    // Evoke (coste alternativo) se elige por texto (CHOOSE_CHOICE, no ABILITY).
    onChooseChoice(opts, ctx) {
      ctx.log('onChooseChoice evoke:', JSON.stringify(opts).slice(0, 300))
      const ev = (opts ?? []).find((o) => /evoke/i.test(String(o?.label ?? o?.value ?? '')))
      if (ev) return ev.value ?? ev.label ?? ev.id
      return undefined
    },
    onChooseAbility(opts, ctx) {
      ctx.log('onChooseAbility evoke:', JSON.stringify(opts).slice(0, 300))
      const ev = (opts ?? []).find((o) => /evoke/i.test(String(o?.label ?? o?.value ?? '')))
      if (ev) return ev.id ?? ev.value
      return undefined
    },
    // TARGETs del evoke (vistos en vivo 2026-09-16):
    // - coste: exiliar carta blanca de la mano (Swords);
    // - "Pick triggered ability": se responde con el UUID de la FUENTE
    //   (Solitude en el campo; el motor acepta sourceId además del ability
    //   id — HumanPlayer.chooseTriggeredAbility);
    // - ETB: "exile" con Solitude ya en el campo → Mystic del SIM.
    onTarget(ctx, question, data) {
      const q = String(question ?? '')
      if (/triggered ability/i.test(q)) {
        // PICK_ABILITY: las habilidades elegibles vienen en cardsView1 como
        // mapa {abilityUUID: {sourceName,...}} (así las enseña el escritorio).
        this._picked = this._picked ?? []
        let cv = data?.cardsView1
        if (typeof cv === 'string') {
          try {
            cv = JSON.parse(cv)
          } catch {
            cv = null
          }
        }
        const keys = cv && typeof cv === 'object' ? Object.keys(cv) : []
        const key = keys.find((k) => !this._picked.includes(k))
        if (key) {
          this._picked.push(key)
          ctx.log('onTarget: orden triggers → ability', key.slice(0, 8))
          return key
        }
        return undefined
      }
      const solBf = ctx.findOnBattlefield('Solitude')
      if (/exile/i.test(q) && !solBf) {
        const id = ctx.cardInHand('Swords to Plowshares')
        if (id) {
          ctx.log('onTarget: exilio Swords para evoke')
          return id
        }
        return undefined
      }
      const simMystic = Object.values((ctx.gv?.players ?? []).find((p) => !p?.controlled)?.battlefield ?? {})
        .find((c) => /elvish mystic/i.test(c?.name ?? ''))
      if (simMystic) {
        ctx.log('onTarget: ETB Solitude → Mystic SIM')
        return simMystic.id
      }
      return undefined
    },
    captureWhen(gv) {
      // Evoke sacrifica a Solitude al entrar: Solitude en el cementerio y el
      // Mystic del SIM exiliado por el ETB.
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const gy = Object.values(me?.graveyard ?? {})
      const simEx = sim?.exile ?? {}
      const simExVals = Array.isArray(simEx) ? simEx : Object.values(simEx)
      return (
        gy.some((c) => /solitude/i.test(c?.name ?? '')) &&
        simExVals.some((c) => /elvish mystic/i.test(c?.name ?? (typeof c === 'string' ? c : '')))
      )
    },
  }
}

// P4 — gang block sin cheat (2026-09-16, §3.6): el SIM juega y bloquea solo.
// Nuestro mazo ordenado (skipInitShuffling: mano top-first): 4 Bosques + Mystic;
// SIM con Bosques + Mystics (los lanza con tryCast y bloquea con el
// primero disponible). Atacamos con 1 Mystic vs sus 2 Mystics → reparto de daño.
// El flujo de asignación se descubre en el log (primera vez).
function makeGangBlockDriver() {
  return {
    name: 'gang-block',
    outFile: 'gang-block.json',
    deck: {
      name: 'Mage Web gang rec',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 4 },
        { cardName: 'Elvish Mystic', setCode: 'm14', cardNumber: '169', amount: 1 },
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 55 },
      ],
      sideboard: [],
    },
    simDeck: {
      name: 'Mage Sim mystics',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 4 },
        { cardName: 'Elvish Mystic', setCode: 'm14', cardNumber: '169', amount: 2 },
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 54 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 420_000,
    _landTurn: -1,
    _bear: false,
    _attackedTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      // Declarar atacantes: el Oso, confirmar con 'special' (precedente
      // driver combat: combat.json). Un ataque por partida.
      if (gv.step === 'DECLARE_ATTACKERS' && me.isActive === true && this._attackedTurn !== gv.turn) {
        const bears = Object.values(me.battlefield ?? {}).filter(
          (c) => /elvish mystic/i.test(c?.name ?? '') && !c.tapped,
        )
        if (bears.length === 0) {
          ctx.pass()
          return
        }
        this._attackedTurn = gv.turn
        for (const a of bears) {
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
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      if (!this._bear && ctx.cardInHand('Elvish Mystic') && ctx.untappedMana() >= 1) {
        this._bear = true
        ctx.log('onSelect: juego Elvish Mystic')
        ctx.playCardByName('Elvish Mystic')
        return
      }
      ctx.pass()
    },
    captureWhen(gv) {
      const combat = gv.combat
      if (!Array.isArray(combat) || combat.length === 0) return false
      return combat.some((group) => {
        const at = group?.attackers
        const bl = group?.blockers
        const nAt = Array.isArray(at) ? at.length : Object.keys(at ?? {}).length
        const nBl = Array.isArray(bl) ? bl.length : Object.keys(bl ?? {}).length
        return nAt >= 1 && nBl >= 1
      })
    },
  }
}

// P4 — scry vía cheatSetup (§3.8): Opt en mano ({U}) con Isla al campo. Al
// resolver: scry 1 (arriba/abajo) + robar. Flujo del prompt por descubrir.
function makeScryDriver() {
  return {
    name: 'scry',
    outFile: 'scry.json',
    deck: {
      name: 'Mage Web scry rec',
      cards: [
        { cardName: 'Island', setCode: 'iko', cardNumber: '265', amount: 60 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
        ctx.log('onSelect: cheatSetup (Opt en mano, Isla al campo)')
        void ctx.cheatSetup({ hand: ['Opt'], battlefield: ['Island'] })
        return
      }
      if (ctx.cardInHand('Opt')) {
        ctx.log('onSelect: lanzo Opt')
        ctx.playCardByName('Opt')
        return
      }
      ctx.pass()
    },
    onChooseChoice(opts, ctx) {
      ctx.log('onChooseChoice scry:', JSON.stringify(opts).slice(0, 200))
      return undefined
    },
    // Scry (visto en vivo 2026-09-16): GAME_TARGET "Select up to one card to
    // PUT on the BOTTOM (Scry)" con la top como único objetivo: se devuelve
    // su UUID (abajo; declinar = arriba) y luego se roba.
    onTarget(ctx, question, data) {
      if (/scry/i.test(String(question ?? ''))) {
        const pt = data?.options?.possibleTargets ?? data?.targets ?? []
        const ids = Array.isArray(pt)
          ? pt.map((o) => (typeof o === 'string' ? o : o?.id)).filter(Boolean)
          : Object.keys(pt ?? {})
        if (ids[0]) {
          ctx.log('onTarget: scry abajo')
          return ids[0]
        }
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      return Object.values(me?.graveyard ?? {}).some((c) => /opt/i.test(String(c?.name ?? '')))
    },
  }
}

// P4 — overload vía cheatSetup (§3.2): Cyclonic Rift en mano con 7 manás
// (6 Islas + tierra del turno). Al lanzar se elige modo normal/sobrecarga
// (precedente modal: GAME_CHOOSE_ABILITY); se fuerza overload.
function makeOverloadDriver() {
  return {
    name: 'overload',
    outFile: 'overload.json',
    deck: {
      name: 'Mage Web overload rec',
      cards: [
        { cardName: 'Island', setCode: 'iko', cardNumber: '265', amount: 60 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
        ctx.log('onSelect: cheatSetup (Rift en mano, 6 Islas al campo)')
        void ctx.cheatSetup({
          hand: ['Cyclonic Rift'],
          battlefield: ['Island', 'Island', 'Island', 'Island', 'Island', 'Island'],
        })
        return
      }
      if (ctx.cardInHand('Cyclonic Rift')) {
        ctx.log('onSelect: lanzo Cyclonic Rift (overload explícito)')
        // Overload es una spell ability separada (OverloadAbility): se elige
        // por texto, no por orden (el UUID de la carta iba a overload por
        // defecto en 1.4.61, visto en vivo 2026-09-16).
        const objs = ctx.gv?.canPlayObjects?.objects ?? {}
        const rid = ctx.cardInHand('Cyclonic Rift')
        const stats = objs[rid ?? '']
        const cands = stats?.basicCastAbilities ?? []
        const ov = cands.find((r) => /overload/i.test(String(r?.value ?? '')))
        ctx.log('onSelect: overload explícito', ov?.id ? 'SÍ' : 'fallback-carta')
        if (ov?.id) ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: ov.id })
        else ctx.playCardByName('Cyclonic Rift')
        return
      }
      ctx.pass()
    },
    // Elegir overload (normal sería el default). El texto exacto sale en log.
    onChooseAbility(opts, ctx) {
      ctx.log('onChooseAbility overload:', JSON.stringify(opts).slice(0, 300))
      const ov = (opts ?? []).find((o) => /overload|sobrecarga/i.test(String(o?.label ?? o?.value ?? '')))
      if (ov) return ov.id ?? ov.value
      return undefined
    },
    captureWhen(gv) {
      return Object.values(gv?.stack ?? {}).some((s) => /cyclonic rift/i.test(s?.name ?? ''))
    },
  }
}

// P4 — sonda de combate (2026-09-16, §3.6): no captura nada (captureWhen
// falso, maxMs corto); solo revela en el log con qué métodos llegan
// DECLARE_ATTACKERS / DECLARE_BLOCKERS y si cheatSetup al rival funciona.
// cheat: 2 Osos nuestros + 2 Grizzlies al rival; luego pasar siempre.
function makeCombatProbeDriver() {
  return {
    name: 'combat-probe',
    outFile: 'combat-probe.json',
    deck: AURA_DECK,
    // PROBE v2 (2026-09-16): el cheat al rival congela (SIM). PROBADO: el
    // simDeck con Osos también congela (3 intentos) — desactivado hasta
    // bisecar (¿mazo inválido? ¿SIM pensando?). Sin simDeck = tierras.
    /*
    simDeck: {
      name: 'Mage Sim bears',
      cards: [
        { cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 36 },
        { cardName: 'Grizzly Bears', setCode: 'LEA', cardNumber: '195', amount: 24 },
      ],
      sideboard: [],
    },
    */
    gameType: 'Constructed - Pioneer',
    maxMs: 150_000,
    _acted: false,
    _cheated: false,
    onSelect(ctx) {
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      // REGLA P1 (2026-09-16): solo en turno propio; cheatear con prioridad
      // en turno ajeno congela el loop de forma determinista.
      if (me.isActive !== true) {
        ctx.pass()
        return
      }
      if (!this._acted) {
        if (ctx.playLand()) {
          this._acted = true
          ctx.log('onSelect: sonda tierra inicial')
        } else ctx.pass()
        return
      }
      // REGLA P1 (2026-09-16): cheat en T1 congela (todos los éxitos fueron
      // en T2+); se juega la tierra en T1 y se cheatea a partir de T2.
      if ((ctx.gv.turn ?? 0) < 2) {
        ctx.pass()
        return
      }
      if (!this._cheated) {
        this._cheated = true
        const rival = (ctx.gv?.players ?? []).find((p) => !p?.controlled)
        const rid = rival?.playerId ?? rival?.id
        ctx.log('onSelect: cheat osos propios y luego al rival (secuencial: en paralelo congela)')
        // Secuencial encadenado: dos cheats en el mismo tick congelan el loop.
        // PROBE 2026-09-16: con PROBE_RIVAL=1 se incluye el cheat al rival.
        void ctx.cheatSetup({ battlefield: ['Runeclaw Bear', 'Runeclaw Bear'] })
          .then(() => {
            if (process.env.PROBE_RIVAL === '1' && rid) return ctx.cheatSetup({ battlefield: ['Grizzly Bears', 'Grizzly Bears'] }, rid)
            ctx.log('onSelect: sonda sin cheat rival')
            return null
          })
        return
      }
      ctx.pass()
    },
    captureWhen() {
      return false
    },
  }
}

// P4 — delve vía cheatSetup (§3.2): Treasure Cruise en mano ({7}{U}), 7
// cartas en el cementerio e Isla al campo. Al lanzar, el pago con delve
// exilia cartas del cementerio (flujo por descubrir en el log).
function makeDelveDriver() {
  return {
    name: 'delve',
    outFile: 'delve.json',
    deck: {
      name: 'Mage Web delve rec',
      cards: [
        { cardName: 'Island', setCode: 'iko', cardNumber: '265', amount: 60 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
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
        ctx.log('onSelect: cheatSetup (Cruise en mano, 7 al cementerio, Isla al campo)')
        void ctx.cheatSetup({
          hand: ['Treasure Cruise'],
          graveyard: ['Forest', 'Forest', 'Forest', 'Forest', 'Mountain', 'Mountain', 'Mountain'],
          battlefield: ['Island'],
        })
        return
      }
      if (ctx.cardInHand('Treasure Cruise')) {
        ctx.log('onSelect: lanzo Treasure Cruise')
        ctx.playCardByName('Treasure Cruise')
        return
      }
      ctx.pass()
    },
    // Delve (visto en el motor 2026-09-16, HumanPlayer.payMana): el pago llega
    // como PLAY_MANA genérico ("Pay {7}"); enviar UUIDs del cementerio se
    // ignora. Hay que responder la cadena "special" (botón Special del pago),
    // que abre la elección de acción especial (delve) y luego el TARGET de
    // cartas del cementerio (0..N: false = terminar). El {U} se paga con la
    // Isla ANTES (tras delveer el motor bloquea habilidades de maná).
    onPlayMana(ctx, m) {
      const msg = String(m?.data?.message ?? '')
      if (/\{U\}/.test(msg)) {
        const bf = Object.values(ctx.me?.battlefield ?? {})
        const isle = bf.find((c) => !c.tapped && /island/i.test(c?.name ?? ''))
        if (isle) {
          ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: isle.id })
          ctx.log('onPlayMana: pago {U} con', isle.name)
          return
        }
      }
      ctx.sendAction('sendPlayerString', { gameId: ctx.gameId, value: 'special' })
      ctx.log('onPlayMana: botón special (delve)')
    },
    // Limpieza tras robar 3: descartar Bosques sobrantes. Y exilio para
    // delve: una carta del cementerio por TARGET (con memoria; false = basta).
    onTarget(ctx, question) {
      const q = String(question ?? '')
      if (/graveyard|cementerio/i.test(q) && !/discard/i.test(q)) {
        this._spent = this._spent ?? []
        const gy = ctx.gv?.players?.find((p) => p?.controlled)?.graveyard ?? {}
        const pick = Object.entries(gy).find(([id]) => !this._spent.includes(id))
        if (pick) {
          this._spent.push(pick[0])
          ctx.log('onTarget: delve exilio', pick[1]?.name)
          return pick[0]
        }
        ctx.log('onTarget: delve terminado (false)')
        return false
      }
      if (/discard/i.test(q)) {
        this._dspent = this._dspent ?? []
        const hand = ctx.gv?.myHand ?? {}
        const pick = Object.entries(hand).find(([id, c]) => /forest/i.test(c?.name ?? '') && !this._dspent.includes(id))
          ?? Object.entries(hand).find(([id]) => !this._dspent.includes(id))
        if (pick) {
          this._dspent.push(pick[0])
          ctx.log('onTarget: descarte limpieza', pick[1]?.name)
          return pick[0]
        }
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const gy = Object.values(me?.graveyard ?? {})
      const ex = me?.exile ?? {}
      const exVals = Array.isArray(ex) ? ex : Object.values(ex)
      return gy.some((c) => /treasure cruise/i.test(String(c?.name ?? ''))) && exVals.length >= 1
    },
  }
}

// ---------------------------------------------------------------------------
// P4 (2026-09-16) — §3.2 coste híbrido: Kitchen Finks ({1}{G/W}{G/W}) con 3
// Bosques (el híbrido se paga con verde, sin ambigüedad). Captura: Finks
// resuelto en el battlefield (3/2 con persist).
// ---------------------------------------------------------------------------
function makeHybridDriver() {
  return {
    name: 'hybrid',
    outFile: 'hybrid.json',
    deck: {
      name: 'Mage Web hybrid rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _landTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      // Regla P1: el setup va tras ≥1 acción normal (ver counterspell).
      if (!this._acted) {
        const land = ctx.playLand()
        if (land) {
          this._acted = true
          this._landTurn = gv.turn ?? 0
          ctx.log('onSelect: tierra inicial')
        } else {
          ctx.pass()
        }
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Finks en mano, 3 Bosques al campo)')
        void ctx.cheatSetup({ hand: ['Kitchen Finks'], battlefield: ['Forest', 'Forest', 'Forest'] })
      }
      if (ctx.cardInHand('Kitchen Finks') && ctx.untappedMana() >= 3) {
        ctx.log('onSelect: lanzo Kitchen Finks')
        ctx.playCardByName('Kitchen Finks')
        return
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      ctx.pass()
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      return Object.values(me?.battlefield ?? {}).some((c) => /kitchen finks/i.test(c?.name ?? ''))
    },
  }
}

// ---------------------------------------------------------------------------
// P4 (2026-09-16) — §3.2 maná de cualquier color: Birds of Paradise
// (AddManaOfAnyColorEffect) paga el {U} de Opt. El servidor pregunta la fuente
// (GAME_PLAY_MANA) y luego el color (GAME_CHOOSE_CHOICE "Select a color…"),
// que se responde AZUL. Captura: Opt en el cementerio (lanzado y resuelto).
// ---------------------------------------------------------------------------
function makeAnyColorDriver() {
  return {
    name: 'anycolor',
    outFile: 'anycolor.json',
    deck: {
      name: 'Mage Web anycolor rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _landTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      if (!this._acted) {
        const land = ctx.playLand()
        if (land) {
          this._acted = true
          this._landTurn = gv.turn ?? 0
          ctx.log('onSelect: tierra inicial')
        } else {
          ctx.pass()
        }
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Opt en mano, Birds + 3 Bosques al campo)')
        void ctx.cheatSetup({ hand: ['Opt'], battlefield: ['Birds of Paradise', 'Forest', 'Forest', 'Forest'] })
      }
      if (ctx.cardInHand('Opt')) {
        ctx.log('onSelect: lanzo Opt')
        ctx.playCardByName('Opt')
        return
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      ctx.pass()
    },
    // El {U} lo paga Birds (criatura de maná) y no una tierra: el default
    // (tierra sin voltear) devolvería un Bosque y el coste no se podría pagar.
    onPlayMana(ctx, m) {
      const msg = String(m?.data?.message ?? '')
      const bf = Object.values(ctx.me?.battlefield ?? {}).filter((c) => !c.tapped)
      const birds = bf.find((c) => /birds of paradise/i.test(c?.name ?? ''))
      const pick = birds ?? bf.find((c) => (c.cardTypes ?? []).includes('LAND'))
      if (pick) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: pick.id })
        ctx.log('onPlayMana: giro', pick.name, 'para', msg.slice(0, 40))
      }
    },
    // "Select a color of mana to add 1 of it" → azul (el coste es {U}).
    onChooseChoice(opts, ctx) {
      ctx.log('onChooseChoice anycolor:', JSON.stringify(opts).slice(0, 200))
      const blue = (opts ?? []).find((o) => /blue/i.test(o.label ?? ''))
      return blue?.value
    },
    // Scry 1 de Opt: declinar (false) deja la carta arriba.
    onTarget(ctx, q) {
      if (/bottom|scry/i.test(String(q ?? ''))) {
        ctx.log('onTarget: scry → arriba (false)')
        return false
      }
      return undefined
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const gy = Object.values(me?.graveyard ?? {})
      return gy.some((c) => /^opt$/i.test(String(c?.name ?? '')))
    },
  }
}

// ---------------------------------------------------------------------------
// P4 (2026-09-16) — §3.9 planeswalker: Teferi, Hero of Dominaria ({3}{W}{U},
// 4 lealtad) lanzado y luego +1 (robar) activado desde canPlayObjects.other
// filtrando por el texto de la habilidad (/\+1/). Captura: Teferi en el campo
// con 5 contadores de lealtad.
// ---------------------------------------------------------------------------
function makePlaneswalkerDriver() {
  return {
    name: 'planeswalker',
    outFile: 'planeswalker.json',
    deck: {
      name: 'Mage Web pw rec',
      cards: [
        { cardName: 'Plains', setCode: 'iko', cardNumber: '260', amount: 30 },
        { cardName: 'Island', setCode: 'iko', cardNumber: '271', amount: 30 },
      ],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _landTurn: -1,
    _activated: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      if (!this._acted) {
        const land = ctx.playLand()
        if (land) {
          this._acted = true
          this._landTurn = gv.turn ?? 0
          ctx.log('onSelect: tierra inicial')
        } else {
          ctx.pass()
        }
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Teferi en mano, 5 tierras al campo)')
        void ctx.cheatSetup({ hand: ['Teferi, Hero of Dominaria'], battlefield: ['Plains', 'Plains', 'Island', 'Island', 'Island'] })
      }
      if (ctx.cardInHand('Teferi, Hero of Dominaria') && ctx.untappedMana() >= 5) {
        ctx.log('onSelect: lanzo Teferi')
        ctx.playCardByName('Teferi, Hero of Dominaria')
        return
      }
      // Ya en el campo: activar la lealtad +1 (robar una carta). El clic en el
      // permanente abre el picker de habilidades (GAME_CHOOSE_ABILITY), que se
      // responde en onChooseAbility.
      if (!this._activated && ctx.findOnBattlefield('Teferi, Hero of Dominaria')) {
        const id = ctx.playAbility('Teferi, Hero of Dominaria', ['other'], /\+1/)
        if (id) {
          this._activated = true
          ctx.log('onSelect: click en Teferi (picker de lealtad)')
          return
        }
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      ctx.pass()
    },
    // Picker de lealtad: elegir por texto la habilidad +1 (robar).
    onChooseAbility(opts, ctx) {
      ctx.log('onChooseAbility pw:', JSON.stringify(opts).slice(0, 250))
      const plus = (opts ?? []).find((o) => /\+1/.test(o.label ?? ''))
      if (plus) {
        ctx.log('onChooseAbility: +1 (robar)')
        return plus.value
      }
      return (opts ?? [])[0]?.value
    },
    // {3}{W}{U}: pagar cada símbolo con la tierra del color pedido.
    onPlayMana(ctx, m) {
      const msg = String(m?.data?.message ?? '')
      const wantW = /\{W\}/.test(msg)
      const wantU = /\{U\}/.test(msg)
      const bf = Object.values(ctx.me?.battlefield ?? {}).filter((c) => !c.tapped && (c.cardTypes ?? []).includes('LAND'))
      const pick = bf.find((c) => wantW ? /plains/i.test(c?.name ?? '') : wantU ? /island/i.test(c?.name ?? '') : true)
        ?? bf.find((c) => !/plains|island/i.test(c?.name ?? ''))
        ?? bf[0]
      if (pick) {
        ctx.sendAction('sendPlayerUUID', { gameId: ctx.gameId, value: pick.id })
        ctx.log('onPlayMana: giro', pick.name, 'para', msg.slice(0, 40))
      }
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const pw = Object.values(me?.battlefield ?? {}).find((c) => /teferi, hero of dominaria/i.test(c?.name ?? ''))
      // La lealtad viaja como campo propio (CardView.loyalty, string) además de
      // en counters según el motor; con +1 desde 4 → 5.
      if (Number(pw?.loyalty ?? 0) >= 5) return true
      return (pw?.counters ?? []).some((k) => /loyalty/i.test(String(k?.name ?? '')) && Number(k?.count ?? 0) >= 5)
    },
  }
}

// ---------------------------------------------------------------------------
// P4 (2026-09-16) — §3.9 sagas: History of Benalia ({1}{W}{W}) entra, gana el
// contador de lore del capítulo I y crea un Caballero 2/2 con vigilancia.
// Captura: saga en el campo con lore ≥ 1 y la ficha de Caballero.
// ---------------------------------------------------------------------------
function makeSagaDriver() {
  return {
    name: 'saga',
    outFile: 'saga.json',
    deck: {
      name: 'Mage Web saga rec',
      cards: [{ cardName: 'Plains', setCode: 'iko', cardNumber: '260', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _landTurn: -1,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      if (!this._acted) {
        const land = ctx.playLand()
        if (land) {
          this._acted = true
          this._landTurn = gv.turn ?? 0
          ctx.log('onSelect: tierra inicial')
        } else {
          ctx.pass()
        }
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (History en mano, 3 Llanuras al campo)')
        void ctx.cheatSetup({ hand: ['History of Benalia'], battlefield: ['Plains', 'Plains', 'Plains'] })
      }
      if (ctx.cardInHand('History of Benalia') && ctx.untappedMana() >= 3) {
        ctx.log('onSelect: lanzo History of Benalia')
        ctx.playCardByName('History of Benalia')
        return
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      ctx.pass()
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      const bf = Object.values(me?.battlefield ?? {})
      const saga = bf.find((c) => /history of benalia/i.test(c?.name ?? ''))
      const lore = (saga?.counters ?? []).some((k) => /lore/i.test(String(k?.name ?? '')) && Number(k?.count ?? 0) >= 1)
      const knight = bf.some((c) => c?.isToken === true && /knight/i.test(String(c?.name ?? '')))
      return lore && knight
    },
  }
}

// ---------------------------------------------------------------------------
// P4 (2026-09-16) — §3.8 boca abajo: Den Protector lanzado por morph ({3}
// genérico) con la habilidad de morph elegida por texto en canPlayObjects
// (SpellAbilityType.BASE_ALTERNATE va a la bolsa `other`, no a
// basicCastAbilities). Captura: 2/2 boca abajo en el battlefield (faceDown).
// ---------------------------------------------------------------------------
function makeMorphDriver() {
  return {
    name: 'morph',
    outFile: 'morph.json',
    deck: {
      name: 'Mage Web morph rec',
      cards: [{ cardName: 'Forest', setCode: 'iko', cardNumber: '272', amount: 60 }],
      sideboard: [],
    },
    gameType: 'Constructed - Pioneer',
    maxMs: 300_000,
    _acted: false,
    _cheated: false,
    _landTurn: -1,
    _cast: false,
    onSelect(ctx) {
      const gv = ctx.gv
      const me = ctx.me
      if (!me || me.hasPriority !== true) return
      const isMyMain = me.isActive === true && (gv.phase === 'PRECOMBAT_MAIN' || gv.phase === 'POSTCOMBAT_MAIN')
      if (!isMyMain) {
        ctx.pass()
        return
      }
      if (!this._acted) {
        const land = ctx.playLand()
        if (land) {
          this._acted = true
          this._landTurn = gv.turn ?? 0
          ctx.log('onSelect: tierra inicial')
        } else {
          ctx.pass()
        }
        return
      }
      if (!this._cheated) {
        this._cheated = true
        ctx.log('onSelect: cheatSetup (Den Protector en mano, 3 Bosques al campo)')
        void ctx.cheatSetup({ hand: ['Den Protector'], battlefield: ['Forest', 'Forest', 'Forest'] })
      }
      if (!this._cast && ctx.cardInHand('Den Protector') && ctx.untappedMana() >= 3) {
        const id = ctx.playAbility('Den Protector', ['other', 'basicCastAbilities'], /morph/i)
        if (id) {
          this._cast = true
          ctx.log('onSelect: lanzo Den Protector boca abajo (morph)')
          return
        }
        ctx.log('onSelect: habilidad morph no encontrada, espero')
      }
      const turn = gv.turn ?? 0
      if (turn !== this._landTurn) {
        const land = ctx.playLand()
        if (land) {
          this._landTurn = turn
          return
        }
      }
      ctx.pass()
    },
    // El clic en la carta abre el picker (lanzamiento normal vs morph):
    // elegir morph por texto.
    onChooseAbility(opts, ctx) {
      ctx.log('onChooseAbility morph:', JSON.stringify(opts).slice(0, 250))
      const morph = (opts ?? []).find((o) => /morph/i.test(o.label ?? ''))
      if (morph) {
        ctx.log('onChooseAbility: morph')
        return morph.value
      }
      return (opts ?? [])[0]?.value
    },
    captureWhen(gv) {
      const me = (gv.players ?? []).find((p) => p?.controlled)
      return Object.values(me?.battlefield ?? {}).some((c) => c?.faceDown === true)
    },
  }
}

const NAMES = Object.keys(REGISTRY)

async function runOne(name) {
  const make = REGISTRY[name]
  if (!make) {
    console.error(`driver desconocido: ${name}. Disponibles: ${NAMES.join(', ')}`)
    process.exit(2)
  }
  const driver = make()
  if (driver.kind === 'tournament') await runTournamentRecorder(driver)
  else await runRecorder(driver)
}

// D.20 — torneo Sellado: captura el CONSTRUCT (pool 6xM15 ≈ 28KB) y sale.
// No juega la partida: basta con joinTournament x2 para que llegue el pool.
function makeSealedPoolDriver() {
  return {
    name: 'sealed-pool',
    kind: 'tournament',
    maxMs: 240_000,
    tournament: {
      tournamentType: 'Sealed Elimination',
      matchType: 'Two Player Duel',
      setCodes: ['M20', 'M20', 'M20', 'M20', 'M20', 'M20'],
      numberBoosters: 6,
      constructionTime: 60,
    },
    capturePool: true,
    poolOutFile: 'sealed-pool.json',
  }
}

// D.20 — torneo Sellado hasta el final: auto-submit → partida → concesión en
// el primer SELECT (turn>=1) → getTournament con tournamentState 'Finished'.
function makeTournamentEndDriver() {
  return {
    name: 'tournament-end',
    kind: 'tournament',
    maxMs: 480_000,
    tournament: {
      tournamentType: 'Sealed Elimination',
      matchType: 'Two Player Duel',
      setCodes: ['M20', 'M20', 'M20', 'M20', 'M20', 'M20'],
      numberBoosters: 6,
      constructionTime: 60,
    },
    playToEnd: true,
    endOutFile: 'tournament-end.json',
  }
}

async function main() {
  const arg = process.argv[2]
  if (!arg || arg === 'all') {
    for (const name of NAMES) {
      console.log(`\n=== grabando ${name} ===`)
      await new Promise((resolve) => {
        const child = spawn(process.execPath, [import.meta.url.replace('file://', ''), name], { stdio: 'inherit' })
        child.on('exit', (code) => resolve(code ?? 0))
      })
    }
    return
  }
  await runOne(arg)
}

await main()
