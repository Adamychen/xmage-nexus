import { useSyncExternalStore } from 'react'
import type { CardView } from '../net/types'
import { fxMotionDuration } from './fx'
import { isAbilityCard } from '../cards/cardImages'
import { soundManager } from '../audio/soundManager'

export type ManaColor = 'w' | 'u' | 'b' | 'r' | 'g'
export type SpellWeight = 0 | 1 | 2
export type ImpactKind = 'slam' | 'sparks' | 'destroy' | 'exile' | 'token-pop' | 'token-fade' | 'enter-ring' | 'countered' | 'transform' | 'bounce' | 'heal'
  | 'flicker' | 'phase' | 'sacrifice' | 'copy' | 'ultimate' | 'eliminated' | 'wipe' | 'face-up' | 'poison' | 'poison-lethal' | 'energy' | 'control'
  | 'command' | 'tuck' | 'attach' | 'mutate' | 'animate' | 'emblem' | 'dungeon' | 'planeswalk' | 'flip' | 'conceded'
  | 'first-strike' | 'deathtouch' | 'lifelink' | 'trample' | 'indestructible'

export interface ImpactFx {
  id: number
  kind: ImpactKind
  x: number
  y: number
  w: number
  h: number
  colors: ManaColor[]
  weight: SpellWeight
  duration: number
  /** The far end of a tether (`control`): where the pull comes from. */
  toX?: number
  toY?: number
  /** A CSS colour for the effect, e.g. the seat colour of the player it belongs to. */
  tint?: string
}

const COLOR_FLAGS: Array<[keyof NonNullable<CardView['color']>, ManaColor]> = [
  ['white', 'w'],
  ['blue', 'u'],
  ['black', 'b'],
  ['red', 'r'],
  ['green', 'g'],
]

export function cardManaColors(card: Pick<CardView, 'color' | 'manaCostLeftStr'> | null | undefined): ManaColor[] {
  if (!card) return []
  const out: ManaColor[] = []
  const flags = card.color
  if (flags) {
    for (const [flag, c] of COLOR_FLAGS) if (flags[flag]) out.push(c)
  }
  if (out.length > 0) return out
  const cost = (card.manaCostLeftStr ?? []).join('').toLowerCase()
  for (const c of ['w', 'u', 'b', 'r', 'g'] as const) {
    if (new RegExp(`\\{[^}]*${c}[^}]*\\}`).test(cost)) out.push(c)
  }
  return out
}

export function spellWeight(card: CardView | null | undefined): SpellWeight {
  if (!card || card.isAbility === true || isAbilityCard(card)) return 0
  const mv = typeof card.manaValue === 'number' ? card.manaValue : 0
  const mythic = String(card.rarity ?? '').toUpperCase() === 'MYTHIC'
  if (mv >= 7 || (mythic && mv >= 5)) return 2
  if (mv >= 5 || mythic) return 1
  return 0
}

let impacts: ImpactFx[] = []
let counter = 0
const listeners = new Set<() => void>()
const MAX_IMPACTS = 32

function notify() {
  listeners.forEach((fn) => fn())
}

export function subscribeImpacts(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function getImpacts(): ImpactFx[] {
  return impacts
}

export function useImpacts(): ImpactFx[] {
  return useSyncExternalStore(subscribeImpacts, getImpacts, getImpacts)
}

export function clearImpacts() {
  impacts = []
  notify()
}

/** Base length of a board wipe's wave, from its flash to its fade. */
export const WIPE_MS = 1100

const BASE_MS: Record<ImpactKind, number> = {
  slam: 900,
  sparks: 620,
  destroy: 900,
  exile: 1000,
  'token-pop': 650,
  'token-fade': 700,
  'enter-ring': 900,
  countered: 760,
  transform: 820,
  bounce: 640,
  heal: 1100,
  flicker: 700,
  phase: 800,
  sacrifice: 950,
  copy: 700,
  ultimate: 1300,
  eliminated: 1400,
  wipe: WIPE_MS,
  'face-up': 900,
  poison: 1000,
  'poison-lethal': 1500,
  energy: 700,
  control: 900,
  command: 950,
  tuck: 640,
  attach: 1000,
  mutate: 900,
  animate: 1000,
  emblem: 1000,
  dungeon: 900,
  planeswalk: 1300,
  flip: 760,
  conceded: 1200,
  'first-strike': 520,
  deathtouch: 1000,
  lifelink: 900,
  trample: 700,
  indestructible: 1100,
}

export function spawnImpact(
  kind: ImpactKind,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> | null,
  opts: { colors?: ManaColor[]; weight?: SpellWeight; to?: { x: number; y: number } | null; tint?: string } = {},
): ImpactFx | null {
  const duration = fxMotionDuration(BASE_MS[kind] * (kind === 'slam' && opts.weight === 2 ? 1.35 : 1))
  if (!duration) return null
  if (kind !== 'slam' && (!rect || rect.width <= 0 || rect.height <= 0)) return null
  const item: ImpactFx = {
    id: ++counter,
    kind,
    x: rect ? rect.left + rect.width / 2 : 0,
    y: rect ? rect.top + rect.height / 2 : 0,
    w: rect?.width ?? 0,
    h: rect?.height ?? 0,
    colors: opts.colors ?? [],
    weight: opts.weight ?? 0,
    duration,
    ...(opts.to ? { toX: opts.to.x, toY: opts.to.y } : null),
    ...(opts.tint ? { tint: opts.tint } : null),
  }
  impacts = [...impacts, item].slice(-MAX_IMPACTS)
  notify()
  setTimeout(() => {
    impacts = impacts.filter((f) => f.id !== item.id)
    notify()
  }, duration + 60)
  return item
}

function quakeBoard(weight: SpellWeight, ms: number): void {
  if (typeof document === 'undefined') return
  const cls = weight === 2 ? 'fx-quake-2' : 'fx-quake-1'
  document.querySelectorAll('.board-shell').forEach((el) => {
    el.classList.remove('fx-quake-1', 'fx-quake-2')
    void (el as HTMLElement).offsetWidth
    el.classList.add(cls)
    setTimeout(() => el.classList.remove(cls), ms)
  })
}

export function slamSpell(card: CardView, landDelayMs = 320): SpellWeight {
  const weight = spellWeight(card)
  if (weight === 0) return 0
  const delay = fxMotionDuration(landDelayMs)
  if (!delay) return weight
  setTimeout(() => {
    const fx = spawnImpact('slam', null, { colors: cardManaColors(card), weight })
    if (!fx) return
    quakeBoard(weight, Math.round(fx.duration * 0.6))
    soundManager.play(weight === 2 ? 'impact_epic' : 'impact_heavy', 'game')
  }, delay)
  return weight
}

/** A planeswalker ultimate: a purple shockwave from the planeswalker, the board shakes and the epic impact plays. */
export function slamUltimate(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> | null): ImpactFx | null {
  const fx = spawnImpact('ultimate', rect)
  if (!fx) return null
  quakeBoard(2, Math.round(fx.duration * 0.45))
  soundManager.play('impact_epic', 'game')
  return fx
}

/** Fractions of a board wipe's run: the wave enters the board's left edge at LEAD and leaves its right edge at LEAD + SPAN. */
export const WIPE_WAVE_LEAD = 0.14
export const WIPE_WAVE_SPAN = 0.56

/** A board wipe: one wave of light sweeps the board while it shakes, before the deaths it carries. */
export function slamBoardWipe(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> | null): ImpactFx | null {
  const fx = spawnImpact('wipe', rect)
  if (!fx) return null
  setTimeout(() => quakeBoard(2, Math.round(fx.duration * 0.55)), Math.round(fx.duration * WIPE_WAVE_LEAD))
  soundManager.play('impact_epic', 'game')
  return fx
}

/** Ten poison counters: a toxic cloud bursts over the player's seat, which shakes. */
export function slamLethalPoison(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> | null): ImpactFx | null {
  const fx = spawnImpact('poison-lethal', rect)
  if (!fx) return null
  quakeBoard(1, Math.round(fx.duration * 0.35))
  soundManager.play('impact_heavy', 'game')
  return fx
}

export function particleVectors(seed: number, count: number, spread: number): Array<{ dx: number; dy: number; delay: number; size: number }> {
  let s = (seed * 9301 + 49297) % 233280
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (rnd() - 0.5) * 0.9
    const dist = spread * (0.55 + rnd() * 0.6)
    return {
      dx: Math.round(Math.cos(angle) * dist),
      dy: Math.round(Math.sin(angle) * dist),
      delay: Math.round(rnd() * 90),
      size: 0.6 + rnd() * 0.8,
    }
  })
}
