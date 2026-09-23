import { useSyncExternalStore } from 'react'
import type { CardView } from '../net/types'
import { fxDuration } from './fx'
import { isAbilityCard } from '../cards/cardImages'
import { soundManager } from '../audio/soundManager'

export type ManaColor = 'w' | 'u' | 'b' | 'r' | 'g'
export type SpellWeight = 0 | 1 | 2
export type ImpactKind = 'slam' | 'sparks' | 'destroy' | 'exile' | 'token-pop' | 'token-fade'

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
const MAX_IMPACTS = 12

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

const BASE_MS: Record<ImpactKind, number> = {
  slam: 900,
  sparks: 620,
  destroy: 900,
  exile: 1000,
  'token-pop': 650,
  'token-fade': 700,
}

export function spawnImpact(
  kind: ImpactKind,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> | null,
  opts: { colors?: ManaColor[]; weight?: SpellWeight } = {},
): ImpactFx | null {
  const duration = fxDuration(BASE_MS[kind] * (kind === 'slam' && opts.weight === 2 ? 1.35 : 1))
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
  const delay = fxDuration(landDelayMs)
  if (!delay) return weight
  setTimeout(() => {
    const fx = spawnImpact('slam', null, { colors: cardManaColors(card), weight })
    if (!fx) return
    quakeBoard(weight, Math.round(fx.duration * 0.6))
    soundManager.play(weight === 2 ? 'impact_epic' : 'impact_heavy', 'game')
  }, delay)
  return weight
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
