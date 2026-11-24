import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import SoundFxControls from './SoundFxControls'
import { setSetting } from '../state/store'

afterEach(() => {
  cleanup()
  setSetting('soundEnabled', true)
  setSetting('musicEnabled', true)
})

function isDisabled(container: HTMLElement, settingId: string): boolean {
  const control = container.querySelector<HTMLInputElement | HTMLButtonElement>(
    `[data-setting="${settingId}"] .settings-row-control input, [data-setting="${settingId}"] .settings-row-control button`,
  )
  if (!control) throw new Error(`no control for ${settingId}`)
  return control.disabled
}

describe('SoundFxControls', () => {
  it('SET-12: turning sound effects off leaves the music and the master volume adjustable', () => {
    setSetting('soundEnabled', false)
    setSetting('musicEnabled', true)
    const { container } = render(<SoundFxControls />)
    expect(isDisabled(container, 'music-enabled')).toBe(false)
    expect(isDisabled(container, 'music-volume')).toBe(false)
    expect(isDisabled(container, 'volume-master')).toBe(false)
    expect(isDisabled(container, 'volume-sfx')).toBe(true)
    expect(isDisabled(container, 'volume-ui')).toBe(true)
  })

  it('SET-14: the priority cue offers the four modes, each with its own label', () => {
    const { container } = render(<SoundFxControls />)
    const labels = [...container.querySelectorAll('[data-setting="priority-sound"] .settings-row-control button')]
      .map((b) => b.textContent?.trim() ?? '')
    expect(labels).toHaveLength(4)
    expect(new Set(labels).size).toBe(4)
    expect(labels.every((l) => l.length > 0)).toBe(true)
  })

  it('SET-12: the music volume follows the music switch only', () => {
    setSetting('soundEnabled', true)
    setSetting('musicEnabled', false)
    const { container } = render(<SoundFxControls />)
    expect(isDisabled(container, 'music-volume')).toBe(true)
    expect(isDisabled(container, 'volume-sfx')).toBe(false)
  })
})
