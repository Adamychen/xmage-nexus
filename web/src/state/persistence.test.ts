import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearActiveDraft,
  clearActiveGame,
  clearActiveConstruct,
  loadActiveConstruct,
  saveActiveConstruct,
  saveConstructSelection,
  loadConstructSelection,
  loadActiveDraft,
  loadActiveGame,
  loadConn,
  loadAppearanceSettings,
  saveAppearanceSettings,
  DEFAULT_APPEARANCE,
  loadFxSettings,
  saveActiveDraft,
  saveActiveGame,
  saveConn,
  saveFxSettings,
  loadAudioSettings,
  loadMusicSettings,
  saveMusicSettings,
  DEFAULT_MUSIC_SETTINGS,
  saveAudioSettings,
  loadPhaseStops,
  savePhaseStops,
  loadGameplayPreset,
  saveGameplayPreset,
  loadDeckStacksScale,
  saveDeckStacksScale,
  DECK_STACKS_SCALE_KEY,
  saveResumeToken,
  loadResumeToken,
  clearResumeToken,
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

    it('follows the build quick tunnel when the saved one is a different tunnel', () => {
      vi.stubEnv('VITE_DEFAULT_PROXY_HOST', 'wss://live-tunnel.trycloudflare.com')
      try {
        saveConn({
          wsHost: 'wss://dead-tunnel.trycloudflare.com',
          proxyPort: 443,
          serverHost: 'beta.xmage.today',
          port: 17171,
          username: 'alice',
          password: '',
          flagName: 'es',
        })
        expect(loadConn()).toMatchObject({
          wsHost: 'wss://live-tunnel.trycloudflare.com',
          serverHost: 'beta.xmage.today',
          username: 'alice',
          flagName: 'es',
        })
        expect(JSON.parse(mockStorage['mage-web-conn']).wsHost).toBe('wss://live-tunnel.trycloudflare.com')
      } finally {
        vi.unstubAllEnvs()
      }
    })

    it('keeps a saved host that is not a quick tunnel', () => {
      vi.stubEnv('VITE_DEFAULT_PROXY_HOST', 'wss://live-tunnel.trycloudflare.com')
      try {
        saveConn({
          wsHost: 'wss://my-own-proxy.example.org',
          proxyPort: 443,
          serverHost: 'beta.xmage.today',
          port: 17171,
          username: 'alice',
          password: '',
        })
        expect(loadConn()?.wsHost).toBe('wss://my-own-proxy.example.org')
      } finally {
        vi.unstubAllEnvs()
      }
    })

    it('keeps a saved tunnel when the build default is not a quick tunnel', () => {
      vi.stubEnv('VITE_DEFAULT_PROXY_HOST', 'wss://my-own-proxy.example.org')
      try {
        saveConn({
          wsHost: 'wss://dead-tunnel.trycloudflare.com',
          proxyPort: 443,
          serverHost: 'beta.xmage.today',
          port: 17171,
          username: 'alice',
          password: '',
        })
        expect(loadConn()?.wsHost).toBe('wss://dead-tunnel.trycloudflare.com')
      } finally {
        vi.unstubAllEnvs()
      }
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

  describe('active draft persistence', () => {
    const draft = (id: string) => ({ draftId: id, message: { draftView: { boosterNum: 1 } } }) as never

    it('returns null when no draft is saved', () => {
      expect(loadActiveDraft()).toBeNull()
    })

    it('saves and loads the draft snapshot with its tournament id', () => {
      saveActiveDraft(draft('draft-uuid-123'), 'tournament-uuid-456')
      const active = loadActiveDraft()
      expect(active?.draft.draftId).toBe('draft-uuid-123')
      expect(active?.draft.message).toEqual({ draftView: { boosterNum: 1 } })
      expect(active?.tournamentId).toBe('tournament-uuid-456')
      expect(typeof active?.savedAt).toBe('number')
    })

    it('never stores the synthetic "draft" fallback id', () => {
      saveActiveDraft(draft('draft'))
      expect(loadActiveDraft()).toBeNull()
      expect(mockStorage['mage-web-active-draft']).toBeUndefined()
    })

    it('ignores corrupt snapshots', () => {
      mockStorage['mage-web-active-draft'] = JSON.stringify({ draft: { draftId: 'd1' }, savedAt: Date.now() })
      expect(loadActiveDraft()).toBeNull()
    })

    it('clears the draft when clearActiveDraft() is called', () => {
      saveActiveDraft(draft('draft-uuid-123'))
      expect(loadActiveDraft()).not.toBeNull()
      clearActiveDraft()
      expect(loadActiveDraft()).toBeNull()
    })

    it('clears the draft when passing null to saveActiveDraft()', () => {
      saveActiveDraft(draft('draft-uuid-123'))
      saveActiveDraft(null)
      expect(loadActiveDraft()).toBeNull()
    })

    it('expires and clears drafts older than 3 hours', () => {
      const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000
      mockStorage['mage-web-active-draft'] = JSON.stringify({
        draft: draft('old-draft-123'),
        tournamentId: null,
        savedAt: fourHoursAgo,
      })

      expect(loadActiveDraft()).toBeNull()
      expect(mockStorage['mage-web-active-draft']).toBeUndefined()
    })

    describe('pick timer', () => {
      const pickSnapshot = (timeout: number, picking = true) =>
        ({ draftId: 'draft-uuid-123', message: { draftView: { boosterNum: 1 }, draftPickView: { booster: {}, picks: {}, picking, timeout } } }) as never

      afterEach(() => {
        vi.useRealTimers()
      })

      it('restores the pick timeout minus the time elapsed since the snapshot was saved', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-17T10:00:00Z'))
        saveActiveDraft(pickSnapshot(60))
        vi.setSystemTime(new Date('2026-10-17T10:00:20Z'))
        expect(loadActiveDraft()?.draft.message.draftPickView?.timeout).toBe(40)
      })

      it('never restores a negative pick timeout', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-17T10:00:00Z'))
        saveActiveDraft(pickSnapshot(60))
        vi.setSystemTime(new Date('2026-10-17T10:01:30Z'))
        expect(loadActiveDraft()?.draft.message.draftPickView?.timeout).toBe(0)
      })

      it('leaves the timeout of a snapshot that is not picking untouched', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-17T10:00:00Z'))
        saveActiveDraft(pickSnapshot(0, false))
        vi.setSystemTime(new Date('2026-10-17T10:00:20Z'))
        expect(loadActiveDraft()?.draft.message.draftPickView?.timeout).toBe(0)
      })
    })
  })

  describe('active construct persistence', () => {
    const construct = {
      deckName: 'Draft Pool',
      pool: { 'c-1': { id: 'c-1', name: 'Forest' } },
      tableId: 'table-1',
      parentTableId: null,
      timeLeft: 600,
    }

    afterEach(() => {
      vi.useRealTimers()
    })

    it('restores the pending construct with the time left since it was saved', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-17T10:00:00Z'))
      saveActiveConstruct(construct)
      vi.setSystemTime(new Date('2026-10-17T10:02:00Z'))
      expect(loadActiveConstruct()).toMatchObject({ tableId: 'table-1', deckName: 'Draft Pool', timeLeft: 480 })
    })

    it('discards a construct whose timer already ran out', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-17T10:00:00Z'))
      saveActiveConstruct(construct)
      vi.setSystemTime(new Date('2026-10-17T10:11:00Z'))
      expect(loadActiveConstruct()).toBeNull()
      expect(localStorage.getItem('mage-web-active-construct')).toBeNull()
    })

    it('discards a construct saved more than an hour ago', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-10-17T10:00:00Z'))
      saveActiveConstruct({ ...construct, timeLeft: 100000 })
      vi.setSystemTime(new Date('2026-10-17T11:00:01Z'))
      expect(loadActiveConstruct()).toBeNull()
    })

    it('clears a snapshot without a table id instead of restoring it', () => {
      localStorage.setItem('mage-web-active-construct', JSON.stringify({ construct: { ...construct, tableId: '' }, savedAt: Date.now() }))
      expect(loadActiveConstruct()).toBeNull()
      expect(localStorage.getItem('mage-web-active-construct')).toBeNull()
    })

    it('saving null or clearing removes the snapshot', () => {
      saveActiveConstruct(construct)
      saveActiveConstruct(null)
      expect(loadActiveConstruct()).toBeNull()
      saveActiveConstruct(construct)
      clearActiveConstruct()
      expect(loadActiveConstruct()).toBeNull()
    })

    describe('construct selection', () => {
      const selection = {
        main: [{ cardName: 'Forest', setCode: 'DMU', cardNumber: '277', amount: 3 }],
        pool: [{ cardName: 'Pool Card 100', setCode: 'M21', cardNumber: '101', amount: 1 }],
      }

      it('restores the saved selection for the same construct table', () => {
        saveConstructSelection('table-1', selection)
        expect(loadConstructSelection('table-1')).toEqual(selection)
      })

      it('returns nothing for a different construct table', () => {
        saveConstructSelection('table-1', selection)
        expect(loadConstructSelection('table-2')).toBeNull()
        expect(loadConstructSelection('')).toBeNull()
      })

      it('returns nothing when no selection was saved', () => {
        expect(loadConstructSelection('table-1')).toBeNull()
      })

      it('drops malformed entries instead of restoring them', () => {
        localStorage.setItem('mage-web-construct-selection', JSON.stringify({
          tableId: 'table-1',
          main: [
            { cardName: 'Forest', setCode: 'DMU', cardNumber: '277', amount: 2 },
            { cardName: 'Broken', setCode: 'DMU', cardNumber: '1', amount: 0 },
            { cardName: 42, setCode: 'DMU', cardNumber: '1', amount: 1 },
            null,
          ],
          pool: 'nope',
        }))
        expect(loadConstructSelection('table-1')).toEqual({
          main: [{ cardName: 'Forest', setCode: 'DMU', cardNumber: '277', amount: 2 }],
          pool: [],
        })
      })

      it('is removed together with the construct snapshot', () => {
        saveActiveConstruct(construct)
        saveConstructSelection('table-1', selection)
        clearActiveConstruct()
        expect(loadConstructSelection('table-1')).toBeNull()
        expect(localStorage.getItem('mage-web-construct-selection')).toBeNull()
      })

      it('is removed when the construct timer ran out', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-17T10:00:00Z'))
        saveActiveConstruct(construct)
        saveConstructSelection('table-1', selection)
        vi.setSystemTime(new Date('2026-10-17T10:11:00Z'))
        expect(loadActiveConstruct()).toBeNull()
        expect(loadConstructSelection('table-1')).toBeNull()
      })
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

  describe('appearance settings: card overlay flags', () => {
    // The link that breaks silently: a mistyped key in
    // `loadAppearanceSettings` would make a saved setting be ignored with no
    // error. These cases pin that it is read and that it is normalized.
    it('reads the three overlay flags a player turned off', () => {
      mockStorage['mage-web-appearance'] = JSON.stringify({
        sleeveId: 'classic', boardLayout: 'standard', uiScale: 1, cjkBoost: true,
        showHandCost: false, ptBadgeMode: 'changed', sicknessStyle: 'veil', keywordIcons: 'outline', keywordAura: 'vivid',
      })
      const loaded = loadAppearanceSettings()
      expect(loaded.showHandCost).toBe(false)
      expect(loaded.ptBadgeMode).toBe('changed')
      expect(loaded.sicknessStyle).toBe('veil')
      expect(loaded.keywordIcons).toBe('outline')
      expect(loaded.keywordAura).toBe('vivid')
    })

    it('falls back to today\'s behaviour for a blob written before the flags existed', () => {
      mockStorage['mage-web-appearance'] = JSON.stringify({
        sleeveId: 'classic', boardLayout: 'pod', uiScale: 1.2, cjkBoost: false,
      })
      const loaded = loadAppearanceSettings()
      expect(loaded.showHandCost).toBe(true)
      expect(loaded.ptBadgeMode).toBe('always')
      expect(loaded.sicknessStyle).toBe('badge')
      expect(loaded.keywordIcons).toBe('coins')
      expect(loaded.keywordAura).toBe('subtle')
    })

    it('normalizes a hand-edited or corrupt value instead of leaking it into the UI', () => {
      mockStorage['mage-web-appearance'] = JSON.stringify({
        sleeveId: 'classic', boardLayout: 'standard', uiScale: 1, cjkBoost: true,
        showHandCost: 'false', ptBadgeMode: 'sometimes', sicknessStyle: 'hourglass', keywordIcons: 'emoji', keywordAura: 'loud',
      })
      const loaded = loadAppearanceSettings()
      expect(loaded.showHandCost).toBe(true)
      expect(loaded.ptBadgeMode).toBe('always')
      expect(loaded.sicknessStyle).toBe('badge')
      expect(loaded.keywordIcons).toBe('coins')
      expect(loaded.keywordAura).toBe('subtle')
    })
  })

  describe('card preview size persistence', () => {
    it('SET-1: cardPreviewScale defaults to 100% and survives a save and load', () => {
      expect(DEFAULT_APPEARANCE.cardPreviewScale).toBe(1)
      expect(loadAppearanceSettings().cardPreviewScale).toBe(1)
      saveAppearanceSettings({ ...DEFAULT_APPEARANCE, cardPreviewScale: 1.65 })
      expect(loadAppearanceSettings().cardPreviewScale).toBe(1.65)
    })

    it.each([
      [5, 2],
      [0.1, 0.75],
      [-3, 0.75],
      [1.234, 1.25],
      ['1.5', 1],
      [null, 1],
      [Number.NaN, 1],
      [{}, 1],
    ])('SET-1: a stored cardPreviewScale of %j loads as %s', (stored, expected) => {
      mockStorage['mage-web-appearance'] = JSON.stringify({ sleeveId: 'classic', boardLayout: 'standard', uiScale: 1, cjkBoost: true, cardPreviewScale: stored })
      expect(loadAppearanceSettings().cardPreviewScale).toBe(expected)
    })
  })

  describe('board spotlight settings persistence', () => {
    it('BRD-6, BRD-13: appearance settings keep boardSpotlight and boardSpotlightPanel across a save and load', () => {
      expect(DEFAULT_APPEARANCE.boardSpotlight).toBe(false)
      expect(DEFAULT_APPEARANCE.boardSpotlightPanel).toBe(22)
      saveAppearanceSettings({ ...DEFAULT_APPEARANCE, boardSpotlight: true, boardSpotlightPanel: 31 })
      const loaded = loadAppearanceSettings()
      expect(loaded.boardSpotlight).toBe(true)
      expect(loaded.boardSpotlightPanel).toBe(31)
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
        prioritySound: 'on-gain',
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
        prioritySound: 'every-prompt',
      })
    })

    it('falls back to defaults for corrupt payloads', () => {
      mockStorage['mage-web-audio'] = '{invalid json'
      expect(loadAudioSettings()).toEqual(DEFAULT_AUDIO_SETTINGS)
    })
  })

  describe('music settings persistence', () => {
    it('defaults to adaptive music on at a modest volume', () => {
      expect(loadMusicSettings()).toEqual(DEFAULT_MUSIC_SETTINGS)
      expect(DEFAULT_MUSIC_SETTINGS.musicEnabled).toBe(true)
    })

    it('round-trips and clamps the music volume', () => {
      saveMusicSettings({ musicEnabled: false, musicVolume: 0.6 })
      expect(loadMusicSettings()).toEqual({ musicEnabled: false, musicVolume: 0.6 })
      mockStorage['mage-web-music'] = JSON.stringify({ musicEnabled: true, musicVolume: 3 })
      expect(loadMusicSettings().musicVolume).toBe(1)
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

  describe('gameplay preset persistence', () => {
    it('returns null when nothing is stored', () => {
      expect(loadGameplayPreset()).toBeNull()
    })

    it('saves and loads the selected preset', () => {
      saveGameplayPreset('simple')
      expect(loadGameplayPreset()).toBe('simple')
      expect(mockStorage['mage-web-gameplay-preset']).toBe('simple')
    })

    it('clears the selection when saved as null', () => {
      saveGameplayPreset('balanced')
      saveGameplayPreset(null)
      expect(loadGameplayPreset()).toBeNull()
      expect(mockStorage['mage-web-gameplay-preset']).toBeUndefined()
    })
  })

  describe('deck stacks scale persistence', () => {
    it('DCK-1: defaults to 100% when nothing is stored', () => {
      expect(loadDeckStacksScale()).toBe(100)
    })

    it('DCK-1: keeps the stacks card size across a save and load', () => {
      saveDeckStacksScale(170)
      expect(mockStorage[DECK_STACKS_SCALE_KEY]).toBe('170')
      expect(loadDeckStacksScale()).toBe(170)
    })

    it.each([
      ['250', 200],
      ['10', 50],
      ['-40', 50],
      ['134', 130],
      ['"big"', 100],
      ['null', 100],
      ['{"scale":150}', 100],
      ['not json', 100],
    ])('DCK-1: sanitises a stored stacks card size of %s to %i', (raw, expected) => {
      mockStorage[DECK_STACKS_SCALE_KEY] = raw
      expect(loadDeckStacksScale()).toBe(expected)
    })

    it('DCK-1: clamps an out-of-range value before writing it', () => {
      saveDeckStacksScale(900)
      expect(mockStorage[DECK_STACKS_SCALE_KEY]).toBe('200')
    })
  })
})

describe('resume token', () => {
  const conn: ConnectionInfo = { wsHost: 'localhost', proxyPort: 8787, serverHost: 'Example.org', port: 17171, username: 'Ana', password: '' }

  beforeEach(() => window.sessionStorage.clear())
  afterEach(() => vi.useRealTimers())

  it('round-trips for the same proxy and account (case-insensitive)', () => {
    saveResumeToken({ streamId: 's1', seq: 9 }, conn)
    expect(loadResumeToken({ ...conn, serverHost: 'example.org', username: 'ana' })).toEqual({ streamId: 's1', seq: 9 })
  })

  it('ignores it for another proxy or account', () => {
    saveResumeToken({ streamId: 's1', seq: 9 }, conn)
    expect(loadResumeToken({ ...conn, proxyPort: 8789 })).toBeNull()
    expect(loadResumeToken({ ...conn, username: 'bob' })).toBeNull()
  })

  it('expires once the proxy session cannot be alive any more', () => {
    vi.useFakeTimers()
    saveResumeToken({ streamId: 's1', seq: 9 }, conn)
    vi.advanceTimersByTime(11 * 60 * 1000)
    expect(loadResumeToken(conn)).toBeNull()
  })

  it('clearResumeToken forgets it', () => {
    saveResumeToken({ streamId: 's1', seq: 9 }, conn)
    clearResumeToken()
    expect(loadResumeToken(conn)).toBeNull()
  })
})
