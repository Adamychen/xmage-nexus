export interface MatchHistoryStats {
  wins: number | null
  losses: number | null
  total: number
  winrate: number | null
  formattedHistory: string
}

/**
 * Parses `UsersView.matchHistory`. Two wire shapes exist:
 * - "W-L" (e.g. "12-4") when the server reports results.
 * - A bare MATCH COUNT (e.g. "6" or "6 (Q:1)"): the server only sends the count
 *   (see User.userStatsToMatchHistory). Showing an ELO-derived W-L here would
 *   fabricate results, so wins/losses/winrate stay unknown and only the count shows.
 */
export function parseMatchHistory(historyStr?: string | null): MatchHistoryStats {
  if (!historyStr || historyStr === '0' || historyStr === '0-0') {
    return { wins: 0, losses: 0, total: 0, winrate: null, formattedHistory: '0-0' }
  }
  const wlMatch = historyStr.match(/(\d+)\s*-\s*(\d+)/)
  if (wlMatch) {
    const wins = parseInt(wlMatch[1], 10)
    const losses = parseInt(wlMatch[2], 10)
    const total = wins + losses
    const winrate = total > 0 ? Math.round((wins / total) * 100) : null
    return { wins, losses, total, winrate, formattedHistory: `${wins}-${losses}` }
  }
  const numMatch = historyStr.match(/^(\d+)/)
  if (numMatch) {
    const totalMatches = parseInt(numMatch[1], 10)
    if (totalMatches === 0) {
      return { wins: 0, losses: 0, total: 0, winrate: null, formattedHistory: '0-0' }
    }
    return {
      wins: null,
      losses: null,
      total: totalMatches,
      winrate: null,
      formattedHistory: historyStr.trim(),
    }
  }
  return { wins: 0, losses: 0, total: 0, winrate: null, formattedHistory: historyStr }
}
