import { describe, expect, it, vi } from 'vitest'
import { buildGalleryEntries, recordedFrames, type GalleryEntry } from './galleryFixtures'
import { getState, setState } from '../state/state'
import { STORAGE_KEY as CREATE_TABLE_STORAGE_KEY } from '../lobby/CreateTable/constants'
import { BOARD_WIPE_MIN, boardWipeIds } from '../board/boardWipe'
import { controlChanges } from '../board/controlFx'
import { auraAttachments, flippedChanges, libraryTucks, mutateMerges, playerCounterChanges, turnedFaceUp } from '../board/gameTransitionEngine'
import { creatureShifts } from '../board/creatureShiftFx'
import { commandArrivals } from '../board/commandObjectsFx'
import { handReveals } from '../board/handRevealFx'
import { permanentKind } from '../board/bandWeights'
import { castFromCommand, commanderReturns } from '../board/commandFx'
import type { GameView } from '../net/types'
import { AURA_KEYWORDS, dominantAuraKeyword } from '../board/keywordAura'
import { extractOwnedKeywords } from '../data/keywordExtractor'
import { planDamageStrikes } from '../board/combatStrikes'
import { planKeywordStrikes, survivesLethal } from '../board/keywordStrikeFx'

function entry(entries: GalleryEntry[], id: string): GalleryEntry {
  const found = entries.find((e) => e.id === id)
  expect(found, `falta la entrada ${id}`).toBeTruthy()
  return found!
}

function replayPair(entries: GalleryEntry[], id: string): { base: GameView; next: GameView } {
  const e = entry(entries, id)
  vi.useFakeTimers()
  try {
    setState({ game: null })
    e.action!.run!()
    vi.advanceTimersByTime(100)
    return { base: e.game!, next: getState().game! }
  } finally {
    setState({ game: null })
    vi.useRealTimers()
  }
}

function allCardIds(game: GalleryEntry['game']): string[] {
  const ids: string[] = []
  for (const player of game?.players ?? []) {
    ids.push(...Object.keys(player.battlefield ?? {}), ...Object.keys(player.graveyard ?? {}), ...Object.keys(player.exile ?? {}))
  }
  return ids
}

describe('galería de estados (P3)', () => {
  const entries = buildGalleryEntries()

  it('incluye todos los frames de juego del registro', () => {
    expect(recordedFrames.length).toBeGreaterThan(30)
    for (const frame of recordedFrames) {
      expect(entries.some((entry) => entry.id === `frame:${frame.mechanic}`), frame.file).toBe(true)
    }
  })

  it('ids únicos y grupos conocidos', () => {
    const ids = entries.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...new Set(entries.map((entry) => entry.group))]).toEqual([
      'Frames reales',
      'Prompts',
      'Animaciones',
      'Pila',
      'Pantallas',
      'Tablero',
      'Dialogs',
      'Global',
    ])
  })

  it('los prompts apuntan a ids reales del frame base', () => {
    const prompts = entries.filter((entry) => entry.group === 'Prompts')
    expect(prompts.length).toBeGreaterThanOrEqual(10)
    for (const entry of prompts) {
      expect(entry.game, entry.id).toBeTruthy()
      expect(entry.gameId, entry.id).toBeTruthy()
      expect(entry.feedback?.gameId, entry.id).toBe(entry.gameId)
    }

    const target = prompts.find((entry) => entry.id === 'prompt:target')
    const targetId = target?.feedback?.options[0]?.id
    const inBattlefield = (target?.game?.players ?? []).some((p) => targetId != null && p.battlefield?.[targetId])
    expect(inBattlefield, `objetivo ${targetId} debe existir en el campo`).toBe(true)

    const mana = prompts.find((entry) => entry.id === 'prompt:mana')
    expect(mana?.feedback?.playerId).toBeTruthy()
    expect(mana?.playableIds?.length).toBeGreaterThan(0)
  })

  it('FX-12: animation entries: each has the action its state needs and a base that can show it', () => {
    const withAction = [
      'anim:untap-wave',
      'anim:life-5',
      'anim:life-2',
      'anim:token-pop',
      'anim:sickness',
      'anim:entered-glow',
      'anim:keyword-auras',
      'anim:keyword-gain',
      'anim:aura-keyword-gain',
      'anim:dissolve',
      'anim:stack-trail',
      'anim:land-slide',
      'anim:creature-damage',
      'anim:player-damage',
      'anim:player-life-loss',
      'anim:counter-change',
      'anim:loyalty-change',
      'anim:mill',
      'anim:countered',
      'anim:transform',
      'anim:bounce',
      'anim:opp-bounce',
      'anim:life-gain',
      'anim:shuffle',
      'anim:shuffle-opp',
      'anim:shuffle-classic',
      'anim:flicker',
      'anim:monarch-pass',
      'anim:initiative-take',
      'anim:player-eliminated',
      'anim:dice-roll',
      'anim:dice-roll-multi',
      'anim:dice-planar',
      'anim:phase-out',
      'anim:phase-in',
      'anim:mulligan',
      'anim:mulligan-opp',
      'anim:day-night',
      'anim:day-night-classic',
      'anim:sacrifice',
      'anim:spell-copy',
      'anim:pw-ultimate',
      'anim:revealed-flip',
      'anim:attack-lunge',
      'anim:combat-strikes',
      'anim:kw-first-strike',
      'anim:kw-deathtouch',
      'anim:kw-lifelink',
      'anim:kw-trample',
      'anim:kw-indestructible',
      'anim:kw-blocker-deathtouch',
      'anim:kw-double-block-deathtouch',
      'anim:kw-trample-planeswalker',
      'anim:destroy',
      'anim:exile',
      'anim:discard',
      'anim:token-fade',
      'anim:reanimate',
      'anim:spell-slam',
      'anim:ability-source',
      'anim:turn-banner',
      'anim:phase-wipe',
      'anim:count-flash',
      'anim:timer-low',
      'anim:turn-recap',
      'anim:commander-lethal',
      'anim:end-victory',
      'anim:end-defeat',
      'anim:exile-v2',
      'anim:pt-pump',
      'anim:pt-shrink',
      'anim:pt-mixed',
      'anim:regrowth',
      'anim:opp-regrowth',
      'anim:exile-from-hand',
      'anim:exile-from-graveyard',
      'anim:exile-from-library',
      'anim:flashback',
      'anim:cast-from-exile',
      'anim:board-wipe',
      'anim:board-wipe-pod',
      'anim:morph-face-up',
      'anim:manifest-face-up',
      'anim:poison',
      'anim:poison-lethal',
      'anim:poison-pod',
      'anim:energy',
      'anim:player-counter',
      'anim:speed',
      'anim:gain-control',
      'anim:control-return',
      'anim:gain-control-pod',
      'anim:commander-to-command',
      'anim:commander-to-command-v2',
      'anim:commander-grave-to-command',
      'anim:commander-cast',
      'anim:commander-to-command-pod',
      'anim:tuck',
      'anim:tuck-classic',
      'anim:hand-to-library',
      'anim:opp-hand-to-library',
      'anim:aura-attach',
      'anim:aura-attach-classic',
      'anim:mutate',
      'anim:mutate-under',
      'anim:land-animate',
      'anim:land-animate-v2',
      'anim:land-unanimate',
      'anim:vehicle-crew',
      'anim:emblem',
      'anim:dungeon',
      'anim:planeswalk',
      'anim:hand-revealed',
      'anim:hand-revealed-v2',
      'anim:mana-spent',
      'anim:goad',
      'anim:card-icon-gain',
      'anim:pay-paid',
      'anim:pay-declined-opp',
      'anim:chosen-card',
      'anim:chosen-player',
      'anim:behold',
      'anim:player-conceded',
      'anim:dungeon-complete',
      'anim:designation-monstrous',
      'anim:designation-renowned',
      'anim:designation-suspected',
      'anim:designation-classlevel',
      'anim:designation-casesolved',
      'anim:scry',
      'anim:surveil-opp',
      'anim:library-low',
      'anim:library-empty',
      'anim:library-empty-classic',
      'anim:block-lunge',
      'anim:block-lunge-opp',
      'anim:flip-card',
    ]
    for (const id of withAction) expect(entry(entries, id).action?.label, id).toBeTruthy()
    const staticStates = ['anim:life-6', 'anim:chosen-target', 'anim:opp-pill-required', 'anim:opp-pill-optional']
    for (const id of staticStates) expect(entry(entries, id).action, id).toBeUndefined()

    const untapBase = entry(entries, 'anim:untap-wave').game
    const me = (untapBase?.players ?? []).find((p) => p.controlled)
    const tapped = Object.values(me?.battlefield ?? {}).filter((perm) => perm.tapped === true)
    expect(tapped.length).toBeGreaterThanOrEqual(2)
    expect(untapBase?.combat ?? []).toHaveLength(0)

    expect(entry(entries, 'anim:life-6').game?.players?.find((p) => p.controlled)?.life).toBe(6)
    expect(Object.values(entry(entries, 'anim:stack-trail').game?.myHand ?? {}).some((c) => (c.cardTypes ?? []).includes('Instant'))).toBe(true)
    expect(Object.values(entry(entries, 'anim:land-slide').game?.myHand ?? {}).some((c) => (c.cardTypes ?? []).some((t) => String(t).toLowerCase() === 'land'))).toBe(true)
    expect(entry(entries, 'anim:player-damage').game?.stack && Object.keys(entry(entries, 'anim:player-damage').game!.stack!)).toHaveLength(1)
    expect(entry(entries, 'anim:opp-pill-required').feedback?.required).toBe(true)
    expect(entry(entries, 'anim:opp-pill-optional').feedback?.required).toBe(false)
    expect(entry(entries, 'anim:chosen-target').feedback?.chosenTargets?.length).toBe(1)
  })

  it('the gallery-gap animation entries start from a base that can play them', () => {
    const meOf = (e: GalleryEntry) => e.game?.players?.find((p) => p.controlled)

    const strikes = entry(entries, 'anim:combat-strikes').game
    expect(strikes?.step).toBe('DECLARE_BLOCKERS')
    expect(strikes?.combat ?? []).toHaveLength(2)

    const lunge = entry(entries, 'anim:attack-lunge').game
    expect(lunge?.combat ?? []).toHaveLength(0)

    const reanimate = entry(entries, 'anim:reanimate')
    const reanimateMe = meOf(reanimate)
    const buried = Object.keys(reanimateMe?.graveyard ?? {}).find((id) => !(id in (reanimateMe?.battlefield ?? {})))
    expect(buried).toBeTruthy()

    expect(Object.values(meOf(entry(entries, 'anim:token-fade'))?.battlefield ?? {}).some((perm) => perm.isToken === true)).toBe(true)
    expect(Object.values(entry(entries, 'anim:spell-slam').game?.myHand ?? {}).some((card) => (card.manaValue ?? 0) >= 7)).toBe(true)
    expect(meOf(entry(entries, 'anim:timer-low'))?.hasPriority).toBe(true)
    expect(entry(entries, 'anim:exile').gameUi).toBe('v1')

    const wipe = entry(entries, 'anim:phase-wipe')
    expect(wipe.gameUi).toBe('v1')
    expect(wipe.action?.apply?.(wipe.game!).step).toBe('BEGIN_COMBAT')

    const commander = entry(entries, 'anim:commander-lethal')
    expect(commander.gameUi).toBe('v1')
    const rules = (commander.game?.players ?? []).flatMap((p) => (p.commandList ?? []).flatMap((item) => (item as { rules?: string[] }).rules ?? []))
    expect(rules.some((rule) => rule.includes('did 18 combat damage to player'))).toBe(true)

    expect(entry(entries, 'anim:end-victory').gameEnd?.won).toBe(true)
    expect(entry(entries, 'anim:end-defeat').gameEnd?.won).toBe(false)
    expect(entry(entries, 'anim:end-victory').screen).toBe('gameend')
  })

  it('the wipe, face-up, player-counter and control entries start from a base that can play them', () => {
    const changeOf = (id: string) => {
      const e = entry(entries, id)
      let next: GalleryEntry['game'] = null
      vi.useFakeTimers()
      try {
        setState({ game: null })
        e.action!.run!()
        vi.advanceTimersByTime(100)
        next = getState().game
      } finally {
        vi.useRealTimers()
      }
      return { base: e.game!, next: next! }
    }

    for (const id of ['anim:board-wipe', 'anim:board-wipe-pod']) {
      const { base, next } = changeOf(id)
      expect(boardWipeIds(base, next).length, id).toBeGreaterThanOrEqual(BOARD_WIPE_MIN)
    }
    expect(entry(entries, 'anim:board-wipe-pod').boardLayout).toBe('pod')

    for (const [id, kind] of [['anim:morph-face-up', 'morph'], ['anim:manifest-face-up', 'manifest']] as const) {
      const { base, next } = changeOf(id)
      const me = (g: GameView) => (g.players ?? []).find((p) => p.controlled)!
      expect(turnedFaceUp(me(base), me(next)).map((c) => c.kind), id).toEqual([kind])
    }

    const counterOf = (id: string) => {
      const { base, next } = changeOf(id)
      return (base.players ?? []).flatMap((p) => playerCounterChanges(p, (next.players ?? []).find((n) => n.playerId === p.playerId)!))
    }
    expect(counterOf('anim:poison')).toEqual([{ name: 'poison', from: 2, to: 3 }])
    expect(counterOf('anim:poison-lethal')).toEqual([{ name: 'poison', from: 9, to: 10 }])
    expect(counterOf('anim:poison-pod')).toEqual([{ name: 'poison', from: 4, to: 5 }])
    expect(counterOf('anim:energy')).toEqual([{ name: 'energy', from: 1, to: 3 }])
    expect(counterOf('anim:player-counter')).toEqual([{ name: 'experience', from: 1, to: 2 }])
    expect(counterOf('anim:speed')).toEqual([{ name: 'speed', from: 1, to: 2 }])

    for (const id of ['anim:gain-control', 'anim:control-return', 'anim:gain-control-pod']) {
      const { base, next } = changeOf(id)
      expect(controlChanges(base, next), id).toHaveLength(1)
    }
    const taken = changeOf('anim:gain-control')
    expect(controlChanges(taken.base, taken.next)[0].to).toBe((taken.base.players ?? []).find((p) => p.controlled)?.playerId)
    const pod = changeOf('anim:gain-control-pod')
    const podChange = controlChanges(pod.base, pod.next)[0]
    expect((pod.base.players ?? []).filter((p) => !p.controlled).map((p) => p.playerId)).toEqual(expect.arrayContaining([podChange.from, podChange.to]))
  })

  it('the commander, library, aura and mutate entries start from a base that can play them', () => {
    const changeOf = (id: string) => {
      const e = entry(entries, id)
      let next: GalleryEntry['game'] = null
      vi.useFakeTimers()
      try {
        setState({ game: null })
        e.action!.run!()
        vi.advanceTimersByTime(100)
        next = getState().game
      } finally {
        vi.useRealTimers()
      }
      return { base: e.game!, next: next! }
    }
    const pair = (base: GameView, next: GameView) => (base.players ?? []).map((p) => [p, (next.players ?? []).find((n) => n.playerId === p.playerId)!] as const)

    for (const [id, origin] of [['anim:commander-to-command', 'battlefield'], ['anim:commander-to-command-v2', 'battlefield'], ['anim:commander-grave-to-command', 'graveyard'], ['anim:commander-to-command-pod', 'battlefield']] as const) {
      const { base, next } = changeOf(id)
      expect(commanderReturns(base, next).map((r) => r.origin), id).toEqual([origin])
    }
    const pod = changeOf('anim:commander-to-command-pod')
    expect(commanderReturns(pod.base, pod.next)[0].playerId).not.toBe((pod.base.players ?? []).find((p) => p.controlled)?.playerId)
    expect(entry(entries, 'anim:commander-to-command').gameUi).toBe('v1')
    expect(entry(entries, 'anim:commander-to-command-v2').gameUi).toBe('v2')
    expect(entry(entries, 'anim:commander-to-command-pod').boardLayout).toBe('pod')

    const cast = changeOf('anim:commander-cast')
    const [spellId, spell] = Object.entries(cast.next.stack ?? {})[0]
    expect(castFromCommand(spell, spellId, cast.base, cast.next)).toBeTruthy()

    const tucksOf = (id: string) => {
      const { base, next } = changeOf(id)
      return pair(base, next).map(([p, n]) => libraryTucks(p, n, base, next))
    }
    for (const id of ['anim:tuck', 'anim:tuck-classic']) expect(tucksOf(id).flatMap((t) => t.permanents), id).toHaveLength(1)
    expect(tucksOf('anim:hand-to-library').flatMap((t) => t.hand)).toHaveLength(2)
    expect(tucksOf('anim:opp-hand-to-library').map((t) => t.hidden)).toContain(2)

    for (const id of ['anim:aura-attach', 'anim:aura-attach-classic']) {
      const { base, next } = changeOf(id)
      expect(pair(base, next).flatMap(([p, n]) => auraAttachments(p, n, next)), id).toHaveLength(1)
    }
    for (const id of ['anim:mutate', 'anim:mutate-under']) {
      const { base, next } = changeOf(id)
      expect(mutateMerges(base, next).size, id).toBe(1)
    }
  })

  it('the band-change, command-zone, hand-reveal and flip entries start from a base that can play them', () => {
    const changeOf = (id: string) => {
      const e = entry(entries, id)
      let next: GalleryEntry['game'] = null
      vi.useFakeTimers()
      try {
        setState({ game: null })
        e.action!.run!()
        vi.advanceTimersByTime(100)
        next = getState().game
      } finally {
        vi.useRealTimers()
      }
      return { base: e.game!, next: next! }
    }
    const pair = (base: GameView, next: GameView) => (base.players ?? []).map((p) => [p, (next.players ?? []).find((n) => n.playerId === p.playerId)!] as const)

    for (const [id, rises] of [['anim:land-animate', true], ['anim:land-animate-v2', true], ['anim:land-unanimate', false], ['anim:vehicle-crew', true]] as const) {
      const { base, next } = changeOf(id)
      const shifts = pair(base, next).flatMap(([p, n]) => creatureShifts(p, n))
      expect(shifts.map((s) => s.rises), id).toEqual([rises])
      const before = base.players!.flatMap((p) => Object.entries(p.battlefield ?? {})).find(([pid]) => pid === shifts[0].id)![1]
      const after = next.players!.flatMap((p) => Object.entries(p.battlefield ?? {})).find(([pid]) => pid === shifts[0].id)![1]
      expect(permanentKind(before), id).not.toBe(permanentKind(after))
    }
    expect(entry(entries, 'anim:land-animate').gameUi).toBe('v1')
    expect(entry(entries, 'anim:land-animate-v2').gameUi).toBe('v2')

    const emblem = changeOf('anim:emblem')
    expect(commandArrivals(emblem.base, emblem.next).emblems).toHaveLength(1)
    const dungeon = changeOf('anim:dungeon')
    expect(commandArrivals(dungeon.base, dungeon.next).dungeons.map((d) => [d.entered, d.dungeon.room])).toEqual([[false, 'Goblin Lair']])
    const plane = changeOf('anim:planeswalk')
    expect(commandArrivals(plane.base, plane.next).planes.map((p) => p.replaced)).toEqual([true])

    for (const id of ['anim:hand-revealed', 'anim:hand-revealed-v2']) {
      const { base, next } = changeOf(id)
      expect(handReveals(base, next).map((r) => r.cards.length), id).toEqual([3])
    }
    expect(entry(entries, 'anim:hand-revealed').gameUi).toBe('v1')
    expect(entry(entries, 'anim:hand-revealed-v2').gameUi).toBe('v2')

    const flip = changeOf('anim:flip-card')
    expect(pair(flip.base, flip.next).flatMap(([p, n]) => flippedChanges(p, n))).toHaveLength(1)
  })

  it('anim:keyword-auras replay puts one creature per aura keyword on the battlefield', () => {
    vi.useFakeTimers()
    try {
      setState({ game: null })
      entry(entries, 'anim:keyword-auras').action!.run!()
      vi.advanceTimersByTime(100)
      const me = getState().game?.players?.find((p) => p.controlled)
      const perms = Object.values(me?.battlefield ?? {}).filter((perm) => perm.id?.startsWith('gallery-kw-'))
      expect(perms).toHaveLength(7)
      const auras = perms.map((perm) => dominantAuraKeyword(extractOwnedKeywords(perm).map((k) => k.id)))
      expect([...auras].sort()).toEqual([...AURA_KEYWORDS].sort())
    } finally {
      setState({ game: null })
      vi.useRealTimers()
    }
  })

  it('anim:kw-first-strike replay plans a first-strike hit on the unblocked knight', () => {
    const { base, next } = replayPair(entries, 'anim:kw-first-strike')
    expect(base.step).toBe('DECLARE_BLOCKERS')
    expect(next.step).toBe('FIRST_COMBAT_DAMAGE')
    const opponent = next.players!.find((p) => !p.controlled)!
    expect(opponent.life).toBe((base.players!.find((p) => !p.controlled)!.life ?? 0) - 2)
    const strikes = planKeywordStrikes(base, next, planDamageStrikes(base, next))
    expect(strikes).toEqual([
      { attackerId: 'gallery-kwfx-knight', targetId: opponent.playerId, firstStrike: true, deathtouchKill: false, lifelinkTo: null, trampleTo: null },
    ])
  })

  it('anim:kw-deathtouch replay plans a deathtouch kill of the blocker', () => {
    const { base, next } = replayPair(entries, 'anim:kw-deathtouch')
    expect(base.step).toBe('DECLARE_BLOCKERS')
    expect(next.step).toBe('COMBAT_DAMAGE')
    expect(next.combat ?? []).toHaveLength(0)
    const strikes = planKeywordStrikes(base, next, planDamageStrikes(base, next))
    expect(strikes).toEqual([
      { attackerId: 'gallery-kwfx-rats', targetId: 'gallery-kwfx-dreadmaw-opp', firstStrike: false, deathtouchKill: true, lifelinkTo: null, trampleTo: null },
    ])
    const allNext = next.players!.flatMap((p) => Object.keys(p.battlefield ?? {}))
    expect(allNext).not.toContain('gallery-kwfx-rats')
    expect(allNext).not.toContain('gallery-kwfx-dreadmaw-opp')
  })

  it('anim:kw-lifelink replay plans lifelink motes to my life total', () => {
    const { base, next } = replayPair(entries, 'anim:kw-lifelink')
    expect(base.step).toBe('DECLARE_BLOCKERS')
    expect(next.step).toBe('COMBAT_DAMAGE')
    const me = (g: GameView) => g.players!.find((p) => p.controlled)!
    const opponent = (g: GameView) => g.players!.find((p) => !p.controlled)!
    expect(me(next).life).toBe((me(base).life ?? 0) + 2)
    expect(opponent(next).life).toBe((opponent(base).life ?? 0) - 2)
    const strikes = planKeywordStrikes(base, next, planDamageStrikes(base, next))
    expect(strikes).toEqual([
      { attackerId: 'gallery-kwfx-child', targetId: opponent(base).playerId, firstStrike: false, deathtouchKill: false, lifelinkTo: me(base).playerId, trampleTo: null },
    ])
  })

  it('anim:kw-trample replay plans the overflow to the opponent', () => {
    const { base, next } = replayPair(entries, 'anim:kw-trample')
    expect(base.step).toBe('DECLARE_BLOCKERS')
    expect(next.step).toBe('COMBAT_DAMAGE')
    const opponent = (g: GameView) => g.players!.find((p) => !p.controlled)!
    expect(opponent(next).life).toBe((opponent(base).life ?? 0) - 4)
    expect(Object.keys(opponent(next).graveyard ?? {})).toContain('gallery-kwfx-bears')
    expect(next.players!.find((p) => p.controlled)!.battlefield?.['gallery-kwfx-dreadmaw']?.damage).toBe(2)
    const strikes = planKeywordStrikes(base, next, planDamageStrikes(base, next))
    expect(strikes).toEqual([
      { attackerId: 'gallery-kwfx-dreadmaw', targetId: 'gallery-kwfx-bears', firstStrike: false, deathtouchKill: false, lifelinkTo: null, trampleTo: opponent(base).playerId },
    ])
  })

  it('anim:kw-blocker-deathtouch replay plans the blocker\'s kill of my attacker', () => {
    const { base, next } = replayPair(entries, 'anim:kw-blocker-deathtouch')
    expect(base.step).toBe('DECLARE_BLOCKERS')
    expect(next.step).toBe('COMBAT_DAMAGE')
    expect(next.combat ?? []).toHaveLength(0)
    const allNext = next.players!.flatMap((p) => Object.keys(p.battlefield ?? {}))
    expect(allNext).not.toContain('gallery-kwfx-bears')
    expect(allNext).not.toContain('gallery-kwfx-rats-opp')
    const strikes = planKeywordStrikes(base, next, planDamageStrikes(base, next))
    expect(strikes).toEqual([
      { attackerId: 'gallery-kwfx-rats-opp', targetId: 'gallery-kwfx-bears', firstStrike: false, deathtouchKill: true, lifelinkTo: null, trampleTo: null, fromBlocker: true },
    ])
  })

  it('anim:kw-double-block-deathtouch replay plans one skull for each blocker the deathtouch attacker kills', () => {
    const { base, next } = replayPair(entries, 'anim:kw-double-block-deathtouch')
    expect(base.step).toBe('DECLARE_BLOCKERS')
    expect(next.step).toBe('COMBAT_DAMAGE')
    expect(next.combat ?? []).toHaveLength(0)
    const strikes = planKeywordStrikes(base, next, planDamageStrikes(base, next))
    const kill = (targetId: string) => ({ attackerId: 'gallery-kwfx-viper', targetId, firstStrike: false, deathtouchKill: true, lifelinkTo: null, trampleTo: null })
    expect(strikes).toEqual([kill('gallery-kwfx-bears-opp-1'), kill('gallery-kwfx-bears-opp-2')])
  })

  it('anim:kw-trample-planeswalker replay plans the overflow wave to the planeswalker', () => {
    const { base, next } = replayPair(entries, 'anim:kw-trample-planeswalker')
    expect(base.step).toBe('DECLARE_BLOCKERS')
    expect(next.step).toBe('COMBAT_DAMAGE')
    const opponent = (g: GameView) => g.players!.find((p) => !p.controlled)!
    expect(opponent(base).battlefield?.['gallery-kwfx-walker']?.loyalty).toBe('5')
    expect(opponent(next).battlefield?.['gallery-kwfx-walker']?.loyalty).toBe('1')
    expect(opponent(next).life).toBe(opponent(base).life)
    const strikes = planKeywordStrikes(base, next, planDamageStrikes(base, next))
    expect(strikes).toEqual([
      { attackerId: 'gallery-kwfx-dreadmaw', targetId: 'gallery-kwfx-bears', firstStrike: false, deathtouchKill: false, lifelinkTo: null, trampleTo: 'gallery-kwfx-walker' },
    ])
  })

  it('anim:kw-indestructible replay leaves the lethal-damaged myr on the battlefield', () => {
    const { base, next } = replayPair(entries, 'anim:kw-indestructible')
    const myrOf = (g: GameView) => g.players!.find((p) => p.controlled)!.battlefield!['gallery-kwfx-myr']!
    expect(survivesLethal(myrOf(base))).toBe(false)
    expect(myrOf(next).damage).toBe(3)
    expect(survivesLethal(myrOf(next))).toBe(true)
  })

  it('anim:turn-recap closes a recap through the real observer', () => {
    vi.useFakeTimers()
    try {
      setState({ turnRecap: null })
      entry(entries, 'anim:turn-recap').action!.run!()
      vi.advanceTimersByTime(100)
      const recap = getState().turnRecap
      expect(recap).toBeTruthy()
      expect(recap!.actors[0]?.played).toContain('Grizzly Bears')
      expect(recap!.actors[0]?.attackedWith.length).toBe(1)
      expect(recap!.departures.some((d) => d.mine && d.dest === 'graveyard')).toBe(true)
      expect(recap!.life.some((l) => l.mine && l.delta === -1)).toBe(true)
    } finally {
      setState({ turnRecap: null })
      vi.useRealTimers()
    }
  })

  it('las entradas de sickness y entered-glow pertenecen a Animaciones', () => {
    expect(entry(entries, 'anim:sickness').group).toBe('Animaciones')
    expect(entry(entries, 'anim:entered-glow').group).toBe('Animaciones')
    expect(entry(entries, 'anim:spell-cast-own').group).toBe('Animaciones')
    expect(entry(entries, 'anim:spell-cast-opp').group).toBe('Animaciones')
    expect(entry(entries, 'anim:counter-change').group).toBe('Animaciones')
    expect(entry(entries, 'anim:counter-change').action?.label).toBe('Replay')
    const counterMe = entry(entries, 'anim:counter-change').game?.players?.find((p) => p.controlled)
    const counterBattlefield = Object.values(counterMe?.battlefield ?? {})
    expect(counterBattlefield.some((perm) => perm.counters?.some((c) => c.name === '+1/+1' && c.count === 1))).toBe(true)
    expect(entry(entries, 'anim:loyalty-change').group).toBe('Animaciones')
    const loyaltyMe = entry(entries, 'anim:loyalty-change').game?.players?.find((p) => p.controlled)
    expect(Object.values(loyaltyMe?.battlefield ?? {}).some((perm) => perm.loyalty === '4')).toBe(true)
    expect(entry(entries, 'anim:mill').group).toBe('Animaciones')
    expect(entry(entries, 'anim:equip-move').group).toBe('Animaciones')
    expect(entry(entries, 'anim:equip-move').action?.label).toBe('Replay')
    expect(entry(entries, 'anim:coin-flip').group).toBe('Animaciones')
    expect(entry(entries, 'anim:coin-flip').action?.label).toBe('Replay')
    expect(entry(entries, 'anim:sickness').action?.label).toBe('Invocar criatura')
    expect(entry(entries, 'anim:entered-glow').action?.label).toBe('Entrar criatura')
  })

  it('anim:coin-flip starts at turn 0 with nobody active and no mulligan prompt', () => {
    const coin = entry(entries, 'anim:coin-flip')
    expect(coin.game?.turn).toBe(0)
    expect(coin.game?.players?.some((p) => p.isActive)).toBe(false)
    expect(coin.feedback ?? null).toBeNull()
    expect(coin.gameId).toBeTruthy()
  })

  it('la entrada de instantáneo del rival empieza con el instantáneo en su mano y la pila vacía', () => {
    const opp = entry(entries, 'anim:spell-cast-opp').game
    const oppPlayer = opp?.players?.find((p) => !p.controlled)
    expect(oppPlayer).toBeTruthy()
    expect(oppPlayer!.handCount ?? 0).toBeGreaterThan(0)
    expect(Object.keys(opp?.stack ?? {})).toHaveLength(0)
  })

  it('los Lightning Bolt de la galería usan una impresión real (M10 146), no el 2XM 129', () => {
    for (const id of ['anim:stack-trail', 'anim:spell-cast-own', 'anim:spell-cast-opp']) {
      const game = entry(entries, id).game
      const bolts = [...Object.values(game?.myHand ?? {}), ...Object.values(game?.stack ?? {})].filter((c) => c.name === 'Lightning Bolt')
      for (const card of bolts) expect(card.expansionSetCode, `${id} ${card.id}`).toBe('M10')
    }
  })

  it('la búsqueda filtrada declara solo parte de las candidatas como elegibles', () => {
    const filtered = entry(entries, 'prompt:card-grid-filtered').feedback
    expect(filtered?.options.length).toBeGreaterThan(0)
    expect(filtered!.options.length).toBeLessThan(filtered!.cards!.length)
    for (const option of filtered!.options) {
      expect(filtered!.cards!.some((card) => card.id === option.id), option.id).toBe(true)
    }
  })

  it('la entrada de login no arrastra partida', () => {
    const login = entry(entries, 'screen:login')
    expect(login.phase).toBe('idle')
    expect(login.game).toBeUndefined()
    expect(entry(entries, 'screen:login-connecting').phase).toBe('connecting')
    expect(entry(entries, 'screen:login-error').error).toBeTruthy()
  })

  it('los tableros multi-jugador clonan rivales con ids únicos y un solo controlado', () => {
    for (const id of ['board:pod-4', 'board:arena-4']) {
      const game = entry(entries, id).game
      expect(game?.players?.length, id).toBe(4)
      const playerIds = (game?.players ?? []).map((p) => p.playerId)
      expect(new Set(playerIds).size, `${id}: playerIds únicos`).toBe(4)
      expect((game?.players ?? []).filter((p) => p.controlled).length, `${id}: un controlado`).toBe(1)
      const cardIds = allCardIds(game)
      expect(new Set(cardIds).size, `${id}: ids de carta únicos entre jugadores`).toBe(cardIds.length)
    }

    const commander = entry(entries, 'board:pod-commander')
    expect(commander.boardLayout).toBe('pod')
    expect(commander.game?.players?.length).toBe(3)
    expect((commander.game?.players ?? []).every((p) => (p.commandList ?? []).length > 0)).toBe(true)
  })

  it('los rivales clonados no heredan prioridad ni turno', () => {
    const pod = entry(entries, 'board:pod-4').game
    expect((pod?.players ?? []).filter((p) => p.hasPriority).length).toBeLessThanOrEqual(1)
    expect((pod?.players ?? []).filter((p) => p.isActive).length).toBeLessThanOrEqual(1)
  })

  it('el marco de prioridad pone la prioridad en un rival no activo y la rota por la mesa', () => {
    const e = entry(entries, 'board:priority-frame')
    expect(e.boardLayout).toBe('arena')
    const game = e.game
    const holders = (game?.players ?? []).filter((p) => p.hasPriority)
    expect(holders).toHaveLength(1)
    expect(holders[0].controlled).toBeFalsy()
    expect(holders[0].playerId).not.toBe(game?.activePlayerId)
    expect(game?.priorityPlayerName).toBe(holders[0].name)

    let current = game!
    const seen = new Set<string>()
    for (let i = 0; i < 4; i++) {
      current = e.action!.apply!(current)
      const now = (current.players ?? []).filter((p) => p.hasPriority)
      expect(now).toHaveLength(1)
      seen.add(now[0].playerId)
    }
    expect(seen.size).toBe(4)
  })

  it('cada variante de tablero declara su layout y el frame base conserva su campo', () => {
    expect(entry(entries, 'board:pod-4').boardLayout).toBe('pod')
    expect(entry(entries, 'board:arena-4').boardLayout).toBe('arena')
    const base = recordedFrames.find((f) => f.file === 'gang-block.json')?.gameView
    const pod = entry(entries, 'board:pod-4').game
    expect(pod?.myHand).toEqual(base?.myHand)
  })

  it('mano de 15 cartas y nombres largos', () => {
    const hand = entry(entries, 'game:hand-15').game
    expect(Object.keys(hand?.myHand ?? {})).toHaveLength(15)
    const me = (hand?.players ?? []).find((p) => p.controlled)
    expect(me?.handCount).toBe(15)

    const long = entry(entries, 'game:long-names').game
    const names = (long?.players ?? []).map((p) => p.name)
    expect(names.some((name) => (name ?? '').length > 30)).toBe(true)
  })

  it('pantallas nuevas montan con los props/slices que leen', () => {
    const staging = entry(entries, 'screen:staging-player')
    expect(staging.screen).toBe('staging')
    expect(staging.stagingTable?.seats.length).toBe(2)
    expect(staging.chatMessages?.length).toBeGreaterThan(0)

    const wizard = entry(entries, 'screen:wizard')
    expect(wizard.screen).toBe('wizard')
    const seed = JSON.parse(wizard.storageSeed?.[CREATE_TABLE_STORAGE_KEY] ?? '{}')
    expect(seed.deckType).toBe('Limited')
    expect(seed.useDraftTournament).toBe(true)
    expect(seed.name).toBeTruthy()
  })

  it('torneo: carga, error, vacío y espera son estados distintos del modal', () => {
    expect(entry(entries, 'screen:tournament-loading').tournamentModal?.loading).toBe(true)
    expect(entry(entries, 'screen:tournament-error').tournamentModal?.error).toBeTruthy()
    const empty = entry(entries, 'screen:tournament-empty').tournamentModal
    expect(empty?.view).toBeNull()
    expect(empty?.loading ?? false).toBe(false)
    expect(empty?.error ?? null).toBeNull()
    const waiting = entry(entries, 'screen:tournament-waiting').tournamentModal?.view
    expect(waiting?.rounds).toHaveLength(0)
    expect(waiting?.tournamentState.toLowerCase()).toContain('construct')
  })

  it('draft cuñado usa el watchdog real (lastDraftEventAt)', () => {
    const stalled = entry(entries, 'screen:draft-stalled')
    expect(stalled.draft).toBeTruthy()
    expect(stalled.lastDraftEventAt).toBe(0)
  })

  it('fin de partida y fin de match se distinguen por matchView.endTime', () => {
    const game = entry(entries, 'screen:gameend-game').gameEnd
    expect(game?.matchView?.endTime ?? null).toBeNull()
    const match = entry(entries, 'screen:gameend-match').gameEnd
    expect(match?.matchView?.endTime).toBeTruthy()
    expect(match?.won).toBe(true)
  })

  it('estados globales: idioma, zoom y desconexión', () => {
    expect(entry(entries, 'global:lang-lobby-ru').lang).toBe('ru')
    const ja = entry(entries, 'global:lang-game-ja')
    expect(ja.lang).toBe('ja')
    expect(ja.cjkBoost).toBe(true)
    expect(entry(entries, 'global:zoom-lobby-125').uiScale).toBe(1.25)
    expect(entry(entries, 'global:reconnecting').connecting).toBe(true)
  })
})
