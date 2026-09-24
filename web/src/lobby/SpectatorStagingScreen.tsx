import { useMemo, useState } from 'react'
import IconButton from '../ui/IconButton'
import { hideStaging, leaveStagingTable, removeStagingTable, returnToLobby, setMyDeck, startStagedMatch, useStore, clearError } from '../state/store'
import { setState } from '../state/state'
import type { SeatView, TableView } from '../net/types'
import * as cmds from '../net/commands'
import ChatBox, { parseReadyMarker } from './ChatBox'
import JoinTableDialog from './JoinTableDialog'
import CountryFlag from './CountryFlag'
import RankBadge from './RankBadge'
import Icon from '../ui/Icon'
import Button from '../ui/Button'
import Chip from '../ui/Chip'
import ErrorBanner from '../ui/ErrorBanner'
import InviteLinkButton from './InviteLinkButton'
import { formatSeatHistory } from './lobbyUtils'
import { requestDeckValidation } from './DeckIssuesDialog'
import type { Deck } from './decks'
import { useTranslation } from '../i18n'
import { translateError } from '../i18n'
import { confirmDialog } from '../ui/confirmDialog'
import { prepareDeckForXMage } from '../decks/deckNormalize'
import AvatarImage from './AvatarImage'
import { extractLobbyUsers } from './lobbyUtils'
import { tableFormatProfile, deckCoverCard, deckMainSize, type JoinDeck } from './joinDeckFit'
import { useCardArtUrl } from '../decks/useCardArtUrl'
import { colorIdentityFromCards } from '../decks/types'
import { ManaPip } from '../decks/ArenaManaSymbols'
import './SpectatorStagingScreen.css'

type Readiness = 'empty' | 'ready' | 'preparing'

function SeatAvatar({ seat, avatarId, readiness, size = 'huge' }: {
  seat?: SeatView
  avatarId?: number
  readiness: Readiness
  size?: 'large' | 'huge'
}) {
  const isBot = !!seat?.playerType && seat.playerType !== 'HUMAN'
  return (
    <span className={`seat-avatar-wrap ${readiness} size-${size}`}>
      {!seat?.playerName ? (
        <span className="seat-avatar-empty"><Icon name="plus" size={size === 'huge' ? 22 : 16} /></span>
      ) : isBot ? (
        <span className="seat-avatar-bot"><Icon name="bot" size={size === 'huge' ? 28 : 20} /></span>
      ) : (
        <AvatarImage avatarId={avatarId} username={seat.playerName} size={size} />
      )}
      {readiness !== 'empty' && (
        <span className="seat-avatar-status" aria-hidden="true">
          <Icon name={readiness === 'ready' ? 'check' : 'hourglass'} size={10} />
        </span>
      )}
    </span>
  )
}

function SeatDeck({ deck, onClick }: { deck: JoinDeck; onClick: () => void }) {
  const { t } = useTranslation()
  const art = useCardArtUrl(deckCoverCard(deck))
  const colors = deck.colors ?? colorIdentityFromCards(deck.cards)
  return (
    <Button variant="ghost" className="seat-deck" onClick={onClick} title={t('lobby', 'staging_btn_change_deck')}>
      {art && <img src={art} alt="" className="seat-deck-art" loading="lazy" />}
      <span className="seat-deck-scrim" />
      <span className="seat-deck-text">
        <span className="seat-deck-label">{t('lobby', 'staging_your_deck')} · {deckMainSize(deck)}</span>
        <span className="seat-deck-name">{deck.name}</span>
      </span>
      <span className="seat-deck-colors">
        {(colors.length ? colors : ['C']).map((c) => <ManaPip key={c} symbol={c} size={13} />)}
      </span>
      <span className="seat-deck-swap" aria-hidden="true"><Icon name="swap" size={12} /></span>
    </Button>
  )
}

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
  const stagingError = useStore((s) => s.error)
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
  const myDeck = useStore((s) => s.myDeck) as JoinDeck | null
  const users = useMemo(() => extractLobbyUsers(lobby?.users), [lobby?.users])
  const profile = useMemo(
    () => tableFormatProfile(activeTable?.deckType, activeTable?.gameType),
    [activeTable?.deckType, activeTable?.gameType],
  )

  const [showChangeDeck, setShowChangeDeck] = useState(false)
  const [myReadyState, setMyReadyState] = useState(true)
  const [starting, setStarting] = useState(false)

  const playerReadyMap = useMemo(() => {
    const map: Record<string, boolean> = {}
    const scopeId = tableChatId ?? chatId
    for (const m of messages) {
      if (scopeId && m.chatId && m.chatId !== scopeId) continue
      const marker = m.message ? parseReadyMarker(m.message) : null
      if (!marker) continue
      const embedded = marker.user?.toLowerCase()
      const sender = m.username?.toLowerCase()
      if (embedded && sender && embedded !== sender) continue
      const user = sender || embedded
      if (user) map[user] = marker.ready
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
      <IconButton label={title(labelKey)} size="xs"
        data-testid={testId}
        disabled={locked || (dir < 0 ? idx <= 0 : idx >= seats.length - 1)}
        onClick={() => void handleSwapSeats(idx, dir)}>
        <Icon
          name={variant === 'ring' ? (dir < 0 ? 'rotateCcw' : 'rotateCw') : dir < 0 ? 'chevronUp' : 'chevronDown'}
          size={12}
        />
      </IconButton>
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

  const avatarFor = (seat?: SeatView): number | undefined => {
    if (!seat?.playerName) return undefined
    const lower = seat.playerName.toLowerCase()
    if (lower === myUsername) return conn?.avatarId
    return users.find((u) => u.userName.toLowerCase() === lower)?.avatarId
  }

  const getSeatReadiness = (seat?: SeatView): Readiness => {
    if (!seat?.playerName) return 'empty'
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
    const xmageDeck = prepareDeckForXMage(deck, tTable.deckType, tTable.gameType)
    const finalDeck = await requestDeckValidation(xmageDeck)
    if (!finalDeck) return
    if (isOwner) {
      const otherHumans = seats.some((s) => s.playerName && s.playerName.toLowerCase() !== conn?.username?.toLowerCase() && (!s.playerType || s.playerType === 'HUMAN'))
      if (otherHumans) {
        const ok = await confirmDialog(t('lobby', 'staging_change_deck_host_warn'))
        if (!ok) return
      }
      await cmds.removeTable(tTable.tableId)
      const simSeats = seats.filter((s) => s.playerType === 'SIM').length
      const playerTypes = seats.map((s) => s.playerType || 'HUMAN')
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

  const handleStart = async () => {
    if (starting) return
    if (!allPlayersReady) {
      const ok = await confirmDialog(t('lobby','staging_start_unready_confirm'))
      if (!ok) return
    }
    setStarting(true)
    void startStagedMatch().finally(() => setStarting(false))
  }

  const statusLabel = (readiness: Readiness, emptyLabel: string) =>
    readiness === 'empty'
      ? emptyLabel
      : readiness === 'preparing'
      ? t('lobby', 'staging_status_preparing')
      : t('lobby', 'staging_status_ready')

  const renderSeatCard = (idx: number, emptyLabel: string, emptyStatus: string) => {
    const seat = seats[idx]
    const occupied = !!seat?.playerName
    const isMe = occupied && !!myUsername && seat.playerName.toLowerCase() === myUsername
    const isHost = occupied && !!hostName && seat.playerName.toLowerCase() === hostName.toLowerCase()
    const readiness = getSeatReadiness(seat)
    return (
      <div
        key={idx}
        className={`staging-player-card ${occupied ? 'occupied' : 'empty'} ${readiness}${isMe ? ' my-seat' : ''}${swappedClass(idx)}${dropClass(idx)}`}
        {...seatDnD(idx, occupied)}
      >
        <span className="seat-index" title={t('lobby', 'staging_seat_number', { number: idx + 1 })}>{idx + 1}</span>
        {isMe && <span className="seat-you">{t('lobby', 'staging_you')}</span>}
        <SeatAvatar seat={seat} avatarId={avatarFor(seat)} readiness={readiness} />
        <div className="player-meta">
          <span className="player-card-name">
            <span className="player-card-name-text">{occupied ? seat.playerName : emptyLabel}</span>
            {isHost && (
              <span className="player-crown" title={t('lobby', 'staging_host_crown')}><Icon name="crown" size={13} /></span>
            )}
            {renderSeatOrder(idx, occupied)}
          </span>
          {renderSeatMeta(seat)}
          <span className={`player-status-tag ${readiness}`}>{statusLabel(readiness, emptyStatus)}</span>
        </div>
        {isMe && mode === 'player' && myDeck && (
          <SeatDeck deck={myDeck} onClick={() => setShowChangeDeck(true)} />
        )}
        {!occupied && <span className="seat-empty-hint">{t('lobby', 'staging_empty_invite_hint')}</span>}
      </div>
    )
  }

  const statusTone = isReady ? (allPlayersReady ? 'go' : 'wait') : 'fill'

  return (
    <div className="spectator-staging-screen">
      <header className="staging-top-header">
        <div className="staging-brand">
          <img src="/logo.jpeg" alt="XMage Nexus" className="staging-logo" />
          <div className="staging-titles">
            <h1 className="staging-main-title">XMage Nexus</h1>
            <span className="staging-subtitle">{t('lobby', 'staging_title')}</span>
          </div>
        </div>

        <Button variant="soft-danger"
          onClick={handleLeave}
          data-testid="staging-back"
          title={mode === 'player' ? t('lobby', 'staging_back_hint') : t('lobby', 'staging_leave_hint')}>
          <span><Icon name="logout" size={13} /> {t('lobby', 'staging_back_lobby')}</span>
        </Button>
      </header>

      <main className="staging-main-container">
        <div className={`staging-arena-card panel family-${profile.family}`}>
          <div className="staging-card-header">
            <span className="staging-emblem" aria-hidden="true"><Icon name={profile.icon} size={26} /></span>
            <div className="staging-heading">
              <div className="staging-title-row">
                <Chip tone="brand" icon={mode === 'player' ? 'chair' : 'eye'}>{mode === 'player' ? t('lobby', 'staging_mode_player') : t('lobby', 'staging_mode_spectator')}</Chip>
                {profile.label && <span className="staging-format-name" title={activeTable?.deckType}>{profile.label}</span>}
              </div>
              <h2 className="staging-table-name">{activeTable?.tableName || t('lobby', 'staging_waiting_fallback')}</h2>
              <div className="staging-tags-row">
                <Chip icon="gamepad" className="staging-tag tag-game">{activeTable?.gameType || t('lobby', 'staging_duel_fallback')}</Chip>
                {skill && (
                  <Chip className={`staging-tag tag-skill ${skill.className}`}>
                    <span className="staging-skill-stars">
                      {Array.from({ length: skill.stars }, (_, i) => <Icon key={i} name="star" size={11} />)}
                    </span>
                    {skill.label}
                  </Chip>
                )}
                {activeTable?.rated ? (
                  <Chip tone="gold" icon="medal" className="staging-tag tag-rated">{t('lobby', 'tag_rated')}</Chip>
                ) : (
                  <Chip className="staging-tag tag-unrated">{t('lobby', 'tag_unrated')}</Chip>
                )}
                {activeTable?.passworded && (
                  <Chip tone="warn" icon="lock" className="staging-tag tag-private">{t('lobby', 'tag_private')}</Chip>
                )}
                <Chip icon="users" className="staging-tag tag-seats">{activeTable?.seatsInfo || t('lobby', 'staging_seats_count', { count: seats.length })}</Chip>
              </div>
            </div>
            <div className="staging-invite">
              <InviteLinkButton tableId={activeTable?.tableId} />
            </div>
          </div>

          <div className="staging-roster-area">
            {is1v1 ? (
              <div className="staging-duel-roster">
                {renderSeatCard(0, t('lobby', 'staging_waiting_player'), t('lobby', 'staging_seat_available'))}
                <div className="staging-vs-emblem">
                  <span className="vs-line" />
                  <span className="vs-text">{t('lobby', 'staging_vs')}</span>
                  <span className="vs-line" />
                </div>
                {renderSeatCard(1, t('lobby', 'staging_waiting_opponent'), t('lobby', 'staging_waiting_opponent_short'))}
              </div>
            ) : seats.length <= 6 ? (
              <div className="staging-ring" data-testid="staging-ring">
                <div className="ring-table" aria-hidden="true" />
                <div className="ring-center">
                  <span className="ring-count">{filledSeats}/{seats.length}</span>
                  <span className="ring-label">{t('lobby', 'staging_seats_count', { count: seats.length })}</span>
                </div>
                {seats.map((s, idx) => {
                  const angle = (idx / seats.length) * Math.PI * 2 - Math.PI / 2
                  const x = 50 + 38 * Math.cos(angle)
                  const y = 50 + 30 * Math.sin(angle)
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
                        <span className="ring-empty-label">{t('lobby', 'staging_available')}</span>
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
                      {isMe && <span className="seat-you">{t('lobby', 'staging_you')}</span>}
                      <span className="ring-avatar">
                        <SeatAvatar seat={s} avatarId={avatarFor(s)} readiness={readiness} size="large" />
                      </span>
                      <span className="ring-name">
                        <span className="ring-name-text">{s.playerName}</span>
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
              <div className="staging-multi-grid">
                {seats.map((s, idx) => {
                  if (!s.playerName) {
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
                  return renderSeatCard(idx, '', '')
                })}
              </div>
            )}
          </div>

          {stagingError && (
            <ErrorBanner
              message={stagingError}
              onClose={clearError}
              className="staging-error-banner"
              testId="staging-error"
            />
          )}

          <div className={`staging-status tone-${statusTone}`}>
            <div className="staging-pulse-banner">
              <div className="pulse-spinner" />
              <div className="pulse-text-group">
                <span className="pulse-headline">
                  {isReady
                    ? allPlayersReady
                      ? (<><Icon name="sparkles" size={13} /> {t('lobby', 'staging_all_ready')}</>)
                      : (<><Icon name="hourglass" size={13} /> {t('lobby', 'staging_waiting_players_ready')}</>)
                    : hasEmptySeats
                    ? (<><Icon name="hourglass" size={13} /> {t('lobby', 'staging_waiting_seats')}</>)
                    : (<><Icon name="hourglass" size={13} /> {t('lobby', 'staging_preparing')}</>)}
                </span>
                <span className="pulse-subline">
                  {mode === 'player'
                    ? t('lobby', 'staging_player_hint')
                    : t('lobby', 'staging_auto_connect')}
                </span>
              </div>
            </div>
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
          </div>

          {mode === 'player' && (
            <div className="staging-player-actions" data-testid="staging-player-actions">
              <div className="staging-actions-secondary">
                <Button
                  variant="subtle"
                  className="staging-action-btn"
                  data-testid="staging-leave"
                  title={t('lobby', 'staging_leave_table')}
                  aria-label={t('lobby', 'staging_leave_table')}
                  onClick={() => void leaveStagingTable()}
                >
                  <Icon name="logout" size={13} /> <span className="staging-btn-label">{t('lobby', 'staging_leave_table')}</span>
                </Button>
                {isOwner && (
                  <Button
                    variant="subtle"
                    className="staging-action-btn danger"
                    data-testid="staging-remove"
                    title={t('lobby', 'staging_remove_table')}
                    aria-label={t('lobby', 'staging_remove_table')}
                    onClick={() => void removeStagingTable()}
                  >
                    <Icon name="trash" size={13} /> <span className="staging-btn-label">{t('lobby', 'staging_remove_table')}</span>
                  </Button>
                )}
              </div>
              <div className="staging-actions-primary">
                <Button
                  className="staging-action-btn"
                  data-testid="staging-change-deck"
                  onClick={() => setShowChangeDeck(true)}
                >
                  <Icon name="layers" size={13} /> {t('lobby', 'staging_btn_change_deck')}
                </Button>
                <Button
                  className={`staging-action-btn ${myIsReady ? 'ready-toggle-on' : 'ready-toggle-off'}`}
                  data-testid="staging-toggle-ready"
                  onClick={handleToggleReady}
                >
                  {myIsReady ? (<><Icon name="hourglass" size={13} /> {t('lobby', 'staging_btn_not_ready')}</>) : (<><Icon name="check" size={13} /> {t('lobby', 'staging_btn_ready')}</>)}
                </Button>
                {isReady && isOwner && (
                  <Button
                    variant="success"
                    className="staging-action-btn staging-start-btn"
                    data-testid="staging-start"
                    onClick={handleStart}
                    disabled={starting}
                    title={!allPlayersReady ? t('lobby', 'staging_start_unready_confirm') : undefined}
                  >
                    <Icon name="play" size={14} /> {t('lobby', 'start_match_btn')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

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
          title={t('lobby', 'staging_change_deck_title')}
          submitLabel={t('lobby', 'staging_change_deck_confirm')}
          onClose={() => setShowChangeDeck(false)}
          onJoin={handleChangeDeck}
        />
      )}
    </div>
  )
}
