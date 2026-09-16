import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { gameViewFromAndValidate } from './schema'
import type { GameView } from '../src/net/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RECORDED_DIR = path.join(__dirname, 'recorded')

type AssertKind =
  | 'hasMutatedPermanent'
  | 'hasNonMutatedCreature'
  | 'hasAttackingTappedCreature'
  | 'hasCombatGroup'
  | 'hasCounterOnStack'
  | 'hasAttachedAura'
  | 'hasTokens'
  | 'hasModalOnStack'
  | 'hasXCostCounters'
  | 'hasStackResponse'
  | 'hasDoubleTrigger'
  | 'hasSolemn'
  | 'hasConvoke'
  | 'hasFlashback'
  | 'hasDelve'
  | 'hasScry'
  | 'hasOverload'
  | 'hasBlock'
  | 'hasKicker'
  | 'hasEvoke'
  | 'hasClone'
  | 'hasThreaten'
  | 'hasTransform'
  | 'hasAdventure'
  | 'hasSplit'
  | 'hasSeize'
  | 'hasTutor'
  | 'hasPhyrexian'
  | 'hasSnowFight'
  | 'hasMadness'
  | 'hasSplitSecond'
  | 'hasCascade'
  | 'hasVote'
  | 'hasExtraTurn'
  | 'hasHybrid'
  | 'hasAnyColor'
  | 'hasPlaneswalker'
  | 'hasSaga'
  | 'hasFaceDown'
  | 'hasConstructPool'
  | 'tournamentFinished'

type ManifestKind = 'game' | 'construct' | 'tournament'

function getMe(gv: GameView): GameView['players'][number] | undefined {
  return gv.players?.find((p) => p?.controlled)
}

function combatAttackerIds(gv: GameView): string[] {
  const ids: string[] = []
  for (const group of gv.combat ?? []) {
    const record = group as unknown as Record<string, unknown>
    const attackers = record.attackers
    if (Array.isArray(attackers)) ids.push(...attackers.map(String))
    else if (attackers && typeof attackers === 'object') ids.push(...Object.keys(attackers))
  }
  return ids
}

function runAssert(kind: AssertKind, gv: GameView): boolean {
  const me = getMe(gv)
  const bf = Object.values(me?.battlefield ?? {})
  switch (kind) {
    case 'hasMutatedPermanent':
      return bf.some((c) => (c as { mutated?: boolean; mutateView?: unknown }).mutated && Object.keys((c as { mutateView?: Record<string, unknown> }).mutateView ?? {}).length > 0)
    case 'hasNonMutatedCreature':
      return bf.some((c) => (c.cardTypes ?? []).includes('CREATURE') && !(c as { mutated?: boolean }).mutated)
    case 'hasCounterOnStack': {
      const names = Object.values(gv.stack ?? {}).map((s) => String((s as { name?: unknown }).name ?? ''))
      return names.some((n) => /counterspell/i.test(n)) && names.some((n) => /lightning bolt/i.test(n))
    }
    case 'hasAttachedAura':
      return bf.some((c) => ((c as { attachments?: unknown }).attachments as unknown[] | undefined)?.length > 0)
        && bf.some((c) => /rancor/i.test(String((c as { name?: unknown }).name ?? '')))
    case 'hasTokens':
      return bf.filter((c) => (c as { isToken?: unknown }).isToken === true).length >= 2
    case 'hasModalOnStack':
      return Object.values(gv.stack ?? {}).some((s) => /boros charm/i.test(String((s as { name?: unknown }).name ?? '')))
    case 'hasXCostCounters': {
      const ballista = bf.find((c) => /walking ballista/i.test(String((c as { name?: unknown }).name ?? '')))
      const counters = (ballista as unknown as { counters?: Array<{ name?: unknown; count?: unknown }> } | undefined)?.counters ?? []
      return counters.some((k) => /\+1\/\+1/.test(String(k?.name ?? '')) && Number(k?.count ?? 0) >= 2)
    }
    case 'hasStackResponse': {
      const names = Object.values(gv.stack ?? {}).map((s) => String((s as { name?: unknown }).name ?? ''))
      return names.some((n) => /giant growth/i.test(n)) && names.some((n) => /hornet sting/i.test(n))
    }
    case 'hasDoubleTrigger': {
      const wardens = bf.filter((c) => /soul warden/i.test(String((c as { name?: unknown }).name ?? '')))
      const mystic = bf.some((c) => /elvish mystic/i.test(String((c as { name?: unknown }).name ?? '')))
      return wardens.length >= 2 && mystic && Number(me?.life ?? 0) >= 22
    }
    case 'hasSolemn':
      return bf.some((c) => /solemn simulacrum/i.test(String((c as { name?: unknown }).name ?? '')))
    case 'hasConvoke': {
      const me2 = getMe(gv)
      const mystics = bf.filter((c) => /elvish mystic/i.test(String((c as { name?: unknown }).name ?? '')))
      const gy = Object.values(me2?.graveyard ?? {})
      return mystics.length >= 4 && gy.some((c) => /chord of calling/i.test(String((c as { name?: unknown }).name ?? '')))
    }
    case 'hasDelve': {
      const me2 = getMe(gv)
      const gy = Object.values(me2?.graveyard ?? {})
      const ex = me2?.exile ?? {}
      const exVals = Array.isArray(ex) ? ex : Object.values(ex)
      return (
        gy.some((c) => /treasure cruise/i.test(String((c as { name?: unknown })?.name ?? ''))) && exVals.length >= 7
      )
    }
    case 'hasScry': {
      const me2 = getMe(gv)
      const gy = Object.values(me2?.graveyard ?? {})
      return gy.some((c) => String((c as { name?: unknown })?.name ?? '').toLowerCase() === 'opt')
    }
    case 'hasOverload': {
      const me2 = getMe(gv)
      const bf = Object.values(me2?.battlefield ?? {})
      const tappedIsles = bf.filter(
        (c) => /island/i.test(String((c as { name?: unknown })?.name ?? '')) && (c as { tapped?: boolean })?.tapped === true,
      )
      const stack = Object.values(gv.stack ?? {})
      return tappedIsles.length >= 6 && stack.some((s) => /cyclonic rift/i.test(String((s as { name?: unknown })?.name ?? '')))
    }
    case 'hasBlock': {
      const groups = gv.combat ?? []
      return groups.some((group) => {
        const at = (group as unknown as Record<string, Record<string, unknown>>).attackers
        const bl = (group as unknown as Record<string, Record<string, unknown>>).blockers
        const nAt = Array.isArray(at) ? at.length : Object.keys(at ?? {}).length
        const nBl = Array.isArray(bl) ? bl.length : Object.keys(bl ?? {}).length
        return nAt >= 1 && nBl >= 1
      })
    }
    case 'hasKicker': {
      const me2 = getMe(gv)
      const bf = Object.values(me2?.battlefield ?? {})
      const hasBw = bf.some((c) => /goblin bushwhacker/i.test(String((c as { name?: unknown })?.name ?? '')))
      const tappedMtn = bf.filter(
        (c) => /mountain/i.test(String((c as { name?: unknown })?.name ?? '')) && (c as { tapped?: boolean })?.tapped === true,
      )
      return hasBw && tappedMtn.length >= 2
    }
    case 'hasEvoke': {
      const me2 = getMe(gv)
      const gy = Object.values(me2?.graveyard ?? {})
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const simEx = sim?.exile ?? {}
      const simExVals = Array.isArray(simEx) ? simEx : Object.values(simEx)
      const nameOf = (c: unknown) =>
        String((c as { name?: unknown })?.name ?? (typeof c === 'string' ? c : ''))
      return (
        gy.some((c) => /solitude/i.test(nameOf(c))) && simExVals.some((c) => /elvish mystic/i.test(nameOf(c)))
      )
    }
    case 'hasClone': {
      const me2 = getMe(gv)
      const bf = Object.values(me2?.battlefield ?? {})
      return bf.some(
        (c) =>
          /elvish mystic/i.test(String((c as { name?: unknown })?.name ?? '')) &&
          (c as { copy?: boolean })?.copy === true,
      )
    }
    case 'hasThreaten': {
      const me2 = getMe(gv)
      const bf = Object.values(me2?.battlefield ?? {})
      return bf.some((c) => /elvish mystic/i.test(String((c as { name?: unknown })?.name ?? '')))
    }
    case 'hasTransform': {
      const me2 = getMe(gv)
      const bf = Object.values(me2?.battlefield ?? {})
      return bf.some((c) => /insectile aberration/i.test(String((c as { name?: unknown })?.name ?? '')))
    }
    case 'hasAdventure': {
      const me2 = getMe(gv)
      const bf = Object.values(me2?.battlefield ?? {})
      return bf.some((c) => /bonecrusher giant/i.test(String((c as { name?: unknown })?.name ?? '')))
    }
    case 'hasSplit': {
      const stack = Object.values(gv.stack ?? {})
      return stack.some((s) => /arc trail/i.test(String((s as { name?: unknown })?.name ?? '')))
    }
    case 'hasSeize': {
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const gy = Object.values(sim?.graveyard ?? {})
      return gy.length >= 1
    }
    case 'hasTutor': {
      const me2 = getMe(gv)
      const gy = Object.values(me2?.graveyard ?? {})
      return gy.some((c) => /demonic tutor/i.test(String((c as { name?: unknown })?.name ?? '')))
    }
    case 'hasPhyrexian': {
      const me2 = getMe(gv)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const simGy = Object.values(sim?.graveyard ?? {})
      return (
        Number(me2?.life ?? 20) < 20 && simGy.some((c) => /elvish mystic/i.test(String((c as { name?: unknown })?.name ?? '')))
      )
    }
    case 'hasSnowFight': {
      const stack = Object.values(gv.stack ?? {})
      return stack.some((s) => /blizzard brawl/i.test(String((s as { name?: unknown })?.name ?? '')))
    }
    case 'hasMadness': {
      const me2 = getMe(gv)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const gy = Object.values(me2?.graveyard ?? {})
      return (
        gy.some((c) => /fiery temper/i.test(String((c as { name?: unknown })?.name ?? ''))) &&
        Number(sim?.life ?? 20) < 20
      )
    }
    case 'hasSplitSecond': {
      const stack = Object.values(gv.stack ?? {})
      return stack.some((s) => /sudden shock/i.test(String((s as { name?: unknown })?.name ?? '')))
    }
    case 'hasCascade': {
      const me2 = getMe(gv)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const bf = Object.values(me2?.battlefield ?? {})
      return (
        bf.some((c) => /bloodbraid elf/i.test(String((c as { name?: unknown })?.name ?? ''))) &&
        Number(sim?.life ?? 20) < 20
      )
    }
    case 'hasVote': {
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const ex = sim?.exile ?? {}
      const vals = Array.isArray(ex) ? ex : Object.values(ex)
      return vals.some((c) => /elvish mystic/i.test(String((c as { name?: unknown })?.name ?? (typeof c === 'string' ? c : ''))))
    }
    case 'hasExtraTurn': {
      const me2 = getMe(gv)
      const gy = Object.values(me2?.graveyard ?? {})
      return gy.some((c) => /time warp/i.test(String((c as { name?: unknown })?.name ?? '')))
    }
    case 'hasHybrid': {
      const finks = bf.find((c) => /kitchen finks/i.test(String((c as { name?: unknown })?.name ?? '')))
      return (
        String((finks as { power?: unknown })?.power ?? '') === '3' &&
        String((finks as { toughness?: unknown })?.toughness ?? '') === '2'
      )
    }
    case 'hasAnyColor': {
      const birds = bf.some((c) => /birds of paradise/i.test(String((c as { name?: unknown })?.name ?? '')))
      const gy = Object.values(getMe(gv)?.graveyard ?? {})
      return birds && gy.some((c) => /^opt$/i.test(String((c as { name?: unknown })?.name ?? '')))
    }
    case 'hasPlaneswalker': {
      const pw = bf.find((c) => /teferi, hero of dominaria/i.test(String((c as { name?: unknown })?.name ?? '')))
      if (!pw) return false
      if (Number((pw as { loyalty?: unknown }).loyalty ?? 0) >= 5) return true
      const counters = (pw as { counters?: Array<{ name?: unknown; count?: unknown }> }).counters ?? []
      return counters.some((k) => /loyalty/i.test(String(k?.name ?? '')) && Number(k?.count ?? 0) >= 5)
    }
    case 'hasSaga': {
      const saga = bf.find((c) => /history of benalia/i.test(String((c as { name?: unknown })?.name ?? '')))
      const lore = ((saga as { counters?: Array<{ name?: unknown; count?: unknown }> } | undefined)?.counters ?? []).some(
        (k) => /lore/i.test(String(k?.name ?? '')) && Number(k?.count ?? 0) >= 1,
      )
      const knight = bf.some(
        (c) => (c as { isToken?: boolean }).isToken === true && /knight/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return lore && knight
    }
    case 'hasFaceDown':
      return bf.some((c) => (c as { faceDown?: boolean }).faceDown === true)
    case 'hasFlashback': {
      const me2 = getMe(gv)
      const ex = me2?.exile ?? {}
      const vals = Array.isArray(ex) ? ex : Object.values(ex)
      return vals.some((c) => /faithless looting/i.test(String((c as { name?: unknown })?.name ?? (typeof c === 'string' ? c : ''))))
    }
    case 'hasCombatGroup':
      return combatAttackerIds(gv).length > 0
    case 'hasAttackingTappedCreature': {
      const attackerIds = new Set(combatAttackerIds(gv))
      if (attackerIds.size === 0) return false
      // El atacante debe figurar girado (tapped) en el battlefield o dentro del
      // propio grupo de combate (los no-vigilancia los gira el servidor).
      const tappedInCombat = (gv.combat ?? []).some((group) => {
        const attackers = (group as unknown as Record<string, Record<string, unknown>>).attackers
        if (!attackers || typeof attackers !== 'object' || Array.isArray(attackers)) return false
        return Object.values(attackers).some((a) => (a as { tapped?: boolean }).tapped === true)
      })
      return tappedInCombat || bf.some((c) => attackerIds.has(String(c.id ?? '')) && (c as { tapped?: boolean }).tapped === true)
    }
    default:
      return false
  }
}

const manifest = JSON.parse(fs.readFileSync(path.join(RECORDED_DIR, 'manifest.json'), 'utf8')) as Array<{
  file: string
  mechanic: string
  kind?: ManifestKind
  assert: AssertKind
  note?: string
}>

function poolSize(construct: unknown): number {
  const deck = (construct as { deck?: { cards?: Record<string, unknown>; sideboard?: Record<string, unknown> } })?.deck
  if (!deck || typeof deck !== 'object') return -1
  return Object.keys(deck.cards ?? {}).length + Object.keys(deck.sideboard ?? {}).length
}

function runConstructAssert(kind: AssertKind, raw: { construct?: unknown }): boolean {
  const construct = raw.construct as {
    deck?: { cards?: Record<string, { id?: unknown; expansionSetCode?: unknown; cardNumber?: unknown }>; sideboard?: Record<string, { id?: unknown; expansionSetCode?: unknown; cardNumber?: unknown }> }
    time?: unknown
    currentTableId?: unknown
  }
  switch (kind) {
    case 'hasConstructPool': {
      if (!construct || typeof construct !== 'object') return false
      if (typeof construct.time !== 'number' || construct.time <= 0) return false
      if (typeof construct.currentTableId !== 'string' || !construct.currentTableId) return false
      const cards = { ...(construct.deck?.cards ?? {}), ...(construct.deck?.sideboard ?? {}) }
      const ids = Object.values(cards)
      if (ids.length < 40) return false
      return ids.every((c) => typeof c?.id === 'string' && !!c.id && typeof c?.expansionSetCode === 'string' && typeof c?.cardNumber === 'string')
    }
    default:
      return false
  }
}

function runTournamentAssert(kind: AssertKind, raw: { tournament?: unknown }): boolean {
  const t = raw.tournament as {
    tournamentState?: unknown
    tournamentType?: unknown
    players?: Array<{ name?: unknown; state?: unknown; points?: unknown }>
    rounds?: Array<{ games?: Array<{ state?: unknown; result?: unknown }> }>
  }
  switch (kind) {
    case 'tournamentFinished': {
      if (!t || typeof t !== 'object') return false
      if (t.tournamentState !== 'Finished') return false
      if (!Array.isArray(t.players) || t.players.length < 2) return false
      const winner = t.players.find((p) => typeof p?.state === 'string' && /winner/i.test(p.state))
      if (!winner || typeof winner.points !== 'number' || winner.points < 3) return false
      const game = t.rounds?.[0]?.games?.[0]
      if (!game || typeof game.state !== 'string' || !game.state.startsWith('Finished')) return false
      return typeof game.result === 'string' && /winner/i.test(game.result)
    }
    default:
      return false
  }
}

describe('golden frames grabados del protocolo real (anti-deriva)', () => {
  it('el manifest referencia frames que existen', () => {
    for (const entry of manifest) {
      expect(fs.existsSync(path.join(RECORDED_DIR, entry.file)), `falta ${entry.file}`).toBe(true)
    }
  })

  for (const entry of manifest) {
    const kind: ManifestKind = entry.kind ?? 'game'
    if (kind === 'game') {
      it(`el frame ${entry.file} (${entry.mechanic}) pasa la validación de contrato y cumple su invariante`, () => {
        const raw = JSON.parse(fs.readFileSync(path.join(RECORDED_DIR, entry.file), 'utf8')) as { gameView: GameView }
        const res = gameViewFromAndValidate(raw.gameView)
        expect(res.ok, `gameView de ${entry.file} inválido: ${JSON.stringify(res.errors)}`).toBe(true)
        expect(runAssert(entry.assert, raw.gameView), `invariante ${entry.assert} no cumple en ${entry.file}`).toBe(true)
      })
    } else if (kind === 'construct') {
      it(`el frame ${entry.file} (${entry.mechanic}) trae pool CONSTRUCT válido y cumple su invariante`, () => {
        const raw = JSON.parse(fs.readFileSync(path.join(RECORDED_DIR, entry.file), 'utf8')) as { construct: unknown }
        expect(poolSize(raw.construct) >= 40, `pool <40 en ${entry.file}`).toBe(true)
        expect(runConstructAssert(entry.assert, raw), `invariante ${entry.assert} no cumple en ${entry.file}`).toBe(true)
      })
    } else {
      it(`el frame ${entry.file} (${entry.mechanic}) trae torneo Finished válido y cumple su invariante`, () => {
        const raw = JSON.parse(fs.readFileSync(path.join(RECORDED_DIR, entry.file), 'utf8')) as { tournament: unknown }
        expect(runTournamentAssert(entry.assert, raw), `invariante ${entry.assert} no cumple en ${entry.file}`).toBe(true)
      })
    }
  }
})
