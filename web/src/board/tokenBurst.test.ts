import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { spawnTokenBurst, TOKEN_BURST_DOTS } from './tokenBurst'
import { getState, setState } from '../state/state'

const RECT = { left: 100, top: 200, width: 60, height: 80 }

function setEffects(effects: boolean) {
  setState({ settings: { ...getState().settings, effects } })
}

describe('spawnTokenBurst', () => {
  beforeEach(() => {
    setEffects(true)
    document.body.innerHTML = ''
  })

  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia
    document.body.innerHTML = ''
    vi.useRealTimers()
  })

  it('spawns one dot per slot in the token color, centred on the token', () => {
    spawnTokenBurst(RECT, 'g')
    const dots = document.querySelectorAll<HTMLElement>('.token-burst-dot')
    expect(dots.length).toBe(TOKEN_BURST_DOTS)
    expect(dots[0].classList.contains('token-burst-dot--g')).toBe(true)
    expect(dots[0].style.left).toBe('130px')
    expect(dots[0].style.top).toBe('240px')
  })

  it('uses the colorless dot for a token with no colour', () => {
    spawnTokenBurst(RECT, null)
    expect(document.querySelector('.token-burst-dot--c')).not.toBeNull()
  })

  it('removes its dots when they finish', () => {
    spawnTokenBurst(RECT, 'u')
    document.querySelectorAll<HTMLElement>('.token-burst-dot').forEach((d) => d.dispatchEvent(new Event('animationend')))
    expect(document.querySelectorAll('.token-burst-dot').length).toBe(0)
  })

  it('spawns nothing while effects are off', () => {
    setEffects(false)
    spawnTokenBurst(RECT, 'r')
    expect(document.querySelectorAll('.token-burst-dot').length).toBe(0)
  })

  it('spawns nothing for a zero-size token', () => {
    spawnTokenBurst({ left: 0, top: 0, width: 0, height: 0 }, 'w')
    expect(document.querySelectorAll('.token-burst-dot').length).toBe(0)
  })
})
