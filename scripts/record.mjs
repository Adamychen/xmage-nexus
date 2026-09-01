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
import { runRecorder, getMe } from './rec-lib.mjs'

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

const REGISTRY = { mutate: makeMutateDriver, creature: makeCreatureDriver, combat: makeCombatDriver }
const NAMES = Object.keys(REGISTRY)

async function runOne(name) {
  const make = REGISTRY[name]
  if (!make) {
    console.error(`driver desconocido: ${name}. Disponibles: ${NAMES.join(', ')}`)
    process.exit(2)
  }
  await runRecorder(make())
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
