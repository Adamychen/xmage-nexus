import { openStagingTable } from '../state/store'
import type { TableView, UsersView } from '../net/types'
import Icon from '../ui/Icon'
import AvatarImage from './AvatarImage'
import CountryFlag from './CountryFlag'
import RankBadge from './RankBadge'
import { useTranslation } from '../i18n'
import { fallbackActionUser, formatDeckTypeName, formatSeatHistory, formatTimeAgo, getSkillBadge } from './lobbyUtils'

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
  onOpenBracket: (t: TableView) => void
  onSelectUser: (u: UsersView) => void
}

export default function TableCard({
  tTable, users, username, avatarId, stagingTableId, busyTable,
  onJoinHuman, onJoinAi, onStart, onWatch, onOpenBracket, onSelectUser,
}: Props) {
  const { t } = useTranslation()
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
  const mySeat = !!username
    && tTable.seats.some((s) => s.playerName?.toLowerCase() === username.toLowerCase())
  const canReenter = mySeat || stagingTableId === tTable.tableId

  return (
    <div
      className={`table-card table-row ${statusClass}`}
      onDoubleClick={() => {
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
            {tTable.isTournament ? (
              <span className="table-type-badge tourney" title={t('lobby.tournament_badge')}><Icon name="trophy" size={12} /> {t('lobby.tournament_badge')}</span>
            ) : (
              <span className="table-type-badge match" title={t('lobby','match_badge')}><Icon name="swords" size={12} /> {t('lobby','match_badge')}</span>
            )}
            {tTable.passworded && (
              <span className="table-badge-lock" title={t('lobby','tag_private')}><Icon name="lock" size={12} /> {t('lobby','tag_private')}</span>
            )}
          </div>
          <div className="table-header-right">
            {timeAgo && (
              <span className="table-time-ago" title={tTable.createTime ? new Date(tTable.createTime).toLocaleTimeString() : undefined}>
                <Icon name="clock" size={12} /> {timeAgo}
              </span>
            )}
            <span className={`table-state-badge ${statusClass}`}>{tTable.tableStateText}</span>
          </div>
        </div>

        <div className="table-title-area">
          <h3 className="table-name-text" title={tTable.tableName}>{tTable.tableName}</h3>
        </div>

        <div className="table-meta-row">
          <span className="table-game-tag"><Icon name="gamepad" size={12} /> {tTable.gameType}</span>
          <span
            className="table-deck-tag"
            title={formatDeckTypeName(tTable.deckType).full}
          >
            <Icon name="scrollText" size={12} /> {formatDeckTypeName(tTable.deckType).short}
          </span>
          <span className="table-seats-count table-seats"><Icon name="users" size={12} /> {tTable.seatsInfo}</span>
          {skill && (
            <span className={`table-skill-badge ${skill.className}`} title={`${t('lobby','create_field_skill')}: ${skill.label}`}>
              {Array.from({ length: skill.stars }, (_, i) => <Icon key={i} name="star" size={11} />)} {skill.label}
            </span>
          )}
          {tTable.rated ? (
            <span className="table-tag-rated" title={t('lobby','tag_rated')}><Icon name="medal" size={12} /> {t('lobby','tag_rated')}</span>
          ) : (
            <span className="table-tag-unrated" title={t('lobby','tag_unrated')}>{t('lobby','tag_unrated')}</span>
          )}
          {tTable.spectatorsAllowed && (
            <span className="table-tag-spectate" title={t('lobby','tag_spectators')}><Icon name="eye" size={12} /> {t('lobby','spectators')}</span>
          )}
          {Number(tTable.minimumRating) > 0 && (
            <span className="table-tag-restriction" title={`${t('lobby','create_field_min_rating')}: ${tTable.minimumRating}`}>
              <Icon name="star" size={12} /> Min {tTable.minimumRating}
            </span>
          )}
          {Number(String(tTable.quitRatio ?? '100').replace('%', '')) < 100 && (
            <span className="table-tag-restriction" title={`${t('lobby','create_field_quit_ratio')}: ${tTable.quitRatio}`}>
              <Icon name="ban" size={12} /> Max Quit {tTable.quitRatio}
            </span>
          )}
        </div>

        {tTable.additionalInfoShort && (
          <div className="table-info-strip" title={tTable.additionalInfoFull || tTable.additionalInfoShort}>
            <span className="info-strip-icon"><Icon name="info" size={12} /></span>
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
            const rating = foundUser?.constructedRating ?? s.constructedRating
            const historyInfo = formatSeatHistory(s.history, foundUser?.matchHistory)
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
                  if (!s.playerName) return
                  onSelectUser(
                    foundUser ?? {
                      ...fallbackActionUser(s.playerName),
                      flagName: s.flagName ?? '',
                      constructedRating: s.constructedRating || 1500,
                      matchHistory: s.history || '',
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
                    <span className="seat-icon empty-circle"><Icon name="circle" size={14} /></span>
                  )}
                  {s.flagName && <CountryFlag flagName={s.flagName} className="seat-flag" />}
                </div>

                 <div className="seat-part-main">
                  <div className="seat-name-row">
                    <span className="seat-player-name">
                      {s.playerName || t('lobby.open_seat')}
                    </span>
                    {isOwner && <span className="seat-crown" title={t('lobby.host')}><Icon name="crown" size={12} /> {t('lobby.host')}</span>}
                    {!isHuman && <span className="seat-bot-tag" title={t('lobby.ai')}><Icon name="bot" size={12} /> {s.playerType || t('lobby.ai')}</span>}
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
        {canReenter && (
          <button
            className="primary table-action-btn return-table-btn"
            data-testid="return-to-table"
            onClick={() => openStagingTable(tTable.tableId)}
          >
            <Icon name="chair" size={13} /> {t('lobby','staging_return_table')}
          </button>
        )}
        {isReady && (
          <button
            className="primary table-action-btn"
            disabled={busyTable === tTable.tableId}
            onClick={() => onStart(tTable)}
          >
            {t('lobby.start_match_btn')}
          </button>
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
        {hasAiSeat && (
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
