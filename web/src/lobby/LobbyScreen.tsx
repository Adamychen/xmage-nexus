import { useState, useMemo, useEffect } from 'react'
import { reset, useLobby, useStore, setWatchingTable, openStagingTable } from '../state/store'
import * as cmds from '../net/commands'
import type { TableView, UsersView } from '../net/types'
import { cacheAvatar } from './avatarCache'
import CreateTableDialog from './CreateTableDialog'
import JoinTableDialog from './JoinTableDialog'
import ChatBox from './ChatBox'
import DecksGallery from '../decks/DecksGallery'
import DeckBuilder from '../decks/DeckBuilder'
import CountryFlag from './CountryFlag'
import RankBadge from './RankBadge'
import AvatarImage from './AvatarImage'
import PingBadge from './PingBadge'
import LeaderboardModal from './LeaderboardModal'
import UserActionModal from './UserActionModal'
import TableFilterBar, { INITIAL_TABLE_FILTERS, filterTables, type TableFilters } from './TableFilterBar'
import FinishedMatchesPanel from './FinishedMatchesPanel'
import TournamentBracket from './TournamentBracket'
import DownloadImagesDialog from './DownloadImagesDialog'
import LanguageSelector from '../i18n/LanguageSelector'
import { t as tStatic } from '../i18n'
import { useTranslation } from '../i18n'
import type { TournamentView } from '../net/types'
import { AI_OPPONENT_DECK, type Deck } from './decks'
import { useFullscreen } from '../utils/fullscreen'
import './LobbyScreen.css'
import './TournamentBracket.css'

/** Las promesas del proxy no deben colgar la UI: todo con timeout explícito. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
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

function formatTimeAgo(epochMs?: number): string {
  if (!epochMs) return ''
  const diffSec = Math.floor((Date.now() - epochMs) / 1000)
  if (diffSec < 45) return tStatic('lobby','time_now')
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return tStatic('lobby','time_ago_m', { count: diffMin })
  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) return tStatic('lobby','time_ago_h', { count: diffHours })
  return tStatic('lobby','time_ago_d', { count: Math.floor(diffHours / 24) })
}

function getSkillBadge(skill?: string): { label: string; icon: string; className: string } | null {
  if (!skill) return null
  switch (skill.toUpperCase()) {
    case 'BEGINNER':
      return { label: tStatic('lobby','create_skill_beginner'), icon: '⭐', className: 'skill-beginner' }
    case 'CASUAL':
      return { label: tStatic('lobby','create_skill_casual'), icon: '⭐⭐', className: 'skill-casual' }
    case 'SERIOUS':
      return { label: tStatic('lobby','create_skill_competitive'), icon: '⭐⭐⭐', className: 'skill-serious' }
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

  // Parse seat history like "720 (I:15 T:8 Q:3)", "1817 (I:4 T:12 Q:0)", "8 (Q:1)", "2"
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

  // Parse from raw user history "Matches: 265 (I:3 T:1 Q:13) (6%), Tourneys: 0 (0%), Constructed Rating..."
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

  // Fallback for simple short strings
  if (raw.length <= 14) {
    return { short: raw, full: raw }
  }

  return { short: raw.slice(0, 10), full: raw }
}

export function extractLobbyUsers(rawUsers: unknown): import('../net/types').UsersView[] {
  if (!rawUsers) return []
  if (Array.isArray(rawUsers)) {
    const list: import('../net/types').UsersView[] = []
    for (const item of rawUsers) {
      if (item && typeof item === 'object') {
        if (Array.isArray((item as any).usersView)) {
          list.push(...(item as any).usersView)
        } else if (typeof (item as any).userName === 'string') {
          list.push(item as import('../net/types').UsersView)
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

export type LobbyTab = 'tables' | 'decks' | 'community' | 'matches'

export default function LobbyScreen() {
  const { t } = useTranslation()
  const lobby = useLobby()
  const conn = useStore((s) => s.conn)
  const stagingTableId = useStore((s) => s.stagingTableId)
  const myDeck = useStore((s) => s.myDeck)
  const error = useStore((s) => s.error)
  const events = useStore((s) => s.events)
  const [unreadChat, setUnreadChat] = useState(0)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [activeTab, setActiveTab] = useState<LobbyTab>('tables')
  const [deckBuilderId, setDeckBuilderId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showDownloadImages, setShowDownloadImages] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboardTarget, setLeaderboardTarget] = useState<string | undefined>(undefined)
  const [leaderboardTab, setLeaderboardTab] = useState<'room' | 'profile' | 'tiers'>('room')
  const [selectedUser, setSelectedUser] = useState<UsersView | null>(null)
  const [chatPrefill, setChatPrefill] = useState<string>('')
  const [joiningTable, setJoiningTable] = useState<TableView | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [filters, setFilters] = useState<TableFilters>(() => {
    try {
      const saved = localStorage.getItem('lobby_filters')
      return saved ? { ...INITIAL_TABLE_FILTERS, ...JSON.parse(saved) } : INITIAL_TABLE_FILTERS
    } catch { return INITIAL_TABLE_FILTERS }
  })
  const [busyTable, setBusyTable] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isFullscreenActive, toggleFullscreen] = useFullscreen()
  const tournamentState = useStore((s) => s.tournament)
  const [bracketTable, setBracketTable] = useState<TableView | null>(null)
  const [bracketView, setBracketView] = useState<TournamentView | null>(null)
  const [bracketLoading, setBracketLoading] = useState(false)
  const [bracketError, setBracketError] = useState<string | null>(null)

  const openLeaderboard = (target?: string, tab: 'room' | 'profile' | 'tiers' = 'room') => {
    setLeaderboardTarget(target)
    setLeaderboardTab(tab)
    setShowLeaderboard(true)
  }

  const tables = lobby?.tables ?? []
  const users = useMemo(() => extractLobbyUsers(lobby?.users), [lobby?.users])
  const myUser = useMemo(
    () => users.find((u) => u.userName.toLowerCase() === (conn?.username ?? '').toLowerCase()),
    [users, conn?.username],
  )

  const filteredTables = useMemo(() => {
    return filterTables(tables, filters)
  }, [tables, filters])

  // Cachear automáticamente el avatar real del usuario conectado
  useEffect(() => {
    if (conn?.username && conn?.avatarId && conn.avatarId > 0) {
      cacheAvatar(conn.username, conn.avatarId)
    }
  }, [conn?.username, conn?.avatarId])

  const joinHuman = (t: TableView) => {
    setNotice(null)
    const seat = t.seats.find((s) => !s.playerName)
    if (!seat) {
      setNotice(tStatic('errors','table_no_seats'))
      return
    }
    setJoiningTable(t)
  }

  const handleJoinWithDeck = async (t: TableView, deck: Deck, password?: string) => {
    setBusyTable(t.tableId)
    setNotice(null)
    try {
      const res = await withTimeout(
        cmds.joinTable({
          tableId: t.tableId,
          playerName: conn?.username ?? 'player',
          playerType: 'HUMAN',
          skill: 1,
          deck,
          password,
        }),
        15000,
        'joinTable',
      )
      if (res.ok) {
        setNotice(tStatic('lobby','waiting_players'))
        setJoiningTable(null)
      } else {
        throw new Error(res.error || tStatic('errors','join_table_failed'))
      }
    } catch (e) {
      setNotice((e as Error).message)
    } finally {
      setBusyTable(null)
    }
  }

  const joinAi = async (t: TableView) => {
    setBusyTable(t.tableId)
    setNotice(null)
    const seat = t.seats.find((s) => !s.playerName && s.playerType && /COMPUTER|AI/i.test(s.playerType))
    if (!seat?.playerType) {
      setNotice(tStatic('errors','table_no_seats'))
      return
    }
    const aiSeats = t.seats.filter((s) => s.playerType && /COMPUTER|AI/i.test(s.playerType))
    const aiIndex = aiSeats.indexOf(seat)
    try {
      const res = await withTimeout(
        cmds.joinTable({
          tableId: t.tableId,
          playerName: aiIndex <= 0 ? 'Computer' : `Computer ${aiIndex + 1}`,
          playerType: seat.playerType,
          skill: 1,
          deck: AI_OPPONENT_DECK,
        }),
        15000,
        'joinTable IA',
      )
      setNotice(res.ok ? tStatic('lobby','join_ai_btn') : `joinTable IA: ${res.error}`)
    } catch (e) {
      setNotice((e as Error).message)
    } finally {
      setBusyTable(null)
    }
  }

  const startTable = async (t: TableView) => {
    setBusyTable(t.tableId)
    try {
      const res = await withTimeout(cmds.startMatch(t.tableId), 20000, 'startMatch')
      setNotice(res.ok ? tStatic('lobby','start_match_btn') : `startMatch: ${res.error}`)
    } catch (e) {
      setNotice((e as Error).message)
    } finally {
      setBusyTable(null)
    }
  }

  const watchTable = async (t: TableView) => {
    setBusyTable(t.tableId)
    try {
      const res = await withTimeout(cmds.watchTable(t.tableId), 15000, 'watchTable')
      if (res.ok) {
        setWatchingTable(t)
        setNotice(tStatic('lobby','watch_btn'))
      } else {
        setNotice(`watchTable: ${res.error}`)
      }
    } catch (e) {
      setNotice((e as Error).message)
    } finally {
      setBusyTable(null)
    }
  }

  const openBracket = async (t: TableView) => {
    setBracketTable(t)
    setBracketError(null)
    if (tournamentState) {
      setBracketView(tournamentState.view)
    }
    setBracketLoading(true)
    try {
      // 1. Tell XMage server to stream tournament data for this table
      void cmds.watchTournamentTable(t.tableId)
      // 2. Also try direct getTournament
      const data = await withTimeout(cmds.getTournament(t.tableId) as Promise<unknown>, 8000, 'getTournament')
      if (data && typeof data === 'object' && 'tournamentName' in (data as Record<string, unknown>)) {
        setBracketView(data as TournamentView)
      } else if (tournamentState?.view) {
        setBracketView(tournamentState.view)
      }
    } catch (e) {
      if (tournamentState?.view) {
        setBracketView(tournamentState.view)
      } else {
        setBracketError((e as Error).message)
      }
    } finally {
      setBracketLoading(false)
    }
  }

  const closeBracket = () => {
    setBracketTable(null)
    setBracketView(null)
    setBracketError(null)
  }

  const refreshBracket = async () => {
    if (!bracketTable) return
    setBracketLoading(true)
    setBracketError(null)
    try {
      void cmds.watchTournamentTable(bracketTable.tableId)
      const data = await withTimeout(cmds.getTournament(bracketTable.tableId) as Promise<unknown>, 8000, 'getTournament')
      if (data && typeof data === 'object' && 'tournamentName' in (data as Record<string, unknown>)) {
        setBracketView(data as TournamentView)
      } else if (tournamentState?.view) {
        setBracketView(tournamentState.view)
      }
    } catch (e) {
      if (tournamentState?.view) {
        setBracketView(tournamentState.view)
      } else {
        setBracketError((e as Error).message)
      }
    } finally {
      setBracketLoading(false)
    }
  }

  useEffect(() => {
    if (!bracketTable) return
    if (tournamentState?.view) {
      setBracketView(tournamentState.view)
    }
  }, [tournamentState, bracketTable])

  useEffect(() => {
    if (!bracketTable) return
    const id = setInterval(() => {
      void refreshBracket()
    }, 8000)
    return () => clearInterval(id)
  }, [bracketTable?.tableId])

  return (
    <div className="lobby">
      {/* Thin top strip: brand + user identity */}
      <header className="lobby-topstrip">
        <div className="lobby-brand-col">
          <img src="/logo.jpeg" alt="XMage Nexus" className="lobby-brand-logo" />
          <div className="lobby-brand-titles">
            <h1 className="lobby-main-heading">XMage Nexus</h1>
            <span className="conn-info">
              <span className="conn-status-dot" />
              {conn?.serverHost}:{conn?.port} · {users.length} {t('lobby','online_count')}
            </span>
          </div>
        </div>

        <div className="lobby-user-actions">
          <LanguageSelector showCardLangToggle={true} />

          <button
            type="button"
            className={`lobby-fullscreen-btn ${isFullscreenActive ? 'active' : ''}`}
            onClick={toggleFullscreen}
            title={isFullscreenActive ? t('game','exit_fullscreen') : t('game','enter_fullscreen')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={isFullscreenActive ? 'M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3' : 'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3'} />
            </svg>
          </button>

          <div
            className="lobby-user-badge"
            onClick={() => openLeaderboard(conn?.username, 'profile')}
            title={`${t('lobby','view_profile_hint')} ${conn?.username ?? ''}`}
          >
            <AvatarImage avatarId={conn?.avatarId ?? 10} username={conn?.username} size="medium" />
            <div className="lobby-user-col">
              <div className="lobby-user-name-line" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="lobby-username">{conn?.username}</span>
                {myUser?.infoPing && <PingBadge infoPing={myUser.infoPing} compact />}
              </div>
              <RankBadge elo={myUser?.constructedRating ?? 1500} compact />
            </div>
          </div>
          {confirmDisconnect ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#ff9999', fontWeight: 700 }}>{t('lobby', 'disconnect_confirm')}</span>
              <button className="lobby-disconnect-btn" onClick={reset} style={{ padding: '4px 8px', fontSize: 11 }}>{t('common', 'yes')}</button>
              <button onClick={() => setConfirmDisconnect(false)} style={{ padding: '4px 8px', fontSize: 11, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#c4cae8', cursor: 'pointer' }}>{t('common', 'no')}</button>
            </div>
          ) : (
            <button className="lobby-disconnect-btn" onClick={() => setConfirmDisconnect(true)} title={t('lobby', 'disconnect')}>
              🚪
            </button>
          )}
        </div>
      </header>

      {error && <div className="error-box panel lobby-error-banner">{error}</div>}
      {notice && <div className="notice panel lobby-notice-banner">{notice}</div>}

      {/* 3-Column main area */}
      <div className="lobby-columns">

        {/* LEFT: Icon Sidebar Navigation */}
        <nav className="lobby-sidebar" aria-label="Main navigation">
          <button
            type="button"
            className="sidebar-btn hero-create-btn"
            onClick={() => setShowCreate(true)}
            title={t('lobby.nav_new')}
          >
            <span className="sidebar-btn-icon">➕</span>
            <span className="sidebar-btn-label">{t('lobby.nav_new')}</span>
          </button>

          <div className="sidebar-divider" />

          <button
            type="button"
            className={`sidebar-btn ${activeTab === 'tables' ? 'active' : ''}`}
            onClick={() => setActiveTab('tables')}
            title={`${t('lobby.nav_tables')} (${tables.length})`}
          >
            <span className="sidebar-btn-icon">⚔️</span>
            <span className="sidebar-btn-label">{t('lobby.nav_tables')}{tables.length > 0 ? ` (${tables.length})` : ''}</span>
          </button>

          <button
            type="button"
            className={`sidebar-btn ${activeTab === 'decks' ? 'active' : ''}`}
            onClick={() => setActiveTab('decks')}
            title={t('lobby.nav_decks')}
          >
            <span className="sidebar-btn-icon">🃏</span>
            <span className="sidebar-btn-label">{t('lobby.nav_decks')}</span>
          </button>

          <button
            type="button"
            className={`sidebar-btn ${activeTab === 'matches' ? 'active' : ''}`}
            onClick={() => setActiveTab('matches')}
            title={t('lobby.nav_history')}
          >
            <span className="sidebar-btn-icon">📜</span>
            <span className="sidebar-btn-label">{t('lobby.nav_history')}</span>
          </button>

          <button
            type="button"
            className="sidebar-btn sidebar-btn-leaderboard"
            onClick={() => openLeaderboard(conn?.username, 'room')}
            title={t('lobby.nav_ranking')}
          >
            <span className="sidebar-btn-icon">🏆</span>
            <span className="sidebar-btn-label">{t('lobby.nav_ranking')}</span>
          </button>

          <div className="sidebar-divider" />

          <button
            type="button"
            className="sidebar-btn"
            onClick={() => setShowDownloadImages(true)}
            title={t('dialogs','download_title')}
          >
            <span className="sidebar-btn-icon">📥</span>
            <span className="sidebar-btn-label">{t('lobby.nav_downloads')}</span>
          </button>
        </nav>

        {/* CENTER: Main tab content */}
        <main className="lobby-main">
          {activeTab === 'tables' && (
            <div className="lobby-tables-view">
              <TableFilterBar
                tables={tables}
                filters={filters}
                onChange={(f) => { setFilters(f); try { localStorage.setItem('lobby_filters', JSON.stringify(f)) } catch {} }}
                onReset={() => { setFilters(INITIAL_TABLE_FILTERS); try { localStorage.removeItem('lobby_filters') } catch {} }}
              />

              <section className="panel tables-panel">
                <div className="tables-panel-header">
                  <div className="tables-header-title-row">
                    <h2>
                      {t('lobby.tables_heading')} ({filteredTables.length}
                      {filteredTables.length !== tables.length ? ` / ${tables.length}` : ''})
                    </h2>
                    <span className="tables-deck-hint">{t('lobby.tables_deck_hint')}</span>
                  </div>
                  <div className="hero-deck-badge" title={`${t('lobby.active_deck')}: ${myDeck?.name ?? 'Mage Web bolt'}`}>
                    <span className="hero-deck-label">{t('lobby.active_deck')}:</span>
                    <span className="hero-deck-name">🃏 {myDeck?.name ?? 'Mage Web bolt'}</span>
                  </div>
                </div>

                <div className="tables-list">
                  {filteredTables.map((tTable) => {
                    const isReady = tTable.tableState === 'READY_TO_START'
                    const isPlaying = tTable.tableState === 'DUELING' || tTable.tableState === 'SIDEBOARDING'
                    const isWaiting = tTable.tableState === 'WAITING'

                    const hasHumanSeat =
                      (isWaiting || isReady) &&
                      tTable.seats.some((s) => !s.playerName && (!s.playerType || s.playerType === 'HUMAN'))
                    const hasAiSeat =
                      (isWaiting || isReady) &&
                      tTable.seats.some((s) => !s.playerName && s.playerType && /COMPUTER|AI/i.test(s.playerType))

                    const statusClass = isReady
                      ? 'status-ready'
                      : isPlaying
                      ? 'status-playing'
                      : 'status-waiting'

                    const timeAgo = formatTimeAgo(tTable.createTime)
                    const skill = getSkillBadge(tTable.skillLevel)
                    const mySeat = !!conn?.username
                      && tTable.seats.some((s) => s.playerName?.toLowerCase() === conn.username.toLowerCase())
                    const canReenter = mySeat || stagingTableId === tTable.tableId

                    return (
                      <div key={tTable.tableId} className={`table-card table-row ${statusClass}`}>
                        <div className="table-card-main">
                          <div className="table-card-top-bar">
                            <div className="table-badges-left">
                              {tTable.isTournament ? (
                                <span className="table-type-badge tourney" title={t('lobby.tournament_badge')}>🏆 {t('lobby.tournament_badge')}</span>
                              ) : (
                                <span className="table-type-badge match" title="Match">⚔️ Match</span>
                              )}
                              {tTable.passworded && (
                                <span className="table-badge-lock" title={t('lobby','tag_private')}>🔒 {t('lobby','tag_private')}</span>
                              )}
                            </div>
                            <div className="table-header-right">
                              {timeAgo && (
                                <span className="table-time-ago" title={tTable.createTime ? new Date(tTable.createTime).toLocaleTimeString() : undefined}>
                                  ⏱️ {timeAgo}
                                </span>
                              )}
                              <span className={`table-state-badge ${statusClass}`}>{tTable.tableStateText}</span>
                            </div>
                          </div>

                          <div className="table-title-area">
                            <h3 className="table-name-text" title={tTable.tableName}>{tTable.tableName}</h3>
                          </div>

                          <div className="table-meta-row">
                            <span className="table-game-tag">🎮 {tTable.gameType}</span>
                            <span
                              className="table-deck-tag"
                              title={formatDeckTypeName(tTable.deckType).full}
                            >
                              📜 {formatDeckTypeName(tTable.deckType).short}
                            </span>
                            <span className="table-seats-count table-seats">👥 {tTable.seatsInfo}</span>
                            {skill && (
                              <span className={`table-skill-badge ${skill.className}`} title={`${t('lobby','create_field_skill')}: ${skill.label}`}>
                                {skill.icon} {skill.label}
                              </span>
                            )}
                            {tTable.rated ? (
                              <span className="table-tag-rated" title={t('lobby','tag_rated')}>🏅 {t('lobby','tag_rated')}</span>
                            ) : (
                              <span className="table-tag-unrated" title={t('lobby','tag_unrated')}>{t('lobby','tag_unrated')}</span>
                            )}
                            {tTable.spectatorsAllowed && (
                              <span className="table-tag-spectate" title={t('lobby','tag_spectators')}>👁️ {t('lobby','spectators')}</span>
                            )}
                            {Number(tTable.minimumRating) > 0 && (
                              <span className="table-tag-restriction" title={`${t('lobby','create_field_min_rating')}: ${tTable.minimumRating}`}>
                                ⭐ Min {tTable.minimumRating}
                              </span>
                            )}
                            {Number(String(tTable.quitRatio ?? '100').replace('%', '')) < 100 && (
                              <span className="table-tag-restriction" title={`${t('lobby','create_field_quit_ratio')}: ${tTable.quitRatio}`}>
                                🚫 Max Quit {tTable.quitRatio}
                              </span>
                            )}
                          </div>

                          {tTable.additionalInfoShort && (
                            <div className="table-info-strip" title={tTable.additionalInfoFull || tTable.additionalInfoShort}>
                              <span className="info-strip-icon">ℹ️</span>
                              <span className="info-strip-text">{tTable.additionalInfoShort}</span>
                            </div>
                          )}

                          <div className="table-seats-roster">
                            {tTable.seats.map((s, idx) => {
                              const hostName = tTable.controllerName ? tTable.controllerName.split(',')[0].trim() : ''
                              const isOwner = !!hostName && !!s.playerName && s.playerName.toLowerCase() === hostName.toLowerCase()
                              const isHuman = !s.playerType || s.playerType === 'HUMAN'
                              const foundUser = s.playerName
                                ? users.find((u) => u.userName.toLowerCase() === s.playerName.toLowerCase())
                                : undefined
                              const rating = foundUser?.constructedRating ?? (s as any).constructedRating
                              const historyInfo = formatSeatHistory(s.history, foundUser?.matchHistory)
                              const seatAvatarId = isHuman
                                ? s.playerName === conn?.username
                                  ? conn?.avatarId
                                  : foundUser?.avatarId
                                : 13

                              return (
                                <div
                                  key={idx}
                                  className={`seat-badge ${s.playerName ? 'occupied interactive' : 'empty'} ${isOwner ? 'is-owner' : ''}`}
                                  onClick={() => {
                                    if (!s.playerName) return
                                    setSelectedUser(
                                      foundUser ?? {
                                        userName: s.playerName,
                                        flagName: s.flagName ?? '',
                                        constructedRating: (s as any).constructedRating || 1500,
                                        matchHistory: s.history || '',
                                        infoGames: '',
                                        matchQuitRatio: 0,
                                        tourneyHistory: '',
                                        tourneyQuitRatio: 0,
                                        infoPing: '',
                                        generalRating: 1500,
                                        limitedRating: 1500,
                                      },
                                    )
                                  }}
                                  style={s.playerName ? { cursor: 'pointer' } : undefined}
                                  title={s.playerName ? `${t('lobby','view_profile_hint')} ${s.playerName}` : t('lobby','open_seat')}
                                >
                                  <div className="seat-part-avatar">
                                    {s.playerName ? (
                                      <AvatarImage avatarId={seatAvatarId} username={s.playerName} size="small" />
                                    ) : (
                                      <span className="seat-icon empty-circle">⭕</span>
                                    )}
                                    {s.flagName && <CountryFlag flagName={s.flagName} className="seat-flag" />}
                                  </div>

                                   <div className="seat-part-main">
                                    <div className="seat-name-row">
                                      <span className="seat-player-name">
                                        {s.playerName || t('lobby.open_seat')}
                                      </span>
                                      {isOwner && <span className="seat-crown" title={t('lobby.host')}>👑 {t('lobby.host')}</span>}
                                      {!isHuman && <span className="seat-bot-tag" title={t('lobby.ai')}>🤖 {s.playerType || t('lobby.ai')}</span>}
                                    </div>

                                    {s.playerName && (rating || historyInfo.short) && (
                                      <div className="seat-meta-row">
                                        {rating && <RankBadge elo={rating} compact showElo />}
                                        {historyInfo.short && (
                                          <span className="seat-history-pill" title={historyInfo.full || `${t('lobby','leaderboard_col_history')}: ${historyInfo.short}`}>
                                            🏆 {historyInfo.short}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>

                                  <div className="seat-part-status">
                                    {s.playerName ? (
                                      <span className="seat-ready-indicator" title={t('lobby.ready_status')}>
                                        <span className="seat-ready-dot" />
                                        <span className="seat-ready-text">{t('lobby.ready_status')}</span>
                                      </span>
                                    ) : (
                                      <span className="seat-open-badge">{t('lobby.open_seat')}</span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        <div className="table-actions">
                          {canReenter && (
                            <button
                              className="primary table-action-btn return-table-btn"
                              data-testid="return-to-table"
                              onClick={() => openStagingTable(tTable.tableId)}
                            >
                              🪑 {t('lobby','staging_return_table')}
                            </button>
                          )}
                          {isReady && (
                            <button
                              className="primary table-action-btn"
                              disabled={busyTable === tTable.tableId}
                              onClick={() => startTable(tTable)}
                            >
                              {t('lobby.start_match_btn')}
                            </button>
                          )}
                          {hasHumanSeat && (
                            <button
                              className="table-action-btn join-btn"
                              disabled={busyTable === tTable.tableId}
                              onClick={() => joinHuman(tTable)}
                            >
                              {t('lobby.join_human_btn')}
                            </button>
                          )}
                          {hasAiSeat && (
                            <button
                              className="table-action-btn ai-btn"
                              disabled={busyTable === tTable.tableId}
                              onClick={() => joinAi(tTable)}
                            >
                              {t('lobby.join_ai_btn')}
                            </button>
                          )}
                          <button
                            className="table-action-btn watch-btn"
                            disabled={busyTable === tTable.tableId}
                            onClick={() => watchTable(tTable)}
                          >
                            👁️ {t('lobby.watch_btn')}
                          </button>
                          {tTable.isTournament && (
                            <button
                              className="table-action-btn bracket-btn"
                              disabled={busyTable === tTable.tableId}
                              onClick={() => void openBracket(tTable)}
                              data-testid="open-bracket"
                            >
                              🏆 {t('lobby.view_bracket')}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {filteredTables.length === 0 && tables.length === 0 && (
                    <div className="tables-empty-state">
                      <span className="empty-icon">🏰</span>
                      <h3>{t('lobby','empty_tables')}</h3>
                      <p>{t('lobby','tables_deck_hint')}</p>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button className="primary" onClick={() => setShowCreate(true)}>
                          ➕ {t('lobby','create_table_btn')}
                        </button>
                      </div>
                    </div>
                  )}

                  {filteredTables.length === 0 && tables.length > 0 && (
                    <div className="tables-empty-match">
                      <span className="empty-match-icon">🔍</span>
                      <span className="empty-match-title">{t('lobby','empty_filtered')}</span>
                      <p className="empty-match-desc">
                        {t('lobby','no_tables_found')}
                      </p>
                      <button
                        type="button"
                        className="empty-reset-btn"
                        onClick={() => setFilters(INITIAL_TABLE_FILTERS)}
                      >
                        {t('lobby','filter_reset')}
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'decks' && (
            deckBuilderId ? (
              <DeckBuilder deckId={deckBuilderId} onClose={() => setDeckBuilderId(null)} />
            ) : (
              <DecksGallery onEdit={(id) => setDeckBuilderId(id)} />
            )
          )}

          {activeTab === 'matches' && (
            <FinishedMatchesPanel
              users={users}
              onInspectUser={(username) => openLeaderboard(username, 'profile')}
            />
          )}
        </main>

        {/* RIGHT: Persistent Chat + Users panel (always visible) */}
        <aside className="lobby-aside">
          <section className="aside-chat-section">
            <div className="aside-section-header">
              <span className="aside-section-title">💬 {t('lobby','global_chat')}</span>
              {unreadChat > 0 && (
                <span className="aside-unread-badge">{unreadChat > 9 ? '9+' : unreadChat}</span>
              )}
            </div>
            <div className="aside-chat-body">
              <ChatBox
                prefill={chatPrefill}
                onPrefillUsed={() => setChatPrefill('')}
                onMessage={() => setUnreadChat(0)}
                onUserClick={(username) => {
                  const found = users.find(
                    (u) => u.userName.toLowerCase() === username.toLowerCase(),
                  )
                  if (found) {
                    setSelectedUser(found)
                  } else {
                    setSelectedUser({
                      userName: username,
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
                    })
                  }
                }}
              />
            </div>
          </section>

          <section className="aside-users-section">
            <div className="aside-section-header">
              <span className="aside-section-title">👥 {t('lobby.online_users')} ({users.length})</span>
              <button
                type="button"
                className="view-leaderboard-btn"
                onClick={() => openLeaderboard(conn?.username, 'room')}
                title={t('lobby','nav_ranking')}
              >
                🏆
              </button>
            </div>
            <ul className="users-list aside-users-list">
              {users.map((u) => (
                <li
                  key={u.userName}
                  className="user-list-item interactive"
                  onClick={() => setSelectedUser(u)}
                  style={{ cursor: 'pointer' }}
                  title={`${t('lobby','view_profile_hint')} ${u.userName}`}
                >
                  <span className={`dot ${u.infoGames ? 'playing' : 'online'}`} />
                  <AvatarImage avatarId={u.avatarId} username={u.userName} size="medium" />
                  <div className="user-info-col">
                    <div className="user-name-row">
                      {u.flagName && <CountryFlag flagName={u.flagName} className="user-list-flag" showTextFallback />}
                      <span className="user-name-text">{u.userName}</span>
                    </div>
                    <div className="user-name-row">
                      <RankBadge elo={u.constructedRating} compact />
                      {u.infoPing && <PingBadge infoPing={u.infoPing} compact />}
                    </div>
                  </div>
                  {u.infoGames ? (
                    <span className="game-info-badge">⚔️</span>
                  ) : (
                    <span className="lobby-idle-badge">{t('lobby.in_lobby')}</span>
                  )}
                </li>
              ))}
              {users.length === 0 && (
                <li className="users-empty-item">
                  <span className="empty">{t('lobby.waiting_players')}</span>
                </li>
              )}
            </ul>
          </section>
        </aside>
      </div>

      {/* Collapsible Debug Drawer Toggle at Bottom */}
      {import.meta.env.DEV && (
        <div className="debug-drawer-container">
          <button
            type="button"
            className="debug-toggle-btn"
            onClick={() => setShowDebug(!showDebug)}
          >
            <span>🛠️ {t('lobby','debug_title')} ({events.length})</span>
            <span>{showDebug ? `▼ ${t('common','close')}` : `▲ ${t('common','loading')}`}</span>
          </button>

          {showDebug && (
            <div className="debug-drawer-panel panel">
              <div className="debug-drawer-header">
                <h3>{t('lobby','debug_ws_log')}</h3>
                <span className="debug-count">{events.length} {t('common','loading')}</span>
              </div>
              <ul className="events-list">
                {events.slice(-50).map((e, i) => (
                  <li key={i}>
                    <span className="debug-time">{new Date(e.time).toLocaleTimeString()}</span>
                    <span className="debug-method">{e.method}</span>
                  </li>
                ))}
                {events.length === 0 && <p className="empty">{t('lobby','waiting_players')}</p>}
              </ul>
            </div>
          )}
        </div>
      )}

      {showCreate && <CreateTableDialog onClose={() => setShowCreate(false)} />}
      {showLeaderboard && (
        <LeaderboardModal
          users={users}
          currentUsername={conn?.username ?? ''}
          initialTargetUsername={leaderboardTarget}
          initialTab={leaderboardTab}
          onClose={() => {
            setShowLeaderboard(false)
            setLeaderboardTarget(undefined)
            setLeaderboardTab('room')
          }}
        />
      )}
      {selectedUser && (
        <UserActionModal
          user={selectedUser}
          currentUsername={conn?.username ?? ''}
          tables={tables}
          onWhisper={(username) => {
            setActiveTab('community')
            setChatPrefill(`/w ${username} `)
          }}
          onViewLeaderboard={(username) => {
            openLeaderboard(username, 'profile')
          }}
          onWatchTable={async (tableId) => {
            setNotice(tStatic('lobby','watch_btn'))
            const watched = await withTimeout(cmds.watchTable(tableId), 15000, 'watchTable')
            setNotice(watched.ok ? tStatic('lobby','watch_btn') : tStatic('errors','generic_error'))
          }}
          onClose={() => setSelectedUser(null)}
        />
      )}
      {joiningTable && (
        <JoinTableDialog
          table={joiningTable}
          busy={busyTable === joiningTable.tableId}
          onClose={() => setJoiningTable(null)}
          onJoin={handleJoinWithDeck}
        />
      )}
      {bracketTable && (
        <div className="tournament-modal-backdrop" role="presentation" onClick={closeBracket} data-testid="tournament-modal-backdrop">
          <div className="tournament-modal" role="dialog" aria-modal="true" aria-label={t('lobby','view_bracket')} onClick={(e) => e.stopPropagation()} data-testid="tournament-modal">
            <div className="tournament-bracket-toolbar">
              <span style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>🏆 {bracketTable.tableName}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="tournament-refresh-btn" onClick={() => void refreshBracket()} disabled={bracketLoading}>
                  {bracketLoading ? t('lobby','matches_loading') : `🔄 ${t('lobby','matches_refresh')}`}
                </button>
                <button type="button" className="tournament-close-btn" onClick={closeBracket} aria-label={t('common','close')}>✕</button>
              </div>
            </div>
            <div className="tournament-modal-scroll">
              {bracketLoading && !bracketView && <div className="tournament-modal-loading">{t('lobby','matches_loading')}</div>}
              {bracketError && <div className="tournament-modal-error" data-testid="tournament-modal-error">{bracketError}</div>}
              {bracketView && (
                <TournamentBracket
                  view={bracketView}
                  tournamentId={bracketTable.tableId}
                  onClose={closeBracket}
                />
              )}
              {!bracketView && !bracketLoading && !bracketError && (
                <div className="tournament-modal-loading" data-testid="tournament-empty">
                  {t('lobby','matches_empty')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {showDownloadImages && (
        <DownloadImagesDialog onClose={() => setShowDownloadImages(false)} />
      )}
    </div>
  )
}

