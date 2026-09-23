import { useCallback, useEffect, useMemo, useState } from 'react'
import Button from '../ui/Button'
import Chip from '../ui/Chip'
import EmptyState from '../ui/EmptyState'
import Tabs from '../ui/Tabs'
import { confirmDialog } from '../ui/confirmDialog'
import { useTranslation } from '../i18n'
import { computeStats, matchHistoryStore, type MatchRecord, type StatsRow } from '../system/matchHistory'
import './MyMatchStats.css'

type Grouping = 'deck' | 'format' | 'opponent'

const RECENT_LIMIT = 20

const percent = (rate: number) => `${Math.round(rate * 100)}%`

function StatsTable({ rows }: { rows: StatsRow[] }) {
  return (
    <ul className="my-stats-rows">
      {rows.map((row) => (
        <li key={row.key} className="my-stats-row">
          <span className="my-stats-row-name">{row.key}</span>
          <span className="my-stats-row-record">{row.wins}-{row.losses}</span>
          <span className="my-stats-row-bar" aria-hidden="true">
            <span className="my-stats-row-fill" style={{ width: percent(row.winRate) }} />
          </span>
          <span className="my-stats-row-rate">{percent(row.winRate)}</span>
        </li>
      ))}
    </ul>
  )
}

export default function MyMatchStats() {
  const { t } = useTranslation()
  const [records, setRecords] = useState<MatchRecord[] | null>(null)
  const [grouping, setGrouping] = useState<Grouping>('deck')

  const reload = useCallback(() => {
    void matchHistoryStore.list().then(setRecords).catch(() => setRecords([]))
  }, [])

  useEffect(reload, [reload])

  const stats = useMemo(() => computeStats(records ?? []), [records])

  if (records === null) return null
  if (records.length === 0) {
    return <EmptyState icon="history" title={t('lobby', 'stats_empty')} boxed />
  }

  const rows = grouping === 'deck' ? stats.byDeck : grouping === 'format' ? stats.byFormat : stats.byOpponent

  const clear = async () => {
    if (!(await confirmDialog(t('lobby', 'stats_clear_confirm'), { danger: true }))) return
    await matchHistoryStore.clear()
    reload()
  }

  return (
    <div className="my-stats">
      <div className="my-stats-summary">
        <Chip tone="neutral">{t('lobby', 'stats_games')}: {stats.overall.games}</Chip>
        <Chip tone="ok">{t('lobby', 'stats_wins')}: {stats.overall.wins}</Chip>
        <Chip tone="err">{t('lobby', 'stats_losses')}: {stats.overall.losses}</Chip>
        <Chip tone="brand">{t('lobby', 'stats_winrate')}: {percent(stats.overall.winRate)}</Chip>
        <Button variant="subtle" size="sm" onClick={() => void clear()}>{t('lobby', 'stats_clear')}</Button>
      </div>

      <Tabs<Grouping>
        variant="segmented"
        size="sm"
        value={grouping}
        onChange={setGrouping}
        items={[
          { id: 'deck', label: t('lobby', 'stats_by_deck') },
          { id: 'format', label: t('lobby', 'stats_by_format') },
          { id: 'opponent', label: t('lobby', 'stats_by_opponent') },
        ]}
      />
      {rows.length > 0 ? <StatsTable rows={rows} /> : <EmptyState title={t('lobby', 'stats_empty')} size="sm" />}

      <h3 className="my-stats-heading">{t('lobby', 'stats_recent')}</h3>
      <ul className="my-stats-recent">
        {records.slice(0, RECENT_LIMIT).map((record) => (
          <li key={record.id} className="my-stats-recent-item">
            <Chip tone={record.result === 'win' ? 'ok' : 'err'} size="xs">
              {t('lobby', record.result === 'win' ? 'stats_result_win' : 'stats_result_loss')}
            </Chip>
            <span className="my-stats-recent-deck">{record.deckName ?? t('lobby', 'stats_unknown_deck')}</span>
            <span className="my-stats-recent-opp">{record.opponents.join(', ')}</span>
            <span className="my-stats-recent-date">{new Date(record.endedAt).toLocaleDateString()}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
