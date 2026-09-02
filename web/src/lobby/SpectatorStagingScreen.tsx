import { useMemo, useState } from 'react'
import { hideStaging, leaveStagingTable, removeStagingTable, returnToLobby, setMyDeck, startStagedMatch, useStore } from '../state/store'
import type { SeatView, TableView } from '../net/types'
import * as cmds from '../net/commands'
import ChatBox from './ChatBox'
import JoinTableDialog from './JoinTableDialog'
import type { Deck } from './decks'
import { useTranslation } from '../i18n'
import './SpectatorStagingScreen.css'

export default function SpectatorStagingScreen({
  table,
  onLeave,
  mode = 'spectator',
}: {
  table?: TableView | null
  onLeave?: () => void
  mode?: 'spectator' | 'player'
}) {
  const { t } = useTranslation()
  const storeTable = useStore((s) => s.watchingTable)
  const lobby = useStore((s) => s.lobby)
  const conn = useStore((s) => s.conn)
  const messages = useStore((s) => s.chatMessages)
  const chatId = useStore((s) => s.roomChatId)
  const stagingTableId = useStore((s) => s.stagingTableId)
  const stagedTable = useMemo(
    () => (mode === 'player' && stagingTableId ? lobby?.tables.find((tb) => tb.tableId === stagingTableId) ?? null : null),
    [mode, stagingTableId, lobby?.tables],
  )
  const activeTable = table || stagedTable || storeTable
  const hostName = activeTable?.controllerName ? activeTable.controllerName.split(',')[0].trim() : ''
  const isOwner = !!hostName && !!conn?.username
    && hostName.toLowerCase() === conn.username.toLowerCase()
  const isReady = activeTable?.tableState === 'READY_TO_START'

  const [showChangeDeck, setShowChangeDeck] = useState(false)
  const [myReadyState, setMyReadyState] = useState(true)

  const playerReadyMap = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const m of messages) {
      if (m.message?.includes('[NEXUS_READY]')) {
        const u = (m.username || m.message.replace(/.*\[NEXUS_READY\]\s*/, '')).trim().toLowerCase()
        if (u) map[u] = true
      } else if (m.message?.includes('[NEXUS_NOT_READY]')) {
        const u = (m.username || m.message.replace(/.*\[NEXUS_NOT_READY\]\s*/, '')).trim().toLowerCase()
        if (u) map[u] = false
      }
    }
    return map
  }, [messages])

  const myUsername = conn?.username?.toLowerCase()
  const myIsReady = myUsername && playerReadyMap[myUsername] !== undefined ? playerReadyMap[myUsername] : myReadyState

  const handleToggleReady = () => {
    const next = !myIsReady
    setMyReadyState(next)
    if (chatId && conn?.username) {
      const code = next ? `[NEXUS_READY] ${conn.username}` : `[NEXUS_NOT_READY] ${conn.username}`
      void cmds.sendChatMessage(chatId, code)
    }
  }

  const seats = useMemo(() => activeTable?.seats ?? [], [activeTable?.seats])
  const is1v1 = (activeTable?.seats.length ?? 0) <= 2 && !activeTable?.gameType?.toLowerCase().includes('commander')
  const hasEmptySeats = seats.some((s) => !s.playerName)

  const getSeatReadiness = (seat?: SeatView) => {
    if (!seat?.playerName) return 'empty'
    if (seat.playerType && seat.playerType !== 'HUMAN') return 'ready'
    const lower = seat.playerName.toLowerCase()
    if (lower === myUsername) {
      return myIsReady ? 'ready' : 'preparing'
    }
    if (playerReadyMap[lower] === false) return 'preparing'
    return 'ready'
  }

  const allPlayersReady = useMemo(() => {
    if (!isReady) return false
    for (const s of seats) {
      if (!s.playerName) continue
      if (s.playerType && s.playerType !== 'HUMAN') continue
      const lower = s.playerName.toLowerCase()
      if (lower === myUsername) {
        if (!myIsReady) return false
      } else if (playerReadyMap[lower] === false) {
        return false
      }
    }
    return true
  }, [isReady, seats, myUsername, myIsReady, playerReadyMap])

  const handleChangeDeck = async (tTable: TableView, deck: Deck, password?: string) => {
    if (isOwner) {
      const otherHumans = seats.some((s) => s.playerName && s.playerName.toLowerCase() !== conn?.username?.toLowerCase() && (!s.playerType || s.playerType === 'HUMAN'))
      if (otherHumans) {
        const ok = window.confirm(t('lobby', 'staging_change_deck_host_warn'))
        if (!ok) return
      }
      await cmds.removeTable(tTable.tableId)
      const simSeats = tTable.seats.filter((s) => s.playerType === 'SIM').length
      const playerTypes = tTable.seats.map((s) => s.playerType || 'HUMAN')
      const createRes = await cmds.createTable({
        name: tTable.tableName,
        gameType: tTable.gameType,
        deckType: tTable.deckType,
        winsNeeded: 1,
        playerTypes,
        password: password?.trim() || undefined,
        skillLevel: tTable.skillLevel || 'CASUAL',
        rated: tTable.rated,
        spectatorsAllowed: tTable.spectatorsAllowed,
        simDecks: simSeats > 0 ? Array.from({ length: simSeats }, () => deck) : undefined,
      })
      if (createRes.ok) {
        const newTableId = (createRes.data as { tableId?: string } | null)?.tableId
        if (newTableId) {
          await cmds.joinTable({
            tableId: newTableId,
            playerName: conn?.username ?? 'player',
            playerType: 'HUMAN',
            skill: 1,
            deck,
            password: password?.trim() || undefined,
          })
        }
      }
    } else {
      await cmds.leaveTable(tTable.tableId)
      await cmds.joinTable({
        tableId: tTable.tableId,
        playerName: conn?.username ?? 'player',
        playerType: 'HUMAN',
        skill: 1,
        deck,
        password: password?.trim() || undefined,
      })
    }
    setMyDeck(deck)
    setShowChangeDeck(false)
  }

  const getSkillBadge = (skill?: string): { label: string; icon: string; className: string } | null => {
    if (!skill) return null
    switch (skill.toUpperCase()) {
      case 'BEGINNER':
        return { label: t('lobby', 'create_skill_beginner'), icon: '⭐', className: 'skill-beginner' }
      case 'CASUAL':
        return { label: t('lobby', 'create_skill_casual'), icon: '⭐⭐', className: 'skill-casual' }
      case 'SERIOUS':
        return { label: t('lobby', 'create_skill_competitive'), icon: '⭐⭐⭐', className: 'skill-serious' }
      default:
        return null
    }
  }

  const skill = getSkillBadge(activeTable?.skillLevel)

  const handleLeave = () => {
    if (mode === 'player') {
      hideStaging()
      return
    }
    if (onLeave) onLeave()
    else returnToLobby()
  }

  return (
    <div className="spectator-staging-screen">
      {/* Top Header */}
      <header className="staging-top-header">
        <div className="staging-brand">
          <img src="/logo.jpeg" alt="XMage Nexus" className="staging-logo" />
          <div className="staging-titles">
            <h1 className="staging-main-title">XMage Nexus</h1>
            <span className="staging-subtitle">{t('lobby','staging_title')}</span>
          </div>
        </div>

        <button
          type="button"
          className="staging-leave-btn"
          onClick={handleLeave}
          data-testid="staging-back"
          title={mode === 'player' ? t('lobby','staging_back_hint') : t('lobby','staging_leave_hint')}
        >
          <span>🚪 {t('lobby','staging_back_lobby')}</span>
        </button>
      </header>

      {/* Center Staging Area */}
      <main className="staging-main-container">
        <div className="staging-arena-card panel">
          {/* Table Header Info */}
          <div className="staging-card-header">
            <div className="staging-title-row">
              <span className="staging-status-pill">{mode === 'player' ? `🪑 ${t('lobby','staging_mode_player')}` : `👁️ ${t('lobby','staging_mode_spectator')}`}</span>
              <h2 className="staging-table-name">{activeTable?.tableName || `${t('lobby','staging_waiting_fallback')} ${t('lobby','staging_title') && ''}`}</h2>
            </div>

            <div className="staging-tags-row">
              <span className="staging-tag tag-game">🎮 {activeTable?.gameType || t('lobby','staging_duel_fallback')}</span>
              <span className="staging-tag tag-deck">📜 {activeTable?.deckType || 'Constructed'}</span>
              {skill && (
                <span className={`staging-tag tag-skill ${skill.className}`}>
                  {skill.icon} {skill.label}
                </span>
              )}
              {activeTable?.rated ? (
                <span className="staging-tag tag-rated">🏅 {t('lobby','tag_rated')}</span>
              ) : (
                <span className="staging-tag tag-unrated">{t('lobby','tag_unrated')}</span>
              )}
              {activeTable?.passworded && (
                <span className="staging-tag tag-private">🔒 {t('lobby','tag_private')}</span>
              )}
              <span className="staging-tag tag-seats">👥 {activeTable?.seatsInfo || t('lobby','staging_seats_count', { count: seats.length })}</span>
            </div>
          </div>

          {/* Arena Roster: 1v1 Face-off or Multiplayer Pod */}
          <div className="staging-roster-area">
            {is1v1 ? (
              <div className="staging-duel-roster">
                {/* Player 1 (Host / Left) */}
                <div className={`staging-player-card ${seats[0]?.playerName ? 'occupied' : 'empty'}`}>
                  <div className="player-avatar-circle">
                    {seats[0]?.playerName ? (
                      seats[0]?.playerType === 'HUMAN' || !seats[0]?.playerType ? '👤' : '🤖'
                    ) : (
                      '⭕'
                    )}
                  </div>
                  <div className="player-meta">
                    <span className="player-card-name">
                      {seats[0]?.playerName || t('lobby','staging_waiting_player')}
                      {hostName && seats[0]?.playerName?.toLowerCase() === hostName.toLowerCase() && (
                        <span className="player-crown" title={t('lobby','staging_host_crown')}>👑</span>
                      )}
                    </span>
                    {(() => {
                      const readiness = getSeatReadiness(seats[0])
                      return (
                        <span className={`player-status-tag ${readiness}`}>
                          {readiness === 'empty'
                            ? t('lobby','staging_seat_available')
                            : readiness === 'preparing'
                            ? t('lobby','staging_status_preparing')
                            : t('lobby','staging_status_ready')}
                        </span>
                      )
                    })()}
                  </div>
                </div>

                {/* VS Glowing Emblem */}
                <div className="staging-vs-emblem">
                  <span className="vs-text">{t('lobby','staging_vs')}</span>
                  <div className="vs-line" />
                </div>

                {/* Player 2 (Challenger / Right) */}
                <div className={`staging-player-card ${seats[1]?.playerName ? 'occupied' : 'empty'}`}>
                  <div className="player-avatar-circle">
                    {seats[1]?.playerName ? (
                      seats[1]?.playerType === 'HUMAN' || !seats[1]?.playerType ? '👤' : '🤖'
                    ) : (
                      '⭕'
                    )}
                  </div>
                  <div className="player-meta">
                    <span className="player-card-name">
                      {seats[1]?.playerName || t('lobby','staging_waiting_opponent')}
                      {hostName && seats[1]?.playerName?.toLowerCase() === hostName.toLowerCase() && (
                        <span className="player-crown" title={t('lobby','staging_host_crown')}>👑</span>
                      )}
                    </span>
                    {(() => {
                      const readiness = getSeatReadiness(seats[1])
                      return (
                        <span className={`player-status-tag ${readiness}`}>
                          {readiness === 'empty'
                            ? t('lobby','staging_waiting_opponent_short')
                            : readiness === 'preparing'
                            ? t('lobby','staging_status_preparing')
                            : t('lobby','staging_status_ready')}
                        </span>
                      )
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              /* Multiplayer Grid (Commander / FFA) */
              <div className="staging-multi-grid">
                {seats.map((s, idx) => {
                  const isHost = !!hostName && !!s.playerName && s.playerName.toLowerCase() === hostName.toLowerCase()
                  const isOccupied = !!s.playerName
                  const readiness = getSeatReadiness(s)
                  return (
                    <div key={idx} className={`staging-player-card ${isOccupied ? 'occupied' : 'empty'}`}>
                      <div className="player-avatar-circle">
                        {isOccupied ? (s.playerType === 'HUMAN' || !s.playerType ? '👤' : '🤖') : '⭕'}
                      </div>
                      <div className="player-meta">
                        <span className="player-card-name">
                          {s.playerName || t('lobby','staging_seat_number', { number: idx + 1 })}
                          {isHost && <span className="player-crown" title={t('lobby','staging_host_crown')}>👑</span>}
                        </span>
                        <span className={`player-status-tag ${readiness}`}>
                          {readiness === 'empty'
                            ? t('lobby','staging_available')
                            : readiness === 'preparing'
                            ? t('lobby','staging_status_preparing')
                            : t('lobby','staging_status_ready')}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Status Message & Pulse Indicator */}
          <div className="staging-pulse-banner">
            <div className="pulse-spinner" />
            <div className="pulse-text-group">
              <span className="pulse-headline">
                {isReady
                  ? allPlayersReady
                    ? `✨ ${t('lobby','staging_all_ready')}`
                    : `⏳ ${t('lobby','staging_waiting_players_ready')}`
                  : hasEmptySeats
                  ? `⏳ ${t('lobby','staging_waiting_seats')}`
                  : `⏳ ${t('lobby','staging_preparing')}`}
              </span>
              <span className="pulse-subline">
                {mode === 'player'
                  ? t('lobby','staging_player_hint')
                  : t('lobby','staging_auto_connect')}
              </span>
            </div>
          </div>

          {mode === 'player' && (
            <div className="staging-player-actions" data-testid="staging-player-actions">
              {isReady && isOwner && (
                <button
                  type="button"
                  className="staging-action-btn primary"
                  data-testid="staging-start"
                  onClick={() => void startStagedMatch()}
                  disabled={!allPlayersReady}
                  title={!allPlayersReady ? t('lobby','staging_start_blocked_not_ready') : undefined}
                >
                  ▶️ {t('lobby','start_match_btn')}
                </button>
              )}
              <button
                type="button"
                className={`staging-action-btn ${myIsReady ? 'ready-toggle-on' : 'ready-toggle-off'}`}
                data-testid="staging-toggle-ready"
                onClick={handleToggleReady}
              >
                {myIsReady ? `⏳ ${t('lobby','staging_btn_not_ready')}` : `✅ ${t('lobby','staging_btn_ready')}`}
              </button>
              <button
                type="button"
                className="staging-action-btn"
                data-testid="staging-change-deck"
                onClick={() => setShowChangeDeck(true)}
              >
                🃏 {t('lobby','staging_btn_change_deck')}
              </button>
              <button
                type="button"
                className="staging-action-btn"
                data-testid="staging-leave"
                onClick={() => void leaveStagingTable()}
              >
                🚪 {t('lobby','staging_leave_table')}
              </button>
              {isOwner && (
                <button
                  type="button"
                  className="staging-action-btn danger"
                  data-testid="staging-remove"
                  onClick={() => void removeStagingTable()}
                >
                  🗑️ {t('lobby','staging_remove_table')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Embedded Global Chat */}
        <div className="staging-chat-card panel">
          <div className="staging-chat-header">
            <h3>💬 {t('lobby','staging_chat_title')}</h3>
            <span className="chat-hint">{t('lobby','staging_chat_hint')}</span>
          </div>
          <div className="staging-chat-body">
            <ChatBox />
          </div>
        </div>
      </main>

      {showChangeDeck && activeTable && (
        <JoinTableDialog
          table={activeTable}
          title={t('lobby','staging_change_deck_title')}
          submitLabel={t('lobby','staging_change_deck_confirm')}
          onClose={() => setShowChangeDeck(false)}
          onJoin={handleChangeDeck}
        />
      )}
    </div>
  )
}
