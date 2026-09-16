import { getState } from '../state/state'
import { recentFrames } from '../net/frameBuffer'
import { APP_VERSION } from './version'
import { getLanguage } from '../i18n'

export interface DiagnosticBundle {
  exportedAt: number
  appVersion: string
  userAgent: string
  language: string
  conn: {
    wsUrl: string | null
    wsAlive: boolean
    serverHost: string | null
    port: number | null
    username: string | null
  }
  session: {
    phase: string
    gameId: string | null
    stagingTableId: string | null
    watchingTableId: string | null
  }
  game: {
    turn: unknown
    step: unknown
    activePlayer: string | null
    players: { name: string; life: unknown; active: boolean }[]
  } | null
  settings: {
    boardLayout: string
    uiScale: unknown
    soundEnabled: boolean
    effects: boolean
  }
  log: { time: number; from: string; text: string }[]
  frames: ReturnType<typeof recentFrames>
}

export function buildDiagnosticBundle(): DiagnosticBundle {
  const s = getState()
  const game = s.game
  return {
    exportedAt: Date.now(),
    appVersion: APP_VERSION,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    language: getLanguage(),
    conn: {
      wsUrl: s.wsUrl,
      wsAlive: s.wsAlive,
      serverHost: s.conn?.serverHost ?? null,
      port: s.conn?.port ?? null,
      username: s.conn?.username ?? null,
    },
    session: {
      phase: s.phase,
      gameId: s.gameId,
      stagingTableId: s.stagingTableId,
      watchingTableId: s.watchingTable?.tableId ?? null,
    },
    game: game
      ? {
          turn: (game as { turn?: unknown }).turn ?? null,
          step: (game as { step?: unknown }).step ?? null,
          activePlayer: (game as { activePlayerId?: string }).activePlayerId ?? null,
          players: (game.players ?? []).map((p) => ({
            name: p.name,
            life: p.life,
            active: p.playerId === (game as { activePlayerId?: string }).activePlayerId,
          })),
        }
      : null,
    settings: {
      boardLayout: s.settings.boardLayout,
      uiScale: s.settings.uiScale,
      soundEnabled: s.settings.soundEnabled,
      effects: s.settings.effects,
    },
    log: s.log.map(({ time, from, text }) => ({ time, from, text })),
    frames: recentFrames(),
  }
}

export function downloadDiagnostics(): boolean {
  try {
    if (typeof document === 'undefined' || typeof URL === 'undefined') return false
    const bundle = buildDiagnosticBundle()
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nexus-diagnostico_${new Date(bundle.exportedAt).toISOString().replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  } catch {
    return false
  }
}
