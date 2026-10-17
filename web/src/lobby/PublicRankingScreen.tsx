import { useState } from 'react'
import Tabs from '../ui/Tabs'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import Icon from '../ui/Icon'
import RankBadge from './RankBadge'
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
  const [tab, setTab] = useState<PublicTab>('ranking')

  return (
    <div className="login-wrap public-ranking-wrap">
      <div className="login-card panel public-ranking" data-testid="public-ranking">
        <header className="public-ranking-header">
          <h1>{'Public ranking'}</h1>
          <p className="subtitle">{'Players and recent matches, updated every few minutes.'}</p>
        </header>

        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { id: 'ranking', icon: 'trophy', label: 'Ratings' },
            { id: 'matches', label: 'Matches' },
          ]}
        />

        {tab === 'ranking' ? <RankingPanel /> : <MatchesPanel />}

        <Button variant="ghost" onClick={() => { window.location.hash = '#/' }}>
          {'Back to login'}
        </Button>
      </div>
    </div>
  )
}

function RemoteNote({ status, onRetry }: { status: RemoteStatus; onRetry: () => void }) {
  if (status === 'ready') return null
  if (status === 'loading') {
    return <p className="public-ranking-note" role="status">{'Loading…'}</p>
  }
  return (
    <div className="public-ranking-note" role="alert">
      <p>{status === 'not_ready' ? 'The ranking is still being prepared. Try again in a moment.' : 'The ranking could not be loaded.'}</p>
      <Button variant="soft" size="sm" onClick={onRetry}>{'Retry'}</Button>
    </div>
  )
}

function RankingPanel() {
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
          { id: 'constructed', label: 'Constructed' },
          { id: 'limited', label: 'Limited' },
        ]}
      />
      <RemoteNote status={status} onRetry={refresh} />
      {status === 'ready' && data && data.players.length === 0 && (
        <EmptyState icon="trophy" title={'No players yet.'} />
      )}
      {status === 'ready' && data && data.players.length > 0 && (
        <>
          <div className="public-ranking-table-wrap">
            <table className="public-ranking-table">
              <thead>
                <tr>
                  <th className="col-num">{'Pos.'}</th>
                  <th>{'Player'}</th>
                  <th>{'Tier'}</th>
                  <th className="col-num">{'Glicko'}</th>
                </tr>
              </thead>
              <tbody>
                {data.players.map((player, index) => (
                  <tr key={player.username}>
                    <td className="col-num">{index + 1}</td>
                    <td>{player.username}</td>
                    <td><RankBadge elo={player.rating} compact /></td>
                    <td className="col-num">{player.rating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="public-ranking-updated"><Icon name="info" size={12} /> {`Updated ${formatDate(data.updatedAt)}`}</p>
        </>
      )}
    </section>
  )
}

function MatchesPanel() {
  const { data, status, refresh } = useRemoteMatches(MATCHES_LIMIT)

  return (
    <section className="public-ranking-section">
      <RemoteNote status={status} onRetry={refresh} />
      {status === 'ready' && data && data.matches.length === 0 && (
        <EmptyState icon="trophy" title={'No players yet.'} />
      )}
      {status === 'ready' && data && data.matches.length > 0 && (
        <>
          <div className="public-ranking-table-wrap">
            <table className="public-ranking-table">
              <thead>
                <tr>
                  <th>{'Match'}</th>
                  <th>{'Players'}</th>
                  <th>{'Result'}</th>
                  <th>{'Date'}</th>
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
          <p className="public-ranking-updated"><Icon name="info" size={12} /> {`Updated ${formatDate(data.updatedAt)}`}</p>
        </>
      )}
    </section>
  )
}
