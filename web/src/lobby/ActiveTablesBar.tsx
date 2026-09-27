import type { TableView } from '../net/types'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { useTranslation, toBcp47Locale } from '../i18n'
import { formatDeckTypeName, formatTimeAgo } from './lobbyUtils'
import { tableOwnerName } from './TableFilterBar'
import './ActiveTablesBar.css'

interface Props {
  tables: TableView[]
  username?: string
  busyTable?: string | null
  onOpenStaging: (tableId: string) => void
  onStart: (t: TableView) => void
  onWatch: (t: TableView) => void
  onResume: (t: TableView) => void
  onRemove?: (t: TableView) => void
}

export default function ActiveTablesBar({ tables, username, busyTable, onOpenStaging, onStart, onResume, onRemove }: Props) {
  const { t, lang } = useTranslation()

  if (!tables || tables.length === 0) return null

  return (
    <div className="active-tables-bar" data-testid="active-tables-bar">
      {tables.map((tTable) => {
        const isReady = tTable.tableState === 'READY_TO_START'
        const isPlaying = tTable.tableState === 'DUELING' || tTable.tableState === 'SIDEBOARDING'

        const statusClass = isReady
          ? 'state-ready'
          : isPlaying
          ? 'state-playing'
          : 'state-waiting'

        const timeAgo = formatTimeAgo(tTable.createTime)
        const totalSeats = tTable.seats?.length ?? 0
        const filledSeats = tTable.seats?.filter((s) => !!s.playerName).length ?? 0
        const owner = tableOwnerName(tTable)
        const canRemove = !!onRemove && !isPlaying && tTable.tableState !== 'FINISHED'
          && !!owner && !!username && owner.toLowerCase() === username.toLowerCase()

        return (
          <div key={tTable.tableId} className={`active-table-strip ${statusClass}`}>
            <div className="active-table-info">
              <div className="active-table-badge-row">
                <span className={`active-status-badge ${statusClass}`}>
                  <span className="status-dot" />
                  {isReady ? (
                    <>
                      <Icon name="check" size={12} /> {t('lobby', 'active_table_ready')}
                    </>
                  ) : isPlaying ? (
                    <>
                      <Icon name="swords" size={12} /> {t('lobby', 'active_table_dueling')}
                    </>
                  ) : (
                    <>
                      <Icon name="clock" size={12} /> {t('lobby', 'active_table_waiting')} ({filledSeats}/{totalSeats})
                    </>
                  )}
                </span>
                {timeAgo && (
                  <span className="active-table-time" title={tTable.createTime ? new Date(tTable.createTime).toLocaleTimeString(toBcp47Locale(lang)) : undefined}>
                    <Icon name="clock" size={11} /> {timeAgo}
                  </span>
                )}
              </div>

              <div className="active-table-title-row">
                <span className="active-table-name" title={tTable.tableName}>
                  {tTable.tableName}
                </span>
                <span className="active-table-format">
                  <Icon name="scrollText" size={12} /> {formatDeckTypeName(tTable.deckType).short}
                </span>
                <span className="active-table-type">
                  {tTable.gameType}
                </span>
              </div>
            </div>

            <div className="active-table-actions">
              {isReady && (
                <Button variant="success" size="sm" data-testid="btn-start"
                  onClick={() => onStart(tTable)}
                  title={t('lobby', 'start_match_btn')}>
                  <Icon name="play" size={13} /> {t('lobby', 'start_match_btn')}
                </Button>
              )}
              {isPlaying && (
                <Button variant="soft" size="sm" data-testid="btn-resume"
                  onClick={() => onResume(tTable)}
                  title={t('lobby', 'active_table_resume')}>
                  <Icon name="swords" size={13} /> {t('lobby', 'active_table_resume')}
                </Button>
              )}
              {!isPlaying && (
                <Button variant="subtle" size="sm" data-testid="btn-staging"
                  onClick={() => onOpenStaging(tTable.tableId)}
                  title={t('lobby', 'active_table_return')}>
                  <Icon name="chair" size={13} /> {t('lobby', 'active_table_return')}
                </Button>
              )}
              {canRemove && (
                <Button variant="soft-danger" size="sm" data-testid="btn-remove-table"
                  disabled={busyTable === tTable.tableId}
                  onClick={() => onRemove(tTable)}
                  title={t('lobby', 'staging_remove_table')}
                  aria-label={t('lobby', 'staging_remove_table')}>
                  <Icon name="trash" size={13} /> {t('lobby', 'staging_remove_table')}
                </Button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
