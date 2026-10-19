import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manaPoolElement, spawnManaParticle, MANA_PARTICLE_MS, MANA_POOL_LAND_CLASS } from './manaParticle'
import { getState, setState } from '../state/state'

const FROM = { left: 100, top: 200, width: 40, height: 60 } as DOMRect
const TO = { left: 300, top: 40, width: 80, height: 20 } as DOMRect

function setEffects(effects: boolean) {
  setState({ settings: { ...getState().settings, effects } })
}

function makePool(): HTMLElement {
  const pool = document.createElement('div')
  pool.className = 'resource-mana-wrap'
  pool.getBoundingClientRect = () => TO
  document.body.appendChild(pool)
  return pool
}

describe('spawnManaParticle', () => {
  beforeEach(() => {
    setEffects(true)
    document.body.innerHTML = ''
  })

  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia
    document.body.innerHTML = ''
  })

  it('appends a particle in the land color, flying from the land to the pool', () => {
    spawnManaParticle(FROM, makePool(), 'G')
    const particle = document.querySelector<HTMLElement>('.mana-particle')
    expect(particle).not.toBeNull()
    expect(particle?.classList.contains('mana-particle--G')).toBe(true)
    expect(particle?.style.left).toBe('120px')
    expect(particle?.style.top).toBe('230px')
    expect(particle?.style.getPropertyValue('--particle-dx')).toBe('220px')
    expect(particle?.style.getPropertyValue('--particle-dy')).toBe('-180px')
    expect(particle?.style.getPropertyValue('--particle-ms')).toBe(`${MANA_PARTICLE_MS}ms`)
  })

  it('removes the particle and pulses the pool when the particle lands', () => {
    vi.useFakeTimers()
    const pool = makePool()
    spawnManaParticle(FROM, pool, 'U')
    expect(document.querySelector('.mana-particle')).not.toBeNull()
    vi.runOnlyPendingTimers()
    expect(document.querySelector('.mana-particle')).toBeNull()
    expect(pool.classList.contains(MANA_POOL_LAND_CLASS)).toBe(true)
    pool.dispatchEvent(new Event('animationend'))
    expect(pool.classList.contains(MANA_POOL_LAND_CLASS)).toBe(false)
    vi.useRealTimers()
  })

  it('spawns nothing while effects are off', () => {
    setEffects(false)
    spawnManaParticle(FROM, makePool(), 'R')
    expect(document.querySelector('.mana-particle')).toBeNull()
  })

  it('spawns nothing under reduced motion', () => {
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
    spawnManaParticle(FROM, makePool(), 'W')
    expect(document.querySelector('.mana-particle')).toBeNull()
  })
})

describe('manaPoolElement', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('returns null when the pool is not on screen', () => {
    expect(manaPoolElement('my')).toBeNull()
  })

  it('finds the controller pool the v2 layout renders outside the resource bar', () => {
    const pool = document.createElement('div')
    pool.className = 'resource-bar-pool'
    pool.dataset.side = 'my'
    pool.getBoundingClientRect = () => TO
    document.body.appendChild(pool)
    expect(manaPoolElement('my')).toBe(pool)
  })
})
