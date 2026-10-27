import { useRef } from 'react'
import { openStagingTable } from '../state/store'
import type { SeatView, TableView, UsersView } from '../net/types'
import Icon, { type IconName } from '../ui/Icon'
import Chip, { type ChipTone } from '../ui/Chip'
import AvatarImage from './AvatarImage'
import CountryFlag from './CountryFlag'
import RankBadge from './RankBadge'
import { useTranslation, toBcp47Locale, plural } from '../i18n'
import { clickableProps } from '../ui/clickable'
import { fallbackActionUser, formatDeckTypeName, formatSeatHistory, formatTimeAgo, getSkillBadge, isMyTable, stateLabel, tableOwnerName } from './lobbyUtils'
import Button from '../ui/Button'
import IconButton from '../ui/IconButton'
import { useCardArtUrl } from '../decks/useCardArtUrl'
import { tableArtCard } from './tableArt'
import { usePointerVars } from './usePointerVars'
import { formatDisplayName, formatFamily } from './formatFamily'
import { tableMode, type TableMode } from './TableFilterBar'
import { parseTableInfo, tableInfoTooltip } from './tableInfo'

interface Props {
  tTable: TableView
  users: UsersView[]
  username?: string
  avatarId?: number
  stagingTableId: string | null
  busyTable: string | null
  onJoinHuman: (t: TableView) => void
  onJoinAi: (t: TableView) => void
  onStart: (t: TableView) => void
  onWatch: (t: TableView) => void
  onResume: (t: TableView) => void
  onOpenBracket: (t: TableView) => void
  onSelectUser: (u: UsersView) => void
  onRemove?: (t: TableView) => void
}

const MODE_ICON: Record<TableMode, IconName> = { '1v1': 'swords', multi: 'users', tourney: 'trophy' }

const AI_NAMES: Record<string, string> = {
  COMPUTER_MAD: 'Mad',
  COMPUTER_MONTE_CARLO: 'Monte Carlo',
  COMPUTER_DRAFT_BOT: 'Draft Bot',
}

function isHumanSeat(s: SeatView): boolean {
  return !s.playerType || s.playerType.toUpperCase() === 'HUMAN'
}

function aiName(playerType: string): string {
  const key = playerType.toUpperCase()
  if (AI_NAMES[key]) return AI_NAMES[key]
  return key.replace(/^COMPUTER_/, '').toLowerCase().replace(/(^|_)(\w)/g, (_, sep: string, c: string) => `${sep ? ' ' : ''}${c.toUpperCase()}`)
}

const RANGE_LABEL: Record<string, string> = { ONE: '1', TWO: '2' }

export default function TableCard({
  tTable, users, username, avatarId, stagingTableId, busyTable,
  onJoinHuman, onJoinAi, onStart, onWatch, onResume, onOpenBracket, onSelectUser, onRemove,
}: Props) {
  const { t, lang } = useTranslation()
  const seats = tTable.seats ?? []
  const isReady = tTable.tableState === 'READY_TO_START'
  const isPlaying = tTable.tableState === 'DUELING' || tTable.tableState === 'SIDEBOARDING'
  const isWaiting = tTable.tableState === 'WAITING'

  const freeHumanSeats = seats.filter((s) => !s.playerName && isHumanSeat(s)).length
  const hasHumanSeat = (isWaiting || isReady) && freeHumanSeats > 0
  const hasAiSeat =
    (isWaiting || isReady) &&
    seats.some((s) => !s.playerName && s.playerType && /COMPUTER|AI/i.test(s.playerType))

  const stateTone: ChipTone = isReady
    ? 'gold'
    : isPlaying
    ? 'brand'
    : tTable.tableState === 'FINISHED'
    ? 'neutral'
    : 'ok'

  const statusClass = isReady
    ? 'status-ready'
    : isPlaying
    ? 'status-playing'
    : tTable.tableState === 'FINISHED'
    ? 'status-finished'
    : 'status-waiting'

  const timeAgo = formatTimeAgo(tTable.createTime)
  const skill = getSkillBadge(tTable.skillLevel)
  const isMine = isMyTable(tTable, username, stagingTableId)
  const mySeat = !!username
    && seats.some((s) => s.playerName?.toLowerCase() === username.toLowerCase())
  const canReenter = isMine || mySeat || stagingTableId === tTable.tableId
  const ownerName = tableOwnerName(tTable)
  const inActiveBar = isMine && tTable.tableState !== 'FINISHED'
  const canRemove = !!onRemove && !isPlaying && tTable.tableState !== 'FINISHED'
    && !!ownerName && !!username && ownerName.toLowerCase() === username.toLowerCase()
  const watchBlocked = !tTable.spectatorsAllowed && !canReenter

  const family = formatFamily(tTable)
  const mode = tableMode(tTable)
  const deckName = formatDeckTypeName(tTable.deckType)
  const formatName = tTable.deckType === 'Limited' ? t('lobby', 'filter_format_limited') : formatDisplayName(deckName.short)
  const info = parseTableInfo(tTable.additionalInfoShort)
  const infoTooltip = tableInfoTooltip(tTable.additionalInfoFull) || tTable.additionalInfoShort || undefined

  const bestOf = info.winsNeeded === null
    ? null
    : info.winsNeeded > 1
    ? t('lobby', 'best_of', { count: info.winsNeeded * 2 - 1 })
    : t('lobby', 'single_game')

  const playerNames = (tTable.controllerName ?? '').split(',').map((n) => n.trim()).filter(Boolean)
  const score = info.score && info.score.length === playerNames.length
    ? info.score.length === 2
      ? `${playerNames[0]} ${info.score[0]} – ${info.score[1]} ${playerNames[1]}`
      : playerNames.map((n, i) => `${n} ${info.score![i]}`).join(' · ')
    : null

  const facts: string[] = []
  if (score) facts.push(score)
  if (info.draws > 0) facts.push(t('lobby', 'draws_count', { count: info.draws }))
  if (info.timeLimit) facts.push(t('lobby', 'time_limit', { time: info.bufferTime ? `${info.timeLimit} (+${info.bufferTime})` : info.timeLimit }))
  else if (info.noTimeLimit) facts.push(t('lobby', 'no_time_limit'))
  if (skill) facts.push(skill.label)
  if (!tTable.rated) facts.push(t('lobby', 'tag_unrated'))
  if (info.range) facts.push(t('lobby', 'range_info', { range: RANGE_LABEL[info.range] ?? t('common', 'all') }))
  if (info.constructionTime) facts.push(t('lobby', 'construction_time', { time: info.constructionTime }))
  if (info.pickTime) facts.push(t('lobby', 'pick_time', { time: info.pickTime }))
  if (info.singleGame) facts.push(t('lobby', 'one_game_all'))
  if (info.customOptions > 0) facts.push(t('lobby', 'custom_options', { count: info.customOptions }))
  if (info.rollbacks) facts.push(t('lobby', 'rollbacks_allowed'))
  facts.push(...info.other)

  const groupOpenSeats = freeHumanSeats > 1
  const firstOpenSeat = seats.findIndex((s) => !s.playerName && isHumanSeat(s))

  const quitRatio = Number(String(tTable.quitRatio ?? '100').replace('%', ''))
  const pillText = (isWaiting && freeHumanSeats > 0)
    ? plural('lobby', 'seats_free', freeHumanSeats)
    : stateLabel(t, tTable.tableState, tTable.tableStateText)

  const artUrl = useCardArtUrl(tableArtCard(tTable.deckType))
  const cardRef = useRef<HTMLDivElement>(null)
  usePointerVars(cardRef)

  return (
    <div
      ref={cardRef}
      className={`table-card table-row fmt-${family} ${statusClass}${isMine ? ' is-my-table' : ''}`}
      style={artUrl ? { ['--card-art' as string]: `url("${artUrl}")` } : undefined}
      data-format-family={family}
      onDoubleClick={() => {
        if (isPlaying) {
          if (isMine || mySeat) {
            onResume(tTable)
          } else if (!watchBlocked) {
            onWatch(tTable)
          }
          return
        }
        if (canReenter) {
          openStagingTable(tTable.tableId)
          return
        }
        if (hasHumanSeat) {
          onJoinHuman(tTable)
          return
        }
        if (!watchBlocked) onWatch(tTable)
      }}
    >
      <div className="tc-banner">
        <div className="tc-format" title={deckName.full || undefined}>
          <span className="tc-format-name">{formatName}</span>
          <span className="tc-mode" title={tTable.gameType}>
            <Icon name={MODE_ICON[mode]} size={13} />
            <span className="tc-mode-name">{tTable.gameType}</span>
            {bestOf && <span className="tc-mode-bo">· {bestOf}</span>}
          </span>
        </div>
        <div className="tc-status">
          <Chip solid tone={stateTone} className={`table-state-badge ${statusClass}`}>{pillText}</Chip>
          {timeAgo && (
            <span className="table-time-ago" title={tTable.createTime ? new Date(tTable.createTime).toLocaleTimeString(toBcp47Locale(lang)) : undefined}>
              {timeAgo}
            </span>
          )}
        </div>
      </div>

      <div className="tc-body">
        <div className="tc-title">
          <h3 className="table-name-text" title={tTable.tableName}>{tTable.tableName}</h3>
          {ownerName && <span className="tc-host">{t('lobby', 'hosted_by', { name: ownerName })}</span>}
        </div>

        <div className="tc-meta">
          <div className="table-badges">
            {isMine && (
              <Chip tone="ok" icon="user" className="table-badge-mine">{t('lobby', 'active_table_my_badge')}</Chip>
            )}
            {tTable.isTournament && (
              <Chip tone="gold" icon="trophy" className="table-type-badge tourney">{t('lobby.tournament_badge')}</Chip>
            )}
            {tTable.passworded && (
              <Chip tone="warn" icon="lock" className="table-badge-lock">{t('lobby', 'tag_private')}</Chip>
            )}
            {tTable.rated && (
              <Chip tone="brand" icon="medal" className="table-tag-rated">{t('lobby', 'tag_rated')}</Chip>
            )}
            {Number(tTable.minimumRating) > 0 && (
              <Chip icon="star" className="table-tag-restriction" title={`${t('lobby', 'create_field_min_rating')}: ${tTable.minimumRating}`}>
                {t('lobby', 'table_min_rating', { rating: tTable.minimumRating })}
              </Chip>
            )}
            {quitRatio < 100 && (
              <Chip icon="ban" className="table-tag-restriction" title={`${t('lobby', 'create_field_quit_ratio')}: ${tTable.quitRatio}`}>
                {t('lobby', 'table_max_quit', { ratio: tTable.quitRatio })}
              </Chip>
            )}
            {!tTable.spectatorsAllowed && (
              <Chip icon="eye" className="table-tag-no-spectators">{t('lobby', 'no_spectators')}</Chip>
            )}
          </div>
          {facts.length > 0 && (
            <p className="table-facts" title={infoTooltip}>
              {facts.map((fact, i) => <span key={i} className="table-fact">{fact}</span>)}
            </p>
          )}
        </div>

        <div className="table-seats-roster">
          {seats.map((s, idx) => {
            if (groupOpenSeats && !s.playerName && isHumanSeat(s)) {
              if (idx !== firstOpenSeat) return null
              return (
                <div key={idx} className="seat-badge empty is-grouped">
                  <Icon name="plus" size={13} />
                  <span className="seat-open-label">{plural('lobby', 'open_seats_count', freeHumanSeats)}</span>
                </div>
              )
            }
            const isOwner = !!ownerName && !!s.playerName && s.playerName.toLowerCase() === ownerName.toLowerCase()
            const isHuman = isHumanSeat(s)
            const foundUser = s.playerName
              ? users.find((u) => u.userName.toLowerCase() === s.playerName.toLowerCase())
              : undefined
            const rating = foundUser?.constructedRating ?? s.constructedRating
            const historyInfo = formatSeatHistory(s.history, foundUser?.matchHistory)
            const seatName = s.playerName
            const openProfile = seatName && isHuman
              ? () => onSelectUser(
                foundUser ?? {
                  ...fallbackActionUser(seatName),
                  flagName: s.flagName ?? '',
                  constructedRating: s.constructedRating || 1500,
                  matchHistory: s.history || '',
                },
              )
              : undefined
            const seatAvatarId = s.playerName === username ? avatarId : foundUser?.avatarId

            if (!s.playerName) {
              return (
                <div key={idx} className={`seat-badge empty${isHuman ? '' : ' is-ai'}`}>
                  <Icon name={isHuman ? 'plus' : 'bot'} size={13} />
                  <span className="seat-open-label">{isHuman ? t('lobby.open_seat') : `${t('lobby', 'ai_seat_open')} · ${aiName(s.playerType ?? '')}`}</span>
                </div>
              )
            }

            if (!isHuman) {
              return (
                <div key={idx} className="seat-badge occupied is-ai" title={s.playerName}>
                  <span className="seat-ai-icon"><Icon name="bot" size={14} /></span>
                  <span className="seat-player-name">{t('lobby.ai')} · {aiName(s.playerType ?? '')}</span>
                </div>
              )
            }

            return (
              <div
                key={idx}
                className={`seat-badge occupied interactive${isOwner ? ' is-owner' : ''}`}
                title={[`${t('lobby', 'view_profile_hint')} ${s.playerName}`, rating ? `ELO ${rating}` : '', historyInfo.full].filter(Boolean).join('\n')}
                onClick={openProfile}
                {...clickableProps(openProfile)}
              >
                <span className="seat-part-avatar">
                  <AvatarImage avatarId={seatAvatarId} username={s.playerName} size="small" />
                </span>
                <span className="seat-main">
                  <span className="seat-name-line">
                    <span className="seat-player-name">{s.playerName}</span>
                    {isOwner && (
                      <span className="seat-crown" title={t('lobby.host')} aria-label={t('lobby.host')} role="img">
                        <Icon name="crown" size={12} />
                      </span>
                    )}
                  </span>
                  {s.flagName && (
                    <span className="seat-meta-line">
                      <CountryFlag flagName={s.flagName} className="seat-flag" />
                    </span>
                  )}
                </span>
                {rating ? <RankBadge elo={rating} compact iconOnly className="seat-rank" /> : null}
              </div>
            )
          })}
        </div>

        <div className="table-seat-pips" title={tTable.seatsInfo}>
          <span className="table-seat-pips-dots" aria-hidden="true">
            {seats.map((s, idx) => (
              <span key={idx} className={`table-seat-pip${s.playerName ? ' is-taken' : isHumanSeat(s) ? '' : ' is-ai'}`} />
            ))}
          </span>
          <span className="table-seats-count table-seats">{tTable.seatsInfo}</span>
        </div>
      </div>

      <div className="table-actions">
        {isPlaying && (isMine || mySeat) && (
          <Button variant="primary" size="sm" className="table-primary-action"
            data-testid="resume-table"
            disabled={busyTable === tTable.tableId}
            onClick={() => onResume(tTable)}
          >
            <Icon name="swords" size={13} /> {t('lobby','active_table_resume')}
          </Button>
        )}
        {canReenter && (
          <Button variant="primary" size="sm" className="table-primary-action"
            data-testid="return-to-table"
            onClick={() => openStagingTable(tTable.tableId)}
          >
            <Icon name="chair" size={13} /> {t('lobby','staging_return_table')}
          </Button>
        )}
        {isReady && !inActiveBar && (
          <Button variant="primary" size="sm" className="table-primary-action"
            disabled={busyTable === tTable.tableId}
            onClick={() => onStart(tTable)}
          >
            {t('lobby.start_match_btn')}
          </Button>
        )}
        {hasHumanSeat && (
          <Button variant="primary" size="sm" className="table-primary-action"
            disabled={busyTable === tTable.tableId}
            onClick={() => onJoinHuman(tTable)}>
            {t('lobby.join_human_btn')}
          </Button>
        )}
        {hasAiSeat && import.meta.env.DEV && (
          <Button variant="soft" size="sm"
            disabled={busyTable === tTable.tableId}
            onClick={() => onJoinAi(tTable)}>
            {t('lobby.join_ai_btn')}
          </Button>
        )}
        {tTable.isTournament && (
          <IconButton size="sm" icon="trophy"
            label={t('lobby.view_bracket')}
            disabled={busyTable === tTable.tableId}
            onClick={() => void onOpenBracket(tTable)}
            data-testid="open-bracket" />
        )}
        <IconButton size="sm" icon="eye" data-testid="watch-btn"
          label={watchBlocked ? t('lobby', 'no_spectators') : t('lobby.watch_btn')}
          disabled={busyTable === tTable.tableId || watchBlocked}
          onClick={() => onWatch(tTable)} />
        {canRemove && !inActiveBar && (
          <IconButton size="sm" icon="trash" data-testid="remove-table"
            className="table-remove-btn"
            label={t('lobby', 'staging_remove_table')}
            disabled={busyTable === tTable.tableId}
            onClick={() => onRemove(tTable)} />
        )}
      </div>
    </div>
  )
}
