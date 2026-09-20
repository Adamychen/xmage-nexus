import { openStagingTable } from '../state/store'
import type { TableView, UsersView } from '../net/types'
import Icon from '../ui/Icon'
import Chip, { type ChipTone } from '../ui/Chip'
import AvatarImage from './AvatarImage'
import CountryFlag from './CountryFlag'
import RankBadge from './RankBadge'
import { useTranslation, toBcp47Locale } from '../i18n'
import { clickableProps } from '../ui/clickable'
import { fallbackActionUser, formatDeckTypeName, formatSeatHistory, formatTimeAgo, getSkillBadge, isMyTable, stateLabel } from './lobbyUtils'
import Button from '../ui/Button'

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
}

export default function TableCard({
  tTable, users, username, avatarId, stagingTableId, busyTable,
  onJoinHuman, onJoinAi, onStart, onWatch, onResume, onOpenBracket, onSelectUser,
}: Props) {
  const { t, lang } = useTranslation()
  const seats = tTable.seats ?? []
  const isReady = tTable.tableState === 'READY_TO_START'
  const isPlaying = tTable.tableState === 'DUELING' || tTable.tableState === 'SIDEBOARDING'
  const isWaiting = tTable.tableState === 'WAITING'

  const hasHumanSeat =
    (isWaiting || isReady) &&
    seats.some((s) => !s.playerName && (!s.playerType || s.playerType === 'HUMAN'))
  const hasAiSeat =
    (isWaiting || isReady) &&
    seats.some((s) => !s.playerName && s.playerType && /COMPUTER|AI/i.test(s.playerType))

  const stateTone: ChipTone = isReady
    ? 'ok'
    : isPlaying
    ? 'brand'
    : tTable.tableState === 'FINISHED'
    ? 'neutral'
    : 'warn'

  const statusClass = isReady
    ? 'status-ready'
    : isPlaying
    ? 'status-playing'
    : 'status-waiting'

  const timeAgo = formatTimeAgo(tTable.createTime)
  const skill = getSkillBadge(tTable.skillLevel)
  const isMine = isMyTable(tTable, username, stagingTableId)
  const mySeat = !!username
    && seats.some((s) => s.playerName?.toLowerCase() === username.toLowerCase())
  const canReenter = isMine || mySeat || stagingTableId === tTable.tableId

  return (
    <div
      className={`table-card table-row ${statusClass}${isMine ? ' is-my-table' : ''}`}
      onDoubleClick={() => {
        if (isPlaying) {
          if (isMine || mySeat) {
            onResume(tTable)
          } else {
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
        onWatch(tTable)
      }}
    >
      <div className="table-card-main">
        <div className="table-card-top-bar">
          <div className="table-badges-left">
            {isMine && (
              <Chip solid tone="ok" icon="user" className="table-badge-mine" title={t('lobby', 'active_table_my_badge')}>
                {t('lobby', 'active_table_my_badge')}
              </Chip>
            )}
            {tTable.isTournament ? (
              <Chip solid tone="gold" icon="trophy" className="table-type-badge tourney" title={t('lobby.tournament_badge')}>{t('lobby.tournament_badge')}</Chip>
            ) : (
              <Chip solid icon="swords" className="table-type-badge match" title={t('lobby','match_badge')}>{t('lobby','match_badge')}</Chip>
            )}
            {tTable.passworded && (
              <Chip solid tone="warn" icon="lock" className="table-badge-lock" title={t('lobby','tag_private')}>{t('lobby','tag_private')}</Chip>
            )}
          </div>
          <div className="table-header-right">
            {timeAgo && (
              <span className="table-time-ago" title={tTable.createTime ? new Date(tTable.createTime).toLocaleTimeString(toBcp47Locale(lang)) : undefined}>
                <Icon name="clock" size={12} /> {timeAgo}
              </span>
            )}
            <Chip solid tone={stateTone} className={`table-state-badge ${statusClass}`}>{stateLabel(t, tTable.tableState, tTable.tableStateText)}</Chip>
          </div>
        </div>

        <div className="table-title-area">
          <h3 className="table-name-text" title={tTable.tableName}>{tTable.tableName}</h3>
        </div>

        <div className="table-meta-row">
          <Chip icon="gamepad" className="table-game-tag">{tTable.gameType}</Chip>
          <Chip icon="scrollText" className="table-deck-tag" title={formatDeckTypeName(tTable.deckType).full}>
            {formatDeckTypeName(tTable.deckType).short}
          </Chip>
          <Chip icon="users" className="table-seats-count table-seats">{tTable.seatsInfo}</Chip>
          {skill && (
            <Chip className={`table-skill-badge ${skill.className}`} title={`${t('lobby','create_field_skill')}: ${skill.label}`}>
              <span className="table-skill-stars">
                {Array.from({ length: skill.stars }, (_, i) => <Icon key={i} name="star" size={11} />)}
              </span>
              {skill.label}
            </Chip>
          )}
          {tTable.rated ? (
            <Chip tone="gold" icon="medal" className="table-tag-rated" title={t('lobby','tag_rated')} role="img" aria-label={t('lobby','tag_rated')} />
          ) : (
            <span className="table-tag-unrated" title={t('lobby','tag_unrated')}>{t('lobby','tag_unrated')}</span>
          )}
          {tTable.spectatorsAllowed && (
            <Chip icon="eye" className="table-tag-spectate" title={t('lobby','tag_spectators')} aria-label={`${t('lobby','tag_spectators')}: ${t('lobby','spectators')}`}>
              {t('lobby','spectators')}
            </Chip>
          )}
          {Number(tTable.minimumRating) > 0 && (
            <Chip icon="star" className="table-tag-restriction" title={`${t('lobby','create_field_min_rating')}: ${tTable.minimumRating}`}>
              {t('lobby', 'table_min_rating', { rating: tTable.minimumRating })}
            </Chip>
          )}
          {Number(String(tTable.quitRatio ?? '100').replace('%', '')) < 100 && (
            <Chip icon="ban" className="table-tag-restriction" title={`${t('lobby','create_field_quit_ratio')}: ${tTable.quitRatio}`}>
              {t('lobby', 'table_max_quit', { ratio: tTable.quitRatio })}
            </Chip>
          )}
        </div>

        {tTable.additionalInfoShort && (
          <div className="table-info-strip" title={tTable.additionalInfoFull || tTable.additionalInfoShort}>
            <span className="info-strip-icon"><Icon name="info" size={12} /></span>
            <span className="info-strip-text">{tTable.additionalInfoShort}</span>
          </div>
        )}

        <div className="table-seats-roster">
          {seats.map((s, idx) => {
            const hostName = tTable.controllerName ? tTable.controllerName.split(',')[0].trim() : ''
            const isOwner = !!hostName && !!s.playerName && s.playerName.toLowerCase() === hostName.toLowerCase()
            const isHuman = !s.playerType || s.playerType === 'HUMAN'
            const foundUser = s.playerName
              ? users.find((u) => u.userName.toLowerCase() === s.playerName.toLowerCase())
              : undefined
            const rating = foundUser?.constructedRating ?? s.constructedRating
            const historyInfo = formatSeatHistory(s.history, foundUser?.matchHistory)
            const seatName = s.playerName
            const openProfile = seatName
              ? () => onSelectUser(
                foundUser ?? {
                  ...fallbackActionUser(seatName),
                  flagName: s.flagName ?? '',
                  constructedRating: s.constructedRating || 1500,
                  matchHistory: s.history || '',
                },
              )
              : undefined
            const seatAvatarId = isHuman
              ? s.playerName === username
                ? avatarId
                : foundUser?.avatarId
              : 13

            return (
              <div
                key={idx}
                className={`seat-badge ${s.playerName ? 'occupied interactive' : 'empty'} ${isOwner ? 'is-owner' : ''}`}
                onClick={() => {
                  openProfile?.()
                }}
                style={s.playerName ? { cursor: 'pointer' } : undefined}
                title={s.playerName ? `${t('lobby','view_profile_hint')} ${s.playerName}` : t('lobby','open_seat')}
                {...clickableProps(openProfile)}
              >
                <div className="seat-part-avatar">
                  {s.playerName ? (
                    <AvatarImage avatarId={seatAvatarId} username={s.playerName} size="small" />
                  ) : (
                    <span className="seat-icon empty-circle"><Icon name="circle" size={14} /></span>
                  )}
                  {s.flagName && <CountryFlag flagName={s.flagName} className="seat-flag" />}
                </div>

                 <div className="seat-part-main">
                  <div className="seat-name-row">
                    <span className="seat-player-name">
                      {s.playerName || t('lobby.open_seat')}
                    </span>
                    {isOwner && <Chip tone="gold" icon="crown" className="seat-crown" title={t('lobby.host')}>{t('lobby.host')}</Chip>}
                    {!isHuman && <Chip icon="bot" className="seat-bot-tag" title={t('lobby.ai')}>{s.playerType || t('lobby.ai')}</Chip>}
                  </div>

                  {s.playerName && (rating || historyInfo.short) && (
                    <div className="seat-meta-row">
                      {rating && <RankBadge elo={rating} compact showElo />}
                      {historyInfo.short && (
                        <span className="seat-history-pill" title={historyInfo.full || `${t('lobby','leaderboard_col_history')}: ${historyInfo.short}`}>
                          <Icon name="trophy" size={11} /> {historyInfo.short}
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
        {isPlaying && (isMine || mySeat) && (
          <Button variant="primary"
            className="table-action-btn resume-table-btn"
            data-testid="resume-table"
            disabled={busyTable === tTable.tableId}
            onClick={() => onResume(tTable)}
          >
            <Icon name="swords" size={13} /> {t('lobby','active_table_resume')}
          </Button>
        )}
        {canReenter && (
          <Button variant="primary"
            className="table-action-btn return-table-btn"
            data-testid="return-to-table"
            onClick={() => openStagingTable(tTable.tableId)}
          >
            <Icon name="chair" size={13} /> {t('lobby','staging_return_table')}
          </Button>
        )}
        {isReady && (
          <Button variant="primary"
            className="table-action-btn"
            disabled={busyTable === tTable.tableId}
            onClick={() => onStart(tTable)}
          >
            {t('lobby.start_match_btn')}
          </Button>
        )}
        {hasHumanSeat && (
          <button
            className="table-action-btn join-btn"
            disabled={busyTable === tTable.tableId}
            onClick={() => onJoinHuman(tTable)}
          >
            {t('lobby.join_human_btn')}
          </button>
        )}
        {hasAiSeat && import.meta.env.DEV && (
          <button
            className="table-action-btn ai-btn"
            disabled={busyTable === tTable.tableId}
            onClick={() => onJoinAi(tTable)}
          >
            {t('lobby.join_ai_btn')}
          </button>
        )}
        <button
          className="table-action-btn watch-btn"
          disabled={busyTable === tTable.tableId}
          onClick={() => onWatch(tTable)}
        >
          <Icon name="eye" size={13} /> {t('lobby.watch_btn')}
        </button>
        {tTable.isTournament && (
          <button
            className="table-action-btn bracket-btn"
            disabled={busyTable === tTable.tableId}
            onClick={() => void onOpenBracket(tTable)}
            data-testid="open-bracket"
          >
            <Icon name="trophy" size={13} /> {t('lobby.view_bracket')}
          </button>
        )}
      </div>
    </div>
  )
}
