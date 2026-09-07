import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearActiveGame,
  loadActiveGame,
  loadConn,
  loadFxSettings,
  saveActiveGame,
  saveConn,
  saveFxSettings,
  loadAudioSettings,
  saveAudioSettings,
  loadPhaseStops,
  savePhaseStops,
  DEFAULT_AUDIO_SETTINGS,
  type ConnectionInfo,
  type FxSettings,
  type AudioSettings,
} from './persistence'

describe('persistence', () => {
  const mockStorage: Record<string, string> = {}

  beforeEach(() => {
    for (const k of Object.keys(mockStorage)) {
      delete mockStorage[k]
    }
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value
      },
      removeItem: (key: string) => {
        delete mockStorage[key]
      },
      clear: () => {
        for (const k of Object.keys(mockStorage)) {
          delete mockStorage[k]
        }
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('connection info', () => {
    it('returns null when nothing is stored', () => {
      expect(loadConn()).toBeNull()
    })

    it('saves and loads connection info correctly', () => {
      const conn: ConnectionInfo = {
        wsHost: '127.0.0.1',
        proxyPort: 8787,
        serverHost: 'beta.xmage.today',
        port: 17171,
        username: 'alice',
        password: 'secret',
      }
      saveConn(conn)
      expect(loadConn()).toEqual(conn)
    })

    it('removes connection info when saving null', () => {
      saveConn({
        wsHost: 'localhost',
        proxyPort: 8787,
        serverHost: 'localhost',
        port: 17171,
        username: 'bob',
        password: '',
      })
      expect(loadConn()).not.toBeNull()
      saveConn(null)
      expect(loadConn()).toBeNull()
    })

    it('migrates legacy format with single host property', () => {
      mockStorage['mage-web-conn'] = JSON.stringify({
        host: 'beta.xmage.today',
        port: 17171,
        username: 'legacy_user',
        password: '',
      })
      const loaded = loadConn()
      expect(loaded).toEqual({
        wsHost: 'beta.xmage.today',
        proxyPort: 8787,
        serverHost: 'beta.xmage.today',
        port: 17171,
        username: 'legacy_user',
        password: '',
      })
    })
  })

  describe('active game persistence', () => {
    it('returns null when no active game is saved', () => {
      expect(loadActiveGame()).toBeNull()
    })

    it('saves and loads active game data', () => {
      saveActiveGame('game-uuid-123', 'table-uuid-456')
      const active = loadActiveGame()
      expect(active).not.toBeNull()
      expect(active?.gameId).toBe('game-uuid-123')
      expect(active?.tableId).toBe('table-uuid-456')
      expect(active?.role).toBe('player')
      expect(typeof active?.savedAt).toBe('number')
    })

    it('saves and loads active game with watcher role', () => {
      saveActiveGame('watch-123', undefined, 'watcher')
      const active = loadActiveGame()
      expect(active?.gameId).toBe('watch-123')
      expect(active?.role).toBe('watcher')
    })

    it('clears active game when clearActiveGame() is called', () => {
      saveActiveGame('game-uuid-123')
      expect(loadActiveGame()).not.toBeNull()
      clearActiveGame()
      expect(loadActiveGame()).toBeNull()
    })

    it('clears active game when passing null to saveActiveGame()', () => {
      saveActiveGame('game-uuid-123')
      expect(loadActiveGame()).not.toBeNull()
      saveActiveGame(null)
      expect(loadActiveGame()).toBeNull()
    })

    it('expires and clears games older than 3 hours', () => {
      const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000
      mockStorage['mage-web-active-game'] = JSON.stringify({
        gameId: 'old-game-123',
        tableId: null,
        savedAt: fourHoursAgo,
      })

      expect(loadActiveGame()).toBeNull()
      expect(mockStorage['mage-web-active-game']).toBeUndefined()
    })
  })

  describe('fx settings persistence', () => {
    it('returns defaults when nothing is stored', () => {
      expect(loadFxSettings()).toEqual({ effects: true, animationSpeed: 1 })
    })

    it('saves and loads fx settings correctly', () => {
      const fx: FxSettings = { effects: false, animationSpeed: 1.5 }
      saveFxSettings(fx)
      expect(loadFxSettings()).toEqual(fx)
    })

    it('rejects an unknown animation speed', () => {
      mockStorage['mage-web-settings'] = JSON.stringify({ effects: true, animationSpeed: 7 })
      expect(loadFxSettings()).toEqual({ effects: true, animationSpeed: 1 })
    })

    it('falls back to defaults for corrupt payloads', () => {
      mockStorage['mage-web-settings'] = '{not json'
      expect(loadFxSettings()).toEqual({ effects: true, animationSpeed: 1 })
    })
  })

  describe('audio settings persistence', () => {
    it('returns defaults when nothing is stored', () => {
      expect(loadAudioSettings()).toEqual(DEFAULT_AUDIO_SETTINGS)
    })

    it('saves and loads audio settings correctly', () => {
      const audio: AudioSettings = {
        soundEnabled: false,
        masterVolume: 0.5,
        sfxVolume: 0.6,
        uiVolume: 0.4,
      }
      saveAudioSettings(audio)
      expect(loadAudioSettings()).toEqual(audio)
    })

    it('clamps out-of-range volume values', () => {
      mockStorage['mage-web-audio'] = JSON.stringify({
        soundEnabled: true,
        masterVolume: 2.5,
        sfxVolume: -0.5,
        uiVolume: 0.8,
      })
      expect(loadAudioSettings()).toEqual({
        soundEnabled: true,
        masterVolume: 1,
        sfxVolume: 0,
        uiVolume: 0.8,
      })
    })

    it('falls back to defaults for corrupt payloads', () => {
      mockStorage['mage-web-audio'] = '{invalid json'
      expect(loadAudioSettings()).toEqual(DEFAULT_AUDIO_SETTINGS)
    })
  })

  describe('phase stops persistence', () => {
    it('returns all-true defaults when nothing is stored', () => {
      const stops = loadPhaseStops()
      for (const turn of ['yourTurn', 'opponentTurn'] as const) {
        for (const key of ['upkeep', 'draw', 'main1', 'beginCombat', 'endCombat', 'main2', 'endStep']) {
          expect(stops[turn][key]).toBe(true)
        }
      }
    })

    it('saves and loads phase stops correctly', () => {
      const stops = loadPhaseStops()
      stops.yourTurn.main1 = false
      stops.opponentTurn.endStep = false
      savePhaseStops(stops)
      expect(loadPhaseStops()).toEqual(stops)
    })

    it('merges partial payloads over the defaults', () => {
      mockStorage['mage-web-phase-stops'] = JSON.stringify({ yourTurn: { main1: false } })
      const stops = loadPhaseStops()
      expect(stops.yourTurn.main1).toBe(false)
      expect(stops.yourTurn.upkeep).toBe(true)
      expect(stops.opponentTurn.main1).toBe(true)
    })

    it('falls back to defaults for corrupt payloads', () => {
      mockStorage['mage-web-phase-stops'] = '{invalid json'
      expect(loadPhaseStops()).toEqual(loadPhaseStops())
      expect(loadPhaseStops().yourTurn.upkeep).toBe(true)
    })
  })
})
