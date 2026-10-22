import { afterEach, describe, expect, it, vi } from 'vitest'
import { getState } from './state'
import { setSetting } from './store'
import { watchAppearanceStorage } from './actions'
import { DEFAULT_AUDIO_SETTINGS } from './persistence'

const AUDIO_KEY = 'mage-web-audio'

function stubStorage() {
  const memory: Record<string, string> = {}
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => memory[key] ?? null,
    setItem: (key: string, value: string) => { memory[key] = value },
    removeItem: (key: string) => { delete memory[key] },
    clear: () => { for (const k of Object.keys(memory)) delete memory[k] },
    key: (index: number) => Object.keys(memory)[index] ?? null,
    get length() { return Object.keys(memory).length },
  })
  return memory
}

describe('settings persistence across tabs', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    setSetting('soundEnabled', true)
    setSetting('uiScale', 1)
  })

  it('a tab that still holds an old mute does not write it back when it changes an unrelated setting', () => {
    stubStorage()
    setSetting('soundEnabled', true)
    localStorage.setItem(AUDIO_KEY, JSON.stringify({ ...DEFAULT_AUDIO_SETTINGS, soundEnabled: false }))
    setSetting('uiScale', 1.1)
    expect(JSON.parse(localStorage.getItem(AUDIO_KEY) ?? '{}')).toMatchObject({ soundEnabled: false })
  })

  it('a storage event for the audio key updates the in-memory audio settings', () => {
    stubStorage()
    const stop = watchAppearanceStorage()
    try {
      setSetting('soundEnabled', true)
      localStorage.setItem(AUDIO_KEY, JSON.stringify({ ...DEFAULT_AUDIO_SETTINGS, soundEnabled: false, masterVolume: 0.3 }))
      window.dispatchEvent(new StorageEvent('storage', { key: AUDIO_KEY }))
      expect(getState().settings.soundEnabled).toBe(false)
      expect(getState().settings.masterVolume).toBe(0.3)
    } finally {
      stop()
    }
  })

  it('a storage event for another settings key updates that group only', () => {
    stubStorage()
    const stop = watchAppearanceStorage()
    try {
      setSetting('smartStops', false)
      localStorage.setItem('mage-web-smart-stops', 'true')
      window.dispatchEvent(new StorageEvent('storage', { key: 'mage-web-smart-stops' }))
      expect(getState().settings.smartStops).toBe(true)
      expect(getState().settings.soundEnabled).toBe(true)
    } finally {
      stop()
    }
  })

  it('a storage event for an unrelated key is ignored', () => {
    stubStorage()
    const stop = watchAppearanceStorage()
    try {
      setSetting('smartStops', false)
      localStorage.setItem('mage-web-smart-stops', 'true')
      window.dispatchEvent(new StorageEvent('storage', { key: 'mage-web-unrelated' }))
      expect(getState().settings.smartStops).toBe(false)
    } finally {
      stop()
    }
  })
})
