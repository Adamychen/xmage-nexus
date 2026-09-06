import { useMemo, useState } from 'react'
import { hideStaging, leaveStagingTable, removeStagingTable, returnToLobby, setMyDeck, startStagedMatch, useStore } from '../state/store'
import { setState } from '../state/state'
import type { SeatView, TableView } from '../net/types'
import * as cmds from '../net/commands'
import ChatBox from './ChatBox'
import JoinTableDialog from './JoinTableDialog'
import CountryFlag from './CountryFlag'
import RankBadge from './RankBadge'
import Icon from '../ui/Icon'
import { formatSeatHistory } from './lobbyUtils'
import { requestDeckValidation } from './DeckIssuesDialog'
import type { Deck } from './decks'
import { useTranslation } from '../i18n'
import { translateError } from '../i18n'
import { prepareDeckForXMage } from '../decks/deckNormalize'
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
  const tableChatId = useStore((s) => s.tableChatId)
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
    const scopeId = tableChatId ?? chatId
    for (const m of messages) {
      if (scopeId && m.chatId && m.chatId !== scopeId) continue
      if (m.message?.includes('[NEXUS_READY]')) {
        const u = (m.username || m.message.replace(/.*\[NEXUS_READY\]\s*/, '')).trim().toLowerCase()
        if (u) map[u] = true
      } else if (m.message?.includes('[NEXUS_NOT_READY]')) {
        const u = (m.username || m.message.replace(/.*\[NEXUS_NOT_READY\]\s*/, '')).trim().toLowerCase()
        if (u) map[u] = false
      }
    }
    return map
  }, [messages, tableChatId, chatId])

  const myUsername = conn?.username?.toLowerCase()
  const myIsReady = myUsername && playerReadyMap[myUsername] !== undefined ? playerReadyMap[myUsername] : myReadyState
  const handleToggleReady = () => {
    const next = !myIsReady
    setMyReadyState(next)
    const target = tableChatId ?? chatId
    if (target && conn?.username) {
      const code = next ? `[NEXUS_READY] ${conn.username}` : `[NEXUS_NOT_READY] ${conn.username}`
      void cmds.sendChatMessage(target, code)
    }
  }

  const canOrder = mode === 'player' && isOwner && !!activeTable
  const dndEnabled = canOrder && isReady
  const [lastSwap, setLastSwap] = useState<{ a: number; b: number } | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)

  const handleSwapPair = async (a: number, b: number) => {
    if (!activeTable || a === b) return
    const res = await cmds.swapSeats(activeTable.tableId, a, b)
    if (!res.ok) {
      const code = (res as { errorCode?: string }).errorCode
      setState({ error: translateError(res.error || code || '', 'swapSeats', code) })
      return
    }
    setLastSwap({ a, b })
    window.setTimeout(() => setLastSwap(null), 700)
  }

  const handleSwapSeats = async (idx: number, dir: -1 | 1) => {
    await handleSwapPair(idx, idx + dir)
  }

  const seatDnD = (idx: number, occupied: boolean) => {
    if (!dndEnabled || !occupied) return {}
    return {
      draggable: true,
      onDragStart: (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(idx))
        setDragIdx(idx)
      },
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDropIdx(idx)
      },
      onDragLeave: () => setDropIdx((cur) => (cur === idx ? null : cur)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        const from = dragIdx ?? Number(e.dataTransfer.getData('text/plain'))
        setDragIdx(null)
        setDropIdx(null)
        if (Number.isInteger(from)) void handleSwapPair(from, idx)
      },
      onDragEnd: () => {
        setDragIdx(null)
        setDropIdx(null)
      },
    }
  }

  const dropClass = (idx: number) => (dropIdx === idx && dragIdx !== idx ? ' seat-drop-target' : '')

  const swappedClass = (idx: number) =>
    lastSwap && (lastSwap.a === idx || lastSwap.b === idx) ? ' seat-just-moved' : ''

  const renderSeatOrder = (idx: number, occupied: boolean, variant: 'linear' | 'ring' = 'linear') => {
    if (!canOrder || !occupied) return null
    const locked = !isReady
    const title = (labelKey: 'staging_seat_move_up' | 'staging_seat_move_down') =>
      locked ? t('lobby', 'staging_seat_move_locked') : t('lobby', labelKey)
    const btn = (dir: -1 | 1, testId: string, labelKey: 'staging_seat_move_up' | 'staging_seat_move_down') => (
      <button
        type="button"
        className="seat-order-btn"
        data-testid={testId}
        title={title(labelKey)}
        aria-label={title(labelKey)}
        disabled={locked || (dir < 0 ? idx <= 0 : idx >= seats.length - 1)}
        onClick={() => void handleSwapSeats(idx, dir)}
      >
        <Icon
          name={variant === 'ring' ? (dir < 0 ? 'rotateCcw' : 'rotateCw') : dir < 0 ? 'chevronUp' : 'chevronDown'}
          size={12}
        />
      </button>
    )
    return (
      <span className="seat-order-btns">
        {btn(-1, `staging-seat-up-${idx}`, 'staging_seat_move_up')}
        {btn(1, `staging-seat-down-${idx}`, 'staging_seat_move_down')}
      </span>
    )
  }

  const seats = useMemo(() => activeTable?.seats ?? [], [activeTable?.seats])
  const filledSeats = seats.filter((s) => !!s.playerName).length
  const is1v1 = (activeTable?.seats.length ?? 0) <= 2 && !activeTable?.gameType?.toLowerCase().includes('commander')
  const hasEmptySeats = seats.some((s) => !s.playerName)

  const getSeatReadiness = (seat?: SeatView) => {    if (!seat?.playerName) return 'empty'
    if (seat.playerType && seat.playerType !== 'HUMAN') return 'ready'
    const lower = seat.playerName.toLowerCase()
    if (lower === myUsername) {
      return myIsReady ? 'ready' : 'preparing'
    }
    if (playerReadyMap[lower] === false) return 'preparing'
    return 'ready'
  }

  /** Rating (limited?limited:constructed, como el desktop) + historial + bandera por asiento. */
  const renderSeatMeta = (seat?: SeatView) => {
    if (!seat?.playerName) return null
    const rating = activeTable?.limited ? (seat.limitedRating ?? 0) : (seat.constructedRating ?? 0)
    const historyInfo = formatSeatHistory(seat.history)
    if (!seat.flagName && !rating && !historyInfo.short) return null
    return (
      <span className="player-seat-meta">
        {seat.flagName ? <CountryFlag flagName={seat.flagName} className="seat-flag" /> : null}
        {rating > 0 ? <RankBadge elo={rating} compact showElo /> : null}
        {historyInfo.short ? (
          <span className="player-seat-history" title={historyInfo.full || `${t('lobby','leaderboard_col_history')}: ${historyInfo.short}`}>
            <Icon name="trophy" size={11} /> {historyInfo.short}
          </span>
        ) : null}
      </span>
    )
  }

  const allPlayersReady = useMemo(() => {    if (!isReady) return false
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
    const xmageDeck = prepareDeckForXMage(deck, tTable.deckType, tTable.gameType)
    const finalDeck = await requestDeckValidation(xmageDeck)
    if (!finalDeck) return
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
        simDecks: simSeats > 0 ? Array.from({ length: simSeats }, () => finalDeck) : undefined,
      })
      if (!createRes.ok) {
        const code = (createRes as { errorCode?: string }).errorCode
        const raw = createRes.error || code || ''
        setState({ error: translateError(raw, 'createTable', code) })
        return
      }
      if (createRes.ok) {
        const newTableId = (createRes.data as { tableId?: string } | null)?.tableId
        if (newTableId) {
          const jr = await cmds.joinTable({
            tableId: newTableId,
            playerName: conn?.username ?? 'player',
            playerType: 'HUMAN',
            skill: 1,
            deck: finalDeck,
            deckType: tTable.deckType,
            gameType: tTable.gameType,
            password: password?.trim() || undefined,
          })
          if (!jr.ok) {
            const code = (jr as { errorCode?: string }).errorCode
            const raw = jr.error || code || ''
            setState({ error: translateError(raw, 'joinTable', code) })
            return
          }
        }
      }
    } else {
      const lv = await cmds.leaveTable(tTable.tableId)
      if (!lv.ok) {
        const code = (lv as { errorCode?: string }).errorCode
        const raw = lv.error || code || ''
        if (raw) setState({ error: translateError(raw, 'leaveTable', code) })
      }
      const jr = await cmds.joinTable({
        tableId: tTable.tableId,
        playerName: conn?.username ?? 'player',
        playerType: 'HUMAN',
        skill: 1,
        deck: finalDeck,
        deckType: tTable.deckType,
        gameType: tTable.gameType,
        password: password?.trim() || undefined,
      })
      if (!jr.ok) {
        const code = (jr as { errorCode?: string }).errorCode
        const raw = jr.error || code || ''
        setState({ error: translateError(raw, 'joinTable', code) })
        return
      }
    }
    setMyDeck(deck)
    setShowChangeDeck(false)
  }

  const getSkillBadge = (skill?: string): { label: string; stars: number; className: string } | null => {
    if (!skill) return null
    switch (skill.toUpperCase()) {
      case 'BEGINNER':
        return { label: t('lobby', 'create_skill_beginner'), stars: 1, className: 'skill-beginner' }
      case 'CASUAL':
        return { label: t('lobby', 'create_skill_casual'), stars: 2, className: 'skill-casual' }
      case 'SERIOUS':
        return { label: t('lobby', 'create_skill_competitive'), stars: 3, className: 'skill-serious' }
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

  const handleStart = () => {
    if (!allPlayersReady) {
      const ok = window.confirm(t('lobby','staging_start_unready_confirm'))
      if (!ok) return
    }
    void startStagedMatch()
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
          <span><Icon name="logout" size={13} /> {t('lobby','staging_back_lobby')}</span>
        </button>
      </header>

      {/* Center Staging Area */}
      <main className="staging-main-container">
        <div className="staging-arena-card panel">
          {/* Table Header Info */}
          <div className="staging-card-header">
            <div className="staging-title-row">
              <span className="staging-status-pill">{mode === 'player' ? (<><Icon name="chair" size={12} /> {t('lobby','staging_mode_player')}</>) : (<><Icon name="eye" size={12} /> {t('lobby','staging_mode_spectator')}</>)}</span>
              <h2 className="staging-table-name">{activeTable?.tableName || `${t('lobby','staging_waiting_fallback')} ${t('lobby','staging_title') && ''}`}</h2>
            </div>

            <div className="staging-tags-row">
              <span className="staging-tag tag-game"><Icon name="gamepad" size={12} /> {activeTable?.gameType || t('lobby','staging_duel_fallback')}</span>
              <span className="staging-tag tag-deck"><Icon name="scrollText" size={12} /> {activeTable?.deckType || 'Constructed'}</span>
              {skill && (
                <span className={`staging-tag tag-skill ${skill.className}`}>
                  {Array.from({ length: skill.stars }, (_, i) => <Icon key={i} name="star" size={11} />)} {skill.label}
                </span>
              )}
              {activeTable?.rated ? (
                <span className="staging-tag tag-rated"><Icon name="medal" size={12} /> {t('lobby','tag_rated')}</span>
              ) : (
                <span className="staging-tag tag-unrated">{t('lobby','tag_unrated')}</span>
              )}
              {activeTable?.passworded && (
                <span className="staging-tag tag-private"><Icon name="lock" size={12} /> {t('lobby','tag_private')}</span>
              )}
              <span className="staging-tag tag-seats"><Icon name="users" size={12} /> {activeTable?.seatsInfo || t('lobby','staging_seats_count', { count: seats.length })}</span>
            </div>
          </div>

          {/* Arena Roster: 1v1 Face-off or Multiplayer Pod */}
          <div className="staging-roster-area">
            {is1v1 ? (
              <div className="staging-duel-roster">
                {/* Player 1 (Host / Left) */}
                <div className={`staging-player-card ${seats[0]?.playerName ? 'occupied' : 'empty'}${seats[0]?.playerName && myUsername && seats[0]?.playerName?.toLowerCase() === myUsername ? ' my-seat' : ''}${swappedClass(0)}${dropClass(0)}`} {...seatDnD(0, !!seats[0]?.playerName)}>
                  <span className="seat-index" title={t('lobby', 'staging_seat_number', { number: 1 })}>1</span>
                  <div className="player-avatar-circle">
                    {seats[0]?.playerName ? (
                      seats[0]?.playerType === 'HUMAN' || !seats[0]?.playerType ? <Icon name="user" size={22} /> : <Icon name="bot" size={22} />
                    ) : (
                      <Icon name="circle" size={22} />
                    )}
                  </div>
                  <div className="player-meta">
                    <span className="player-card-name">
                      {seats[0]?.playerName || t('lobby','staging_waiting_player')}
                      {hostName && seats[0]?.playerName?.toLowerCase() === hostName.toLowerCase() && (
                        <span className="player-crown" title={t('lobby','staging_host_crown')}><Icon name="crown" size={13} /></span>
                      )}
                      {renderSeatOrder(0, !!seats[0]?.playerName)}
                    </span>
                    {renderSeatMeta(seats[0])}
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
                <div className={`staging-player-card ${seats[1]?.playerName ? 'occupied' : 'empty'}${seats[1]?.playerName && myUsername && seats[1]?.playerName?.toLowerCase() === myUsername ? ' my-seat' : ''}${swappedClass(1)}${dropClass(1)}`} {...seatDnD(1, !!seats[1]?.playerName)}>
                  <span className="seat-index" title={t('lobby', 'staging_seat_number', { number: 2 })}>2</span>
                  <div className="player-avatar-circle">
                    {seats[1]?.playerName ? (
                      seats[1]?.playerType === 'HUMAN' || !seats[1]?.playerType ? <Icon name="user" size={22} /> : <Icon name="bot" size={22} />
                    ) : (
                      <Icon name="circle" size={22} />
                    )}
                  </div>
                  <div className="player-meta">
                    <span className="player-card-name">
                      {seats[1]?.playerName || t('lobby','staging_waiting_opponent')}
                      {hostName && seats[1]?.playerName?.toLowerCase() === hostName.toLowerCase() && (
                        <span className="player-crown" title={t('lobby','staging_host_crown')}><Icon name="crown" size={13} /></span>
                      )}
                      {renderSeatOrder(1, !!seats[1]?.playerName)}
                    </span>
                    {renderSeatMeta(seats[1])}
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
            ) : seats.length <= 6 ? (
              /* Pod ring (3-6 players): seats around the table in turn order */
              <div className="staging-ring" data-testid="staging-ring">
                <div className="ring-center">
                  <span className="ring-count">{filledSeats}/{seats.length}</span>
                  <span className="ring-label">{t('lobby', 'staging_seats_count', { count: seats.length })}</span>
                </div>
                {seats.map((s, idx) => {
                  const angle = (idx / seats.length) * Math.PI * 2 - Math.PI / 2
                  const x = 50 + 38 * Math.cos(angle)
                  const y = 50 + 42 * Math.sin(angle)
                  const isHost = !!hostName && !!s.playerName && s.playerName.toLowerCase() === hostName.toLowerCase()
                  const isOccupied = !!s.playerName
                  const isMe = isOccupied && !!myUsername && (s.playerName as string).toLowerCase() === myUsername
                  const readiness = getSeatReadiness(s)
                  if (!isOccupied) {
                    return (
                      <div
                        key={idx}
                        className="ring-seat empty"
                        data-testid={`staging-seat-empty-${idx}`}
                        style={{ left: `${x}%`, top: `${y}%` }}
                        title={t('lobby', 'staging_seat_number', { number: idx + 1 })}
                      >
                        <span className="ring-seat-index">{idx + 1}</span>
                        <span className="ring-empty-plus"><Icon name="plus" size={12} /></span>
                      </div>
                    )
                  }
                  return (
                    <div
                      key={idx}
                      className={`ring-seat occupied ${readiness}${isMe ? ' my-seat' : ''}${swappedClass(idx)}${dropClass(idx)}`}
                      style={{ left: `${x}%`, top: `${y}%` }}
                      title={s.playerName}
                      {...seatDnD(idx, true)}
                    >
                      <span className="ring-seat-index">{idx + 1}</span>
                      <span className="ring-avatar">
                        {s.playerType === 'HUMAN' || !s.playerType ? <Icon name="user" size={18} /> : <Icon name="bot" size={18} />}
                      </span>
                      <span className="ring-name">
                        {s.playerName}
                        {isHost && <span className="player-crown" title={t('lobby', 'staging_host_crown')}><Icon name="crown" size={11} /></span>}
                      </span>
                      {renderSeatMeta(s)}
                      {readiness === 'preparing' && (
                        <span className="player-status-tag mini preparing">
                          {t('lobby', 'staging_status_preparing')}
                        </span>
                      )}
                      {renderSeatOrder(idx, true, 'ring')}
                    </div>
                  )
                })}
              </div>
            ) : (
              /* Multiplayer Grid (Commander / FFA) */
              <div className="staging-multi-grid">
                {seats.map((s, idx) => {
                  const isHost = !!hostName && !!s.playerName && s.playerName.toLowerCase() === hostName.toLowerCase()
                  const isOccupied = !!s.playerName
                  const isMe = isOccupied && !!myUsername && (s.playerName as string).toLowerCase() === myUsername
                  const readiness = getSeatReadiness(s)
                  if (!isOccupied) {
                    return (
                      <div
                        key={idx}
                        className="staging-seat-empty-chip"
                        data-testid={`staging-seat-empty-${idx}`}
                        title={t('lobby', 'staging_seat_number', { number: idx + 1 })}
                      >
                        <span className="seat-empty-plus"><Icon name="plus" size={13} /></span>
                        <span className="seat-empty-label">
                          {t('lobby', 'staging_seat_number', { number: idx + 1 })} · {t('lobby', 'staging_available')}
                        </span>
                      </div>
                    )
                  }
                  return (
                    <div key={idx} className={`staging-player-card occupied${isMe ? ' my-seat' : ''}${swappedClass(idx)}${dropClass(idx)}`} {...seatDnD(idx, true)}>
                      <span className="seat-index" title={t('lobby', 'staging_seat_number', { number: idx + 1 })}>{idx + 1}</span>
                      <div className="player-avatar-circle">
                        {s.playerType === 'HUMAN' || !s.playerType ? <Icon name="user" size={22} /> : <Icon name="bot" size={22} />}
                      </div>
                      <div className="player-meta">
                        <span className="player-card-name">
                          {s.playerName}
                          {isHost && <span className="player-crown" title={t('lobby','staging_host_crown')}><Icon name="crown" size={13} /></span>}
                      {renderSeatOrder(idx, true)}
                        </span>
                        {renderSeatMeta(s)}
                        <span className={`player-status-tag ${readiness}`}>
                          {readiness === 'preparing'
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

          {/* Progress stepper: Table → Players → Ready → Play */}
          <div className="staging-stepper" data-testid="staging-stepper">
            {[
              { key: 'table', label: t('lobby', 'staging_step_table'), state: 'done' as const },
              {
                key: 'players',
                label: t('lobby', 'staging_step_players', { filled: filledSeats, total: seats.length }),
                state: (isReady || allPlayersReady ? 'done' : 'active') as 'done' | 'active',
              },
              {
                key: 'ready',
                label: t('lobby', 'staging_step_ready'),
                state: (allPlayersReady ? 'done' : isReady ? 'active' : 'todo') as 'done' | 'active' | 'todo',
              },
              {
                key: 'play',
                label: t('lobby', 'staging_step_play'),
                state: (allPlayersReady ? 'active' : 'todo') as 'active' | 'todo',
              },
            ].map((step, i, arr) => (
              <div key={step.key} className={`staging-step ${step.state}`}>
                <span className="staging-step-dot">
                  {step.state === 'done' ? <Icon name="check" size={11} /> : <span>{i + 1}</span>}
                </span>
                <span className="staging-step-label">{step.label}</span>
                {i < arr.length - 1 && <span className="staging-step-line" />}
              </div>
            ))}
          </div>

          {/* Status Message & Pulse Indicator */}
          <div className="staging-pulse-banner">
            <div className="pulse-spinner" />
            <div className="pulse-text-group">
              <span className="pulse-headline">
                {isReady
                  ? allPlayersReady
                    ? (<><Icon name="sparkles" size={13} /> {t('lobby','staging_all_ready')}</>)
                    : (<><Icon name="hourglass" size={13} /> {t('lobby','staging_waiting_players_ready')}</>)
                  : hasEmptySeats
                  ? (<><Icon name="hourglass" size={13} /> {t('lobby','staging_waiting_seats')}</>)
                  : (<><Icon name="hourglass" size={13} /> {t('lobby','staging_preparing')}</>)}
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
                  onClick={handleStart}
                  title={!allPlayersReady ? t('lobby','staging_start_unready_confirm') : undefined}
                >
                  <Icon name="play" size={13} /> {t('lobby','start_match_btn')}
                </button>
              )}
              <button
                type="button"
                className={`staging-action-btn ${myIsReady ? 'ready-toggle-on' : 'ready-toggle-off'}`}
                data-testid="staging-toggle-ready"
                onClick={handleToggleReady}
              >
                {myIsReady ? (<><Icon name="hourglass" size={13} /> {t('lobby','staging_btn_not_ready')}</>) : (<><Icon name="check" size={13} /> {t('lobby','staging_btn_ready')}</>)}
              </button>
              <button
                type="button"
                className="staging-action-btn"
                data-testid="staging-change-deck"
                onClick={() => setShowChangeDeck(true)}
              >
                <Icon name="layers" size={13} /> {t('lobby','staging_btn_change_deck')}
              </button>
              <button
                type="button"
                className="staging-action-btn"
                data-testid="staging-leave"
                onClick={() => void leaveStagingTable()}
              >
                <Icon name="logout" size={13} /> {t('lobby','staging_leave_table')}
              </button>
              {isOwner && (
                <button
                  type="button"
                  className="staging-action-btn danger"
                  data-testid="staging-remove"
                  onClick={() => void removeStagingTable()}
                >
                  <Icon name="trash" size={13} /> {t('lobby','staging_remove_table')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Chat propio de la mesa (paridad desktop; el global queda en el lobby) */}
        <div className="staging-chat-card panel">
          <div className="staging-chat-header">
            <h3><Icon name="chat" size={15} /> {t('lobby', tableChatId ? 'staging_table_chat_title' : 'staging_chat_title')}</h3>
            <span className="chat-hint">{t('lobby', tableChatId ? 'staging_table_chat_hint' : 'staging_table_chat_unavailable')}</span>
          </div>
          <div className="staging-chat-body">
            <ChatBox chatIdOverride={tableChatId} />
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
