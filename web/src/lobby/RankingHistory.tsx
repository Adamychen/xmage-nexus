import { useMemo } from 'react'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import type { RankingFormat } from './statsApi'
import RankBadge from './RankBadge'
import { useRemoteRanking, type RemoteStatus } from './useRemoteStats'
import './RankingView.css'

interface RankingHistoryProps {
  format: RankingFormat
  searchQuery: string
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString()
}

export default function RankingHistory({ format, searchQuery }: RankingHistoryProps) {
  const { t } = useTranslation()
  const { data, status, refresh } = useRemoteRanking(format)

  const players = useMemo(() => {
    if (!data) return []
    const q = searchQuery.trim().toLowerCase()
    return q ? data.players.filter((p) => p.username.toLowerCase().includes(q)) : data.players
  }, [data, searchQuery])

  if (status !== 'ready') {
    return <HistoryNote status={status} onRetry={refresh} />
  }

  return (
    <>
      <div className="leaderboard-table-wrap">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th className="col-pos">{t('lobby', 'leaderboard_col_pos')}</th>
              <th>{t('lobby', 'leaderboard_col_player')}</th>
              <th>{t('lobby', 'leaderboard_col_tier')}</th>
              <th className="col-center">{t('lobby', 'leaderboard_col_elo')}</th>
              <th className="col-center">{t('lobby', 'leaderboard_history_matches')}</th>
              <th>{t('lobby', 'leaderboard_history_last_seen')}</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, index) => {
              const rated = p.rating > 0
              return (
                <tr key={p.username} className="leaderboard-row">
                  <td className="pos-cell">{rated ? `#${index + 1}` : '—'}</td>
                  <td className="user-cell">
                    <div className="user-cell-wrap">
                      <span className="leaderboard-user-name">{p.username}</span>
                    </div>
                  </td>
                  <td>
                    {rated ? <RankBadge elo={p.rating} /> : <span className="winrate-na">—</span>}
                  </td>
                  <td className="elo-cell">
                    {rated ? <><Icon name="star" size={12} /> {p.rating}</> : '—'}
                  </td>
                  <td className="history-cell">{p.matches}</td>
                  <td>{formatDate(p.lastSeen)}</td>
                </tr>
              )
            })}
            {players.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState italic>{t('lobby', 'leaderboard_no_results')}</EmptyState>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {data?.updatedAt && (
        <p className="rank-history-note">
          {t('lobby', 'leaderboard_history_updated', { time: formatDate(data.updatedAt) })}
        </p>
      )}
    </>
  )
}

function HistoryNote({ status, onRetry }: { status: RemoteStatus; onRetry: () => void }) {
  const { t } = useTranslation()
  if (status === 'loading') {
    return <EmptyState italic>{t('lobby', 'public_loading')}</EmptyState>
  }
  return (
    <div className="rank-history-note" role="alert">
      <p>{status === 'not_ready' ? t('lobby', 'public_not_ready') : t('lobby', 'public_error')}</p>
      <Button variant="soft" size="sm" onClick={onRetry}>{t('lobby', 'public_retry')}</Button>
    </div>
  )
}
