import { useState } from 'react'
import Tabs from '../ui/Tabs'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import Icon from '../ui/Icon'
import RankBadge from './RankBadge'
import { useTranslation } from '../i18n'
import { useRemoteMatches, useRemoteRanking, type RemoteStatus } from './useRemoteStats'
import type { RankingFormat } from './statsApi'
import './PublicRankingScreen.css'

type PublicTab = 'ranking' | 'matches'

const MATCHES_LIMIT = 50

function formatDate(value: string | number | undefined): string {
  if (value === undefined || value === '') return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

export default function PublicRankingScreen() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<PublicTab>('ranking')

  return (
    <div className="login-wrap public-ranking-wrap">
      <div className="login-card panel public-ranking" data-testid="public-ranking">
        <header className="public-ranking-header">
          <h1>{t('lobby', 'public_ranking_title')}</h1>
          <p className="subtitle">{t('lobby', 'public_ranking_subtitle')}</p>
        </header>

        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'ranking', icon: 'trophy', label: t('lobby', 'public_tab_ranking') },
            { id: 'matches', label: t('lobby', 'public_tab_matches') },
          ]}
        />

        {tab === 'ranking' ? <RankingPanel /> : <MatchesPanel />}

        <Button variant="ghost" onClick={() => { window.location.hash = '#/' }}>
          {t('lobby', 'public_back')}
        </Button>
      </div>
    </div>
  )
}

function RemoteNote({ status, onRetry }: { status: RemoteStatus; onRetry: () => void }) {
  const { t } = useTranslation()
  if (status === 'ready') return null
  if (status === 'loading') {
    return <p className="public-ranking-note" role="status">{t('lobby', 'public_loading')}</p>
  }
  return (
    <div className="public-ranking-note" role="alert">
      <p>{t('lobby', status === 'not_ready' ? 'public_not_ready' : 'public_error')}</p>
      <Button variant="soft" size="sm" onClick={onRetry}>{t('lobby', 'public_retry')}</Button>
    </div>
  )
}

function RankingPanel() {
  const { t } = useTranslation()
  const [format, setFormat] = useState<RankingFormat>('constructed')
  const { data, status, refresh } = useRemoteRanking(format)

  return (
    <section className="public-ranking-section">
      <Tabs
        variant="segmented"
        size="sm"
        value={format}
        onChange={setFormat}
        items={[
          { id: 'constructed', label: t('lobby', 'public_format_constructed') },
          { id: 'limited', label: t('lobby', 'public_format_limited') },
        ]}
      />
      <RemoteNote status={status} onRetry={refresh} />
      {status === 'ready' && data && data.players.length === 0 && (
        <EmptyState icon="trophy" title={t('lobby', 'public_empty')} />
      )}
      {status === 'ready' && data && data.players.length > 0 && (
        <>
          <div className="public-ranking-table-wrap">
            <table className="public-ranking-table">
              <thead>
                <tr>
                  <th className="col-num">{t('lobby', 'leaderboard_col_pos')}</th>
                  <th>{t('lobby', 'leaderboard_col_player')}</th>
                  <th>{t('lobby', 'leaderboard_col_tier')}</th>
                  <th className="col-num">{t('lobby', 'leaderboard_col_elo')}</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map((player, index) => (
                  <tr key={player.username}>
                    <td className="col-num">{index + 1}</td>
                    <td>{player.username}</td>
                    <td>{player.ranked
                      ? <RankBadge elo={player.rating} compact />
                      : <span className="public-ranking-unranked">{t('lobby', 'tag_unrated')}</span>}</td>
                    <td className="col-num">{player.ranked ? player.rating : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="public-ranking-updated"><Icon name="info" size={12} /> {t('lobby', 'public_updated_at', { time: formatDate(data.updatedAt) })}</p>
        </>
      )}
    </section>
  )
}

function MatchesPanel() {
  const { t } = useTranslation()
  const { data, status, refresh } = useRemoteMatches(MATCHES_LIMIT)

  return (
    <section className="public-ranking-section">
      <RemoteNote status={status} onRetry={refresh} />
      {status === 'ready' && data && data.matches.length === 0 && (
        <EmptyState icon="trophy" title={t('lobby', 'public_empty')} />
      )}
      {status === 'ready' && data && data.matches.length > 0 && (
        <>
          <div className="public-ranking-table-wrap">
            <table className="public-ranking-table">
              <thead>
                <tr>
                  <th>{t('lobby', 'public_col_match')}</th>
                  <th>{t('lobby', 'public_col_players')}</th>
                  <th>{t('lobby', 'public_col_result')}</th>
                  <th>{t('lobby', 'public_col_date')}</th>
                </tr>
              </thead>
              <tbody>
                {data.matches.map((match) => (
                  <tr key={match.matchId ?? match.tableId}>
                    <td>{match.matchName ?? match.matchId ?? match.tableId}</td>
                    <td>{match.players ?? ''}</td>
                    <td>{match.result ?? ''}</td>
                    <td>{formatDate(match.endTime ?? match.startTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="public-ranking-updated"><Icon name="info" size={12} /> {t('lobby', 'public_updated_at', { time: formatDate(data.updatedAt) })}</p>
        </>
      )}
    </section>
  )
}
