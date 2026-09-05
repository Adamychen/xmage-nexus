import type { UsersView } from '../net/types'
import { t as tStatic } from '../i18n'

export type LobbyTab = 'tables' | 'decks' | 'community' | 'matches'

/** Las promesas del proxy no deben colgar la UI: todo con timeout explícito. */
export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout en ${label} (${ms / 1000}s)`)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

export function formatTimeAgo(epochMs?: number): string {
  if (!epochMs) return ''
  const diffSec = Math.floor((Date.now() - epochMs) / 1000)
  if (diffSec < 45) return tStatic('lobby','time_now')
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return tStatic('lobby','time_ago_m', { count: diffMin })
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return tStatic('lobby','time_ago_h', { count: diffHours })
  return tStatic('lobby','time_ago_d', { count: Math.floor(diffHours / 24) })
}

export function getSkillBadge(skill?: string): { label: string; stars: number; className: string } | null {
  if (!skill) return null
  switch (skill.toUpperCase()) {
    case 'BEGINNER':
      return { label: tStatic('lobby','create_skill_beginner'), stars: 1, className: 'skill-beginner' }
    case 'CASUAL':
      return { label: tStatic('lobby','create_skill_casual'), stars: 2, className: 'skill-casual' }
    case 'SERIOUS':
      return { label: tStatic('lobby','create_skill_competitive'), stars: 3, className: 'skill-serious' }
    default:
      return null
  }
}

export function formatDeckTypeName(deckType?: string): { short: string; full: string } {
  if (!deckType) return { short: tStatic('lobby','deck_unknown'), full: '' }
  const boosterMatches = deckType.match(/(\d+x[A-Z0-9]+)/g)
  if (boosterMatches && boosterMatches.length > 3) {
    const totalBoosters = boosterMatches.reduce((acc, str) => {
      const num = parseInt(str.split('x')[0], 10) || 1
      return acc + num
    }, 0)
    return {
      short: `${tStatic('lobby','deck_chaos')} • ${totalBoosters}`,
      full: deckType,
    }
  }
  return { short: deckType, full: deckType }
}

export function formatSeatHistory(sHistory?: string, userHistory?: string): { short: string | null; full: string } {
  const raw = (sHistory || userHistory || '').trim()
  if (!raw) return { short: null, full: '' }

  const wlMatch = raw.match(/^(\d+-\d+(?:-\d+)?)$/)
  if (wlMatch) {
    return { short: wlMatch[1], full: `${wlMatch[1]} (${tStatic('lobby','leaderboard_col_history')})` }
  }

  const seatMatch = raw.match(/^(\d+)(?:\s*\((.*?)\))?/)
  if (seatMatch && !raw.toLowerCase().includes('matches:')) {
    const totalMatches = seatMatch[1]
    const details = seatMatch[2] || ''
    const quitMatch = details.match(/Q:(\d+)/i)
    const quitCount = quitMatch ? parseInt(quitMatch[1], 10) : 0

    let short = totalMatches
    if (quitCount > 0) {
      short = `${totalMatches} (Q:${quitCount})`
    }

    let full = `${totalMatches} ${tStatic('lobby','history_matches')}`
    if (details) {
      const parts: string[] = []
      const iMatch = details.match(/I:(\d+)/i)
      const tMatch = details.match(/T:(\d+)/i)
      if (quitCount > 0) parts.push(`${quitCount} ${tStatic('lobby','history_quits')}`)
      if (iMatch && parseInt(iMatch[1], 10) > 0) parts.push(`${iMatch[1]} ${tStatic('lobby','history_inactives')}`)
      if (tMatch && parseInt(tMatch[1], 10) > 0) parts.push(`${tMatch[1]} ${tStatic('lobby','history_timeouts')}`)
      if (parts.length > 0) {
        full += ` (${parts.join(', ')})`
      } else {
        full += ` (${details})`
      }
    }
    return { short, full }
  }

  const matchMatch = raw.match(/Matches:\s*(\d+)(?:\s*\((.*?)\))?(?:\s*\(([\d.]+%)\))?/i)
  if (matchMatch) {
    const totalMatches = matchMatch[1]
    const details = matchMatch[2] || ''
    const quitPct = matchMatch[3] || ''
    const quitMatch = details.match(/Q:(\d+)/i)
    const quitCount = quitMatch ? parseInt(quitMatch[1], 10) : 0

    let short = totalMatches
    if (quitPct && quitPct !== '0%') {
      short = `${totalMatches} (${quitPct})`
    } else if (quitCount > 0) {
      short = `${totalMatches} (Q:${quitCount})`
    }

    return { short, full: raw }
  }

  if (raw.length <= 14) {
    return { short: raw, full: raw }
  }

  return { short: raw.slice(0, 10), full: raw }
}

export function extractLobbyUsers(rawUsers: unknown): UsersView[] {
  if (!rawUsers) return []
  if (Array.isArray(rawUsers)) {
    const list: UsersView[] = []
    for (const item of rawUsers) {
      if (item && typeof item === 'object') {
        if (Array.isArray((item as any).usersView)) {
          list.push(...(item as any).usersView)
        } else if (typeof (item as any).userName === 'string') {
          list.push(item as UsersView)
        }
      }
    }
    return list
  }
  if (typeof rawUsers === 'object') {
    if (Array.isArray((rawUsers as any).usersView)) {
      return (rawUsers as any).usersView
    }
  }
  return []
}

/** Usuarios mínimos para abrir el modal de acción desde asientos o chat. */
export function fallbackActionUser(userName: string): UsersView {
  return {
    userName,
    flagName: '',
    constructedRating: 1500,
    matchHistory: '',
    infoGames: '',
    matchQuitRatio: 0,
    tourneyHistory: '',
    tourneyQuitRatio: 0,
    infoPing: '',
    generalRating: 1500,
    limitedRating: 1500,
  }
}
