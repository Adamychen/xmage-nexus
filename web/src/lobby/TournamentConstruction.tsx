import Chip from '../ui/Chip'
import { useTranslation } from '../i18n'
import type { TournamentView } from '../net/types'
import { constructionRemainingSeconds, readiness } from './tournament/matches'
import { stateLabel } from './lobbyUtils'
import { clockText } from './tournamentPresentation'

export function TournamentConstruction({ view, viewer, sinceArrival }: { view: TournamentView; viewer?: string; sinceArrival: number }) {
  const { t } = useTranslation()
  const total = Math.max(0, view.constructionTime)
  const remaining = constructionRemainingSeconds(view, sinceArrival)
  const elapsed = remaining === null ? 0 : Math.min(total, Math.max(0, total - remaining))
  const percent = total > 0 ? (elapsed / total) * 100 : 0
  const { ready, building } = readiness(view)
  return (
    <div className="trn-construct" data-testid="construct-panel">
      <div className="trn-construct-clock">
        {remaining !== null && <span className="trn-construct-time" data-testid="construct-countdown">{clockText(remaining)}</span>}
        <span className="trn-construct-left" data-testid="construct-total">{t('lobby', 'trn_c_construct_left', { total: clockText(total) })}</span>
      </div>
      <div
        className="trn-construct-bar"
        role="progressbar"
        aria-label={t('lobby', 'trn_c_construct_bar')}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={elapsed}
        data-testid="construct-progress"
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="trn-construct-ready" data-testid="construct-ready">
        {t('lobby', 'trn_c_construct_ready', { ready: ready.length, total: view.players.length })}
      </p>
      <ul className="trn-construct-players" data-testid="construct-players">
        {view.players.map((player) => {
          const status = ready.includes(player.name) ? 'ready' : building.includes(player.name) ? 'building' : 'other'
          const me = viewer === player.name
          const statusText = status === 'ready'
            ? t('lobby', 'trn_c_construct_ready_mark')
            : status === 'building'
              ? t('lobby', 'trn_c_construct_building')
              : stateLabel(t, player.state)
          return (
            <li
              key={player.name}
              className={`trn-construct-player is-${status} ${me ? 'is-me' : ''}`}
              data-testid="construct-player"
              data-status={status}
              data-me={me ? 'true' : 'false'}
            >
              <span className="trn-construct-name">{player.name}</span>
              {me && <Chip tone="brand" size="xs">{t('lobby', 'trn_b_you')}</Chip>}
              <span className="trn-construct-status">{statusText}</span>
            </li>
          )
        })}
      </ul>
      <p className="trn-construct-note" data-testid="construct-note">{t('lobby', 'trn_c_construct_note')}</p>
    </div>
  )
}

export function TournamentDrafting({ view }: { view: TournamentView }) {
  const { t } = useTranslation()
  return (
    <div className="trn-state-panel" data-testid="draft-panel">
      <h4 className="trn-state-title">{t('lobby', 'trn_c_draft_title')}</h4>
      {view.runningInfo && <p className="trn-state-info" data-testid="draft-running">{view.runningInfo}</p>}
      <p className="trn-state-body">{t('lobby', 'trn_c_draft_body')}</p>
    </div>
  )
}
