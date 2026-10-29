import { useId, useState } from 'react'
import Button from '../ui/Button'
import Chip, { type ChipTone } from '../ui/Chip'
import IconButton from '../ui/IconButton'
import Icon from '../ui/Icon'
import Tabs from '../ui/Tabs'
import { confirmDialog } from '../ui/confirmDialog'
import { formatTimer } from '../utils/timer'
import * as cmds from '../net/commands'
import { useStore } from '../state/store'
import type { TournamentView } from '../net/types'
import { plural, useTranslation } from '../i18n'
import { useNarrowScreen } from '../game/useNarrowScreen'
import './TournamentBracket.css'
import { stateLabel } from './lobbyUtils'
import { constructionRemainingSeconds, currentRoundIndex, isParticipant, podium } from './tournament/matches'
import { tournamentPhase, type TournamentPhase } from './tournament/parse'
import TournamentPodium from './TournamentPodium'
import TournamentRounds from './TournamentRounds'
import TournamentStandings from './TournamentStandings'
import TournamentYourMatch from './TournamentYourMatch'
import { ELIMINATION_ROUND_KEYS, eliminationRoundOf, isElimination, startLabel, tournamentKicker, useNow, useSinceArrival } from './tournamentPresentation'

export interface TournamentBracketProps {
  view: TournamentView
  tournamentId?: string
  onQuit?: (tournamentId: string) => void
  onWatchMatch?: (tableId: string) => void
  watchingMatchId?: string | null
  compact?: boolean
  /** false = the viewer does not play this tournament (spectator): no leave action */
  canQuit?: boolean
  showName?: boolean
  /** ms epoch of the last successful refresh; shows "Updated N s ago" */
  updatedAt?: number | null
  refreshing?: boolean
  onRefresh?: () => void
}

type Pane = 'rounds' | 'standings'

function phaseTone(phase: TournamentPhase): ChipTone {
  if (phase === 'dueling' || phase === 'sideboarding') return 'ok'
  if (phase === 'constructing' || phase === 'drafting') return 'warn'
  if (phase === 'finished') return 'gold'
  return 'neutral'
}

export function UpdatedAgo({ at }: { at: number }) {
  const { t } = useTranslation()
  const now = useNow(1000)
  const seconds = Math.max(0, Math.floor((now - at) / 1000))
  return <span className="trn-updated" data-testid="tournament-updated">{t('lobby', 'trn_b_updated_ago', { seconds })}</span>
}

function BracketHeader({ view, showName, updatedAt, refreshing, onRefresh, sinceArrival }: {
  view: TournamentView
  showName: boolean
  updatedAt: number | null | undefined
  refreshing: boolean
  onRefresh?: () => void
  sinceArrival: number
}) {
  const { t, lang } = useTranslation()
  const phase = tournamentPhase(view.tournamentState)
  const current = currentRoundIndex(view)
  const elapsedMs = view.serverTime != null && view.stepStartTime != null ? view.serverTime + sinceArrival - view.stepStartTime : null
  const remaining = phase === 'constructing' ? constructionRemainingSeconds(view, sinceArrival) : null
  const eliminationRound = phase === 'dueling' && current >= 0 && isElimination(view) ? eliminationRoundOf(view, current) : null
  const phaseLabel = eliminationRound
    ? t('lobby', 'trn_f_phase_in_progress', { name: t('lobby', ELIMINATION_ROUND_KEYS[eliminationRound]) })
    : phase === 'dueling' && current >= 0
      ? t('lobby', 'trn_b_phase_round', { number: current + 1 })
      : stateLabel(t, view.tournamentState)
  const players = view.players.length
  const span = phase === 'finished' && view.startTime && view.endTime
    ? t('lobby', 'trn_c_span', { from: startLabel(view.startTime, lang), to: startLabel(view.endTime, lang) })
    : null
  return (
    <header className="trn-header" data-testid="tournament-header">
      <div className="trn-header-top">
        <div className="trn-kicker" data-testid="tournament-kicker">
          <Icon name="trophy" size={13} />
          <span>{tournamentKicker(view, t)}</span>
        </div>
        <div className="trn-header-tools">
          {updatedAt != null && <UpdatedAgo at={updatedAt} />}
          {onRefresh && (
            <IconButton
              icon="refresh"
              label={t('lobby', 'matches_refresh')}
              size="md"
              round
              data-testid="tournament-refresh"
              disabled={refreshing}
              onClick={onRefresh}
            />
          )}
        </div>
      </div>
      {showName && <h2 className="tournament-name" data-testid="tournament-name">{view.tournamentName}</h2>}
      <div className="trn-chips">
        <Chip solid tone={phaseTone(phase)} data-testid="tournament-state">{phaseLabel}</Chip>
        {phase === 'dueling' && elapsedMs != null && (
          <Chip icon="clock" data-testid="tournament-timer">{t('lobby', 'trn_b_started_ago', { time: formatTimer(Math.max(0, Math.floor(elapsedMs / 1000))) })}</Chip>
        )}
        {remaining != null && (
          <Chip icon="hourglass" tone="warn" data-testid="tournament-construction">{t('lobby', 'trn_b_construction_left', { time: formatTimer(remaining) })}</Chip>
        )}
        <Chip icon="users" data-testid="tournament-players">{players} {plural('lobby', 'tournament_player', players)}</Chip>
        <Chip icon={view.watchingAllowed ? 'eye' : 'lock'} tone={view.watchingAllowed ? 'ok' : 'neutral'} data-testid="tournament-watching">
          {t('lobby', view.watchingAllowed ? 'tag_spectators' : 'tag_private')}
        </Chip>
        {span ? (
          <Chip icon="history" data-testid="tournament-dates">{span}</Chip>
        ) : (
          view.startTime != null && view.startTime > 0 && (
            <Chip icon="history" data-testid="tournament-dates">{t('lobby', 'trn_b_started', { time: startLabel(view.startTime, lang) })}</Chip>
          )
        )}
      </div>
      {view.runningInfo && phase !== 'drafting' && (
        <div className="tournament-running-info" data-testid="tournament-running-info">{view.runningInfo}</div>
      )}
    </header>
  )
}

export default function TournamentBracket({
  view,
  tournamentId,
  onQuit,
  onWatchMatch,
  watchingMatchId,
  compact,
  canQuit,
  showName = true,
  updatedAt,
  refreshing = false,
  onRefresh,
}: TournamentBracketProps) {
  const { t } = useTranslation()
  const viewer = useStore((s) => s.conn?.username)
  const idBase = useId().replace(/:/g, '')
  const sinceArrival = useSinceArrival(view)
  const phone = useNarrowScreen()
  const [pane, setPane] = useState<Pane>('rounds')

  const phase = tournamentPhase(view.tournamentState)
  const elimination = isElimination(view)
  const participant = !!viewer && isParticipant(view, viewer)
  const champions = podium(view)

  const handleQuit = async () => {
    if (!tournamentId) return
    if (!(await confirmDialog(t('lobby', 'tournament_quit_confirm'), { danger: true }))) return
    if (onQuit) {
      onQuit(tournamentId)
      return
    }
    try {
      await cmds.quitTournament(tournamentId)
    } catch {}
  }

  const idPrefix = `trn-rounds-${idBase}`

  return (
    <div className={`tournament-bracket ${compact ? 'compact' : ''} ${phone ? 'is-phone' : ''} ${elimination ? 'is-elimination' : ''}`} data-testid="tournament-bracket">
      <BracketHeader
        view={view}
        showName={showName}
        updatedAt={updatedAt}
        refreshing={refreshing}
        onRefresh={onRefresh}
        sinceArrival={sinceArrival}
      />
      {viewer && participant && <TournamentYourMatch view={view} username={viewer} />}
      {phone && (
        <div className="trn-switch-wrap" data-testid="bracket-switch">
          <Tabs<Pane>
            className="trn-switch"
            variant="segmented"
            items={[
              { id: 'rounds', label: t('lobby', 'trn_b_rounds_label'), testId: 'switch-rounds' },
              { id: 'standings', label: t('lobby', 'standings_title'), testId: 'switch-standings' },
            ]}
            value={pane}
            onChange={setPane}
            idPrefix={`${idPrefix}-switch`}
            label={t('lobby', 'trn_c_switch_label')}
          />
        </div>
      )}
      <div className="tournament-bracket-body">
        {(!phone || pane === 'rounds') && (
          <section className="tournament-rounds-section" aria-labelledby={`${idPrefix}-title`} data-testid="bracket-rounds-section">
            <h3 className="tournament-section-title" id={`${idPrefix}-title`}>{t('lobby', 'bracket_title')}</h3>
            <TournamentRounds
              view={view}
              tournamentId={tournamentId}
              canWatch={view.watchingAllowed}
              onWatchMatch={onWatchMatch}
              watchingMatchId={watchingMatchId}
            />
          </section>
        )}
        {(!phone || pane === 'standings') && (
          <section className="tournament-standings-section" aria-labelledby={`${idPrefix}-standings`} data-testid="bracket-standings-section">
            <h3 className="tournament-section-title" id={`${idPrefix}-standings`}>{t('lobby', 'standings_title')}</h3>
            {phase === 'finished' && <TournamentPodium entries={champions} champion={elimination} />}
            <TournamentStandings view={view} viewer={viewer} />
          </section>
        )}
      </div>
      {tournamentId && (canQuit ?? true) && (
        <footer className="trn-footer">
          <Button variant="soft-danger" size="md" className="trn-leave" data-testid="tournament-quit" onClick={() => void handleQuit()}>
            {t('lobby', 'trn_b_leave')}
          </Button>
        </footer>
      )}
    </div>
  )
}
