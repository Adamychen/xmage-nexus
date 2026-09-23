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
  | 'hasWard'
  | 'hasIllegalTargetFizzle'
  | 'hasUpToZeroTargets'
  | 'hasRedirect'
  | 'hasBigStack'
  | 'hasMenaceUnblocked'
  | 'hasSurveil'
  | 'hasJumpStart'
  | 'hasVigilance'
  | 'hasDash'
  | 'hasSuspend'
  | 'hasFirstStrike'
  | 'hasEscape'
  | 'hasForetell'
  | 'hasNinjutsu'
  | 'hasMustBlock'
  | 'hasPithingNeedle'
  | 'hasCavern'
  | 'hasDoubleStrike'
  | 'hasPhasing'
  | 'hasEmerge'
  | 'hasReduceCost'
  | 'hasBrainstorm'
  | 'hasPonder'
  | 'hasFactOrFiction'
  | 'hasManifest'
  | 'hasMassTokens'
  | 'hasClassLevel'
  | 'hasPoison'
  | 'hasTwincastCopy'
  | 'hasWardCountered'
  | 'hasImprovise'
  | 'hasDiscover'
  | 'hasTrampleDeathtouch'
  | 'hasCantBlock'
  | 'hasHexproof'
  | 'hasChoiceColorOrNumber'
  | 'hasGoad'
  | 'hasAttackPlaneswalker'
  | 'hasSwitcheroo'
  | 'hasMonarch'
  | 'hasStunOil'
  | 'hasColorlessC'
  | 'hasCoinDice'
  | 'hasFailToFind'
  | 'hasDisguise'
  | 'hasWinEffect'
  | 'hasAttackBattle'
  | 'hasAlwaysAttack'
  | 'hasAttackCostPaid'
  | 'hasEchoUpkeepPaid'
  | 'hasPlot'
  | 'hasFloatingMana'
  | 'hasDayNight'
  | 'hasCloak'
  | 'hasDungeon'
  | 'hasTheRing'
  | 'hasConcedeMulligan'
  | 'hasInitiative'
  | 'hasRadiation'
  | 'hasStartingPlayerChoice'
  | 'hasEmblem'
  | 'hasCommanderZone'
  | 'hasKarnRestart'
  | 'hasEnergy'
  | 'hasReanimateTarget'
  | 'hasCompanion'
  | 'hasLookedAt'
  | 'hasMultikicker'
  | 'hasStrive'
  | 'hasCombatTrick'
  | 'hasPodCombat'
  | 'hasPodCommander'
  | 'hasFfaSix'
  | 'firstMulliganFreeSecondCostsCard'
  | 'hasTimeoutLoss'
  | 'hasSlicerCeded'
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
      // plan4 §3.10: la evidencia es el RETORNO de fin de turno — el Mystic
      // robado con Act of Treason vuelve al campo del SIM (y ya no está en el
      // nuestro), con el hechizo en nuestro cementerio.
      const me2 = getMe(gv)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const mine = Object.values(me2?.battlefield ?? {}).some((c) =>
        /elvish mystic/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const theirs = Object.values(sim?.battlefield ?? {}).some((c) =>
        /elvish mystic/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const gy = Object.values(me2?.graveyard ?? {}).some((c) =>
        /act of treason/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return !mine && theirs && gy
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
      // Prioridad nuestra con el Shock en la pila: split second prohíbe lanzar
      // hechizos/activar habilidades NO de maná, así que el servidor solo puede
      // ofrecer habilidades de maná (las Montañas destapadas) y nunca el Bolt
      // que sigue en mano. La UI debe distinguirlo (el Bolt no es jugable).
      const stack = Object.values(gv.stack ?? {})
      const hand = gv.myHand ?? gv.hand ?? {}
      const handNames = Object.values(hand).map((c) => String((c as { name?: unknown })?.name ?? ''))
      const offered = gv.canPlayObjects?.objects ?? {}
      const boltId = Object.entries(hand).find(([, c]) =>
        /lightning bolt/i.test(String((c as { name?: unknown })?.name ?? '')),
      )?.[0]
      const boltOffered = !!boltId && Object.prototype.hasOwnProperty.call(offered, boltId)
      const nonManaOffered = Object.values(offered).some((o) => {
        const rec = o as {
          basicCastAbilities?: unknown[]
          basicPlayAbilities?: unknown[]
          other?: unknown[]
        }
        return (
          (rec?.basicCastAbilities?.length ?? 0) > 0 ||
          (rec?.basicPlayAbilities?.length ?? 0) > 0 ||
          (rec?.other?.length ?? 0) > 0
        )
      })
      return (
        stack.some((s) => /sudden shock/i.test(String((s as { name?: unknown })?.name ?? ''))) &&
        getMe(gv)?.hasPriority === true &&
        handNames.some((n) => /lightning bolt/i.test(n)) &&
        !boltOffered &&
        !nonManaOffered
      )
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
    case 'hasTwincastCopy': {
      const me2 = getMe(gv)
      const gy = Object.values(me2?.graveyard ?? {})
      const bolts = gy.filter((c) => /lightning bolt/i.test(String((c as { name?: unknown })?.name ?? ''))).length
      const twincast = gy.some((c) => /twincast/i.test(String((c as { name?: unknown })?.name ?? '')))
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      return bolts === 1 && twincast && Object.keys(gv.stack ?? {}).length === 0 && Number(sim?.life ?? 20) === 14
    }
    case 'hasWardCountered': {
      const me2 = getMe(gv)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const thorn = Object.values(sim?.battlefield ?? {}).find((c) =>
        /thornfist/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const bolt = Object.values(me2?.graveyard ?? {}).some((c) =>
        /lightning bolt/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return (
        !!thorn &&
        Number((thorn as { damage?: number })?.damage ?? 0) === 0 &&
        bolt &&
        Object.keys(gv.stack ?? {}).length === 0 &&
        Number(sim?.life ?? 20) === 20
      )
    }
    case 'hasWard': {
      // Si Ward hubiera contrarrestado el Bolt, Sythis seguiría viva: que esté
      // en el cementerio del rival prueba que el pago se resolvió y el
      // hechizo original siguió su curso.
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const gy = Object.values(sim?.graveyard ?? {})
      return gy.some((c) => /sythis/i.test(String((c as { name?: unknown })?.name ?? '')))
    }
    case 'hasIllegalTargetFizzle': {
      const me2 = getMe(gv)
      const gy = Object.values(me2?.graveyard ?? {}).map((c) => String((c as { name?: unknown })?.name ?? '').toLowerCase())
      const stack = Object.values(gv.stack ?? {})
      return gy.includes('lightning bolt') && gy.includes('elvish mystic') && stack.length === 0
    }
    case 'hasUpToZeroTargets': {
      const me2 = getMe(gv)
      const gy = Object.values(me2?.graveyard ?? {})
      const cast = gy.some((c) => /frost breath/i.test(String((c as { name?: unknown })?.name ?? '')))
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const simMystic = Object.values(sim?.battlefield ?? {}).find((c) => /elvish mystic/i.test(String((c as { name?: unknown })?.name ?? '')))
      const untouched = simMystic ? (simMystic as { tapped?: boolean }).tapped !== true : false
      return cast && untouched
    }
    case 'hasRedirect': {
      const me2 = getMe(gv)
      const gy = Object.values(me2?.graveyard ?? {}).map((c) => String((c as { name?: unknown })?.name ?? '').toLowerCase())
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      return gy.includes('lightning bolt') && gy.includes('redirect') && Number(me2?.life ?? 20) < 20 && Number(sim?.life ?? 20) === 20
    }
    case 'hasBigStack':
      return Object.keys(gv.stack ?? {}).length >= 10
    case 'hasMenaceUnblocked': {
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const bearAlive = Object.values(sim?.battlefield ?? {}).some((c) => /grizzly bears/i.test(String((c as { name?: unknown })?.name ?? '')))
      const groups = gv.combat ?? []
      const menaceUnblocked = groups.some((group) => {
        const record = group as unknown as Record<string, unknown>
        const attackers = record.attackers as Record<string, { rules?: string[] }> | undefined
        const isMenace = Object.values(attackers ?? {}).some((a) => (a?.rules ?? []).some((r) => /menace/i.test(r)))
        const blockers = record.blockers
        const nBl = Array.isArray(blockers) ? blockers.length : Object.keys(blockers ?? {}).length
        return isMenace && nBl === 0
      })
      return bearAlive && menaceUnblocked && Number(sim?.life ?? 20) < 20
    }
    case 'hasSurveil': {
      const me2 = getMe(gv)
      const gy = Object.values(me2?.graveyard ?? {}).map((c) => String((c as { name?: unknown })?.name ?? '').toLowerCase())
      return gy.includes('consider') && gy.includes('mountain')
    }
    case 'hasJumpStart': {
      const me2 = getMe(gv)
      const ex = me2?.exile ?? {}
      const vals = Array.isArray(ex) ? ex : Object.values(ex)
      const exiled = vals.some((c) => /radical idea/i.test(String((c as { name?: unknown })?.name ?? (typeof c === 'string' ? c : ''))))
      const gy = Object.values(me2?.graveyard ?? {}).some((c) => /island/i.test(String((c as { name?: unknown })?.name ?? '')))
      return exiled && gy
    }
    case 'hasVigilance': {
      const groups = gv.combat ?? []
      return groups.some((group) => {
        const record = group as unknown as Record<string, unknown>
        const attackers = record.attackers as Record<string, { tapped?: boolean }> | undefined
        return Object.values(attackers ?? {}).some((a) => a?.tapped === false)
      })
    }
    case 'hasDash': {
      const groups = gv.combat ?? []
      return groups.some((group) => {
        const record = group as unknown as Record<string, unknown>
        const attackers = record.attackers as
          | Record<string, { rules?: string[]; summoningSickness?: boolean; tapped?: boolean }>
          | undefined
        return Object.values(attackers ?? {}).some(
          (a) =>
            (a?.rules ?? []).some((r) => /dash/i.test(r)) &&
            (a?.rules ?? []).some((r) => /^haste$/i.test(r)) &&
            a?.summoningSickness === false &&
            a?.tapped === true,
        )
      })
    }
    case 'hasSuspend': {
      const me2 = getMe(gv)
      const ex = me2?.exile ?? {}
      const vals = Array.isArray(ex) ? ex : Object.values(ex)
      return vals.some((c) => {
        const card = c as { name?: string; counters?: Array<{ name?: string; count?: number }> }
        const name = String(card?.name ?? (typeof c === 'string' ? c : ''))
        return (
          /rift bolt/i.test(name) &&
          (card?.counters ?? []).some((ct) => /time/i.test(String(ct?.name ?? '')) && Number(ct?.count ?? 0) >= 1)
        )
      })
    }
    case 'hasFirstStrike': {
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const nameOf = (c: unknown) => String((c as { name?: unknown })?.name ?? '')
      const bears = /grizzly bears/i
      const bearsDead = Object.values(sim?.graveyard ?? {}).some((c) => bears.test(nameOf(c)))
      const bearsGone = !Object.values(sim?.battlefield ?? {}).some((c) => bears.test(nameOf(c)))
      const firstStriker = (gv.combat ?? []).some((group) => {
        const record = group as unknown as Record<string, unknown>
        const attackers = record.attackers as
          | Record<string, { cardIcons?: Array<{ cardIconType?: string }>; damage?: number }>
          | undefined
        return Object.values(attackers ?? {}).some(
          (a) =>
            (a?.cardIcons ?? []).some((ic) => /first_strike/i.test(String(ic?.cardIconType ?? ''))) &&
            Number(a?.damage ?? 0) === 0,
        )
      })
      return gv.step === 'FIRST_COMBAT_DAMAGE' && bearsDead && bearsGone && firstStriker
    }
    case 'hasEscape': {
      const me2 = getMe(gv)
      const phoenix = Object.values(me2?.battlefield ?? {}).find((c) =>
        /phoenix of ash/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const counters = (phoenix as { counters?: Array<{ name?: string; count?: number }> })?.counters ?? []
      const escaped = counters.some((ct) => /\+1\/\+1/.test(String(ct?.name ?? '')) && Number(ct?.count ?? 0) >= 1)
      const ex = me2?.exile ?? {}
      const vals = Array.isArray(ex) ? ex : Object.values(ex)
      const exiledMountains = vals.filter((c) =>
        /mountain/i.test(String((c as { name?: unknown })?.name ?? (typeof c === 'string' ? c : ''))),
      ).length
      return Boolean(phoenix) && escaped && exiledMountains >= 3 && Object.keys(me2?.graveyard ?? {}).length === 0
    }
    case 'hasForetell': {
      const names = Object.values(gv.stack ?? {}).map((s) => String((s as { name?: unknown })?.name ?? ''))
      const me2 = getMe(gv)
      const ex = me2?.exile ?? {}
      const exileCount = Array.isArray(ex) ? ex.length : Object.keys(ex).length
      return names.some((n) => /saw it coming/i.test(n)) && names.some((n) => /^opt$/i.test(n)) && exileCount === 0
    }
    case 'hasNinjutsu': {
      const hand = Object.values(gv.myHand ?? gv.hand ?? {})
      const bearBack = hand.some((c) => /runeclaw bear/i.test(String((c as { name?: unknown })?.name ?? '')))
      const ninjaAttacking = (gv.combat ?? []).some((group) => {
        const record = group as unknown as Record<string, unknown>
        const attackers = record.attackers as Record<string, { name?: string; tapped?: boolean }> | undefined
        return Object.values(attackers ?? {}).some(
          (a) => /ninja of the deep hours/i.test(String(a?.name ?? '')) && a?.tapped === true,
        )
      })
      return bearBack && ninjaAttacking
    }
    case 'hasMustBlock': {
      return (gv.combat ?? []).some((group) => {
        const record = group as unknown as Record<string, unknown>
        const attackers = record.attackers as Record<string, { name?: string; attachments?: string[] }> | undefined
        const lured = Object.values(attackers ?? {}).some(
          (a) => /runeclaw bear/i.test(String(a?.name ?? '')) && (a?.attachments ?? []).length > 0,
        )
        const blockers = record.blockers
        const list = Array.isArray(blockers) ? blockers : Object.values(blockers ?? {})
        const grizzlyBlocked = list.some((b) => /grizzly bears/i.test(String((b as { name?: unknown })?.name ?? '')))
        return lured && grizzlyBlocked && record.isBlocked === true
      })
    }
    case 'hasPithingNeedle': {
      const me2 = getMe(gv)
      const needle = Object.values(me2?.battlefield ?? {}).find((c) =>
        /pithing needle/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const rules = (needle as { rules?: string[] })?.rules ?? []
      return rules.some((r) => /Chosen name:\s*Lightning Bolt/i.test(r))
    }
    case 'hasCavern': {
      const me2 = getMe(gv)
      const cavern = Object.values(me2?.battlefield ?? {}).find((c) =>
        /cavern of souls/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const rules = (cavern as { rules?: string[] })?.rules ?? []
      return rules.some((r) => /Chosen type:\s*Elf/i.test(r))
    }
    case 'hasDoubleStrike': {
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const firstHitOnly = Number(sim?.life ?? 20) === 19
      const ace = (gv.combat ?? []).some((group) => {
        const record = group as unknown as Record<string, unknown>
        const attackers = record.attackers as
          | Record<string, { name?: string; damage?: number; cardIcons?: Array<{ cardIconType?: string }> }>
          | undefined
        return Object.values(attackers ?? {}).some(
          (a) =>
            /fencing ace/i.test(String(a?.name ?? '')) &&
            Number(a?.damage ?? 0) === 0 &&
            (a?.cardIcons ?? []).some((ic) => /double_strike/i.test(String(ic?.cardIconType ?? ''))),
        )
      })
      return gv.step === 'FIRST_COMBAT_DAMAGE' && firstHitOnly && ace
    }
    case 'hasPhasing': {
      const me2 = getMe(gv)
      const bear = Object.values(me2?.battlefield ?? {}).find((c) =>
        /runeclaw bear/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const phasedOut = (bear as { phasedIn?: boolean })?.phasedIn === false
      const ripple = Object.values(me2?.graveyard ?? {}).some((c) =>
        /reality ripple/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return Boolean(bear) && phasedOut && ripple
    }
    case 'hasEmerge': {
      const me2 = getMe(gv)
      const gryff = Object.values(me2?.battlefield ?? {}).some((c) =>
        /wretched gryff/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const fodder = Object.values(me2?.graveyard ?? {}).some((c) =>
        /grizzly bears/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return gryff && fodder
    }
    case 'hasReduceCost': {
      const me2 = getMe(gv)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const mage = Object.values(me2?.battlefield ?? {}).some((c) =>
        /goblin electromancer/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const strike = Object.values(me2?.graveyard ?? {}).some((c) =>
        /lightning strike/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const lands = Object.values(me2?.battlefield ?? {}).filter((c) =>
        ((c as { cardTypes?: string[] })?.cardTypes ?? []).includes('LAND'),
      )
      const threeTapped = lands.length === 3 && lands.every((c) => (c as { tapped?: boolean })?.tapped === true)
      return mage && strike && threeTapped && Number(sim?.life ?? 20) === 17
    }
    case 'hasBrainstorm': {
      const me2 = getMe(gv)
      const gy = Object.values(me2?.graveyard ?? {}).map((c) => String((c as { name?: unknown })?.name ?? '').toLowerCase())
      const hand = Object.values(gv.myHand ?? gv.hand ?? {}).map((c) => String((c as { name?: unknown })?.name ?? '').toLowerCase())
      return (
        gy.includes('brainstorm') &&
        gy.includes('opt') &&
        hand.includes('plains') &&
        hand.includes('grizzly bears') &&
        !hand.includes('forest')
      )
    }
    case 'hasPonder': {
      const me2 = getMe(gv)
      const names = (o: unknown) =>
        Object.values((o ?? {}) as Record<string, unknown>).map((c) =>
          String((c as { name?: unknown })?.name ?? '').toLowerCase(),
        )
      const gy = names(me2?.graveyard)
      const hand = names(gv.myHand ?? gv.hand)
      return (
        gy.includes('ponder') &&
        hand.includes('grizzly bears') &&
        hand.includes('forest') &&
        !hand.includes('plains')
      )
    }
    case 'hasFactOrFiction': {
      const me2 = getMe(gv)
      const names = (o: unknown) =>
        Object.values((o ?? {}) as Record<string, unknown>).map((c) =>
          String((c as { name?: unknown })?.name ?? '').toLowerCase(),
        )
      const pool = [...names(gv.myHand ?? gv.hand), ...names(me2?.graveyard)]
      const revealed = ['grizzly bears', 'runeclaw bear', 'forest', 'mountain']
      return names(me2?.graveyard).includes('fact or fiction') && revealed.every((n) => pool.filter((x) => x === n).length === 1)
    }
    case 'hasManifest': {
      const me2 = getMe(gv)
      const bf = Object.values(me2?.battlefield ?? {})
      const vanguard = bf.filter((c) => /elite vanguard/i.test(String((c as { name?: unknown })?.name ?? '')))
      const faceUp = vanguard.some((c) => (c as { faceDown?: boolean }).faceDown === false)
      const soul = Object.values(me2?.graveyard ?? {}).some((c) =>
        /soul summons/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return faceUp && soul
    }
    case 'hasMassTokens': {
      const me2 = getMe(gv)
      const goblins = Object.values(me2?.battlefield ?? {}).filter((c) => {
        const card = c as { isToken?: boolean; name?: unknown }
        return card?.isToken === true && /goblin/i.test(String(card?.name ?? ''))
      })
      return goblins.length >= 40
    }
    case 'hasClassLevel': {
      const me2 = getMe(gv)
      const wc = Object.values(me2?.battlefield ?? {}).find((c) =>
        /wizard class/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const rules = (wc as { rules?: unknown[] })?.rules ?? []
      return rules.some((r) => /class level:\s*3/i.test(String(r)))
    }
    case 'hasPoison': {
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const counters = (sim as { counters?: Array<{ name?: string; count?: number }> })?.counters ?? []
      const poison = counters.some(
        (ct) => /^poison$/i.test(String(ct?.name ?? '')) && Number(ct?.count ?? 0) >= 1,
      )
      return poison && Number(sim?.life ?? 20) === 20
    }
    case 'hasImprovise': {
      const me2 = getMe(gv)
      const bf = Object.values(me2?.battlefield ?? {})
      const ornith = bf.filter((c) => /ornithopter/i.test(String((c as { name?: unknown })?.name ?? '')))
      const re = Object.values(me2?.graveyard ?? {}).some((c) =>
        /reverse engineer/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return (
        ornith.length === 3 &&
        ornith.every((c) => (c as { tapped?: boolean }).tapped === true) &&
        re
      )
    }
    case 'hasDiscover': {
      const me2 = getMe(gv)
      const carno = Object.values(me2?.battlefield ?? {}).find((c) =>
        /carnosaur/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const car = carno as { power?: unknown; toughness?: unknown } | undefined
      const gg = Object.values(me2?.graveyard ?? {}).some((c) =>
        /giant growth/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return !!car && Number(car.power) === 10 && Number(car.toughness) === 9 && gg
    }
    case 'hasTrampleDeathtouch': {
      const me2 = getMe(gv)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const warr = Object.values(me2?.battlefield ?? {}).find((c) =>
        /elvish warrior/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const rules = (warr as { rules?: unknown[] })?.rules ?? []
      const att = (warr as { attachments?: Record<string, unknown> })?.attachments ?? {}
      const bearGy = Object.values(sim?.graveyard ?? {}).some((c) =>
        /grizzly bears/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return (
        !!warr &&
        Object.keys(att).length >= 3 &&
        rules.some((r) => /deathtouch/i.test(String(r))) &&
        bearGy &&
        Number(sim?.life ?? 20) === 17 &&
        Number(me2?.life ?? 20) === 24
      )
    }
    case 'hasCantBlock': {
      const me2 = getMe(gv)
      const soul = Object.values(me2?.battlefield ?? {}).find((c) =>
        /tormented soul/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const rules = (soul as { rules?: unknown[] })?.rules ?? []
      const combat = (gv.combat ?? []) as Array<{
        attackers?: Record<string, unknown>
        blockers?: Record<string, unknown>
      }>
      const unblockedAttack = combat.some(
        (g) => Object.keys(g?.attackers ?? {}).length > 0 && Object.keys(g?.blockers ?? {}).length === 0,
      )
      return (
        !!soul &&
        (soul as { tapped?: boolean }).tapped === false &&
        rules.some((r) => /can't block/i.test(String(r))) &&
        Number(me2?.life ?? 20) === 18 &&
        unblockedAttack
      )
    }
    case 'hasHexproof': {
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const me2 = getMe(gv)
      const bogle = Object.values(sim?.battlefield ?? {}).find((c) =>
        /slippery bogle/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const rules = (bogle as { rules?: unknown[] })?.rules ?? []
      const bolt = Object.values(me2?.graveyard ?? {}).some((c) =>
        /lightning bolt/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return (
        !!bogle &&
        Number((bogle as { damage?: number })?.damage ?? 0) === 0 &&
        rules.some((r) => /hexproof/i.test(String(r))) &&
        Number(sim?.life ?? 20) === 17 &&
        bolt
      )
    }
    case 'hasChoiceColorOrNumber': {
      const me2 = getMe(gv)
      const find = (n: string) =>
        Object.values(me2?.battlefield ?? {}).find(
          (c) => String((c as { name?: unknown })?.name ?? '') === n,
        )
      const rules = (x: unknown) =>
        ((x as { rules?: unknown[] })?.rules ?? []).map((r) => String(r))
      const circle = find('Story Circle')
      const prelate = find('Sanctum Prelate')
      return (
        !!circle &&
        !!prelate &&
        rules(circle).some((r) => /chosen color:\s*red/i.test(r)) &&
        rules(prelate).some((r) => /chosen number:\s*3/i.test(r)) &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    }
    case 'hasGoad': {
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const grizzly = Object.values(sim?.battlefield ?? {}).find((c) =>
        /grizzly bears/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const icons =
        (grizzly as { cardIcons?: Array<{ cardIconType?: string; hint?: string }> })?.cardIcons ?? []
      const rules = (grizzly as { rules?: unknown[] })?.rules ?? []
      return (
        !!grizzly &&
        icons.some(
          (ic) =>
            String(ic?.cardIconType ?? '') === 'OTHER_HAS_RESTRICTIONS' &&
            /goad/i.test(String(ic?.hint ?? '')),
        ) &&
        rules.some((r) => /goaded by/i.test(String(r)))
      )
    }
    case 'hasAttackPlaneswalker': {
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const pw = Object.values(sim?.battlefield ?? {}).find((c) =>
        /tibalt/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const pwId = String((pw as { id?: unknown })?.id ?? '')
      const loyalty = Number((pw as { loyalty?: unknown })?.loyalty)
      const combat = (gv.combat ?? []) as Array<{
        defenderId?: string
        attackers?: Record<string, unknown>
      }>
      const attackedPw = combat.some(
        (g) => g?.defenderId === pwId && Object.keys(g?.attackers ?? {}).length > 0,
      )
      return !!pw && loyalty === 3 && pwId !== '' && attackedPw
    }
    case 'hasSwitcheroo': {
      const me2 = getMe(gv)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const names = (o: unknown) =>
        Object.values((o ?? {}) as Record<string, unknown>).map((c) =>
          String((c as { name?: unknown })?.name ?? ''),
        )
      const mine = names(me2?.battlefield)
      const theirs = names(sim?.battlefield)
      const gy = names(me2?.graveyard)
      return (
        mine.includes('Elvish Mystic') &&
        !mine.includes('Grizzly Bears') &&
        theirs.includes('Grizzly Bears') &&
        !theirs.includes('Elvish Mystic') &&
        gy.includes('Switcheroo') &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    }
    case 'hasMonarch': {
      const me2 = getMe(gv)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const sentinels = Object.values(me2?.battlefield ?? {}).some((c) =>
        /palace sentinels/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return (
        (me2 as { monarch?: boolean })?.monarch === true &&
        (sim as { monarch?: boolean })?.monarch !== true &&
        sentinels &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    }
    case 'hasStunOil': {
      const me2 = getMe(gv)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const sac = Object.values(me2?.battlefield ?? {}).find((c) =>
        /incubation sac/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const grizzly = Object.values(sim?.battlefield ?? {}).find((c) =>
        /grizzly bears/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const counters = (x: unknown) =>
        ((x as { counters?: Array<{ name?: string; count?: number }> })?.counters ?? [])
      const hasOil = counters(sac).some(
        (ct) => /^oil$/i.test(String(ct?.name ?? '')) && Number(ct?.count ?? 0) >= 1,
      )
      const hasStun = counters(grizzly).some(
        (ct) => /^stun$/i.test(String(ct?.name ?? '')) && Number(ct?.count ?? 0) >= 1,
      )
      const chill = Object.values(me2?.graveyard ?? {}).some((c) =>
        /rime chill/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return (
        !!sac &&
        !!grizzly &&
        (grizzly as { tapped?: boolean })?.tapped === true &&
        hasOil &&
        hasStun &&
        chill &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    }
    case 'hasColorlessC': {
      const me2 = getMe(gv)
      const wurm = Object.values(me2?.battlefield ?? {}).find((c) =>
        /craw wurm/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const sc = Object.values(me2?.graveyard ?? {}).some((c) =>
        /spatial contortion/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const tappedWastes = Object.values(me2?.battlefield ?? {}).filter(
        (c) => /wastes/i.test(String((c as { name?: unknown })?.name ?? '')) &&
          (c as { tapped?: boolean })?.tapped === true,
      ).length
      return (
        !!wurm &&
        sc &&
        tappedWastes >= 2 &&
        Number((wurm as { power?: unknown })?.power) === 9 &&
        Number((wurm as { toughness?: unknown })?.toughness) === 1
      )
    }
    case 'hasCoinDice': {
      const me2 = getMe(gv)
      const swindler = Object.values(me2?.battlefield ?? {}).find((c) =>
        /tavern swindler/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const tokens = Object.values(me2?.battlefield ?? {}).filter(
        (c) => (c as { isToken?: boolean })?.isToken === true,
      )
      const drive = Object.values(me2?.graveyard ?? {}).some((c) =>
        /recruitment drive/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return (
        !!swindler &&
        (swindler as { tapped?: boolean })?.tapped === true &&
        [17, 23].includes(Number((me2 as { life?: unknown })?.life)) &&
        tokens.length >= 1 &&
        drive &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    }
    case 'hasFailToFind': {
      const me2 = getMe(gv)
      const ew = Object.values(me2?.graveyard ?? {}).some((c) =>
        /evolving wilds/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const lands = Object.values(me2?.battlefield ?? {}).filter((c) =>
        ((c as { cardTypes?: unknown })?.cardTypes as unknown[])?.includes?.('LAND'),
      ).length
      return (
        ew &&
        lands === 1 &&
        Number((me2 as { libraryCount?: unknown })?.libraryCount) === 53 &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    }
    case 'hasDisguise': {
      const me2 = getMe(gv)
      const fd = Object.values(me2?.battlefield ?? {}).find(
        (c) => (c as { faceDown?: boolean })?.faceDown === true,
      )
      const rules = String((fd as { rules?: unknown })?.rules ?? '')
      return (
        !!fd &&
        (fd as { disguised?: boolean })?.disguised === true &&
        Number((fd as { power?: unknown })?.power) === 2 &&
        Number((fd as { toughness?: unknown })?.toughness) === 2 &&
        /ward \{2\}/i.test(rules)
      )
    }
    case 'hasWinEffect': {
      const me2 = getMe(gv)
      const approach = Object.values(me2?.graveyard ?? {}).some((c) =>
        /approach of the second sun/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return (
        Number((me2 as { life?: unknown })?.life) === 27 &&
        approach &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    }
    case 'hasAttackBattle': {
      const me2 = getMe(gv)
      const battle = Object.entries(me2?.battlefield ?? {}).find(([, c]) =>
        ((c as { cardTypes?: unknown })?.cardTypes as unknown[])?.includes?.('BATTLE'),
      )
      if (!battle) return false
      const [battleId, battleCard] = battle
      const defense = Number((battleCard as { defense?: unknown })?.defense)
      const starting = Number((battleCard as { startingDefense?: unknown })?.startingDefense)
      const defended = (gv.combat ?? []).some(
        (c) => String((c as { defenderId?: unknown })?.defenderId) === battleId,
      )
      return (
        defense > 0 &&
        defense < starting &&
        defended &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    }
    case 'hasAlwaysAttack': {
      const sim2 = (gv.players ?? []).find((p) => !p?.controlled)
      const entry = Object.entries(sim2?.battlefield ?? {}).find(([, c]) =>
        /rubblebelt recluse/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      if (!entry) return false
      const [id, recluse] = entry
      const icons = ((recluse as { cardIcons?: unknown })?.cardIcons ?? []) as Array<{
        cardIconType?: string
        hint?: string
      }>
      const mustAttack = icons.some(
        (i) =>
          i?.cardIconType === 'OTHER_HAS_RESTRICTIONS' && /must attack/i.test(String(i?.hint ?? '')),
      )
      const attacking = (gv.combat ?? []).some((c) =>
        Object.keys((c as { attackers?: Record<string, unknown> })?.attackers ?? {}).includes(id),
      )
      return (
        (recluse as { tapped?: boolean })?.tapped === true &&
        mustAttack &&
        attacking &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    }
    case 'hasPlot': {
      const me2 = getMe(gv)
      const plotted = Object.values(me2?.exile ?? {}).some((c) => {
        const name = String((c as { name?: unknown })?.name ?? '')
        const rules = ((c as { rules?: unknown })?.rules ?? []) as unknown[]
        return /rictus robber/i.test(name) && rules.some((r) => /plot \{2\}\{b\}/i.test(String(r)))
      })
      return plotted && Object.keys(gv.stack ?? {}).length === 0
    }
    case 'hasAttackCostPaid': {
      // Propaganda-like: coste para atacar pagado con un Treasure sacrificado
      // + una Forest. El Treasure debe haber desaparecido del campo (0 en
      // battlefield) mientras Grizzly Bears sigue atacando (tapped, en
      // combat[].attackers) y Propaganda sigue en el campo rival.
      const me2 = getMe(gv)
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const propaganda = Object.values(sim?.battlefield ?? {}).some((c) =>
        /propaganda/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const treasures = Object.values(me2?.battlefield ?? {}).filter((c) =>
        ((c as { subTypes?: unknown[] })?.subTypes ?? []).includes('TREASURE'),
      ).length
      const grizzlyAttacking = (gv.combat ?? []).some((g) =>
        Object.values((g as { attackers?: Record<string, unknown> })?.attackers ?? {}).some(
          (c) =>
            /grizzly bears/i.test(String((c as { name?: unknown })?.name ?? '')) &&
            (c as { tapped?: boolean })?.tapped === true,
        ),
      )
      return propaganda && treasures === 0 && grizzlyAttacking
    }
    case 'hasEchoUpkeepPaid': {
      // Citanul Centaurs (Echo {3}{G}) pagado en nuestro upkeep: sigue vivo
      // en el campo (no sacrificado) con al menos 4 Forest giradas y la pila
      // vacía tras resolver el trigger de Echo.
      const me2 = getMe(gv)
      const centaurs = Object.values(me2?.battlefield ?? {}).some((c) =>
        /citanul centaurs/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const tappedForests = Object.values(me2?.battlefield ?? {}).filter(
        (c) =>
          ((c as { cardTypes?: unknown[] })?.cardTypes ?? []).includes('LAND') &&
          (c as { tapped?: boolean })?.tapped === true,
      ).length
      return centaurs && tappedForests >= 4 && Object.keys(gv.stack ?? {}).length === 0
    }
    case 'hasFloatingMana': {
      const me2 = getMe(gv)
      const pool = (me2 as { manaPool?: Record<string, number> })?.manaPool ?? {}
      const total = Object.values(pool).reduce((a, b) => a + Number(b ?? 0), 0)
      return total > 0 && Object.keys(gv.stack ?? {}).length === 0
    }
    case 'hasDayNight': {
      const me2 = getMe(gv)
      const dfc = Object.values(me2?.battlefield ?? {}).find(
        (c) => (c as { transformed?: boolean })?.transformed === true,
      )
      const rules = String((dfc as { rules?: unknown })?.rules ?? '')
      const back = (dfc as { secondCardFace?: { name?: unknown } })?.secondCardFace
      return (
        !!dfc &&
        /storm-charged slasher/i.test(String((dfc as { name?: unknown })?.name ?? '')) &&
        /reckless stormseeker/i.test(String(back?.name ?? '')) &&
        /currently night/i.test(rules) &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    }
    case 'hasCloak': {
      const me2 = getMe(gv)
      const fd = Object.values(me2?.battlefield ?? {}).find(
        (c) => (c as { faceDown?: boolean })?.faceDown === true,
      )
      const rules = String((fd as { rules?: unknown })?.rules ?? '')
      return (
        !!fd &&
        (fd as { cloaked?: boolean })?.cloaked === true &&
        /^cloak:/i.test(String((fd as { name?: unknown })?.name ?? '')) &&
        Number((fd as { power?: unknown })?.power) === 2 &&
        Number((fd as { toughness?: unknown })?.toughness) === 2 &&
        /ward \{2\}/i.test(rules)
      )
    }
    case 'hasDungeon': {
      const me2 = getMe(gv)
      const list = ((me2 as { commandList?: unknown[] })?.commandList ?? []) as Array<{
        name?: unknown
        rules?: unknown[]
      }>
      const dungeon = list.find((c) =>
        /lost mine of phandelver/i.test(String(c?.name ?? '')),
      )
      const ruled = ((dungeon?.rules ?? []) as unknown[]).some((r) =>
        /currently in/i.test(String(r)),
      )
      return !!dungeon && ruled && Object.keys(gv.stack ?? {}).length === 0
    }
    case 'hasTheRing': {
      const me2 = getMe(gv)
      const list = ((me2 as { commandList?: unknown[] })?.commandList ?? []) as Array<{
        name?: unknown
        rules?: unknown[]
      }>
      const ring = list.find((c) => /^the ring$/i.test(String(c?.name ?? '')))
      const level = (ring?.rules ?? []).length
      const bearer = Object.values(me2?.battlefield ?? {}).some((c) =>
        ((c as { cardIcons?: unknown[] })?.cardIcons ?? []).some(
          (i) => String((i as { cardIconType?: unknown })?.cardIconType ?? '') === 'RINGBEARER',
        ),
      )
      return !!ring && level >= 3 && bearer && Object.keys(gv.stack ?? {}).length === 0
    }
    case 'hasConcedeMulligan': {
      const me2 = getMe(gv)
      return (
        (me2 as { hasLeft?: boolean })?.hasLeft === true &&
        Number((me2 as { handCount?: unknown })?.handCount) === 0 &&
        Object.keys((me2 as { battlefield?: Record<string, unknown> })?.battlefield ?? {}).length === 0 &&
        Number(gv.turn) === 1 &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    }
    case 'hasInitiative': {
      const me2 = getMe(gv)
      const undercity = ((me2 as { commandList?: unknown[] })?.commandList ?? []).some((c) =>
        /undercity/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return (
        (me2 as { initiative?: boolean })?.initiative === true &&
        undercity &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    }
    case 'hasRadiation': {
      const me2 = getMe(gv)
      const rad = ((me2 as { counters?: Array<{ name?: string; count?: number }> })?.counters ?? []).some(
        (c) => /^rad$/i.test(String(c?.name ?? '')) && Number(c?.count ?? 0) >= 1,
      )
      const milled = Object.values(me2?.graveyard ?? {}).some((c) =>
        /grizzly bears/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return (
        rad &&
        milled &&
        Number((me2 as { life?: unknown })?.life) === 19 &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    }
    case 'hasStartingPlayerChoice': {
      const me2 = getMe(gv)
      return (
        Number(gv.turn) === 1 &&
        (me2 as { isActive?: boolean })?.isActive === true &&
        String(gv.activePlayerId ?? '') === String((me2 as { playerId?: unknown })?.playerId ?? '') &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    }
    case 'hasEmblem': {
      const me2 = getMe(gv)
      const emblem = ((me2 as { commandList?: unknown[] })?.commandList ?? []).find((c) =>
        /^emblem /i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const rules = ((emblem as { rules?: unknown[] })?.rules ?? []) as unknown[]
      return (
        !!emblem &&
        rules.length >= 1 &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    }
    case 'hasCommanderZone': {
      const me2 = getMe(gv)
      const list = ((me2 as { commandList?: unknown[] })?.commandList ?? []) as Array<{
        name?: unknown
        mageObjectType?: unknown
        rules?: unknown[]
      }>
      const krenko = list.find((c) => /krenko, mob boss/i.test(String(c?.name ?? '')))
      const played = ((krenko?.rules ?? []) as unknown[]).some((r) =>
        /commander.*2 times played/i.test(String(r)),
      )
      const inPlay = Object.values(me2?.battlefield ?? {}).some((c) =>
        /krenko, mob boss/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return (
        !!krenko &&
        String(krenko?.mageObjectType ?? '') === 'COMMANDER' &&
        played &&
        !inPlay &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    }
    case 'hasKarnRestart': {
      const me2 = getMe(gv)
      const anyKarn = (gv.players ?? []).some((p) =>
        Object.values(p?.battlefield ?? {}).some((c) =>
          /karn liberated/i.test(String((c as { name?: unknown })?.name ?? '')),
        ),
      )
      return (
        Number(gv.turn) === 1 &&
        String(gv.activePlayerId ?? '') === String((me2 as { playerId?: unknown })?.playerId ?? '') &&
        !anyKarn &&
        Number((me2 as { libraryCount?: unknown })?.libraryCount) === 53 &&
        Object.keys(gv.stack ?? {}).length === 0
      )
    }
    case 'hasEnergy': {
      const me2 = getMe(gv)
      const counters = (me2 as { counters?: Array<{ name?: string; count?: number }> })?.counters ?? []
      const energy = counters.some((ct) => /^energy$/i.test(String(ct?.name ?? '')) && Number(ct?.count ?? 0) >= 2)
      const attune = Object.values(me2?.graveyard ?? {}).some((c) =>
        /attune with aether/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return energy && attune
    }
    case 'hasFlashback': {
      const me2 = getMe(gv)
      const ex = me2?.exile ?? {}
      const vals = Array.isArray(ex) ? ex : Object.values(ex)
      return vals.some((c) => /faithless looting/i.test(String((c as { name?: unknown })?.name ?? (typeof c === 'string' ? c : ''))))
    }
    case 'hasReanimateTarget': {
      const me2 = getMe(gv)
      const onBattlefield = Object.values(me2?.battlefield ?? {}).some((c) =>
        /grizzly bears/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const stillInGraveyard = Object.values(me2?.graveyard ?? {}).some((c) =>
        /grizzly bears/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return onBattlefield && !stillInGraveyard && Number(me2?.life) <= 18
    }
    case 'hasCompanion': {
      // El compañero propio se pagó ({3}) y está en mano; el del SIM sigue
      // visible en la zona de compañero (RevealedView del rival).
      const me2 = getMe(gv)
      const myName = String((me2 as { name?: unknown })?.name ?? '')
      const hand = Object.values(gv.myHand ?? gv.hand ?? {}).map((c) =>
        String((c as { name?: unknown })?.name ?? ''),
      )
      const rivalCompanion = (gv.companion ?? []).some((v) => {
        const owner = String((v as { name?: unknown })?.name ?? '')
        return myName ? !owner.toLowerCase().includes(myName.toLowerCase()) : true
      })
      return hand.some((n) => /lurrus/i.test(n)) && rivalCompanion
    }
    case 'hasLookedAt': {
      const views = gv.lookedAt ?? []
      return views.some((v) => Object.keys((v as { cards?: Record<string, unknown> })?.cards ?? {}).length >= 1)
    }
    case 'hasMultikicker': {
      const me2 = getMe(gv)
      const chalice = Object.values(me2?.battlefield ?? {}).find((c) =>
        /everflowing chalice/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const charge = ((chalice as { counters?: Array<{ name?: string; count?: number }> })?.counters ?? []).some(
        (ct) => /charge/i.test(String(ct?.name ?? '')) && Number(ct?.count ?? 0) === 2,
      )
      return !!chalice && charge && Object.keys(gv.stack ?? {}).length === 0
    }
    case 'hasStrive': {
      // Launch the Fleet no da +1/+1: concede a los DOS Grizzlies la habilidad
      // disparada del soldado hasta el final del turno (y queda en el
      // cementerio tras pagar {1}{W} por los 2 objetivos).
      const me2 = getMe(gv)
      const grizzlies = Object.values(me2?.battlefield ?? {}).filter((c) =>
        /grizzly bears/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const granted = (c: unknown) =>
        ((c as { rules?: unknown[] })?.rules ?? []).some((r) => /Soldier creature token/i.test(String(r)))
      const gy = Object.values(me2?.graveyard ?? {}).some((c) =>
        /launch the fleet/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      return grizzlies.length === 2 && grizzlies.every(granted) && gy && Object.keys(gv.stack ?? {}).length === 0
    }
    case 'hasCombatTrick': {
      const me2 = getMe(gv)
      const bear = Object.values(me2?.battlefield ?? {}).find((c) =>
        /grizzly bears/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const buffed = Number((bear as { power?: unknown })?.power) === 5 && Number((bear as { toughness?: unknown })?.toughness) === 5
      const gy = Object.values(me2?.graveyard ?? {}).some((c) =>
        /giant growth/i.test(String((c as { name?: unknown })?.name ?? '')),
      )
      const attacking = (gv.combat ?? []).some((group) =>
        Object.keys((group as { attackers?: Record<string, unknown> })?.attackers ?? {}).length > 0,
      )
      return buffed && gy && attacking
    }
    case 'hasPodCombat': {
      // Combate en pod: el Grizzly propio ataca al ÚLTIMO rival de la lista
      // (no al primero/primer-no-activo, el atajo del preview del overlay) y
      // el grupo de combate fija `defenderId` a ese jugador concreto.
      const opponents = (gv.players ?? []).filter((p) => !p?.controlled)
      const lastOpp = opponents[opponents.length - 1]
      if (!lastOpp) return false
      return (gv.combat ?? []).some((group) => {
        const record = group as unknown as {
          defenderId?: string
          attackers?: Record<string, { name?: unknown }>
        }
        if (String(record?.defenderId ?? '') !== String(lastOpp.playerId)) return false
        return Object.values(record?.attackers ?? {}).some((a) =>
          /grizzly bears/i.test(String(a?.name ?? '')),
        )
      })
    }
    case 'hasPodCommander': {
      // El daño de comandante NO tiene campo propio en el view (vive en
      // CommanderInfoWatcher del motor): viaja SOLO como info del cardState
      // dentro de `rules` del comandante ("Commander did N combat damage to
      // player <nombre>."), que el web parsea en CommanderDamageMatrix. El
      // invariante exige la traza completa en un pod de 4: el comandante del
      // humano con la línea de daño, el ÚLTIMO rival como damnificado y su vida
      // exactamente 40 − N.
      const me2 = getMe(gv)
      const opponents = (gv.players ?? []).filter((p) => !p?.controlled)
      if ((gv.players ?? []).length !== 4 || opponents.length !== 3) return false
      const lastOpp = opponents[opponents.length - 1]
      const cards = [
        ...Object.values(me2?.battlefield ?? {}),
        ...((Array.isArray(me2?.commandList) ? me2?.commandList : Object.values(me2?.commandList ?? {})) as unknown[]),
      ] as Array<{ name?: unknown; rules?: unknown[] }>
      const krenko = cards.find((c) => /krenko, mob boss/i.test(String(c?.name ?? '')))
      if (!krenko) return false
      const rules = (krenko.rules ?? []).map((r) => String(r).replace(/<[^>]*>/g, ' ')).join(' ')
      const m = rules.match(/did\s+(\d+)\s+combat damage to player\s+([^.<]+)/i)
      if (!m) return false
      if (m[2].trim().toLowerCase() !== String(lastOpp.name ?? '').toLowerCase()) return false
      return Number(lastOpp.life) === 40 - Number(m[1])
    }
    case 'hasFfaSix': {
      // FFA de 6 (> MAX_BOARD_PLAYERS=4): la decisión §9.1 sirve SOLO el layout
      // standard con switcher. El view debe traer los 6 asientos y una tierra
      // propia ya jugada (frame estable de la primera main).
      const me2 = getMe(gv)
      const opponents = (gv.players ?? []).filter((p) => !p?.controlled)
      if ((gv.players ?? []).length !== 6 || opponents.length !== 5) return false
      return Object.values(me2?.battlefield ?? {}).some((c) =>
        (c.cardTypes ?? []).includes('LAND'),
      )
    }
    case 'firstMulliganFreeSecondCostsCard': {
      const me2 = getMe(gv)
      const opponents = (gv.players ?? []).filter((p) => !p?.controlled)
      return (
        Number(gv.turn) === 1 &&
        Number((me2 as { handCount?: unknown } | undefined)?.handCount) === 6 &&
        opponents.length === 2 &&
        opponents.every((p) => Number((p as { handCount?: unknown })?.handCount) === 7)
      )
    }
    case 'hasTimeoutLoss': {
      const me2 = getMe(gv)
      const opponent = (gv.players ?? []).find((p) => !p?.controlled)
      return (
        Number((me2 as { priorityTimeLeftSecs?: unknown } | undefined)?.priorityTimeLeftSecs) === 0 &&
        (me2 as { hasLeft?: boolean } | undefined)?.hasLeft === true &&
        Number((me2 as { life?: unknown } | undefined)?.life) === 20 &&
        Number((opponent as { priorityTimeLeftSecs?: unknown } | undefined)?.priorityTimeLeftSecs) > 0
      )
    }
    case 'hasSlicerCeded': {
      const sim = (gv.players ?? []).find((p) => !p?.controlled)
      const slicer = Object.values(sim?.battlefield ?? {}).find((c) =>
        /slicer/i.test(String((c as { name?: unknown })?.name ?? '')),
      ) as
        | {
            tapped?: boolean
            cardIcons?: Array<{ cardIconType?: string; hint?: string }>
            rules?: unknown[]
          }
        | undefined
      const icons = slicer?.cardIcons ?? []
      const rules = slicer?.rules ?? []
      return (
        !!slicer &&
        slicer.tapped === false &&
        icons.some(
          (ic) =>
            String(ic?.cardIconType ?? '') === 'OTHER_HAS_RESTRICTIONS' &&
            /goaded by/i.test(String(ic?.hint ?? '')),
        ) &&
        rules.some((r) => /goaded by/i.test(String(r))) &&
        rules.some((r) => /can't be sacrificed/i.test(String(r)))
      )
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
