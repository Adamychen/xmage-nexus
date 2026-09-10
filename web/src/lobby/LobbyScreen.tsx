import { useState, useMemo, useEffect } from 'react'
import { useLobby, useStore, openStagingTable } from '../state/store'
import * as cmds from '../net/commands'
import type { UsersView } from '../net/types'
import { cacheAvatar } from './avatarCache'
import CreateTableDialog from './CreateTableDialog'
import JoinTableDialog from './JoinTableDialog'
import DecksGallery from '../decks/DecksGallery'
import DeckBuilder from '../decks/DeckBuilder'
import LeaderboardModal from './LeaderboardModal'
import UserActionModal from './UserActionModal'
import TableFilterBar, { INITIAL_TABLE_FILTERS, countActiveFilters, filterTables, type TableFilters } from './TableFilterBar'
import Icon from '../ui/Icon'
import FinishedMatchesPanel from './FinishedMatchesPanel'
import { t as tStatic, translateError } from '../i18n'
import { useTranslation } from '../i18n'
import { setState } from '../state/state'
import LobbyHeader, { type LeaderboardTab } from './LobbyHeader'
import { LobbyMobileNav } from './LobbySidebar'
import FloatingChat from './FloatingChat'
import TableCard from './TableCard'
import ActiveTablesBar from './ActiveTablesBar'
import './FloatingChat.css'
import TournamentBracketModal from './TournamentBracketModal'
import { useTableActions } from './useTableActions'
import { useInviteLink } from './useInviteLink'
import { useTournamentBracket } from './useTournamentBracket'
import { extractLobbyUsers, getMyActiveTables, withTimeout, type LobbyTab } from './lobbyUtils'
import { getIgnoredUsers } from './ignoreList'
import SettingsModal from '../settings/SettingsModal'
import AboutModal from '../system/AboutModal'
import { useNewsBadge } from '../system/useNewsBadge'
import './LobbyScreen.css'
import './TournamentBracket.css'

export default function LobbyScreen() {
  const { t, tError } = useTranslation()
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
  const [showAbout, setShowAbout] = useState(false)
  const { unseen: unseenNews, refresh: refreshNews } = useNewsBadge()
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboardTarget, setLeaderboardTarget] = useState<string | undefined>(undefined)
  const [leaderboardTab, setLeaderboardTab] = useState<LeaderboardTab>('room')
  const [selectedUser, setSelectedUser] = useState<UsersView | null>(null)
  const [chatPrefill, setChatPrefill] = useState<string>('')
  const [showDebug, setShowDebug] = useState(false)
  const [filters, setFilters] = useState<TableFilters>(() => {
    try {
      const saved = localStorage.getItem('lobby_filters')
      return saved ? { ...INITIAL_TABLE_FILTERS, ...JSON.parse(saved) } : INITIAL_TABLE_FILTERS
    } catch { return INITIAL_TABLE_FILTERS }
  })
  const [mobileChatOpen, setMobileChatOpen] = useState(() => {
    try { return localStorage.getItem('floating_chat_open') === '1' } catch { return false }
  })
  useEffect(() => {
    try { localStorage.setItem('floating_chat_open', mobileChatOpen ? '1' : '0') } catch {}
  }, [mobileChatOpen])
  const [showSettings, setShowSettings] = useState(false)
  const [showFilters, setShowFilters] = useState(() => {
    try {
      const savedOpen = localStorage.getItem('tables_filters_open')
      if (savedOpen !== null) return savedOpen === '1'
      const saved = localStorage.getItem('lobby_filters')
      const parsed = saved ? { ...INITIAL_TABLE_FILTERS, ...JSON.parse(saved) } : INITIAL_TABLE_FILTERS
      return countActiveFilters(parsed) > 0
    } catch { return false }
  })

  const tableActions = useTableActions(conn)
  const { joiningTable, setJoiningTable, joinPassword, setJoinPassword, busyTable, notice, setNotice } = tableActions
  const bracket = useTournamentBracket()

  const openLeaderboard = (target?: string, tab: LeaderboardTab = 'room') => {
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

  const myActiveTables = useMemo(
    () => getMyActiveTables(tables, conn?.username, stagingTableId),
    [tables, conn?.username, stagingTableId],
  )
  useInviteLink({
    conn,
    tables,
    hasLobby: lobby !== null,
    joinHuman: tableActions.joinHuman,
    watchTable: tableActions.watchTable,
    setNotice,
  })

  const filteredTables = useMemo(() => {
    let ignored: string[] = []
    try { ignored = getIgnoredUsers() } catch { ignored = [] }
    return filterTables(tables, filters, ignored, conn?.username, stagingTableId)
  }, [tables, filters, conn?.username, stagingTableId, selectedUser])

  // Cachear automáticamente el avatar real del usuario conectado
  useEffect(() => {
    if (conn?.username && conn?.avatarId && conn.avatarId > 0) {
      cacheAvatar(conn.username, conn.avatarId)
    }
  }, [conn?.username, conn?.avatarId])

  return (
    <div className="lobby">
      <LobbyHeader
        conn={conn}
        myUser={myUser}
        onlineCount={users.length}
        confirmDisconnect={confirmDisconnect}
        onConfirmDisconnect={setConfirmDisconnect}
        onOpenSettings={() => setShowSettings(true)}
        onOpenLeaderboard={openLeaderboard}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        tableCount={tables.length}
        activeTableCount={myActiveTables.length}
        onGoToActiveTable={() => {
          setActiveTab('tables')
          if (myActiveTables.length === 1) {
            const only = myActiveTables[0]
            if (only.tableState === 'DUELING') {
              tableActions.watchTable(only)
            } else {
              openStagingTable(only.tableId)
            }
          }
        }}
        onCreate={() => setShowCreate(true)}
        onOpenAbout={() => setShowAbout(true)}
        hasNews={unseenNews}
      />

      {error && <div className="error-box panel lobby-error-banner">{tError(error)}</div>}
      {notice && <div className="notice panel lobby-notice-banner">{notice}</div>}

      {/* Single-column main area: nav lives in the topstrip, chat is floating */}
      <div className="lobby-columns lobby-columns-single">

        {/* CENTER: Main tab content */}
        <main className={`lobby-main ${deckBuilderId ? 'has-deck-builder' : ''}`}>
          {activeTab === 'tables' && (
            <div className="lobby-tables-view">
              <section className="panel tables-panel">
                <div className="tables-panel-header">
                  <div className="tables-header-title-row">
                    <h2>
                      {t('lobby.tables_heading')} ({filteredTables.length}
                      {filteredTables.length !== tables.length ? ` / ${tables.length}` : ''})
                    </h2>
                    <span className="tables-deck-hint">{t('lobby.tables_deck_hint')}</span>
                  </div>
                  <div className="tables-header-actions">
                    <div className="hero-deck-badge" title={`${t('lobby.active_deck')}: ${myDeck?.name ?? '—'}`}>
                      <span className="hero-deck-label">{t('lobby.active_deck')}:</span>
                      <span className="hero-deck-name"><Icon name="layers" size={13} /> {myDeck?.name ?? '—'}</span>
                    </div>
                    <button
                      type="button"
                      className={`tables-filter-toggle ${showFilters ? 'is-open' : ''} ${countActiveFilters(filters) > 0 ? 'has-active' : ''}`}
                      onClick={() => {
                        setShowFilters((v) => {
                          try { localStorage.setItem('tables_filters_open', v ? '0' : '1') } catch {}
                          return !v
                        })
                      }}
                      aria-expanded={showFilters}
                      title={t('lobby.filter_search_placeholder')}
                    >
                      <Icon name="filter" size={14} />
                      {countActiveFilters(filters) > 0 && (
                        <span className="tables-filter-count">{countActiveFilters(filters)}</span>
                      )}
                      <Icon name={showFilters ? 'chevronUp' : 'chevronDown'} size={13} />
                    </button>
                  </div>
                </div>

                <div className={`tables-filter-collapse ${showFilters ? 'is-open' : ''}`}>
                  <div className="tables-filter-collapse-inner">
                    <TableFilterBar
                      className="in-panel"
                      tables={tables}
                      filters={filters}
                      onChange={(f) => { setFilters(f); try { localStorage.setItem('lobby_filters', JSON.stringify(f)) } catch {} }}
                      onReset={() => { setFilters(INITIAL_TABLE_FILTERS); try { localStorage.removeItem('lobby_filters') } catch {} }}
                    />
                  </div>
                </div>

                {myActiveTables.length > 0 && (
                  <ActiveTablesBar
                    tables={myActiveTables}
                    onOpenStaging={(tableId) => openStagingTable(tableId)}
                    onStart={tableActions.startTable}
                    onWatch={tableActions.watchTable}
                  />
                )}

                <div className="tables-list">
                  {filteredTables.map((tTable) => (
                    <TableCard
                      key={tTable.tableId}
                      tTable={tTable}
                      users={users}
                      username={conn?.username}
                      avatarId={conn?.avatarId}
                      stagingTableId={stagingTableId}
                      busyTable={busyTable}
                      onJoinHuman={tableActions.joinHuman}
                      onJoinAi={tableActions.joinAi}
                      onStart={tableActions.startTable}
                      onWatch={tableActions.watchTable}
                      onOpenBracket={bracket.openBracket}
                      onSelectUser={setSelectedUser}
                    />
                  ))}

                  {filteredTables.length === 0 && tables.length === 0 && (
                    <div className="tables-empty-state">
                      <span className="empty-icon"><Icon name="castle" size={30} /></span>
                      <h3>{t('lobby','empty_tables')}</h3>
                      <p>{t('lobby','tables_deck_hint')}</p>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <button className="primary" onClick={() => setShowCreate(true)}>
                          <Icon name="plus" size={13} /> {t('lobby','create_table_btn')}
                        </button>
                      </div>
                    </div>
                  )}

                  {filteredTables.length === 0 && tables.length > 0 && (
                    <div className="tables-empty-match">
                      <span className="empty-match-icon"><Icon name="search" size={28} /></span>
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

        <FloatingChat
          users={users}
          chatPrefill={chatPrefill}
          onPrefillUsed={() => setChatPrefill('')}
          unreadChat={unreadChat}
          onMessageRead={() => setUnreadChat(0)}
          onSelectUser={setSelectedUser}
          onOpenRoomLeaderboard={() => openLeaderboard(conn?.username, 'room')}
          open={mobileChatOpen}
          onOpenChange={setMobileChatOpen}
        />

        <LobbyMobileNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onCreate={() => setShowCreate(true)}
          mobileChatOpen={mobileChatOpen}
          onToggleChat={() => setMobileChatOpen((v) => !v)}
          onCloseChat={() => setMobileChatOpen(false)}
          unreadChat={unreadChat}
        />
      </div>

      {/* Collapsible Debug Drawer Toggle at Bottom */}
      {import.meta.env.DEV && (
        <div className="debug-drawer-container">
          <button
            type="button"
            className="debug-toggle-btn"
            onClick={() => setShowDebug(!showDebug)}
          >
            <span><Icon name="settings" size={13} /> {t('lobby','debug_title')} ({events.length})</span>
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
            setMobileChatOpen(true)
            setChatPrefill(`/w ${username} `)
          }}
          onViewLeaderboard={(username) => {
            openLeaderboard(username, 'profile')
          }}
          onWatchTable={async (tableId) => {
            setState({ error: null })
            setNotice(null)
            const watched = await withTimeout(cmds.watchTable(tableId), 15000, 'watchTable')
            if (watched.ok) setNotice(tStatic('lobby','watch_btn'))
            else setState({ error: translateError((watched as { error?: string }).error || tStatic('errors','generic_error'), 'watchTable') })
          }}
          onClose={() => setSelectedUser(null)}
        />
      )}
      {joiningTable && (
        <JoinTableDialog
          table={joiningTable}
          busy={busyTable === joiningTable.tableId}
          initialPassword={joinPassword}
          onClose={() => { setJoiningTable(null); setJoinPassword(undefined) }}
          onJoin={tableActions.handleJoinWithDeck}
        />
      )}
      {bracket.bracketTable && (
        <TournamentBracketModal
          table={bracket.bracketTable}
          view={bracket.bracketView}
          loading={bracket.bracketLoading}
          error={bracket.bracketError}
          onClose={bracket.closeBracket}
          onRefresh={() => void bracket.refreshBracket()}
          onWatchMatch={(id) => void bracket.watchMatch(id)}
          watchingMatchId={bracket.watchingMatchId}
        />
      )}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
      {showAbout && (
        <AboutModal
          onClose={() => {
            setShowAbout(false)
            refreshNews()
          }}
        />
      )}
    </div>
  )
}
