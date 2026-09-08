import type { TableView } from '../net/types'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import { formatDeckTypeName, formatTimeAgo } from './lobbyUtils'
import './ActiveTablesBar.css'

interface Props {
  tables: TableView[]
  onOpenStaging: (tableId: string) => void
  onStart: (t: TableView) => void
  onWatch: (t: TableView) => void
}

export default function ActiveTablesBar({ tables, onOpenStaging, onStart, onWatch }: Props) {
  const { t } = useTranslation()

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
                  <span className="active-table-time" title={tTable.createTime ? new Date(tTable.createTime).toLocaleTimeString() : undefined}>
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
                <button
                  type="button"
                  className="active-table-action-btn btn-start"
                  onClick={() => onStart(tTable)}
                  title={t('lobby', 'start_match_btn')}
                >
                  <Icon name="play" size={13} /> {t('lobby', 'start_match_btn')}
                </button>
              )}
              {isPlaying && (
                <button
                  type="button"
                  className="active-table-action-btn btn-resume"
                  onClick={() => onWatch(tTable)}
                  title={t('lobby', 'active_table_resume')}
                >
                  <Icon name="swords" size={13} /> {t('lobby', 'active_table_resume')}
                </button>
              )}
              {!isPlaying && (
                <button
                  type="button"
                  className="active-table-action-btn btn-staging"
                  onClick={() => onOpenStaging(tTable.tableId)}
                  title={t('lobby', 'active_table_return')}
                >
                  <Icon name="chair" size={13} /> {t('lobby', 'active_table_return')}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
