import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearProjectiles, getProjectiles, projectileFlightMs, spawnProjectile } from './projectileFx'
import { soundManager } from '../audio/soundManager'

const rect = (left: number, top: number, width = 80, height = 112): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => {} } as DOMRect)

describe('projectileFlightMs', () => {
  it('grows with distance and stays within bounds', () => {
    expect(projectileFlightMs(0)).toBe(260)
    expect(projectileFlightMs(400)).toBeGreaterThan(projectileFlightMs(100))
    expect(projectileFlightMs(10_000)).toBe(480)
  })
})

describe('spawnProjectile', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clearProjectiles()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('launches from the source centre and records the target measured at launch', () => {
    const ms = spawnProjectile(rect(0, 0), () => rect(300, 0), ['r'])
    const [p] = getProjectiles()
    expect(ms).toBe(p.duration)
    expect(p.from).toEqual({ x: 40, y: 56 })
    expect(p.to0).toEqual({ x: 340, y: 56 })
    expect(p.colors).toEqual(['r'])
  })

  it('launches nothing when the target is not on screen', () => {
    expect(spawnProjectile(rect(0, 0), () => null)).toBe(0)
    expect(getProjectiles()).toHaveLength(0)
  })

  it('does not launch a second identical projectile while the first is in flight', () => {
    const first = spawnProjectile(rect(0, 0), () => rect(300, 0))
    const second = spawnProjectile(rect(0, 0), () => rect(300, 0))
    expect(second).toBe(first)
    expect(getProjectiles()).toHaveLength(1)
  })

  it('calls onLand exactly when the projectile arrives', () => {
    const onLand = vi.fn()
    const ms = spawnProjectile(rect(0, 0), () => rect(300, 0), [], onLand)
    vi.advanceTimersByTime(ms - 1)
    expect(onLand).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onLand).toHaveBeenCalledTimes(1)
  })

  it('plays the launch sound on launch and the impact sound on landing, not on a duplicate', () => {
    const play = vi.spyOn(soundManager, 'play').mockImplementation(() => {})
    const ms = spawnProjectile(rect(0, 0), () => rect(300, 0))
    spawnProjectile(rect(0, 0), () => rect(300, 0))
    expect(play.mock.calls).toEqual([['projectile_launch', 'game']])
    vi.advanceTimersByTime(ms)
    expect(play.mock.calls).toEqual([['projectile_launch', 'game'], ['projectile_impact', 'game']])
    play.mockRestore()
  })

  it('removes the projectile once it has landed', () => {
    const ms = spawnProjectile(rect(0, 0), () => rect(300, 0))
    expect(getProjectiles()).toHaveLength(1)
    vi.advanceTimersByTime(ms)
    expect(getProjectiles()).toHaveLength(0)
  })
})
