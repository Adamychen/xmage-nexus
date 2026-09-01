import { useState, useEffect, useMemo, useCallback } from 'react'
import type { MatchView, UsersView } from '../net/types'
import { getFinishedMatches, replayGame } from '../net/commands'
import AvatarImage from './AvatarImage'
import CountryFlag from './CountryFlag'
import { useTranslation } from '../i18n'
import { t as tStatic } from '../i18n'
import './FinishedMatchesPanel.css'

export interface ParsedPlayerScore {
  name: string
  wins: number
  losses: number
  draws?: number
  quit?: boolean
  timeoutType?: 'timer' | 'idle' | null
  isWinner?: boolean
}

export function parseMatchResult(result?: string, players?: string): ParsedPlayerScore[] {
  if (!result && !players) return []
  const parts = (result || '').split(',').map((s) => s.trim()).filter(Boolean)
  const playerList = (players || '').split(',').map((s) => s.trim()).filter(Boolean)

  if (parts.length === 0) {
    return playerList.map((p) => ({
      name: p.replace(/\[(timer|idle|quit)\]/i, '').trim(),
      wins: 0,
      losses: 0,
      quit: /\[quit\]/i.test(p),
      timeoutType: /\[timer\]/i.test(p) ? 'timer' : /\[idle\]/i.test(p) ? 'idle' : null,
    }))
  }

  const scores: ParsedPlayerScore[] = []
  let maxWins = -1

  for (const part of parts) {
    const match = part.match(/^(.*?)\s*\[(\d+)-(\d+)(?:-(\d+))?\]$/)
    if (match) {
      const name = match[1].trim()
      const wins = parseInt(match[2], 10)
      const losses = parseInt(match[3], 10)
      const draws = match[4] ? parseInt(match[4], 10) : 0
      if (wins > maxWins) maxWins = wins
      scores.push({ name, wins, losses, draws })
    } else {
      const plainName = part.replace(/\[.*?\]/g, '').trim()
      scores.push({ name: plainName || part, wins: 0, losses: 0 })
    }
  }

  if (scores.length >= 2 && maxWins > 0) {
    const topScorers = scores.filter((s) => s.wins === maxWins)
    if (topScorers.length === 1) {
      topScorers[0].isWinner = true
    }
  }

  return scores
}

export function formatMatchDuration(startTime?: number | string, endTime?: number | string): string {
  if (!startTime || !endTime) return ''
  const start = typeof startTime === 'string' ? new Date(startTime).getTime() : startTime
  const end = typeof endTime === 'string' ? new Date(endTime).getTime() : endTime
  if (isNaN(start) || isNaN(end) || end <= start) return ''
  const diffSec = Math.floor((end - start) / 1000)
  const mins = Math.floor(diffSec / 60)
  const secs = diffSec % 60
  if (mins < 60) {
    return `${mins}m ${secs}s`
  }
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  return `${hours}h ${remMins}m`
}

export function formatRelativeTime(timestamp?: number | string): string {
  if (!timestamp) return ''
  const time = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp
  if (isNaN(time)) return ''
  const diffSec = Math.floor((Date.now() - time) / 1000)
  if (diffSec < 60) return tStatic('lobby', 'time_just_now')
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return tStatic('lobby', 'time_ago_m', { count: String(diffMin) })
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return tStatic('lobby', 'time_ago_h', { count: String(diffHours) })
  const diffDays = Math.floor(diffHours / 24)
  return tStatic('lobby', 'time_ago_d', { count: String(diffDays) })
}

interface FinishedMatchesPanelProps {
  roomId?: string
  users?: UsersView[]
  onInspectUser?: (username: string) => void
}

export default function FinishedMatchesPanel({
  roomId,
  users = [],
  onInspectUser,
}: FinishedMatchesPanelProps) {
  const { t } = useTranslation()
  const [matches, setMatches] = useState<MatchView[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'ranked' | 'tournament'>('all')
  const [replayingGameId, setReplayingGameId] = useState<string | null>(null)

  const fetchMatches = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getFinishedMatches(roomId)
      setMatches(data)
    } catch {
      // Ignorar errores transitorios
    } finally {
      setLoading(false)
    }
  }, [roomId])

  useEffect(() => {
    fetchMatches()
    const interval = setInterval(fetchMatches, 10000)
    return () => clearInterval(interval)
  }, [fetchMatches])

  const userMap = useMemo(() => {
    const map = new Map<string, UsersView>()
    for (const u of users) {
      map.set(u.userName.toLowerCase(), u)
    }
    return map
  }, [users])

  const filteredMatches = useMemo(() => {
    let list = [...matches]

    if (filterType === 'ranked') {
      list = list.filter((m) => m.rated)
    } else if (filterType === 'tournament') {
      list = list.filter((m) => m.isTournament)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(
        (m) =>
          (m.matchName && m.matchName.toLowerCase().includes(q)) ||
          (m.gameType && m.gameType.toLowerCase().includes(q)) ||
          (m.deckType && m.deckType.toLowerCase().includes(q)) ||
          (m.players && m.players.toLowerCase().includes(q)) ||
          (m.result && m.result.toLowerCase().includes(q)),
      )
    }

    // Ordenar de mas reciente a mas antigua
    list.sort((a, b) => {
      const timeA = typeof a.endTime === 'string' ? new Date(a.endTime).getTime() : (a.endTime ?? 0)
      const timeB = typeof b.endTime === 'string' ? new Date(b.endTime).getTime() : (b.endTime ?? 0)
      return timeB - timeA
    })

    return list
  }, [matches, filterType, searchQuery])

  const handleReplay = async (gameId: string) => {
    setReplayingGameId(gameId)
    try {
      await replayGame(gameId)
    } finally {
      setTimeout(() => setReplayingGameId(null), 1000)
    }
  }

  return (
    <div className="finished-matches-panel">
      {/* Header & Controls */}
      <div className="finished-matches-header">
        <div className="finished-matches-title-wrap">
          <div className="finished-matches-title-row">
            <span className="finished-matches-icon">📜</span>
            <h2 className="finished-matches-title">{t('lobby', 'matches_title')}</h2>
            <span className="finished-matches-count-badge">{filteredMatches.length}</span>
          </div>
          <p className="finished-matches-subtitle">
            {t('lobby', 'matches_subtitle')}
          </p>
        </div>

        <div className="finished-matches-actions">
          <div className="matches-search-wrap">
            <input
              type="text"
              className="matches-search-input"
              placeholder={t('common', 'search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="matches-search-clear"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>

          <div className="matches-filter-chips">
            <button
              type="button"
              className={`filter-chip ${filterType === 'all' ? 'active' : ''}`}
              onClick={() => setFilterType('all')}
            >
              {t('lobby', 'matches_filter_all', { count: String(matches.length) })}
            </button>
            <button
              type="button"
              className={`filter-chip ${filterType === 'ranked' ? 'active' : ''}`}
              onClick={() => setFilterType('ranked')}
            >
              ⭐ Ranked
            </button>
            <button
              type="button"
              className={`filter-chip ${filterType === 'tournament' ? 'active' : ''}`}
              onClick={() => setFilterType('tournament')}
            >
              🏆 Torneos
            </button>
          </div>

          <button
            type="button"
            className={`matches-refresh-btn ${loading ? 'spinning' : ''}`}
            onClick={fetchMatches}
            disabled={loading}
            title={t('common', 'refresh')}
          >
            <span className="refresh-icon">🔄</span>
            <span>{loading ? t('common', 'loading') : t('common', 'refresh')}</span>
          </button>
        </div>
      </div>

      {/* Matches Grid */}
      <div className="finished-matches-list">
        {filteredMatches.map((m, index) => {
          const scores = parseMatchResult(m.result, m.players)
          const duration = formatMatchDuration(m.startTime, m.endTime)
          const relativeTime = formatRelativeTime(m.endTime || m.startTime)
          const matchKey = m.matchId || m.tableId || `match-${index}`

          return (
            <div key={matchKey} className="match-card">
              {/* Match Card Header */}
              <div className="match-card-header">
                <div className="match-meta-left">
                  <span className="match-game-type">{m.gameType || 'Duelo MTG'}</span>
                  {m.deckType && <span className="match-deck-type">{m.deckType}</span>}
                </div>

                <div className="match-meta-right">
                  {m.rated && <span className="match-badge rated">⭐ Ranked</span>}
                  {m.isTournament && <span className="match-badge tournament">🏆 Torneo</span>}
                  {duration && <span className="match-duration">⏱️ {duration}</span>}
                  {relativeTime && <span className="match-time-ago">{relativeTime}</span>}
                </div>
              </div>

              {/* Match Players & Score Board */}
              <div className="match-scoreboard">
                {scores.length >= 2 ? (
                  <>
                    {/* Player 1 (Left) */}
                    <div className={`player-slot ${scores[0].isWinner ? 'winner' : ''}`}>
                      <div
                        className="player-info-wrap"
                        onClick={() => onInspectUser?.(scores[0].name)}
                        style={{ cursor: onInspectUser ? 'pointer' : 'default' }}
                      >
                        <AvatarImage
                          avatarId={userMap.get(scores[0].name.toLowerCase())?.avatarId ?? 10}
                          username={scores[0].name}
                          size="medium"
                        />
                        <div className="player-name-col">
                          <div className="player-name-line">
                            {userMap.get(scores[0].name.toLowerCase())?.flagName && (
                              <CountryFlag
                                flagName={userMap.get(scores[0].name.toLowerCase())!.flagName}
                              />
                            )}
                            <span className="player-name">{scores[0].name}</span>
                            {scores[0].isWinner && <span className="winner-crown">👑</span>}
                          </div>
                          {scores[0].quit && (
                            <span className="player-quit-tag">
                              {scores[0].timeoutType === 'timer'
                                ? `⏱️ ${t('lobby', 'match_quit_timeout')}`
                                : scores[0].timeoutType === 'idle'
                                ? `💤 ${t('lobby', 'match_quit_idle')}`
                                : `🚪 ${t('lobby', 'match_quit_abandon')}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="player-score-box">{scores[0].wins}</div>
                    </div>

                    {/* Center VS Indicator */}
                    <div className="match-vs-divider">
                      <span className="vs-text">VS</span>
                    </div>

                    {/* Player 2 (Right) */}
                    <div className={`player-slot right ${scores[1].isWinner ? 'winner' : ''}`}>
                      <div className="player-score-box">{scores[1].wins}</div>
                      <div
                        className="player-info-wrap"
                        onClick={() => onInspectUser?.(scores[1].name)}
                        style={{ cursor: onInspectUser ? 'pointer' : 'default' }}
                      >
                        <div className="player-name-col right-align">
                          <div className="player-name-line">
                            {scores[1].isWinner && <span className="winner-crown">👑</span>}
                            <span className="player-name">{scores[1].name}</span>
                            {userMap.get(scores[1].name.toLowerCase())?.flagName && (
                              <CountryFlag
                                flagName={userMap.get(scores[1].name.toLowerCase())!.flagName}
                              />
                            )}
                          </div>
                          {scores[1].quit && (
                            <span className="player-quit-tag">
                              {scores[1].timeoutType === 'timer'
                                ? `⏱️ ${t('lobby', 'match_quit_timeout')}`
                                : scores[1].timeoutType === 'idle'
                                ? `💤 ${t('lobby', 'match_quit_idle')}`
                                : `🚪 ${t('lobby', 'match_quit_abandon')}`}
                            </span>
                          )}
                        </div>
                        <AvatarImage
                          avatarId={userMap.get(scores[1].name.toLowerCase())?.avatarId ?? 10}
                          username={scores[1].name}
                          size="medium"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="match-single-player-row">
                    <span className="player-raw-text">
                      {m.result || m.players || t('lobby', 'match_no_result')}
                    </span>
                  </div>
                )}
              </div>

              {/* Match Replays & Footer */}
              <div className="match-card-footer">
                <div className="match-result-summary">
                  <span className="result-label">{t('lobby', 'match_result_label')}</span>
                  <span className="result-text">{m.result || m.players || t('lobby', 'match_concluded')}</span>
                </div>

                {m.games && m.games.length > 0 && (
                  <div className="match-replay-actions">
                    {m.games.map((gId, gIdx) => (
                      <button
                        key={gId}
                        type="button"
                        className="replay-btn"
                        onClick={() => handleReplay(gId)}
                        disabled={replayingGameId === gId}
                        title={`${t('common', 'loading')} #${gIdx + 1}`}
                      >
                        <span className="replay-icon">🎬</span>
                        <span>{replayingGameId === gId ? t('common', 'loading') : m.games!.length === 1 ? t('lobby', 'match_replay_single') : t('lobby', 'match_replay_number', { number: String(gIdx + 1) })}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {filteredMatches.length === 0 && !loading && (
          <div className="matches-empty-state">
            <span className="empty-icon">📭</span>
            <h3 className="empty-title">{t('lobby', 'matches_empty')}</h3>
            <p className="empty-desc">
              {searchQuery
                ? t('lobby', 'no_tables_found')
                : t('lobby', 'matches_empty')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
