import { useId, useMemo, useState, type ReactNode } from 'react'
import EmptyState from '../ui/EmptyState'
import Tabs, { tabPanelProps, type TabItem } from '../ui/Tabs'
import { useTranslation } from '../i18n'
import { useNarrowScreen } from '../game/useNarrowScreen'
import { useStore } from '../state/store'
import type { TournamentView } from '../net/types'
import { currentRoundIndex, eliminationTree, type MatchSummary } from './tournament/matches'
import { tournamentPhase, type TournamentPhase } from './tournament/parse'
import TournamentEliminationTree from './TournamentEliminationTree'
import { TournamentConstruction, TournamentDrafting } from './TournamentConstruction'
import TournamentMatchCard from './TournamentMatchCard'
import { isElimination, matchesByRound, roundTotal, useSinceArrival } from './tournamentPresentation'

export interface TournamentRoundsProps {
  view: TournamentView
  tournamentId?: string
  canWatch?: boolean
  onWatchMatch?: (tableId: string) => void
  watchingMatchId?: string | null
}

function RoundPanel({ view, index, matches, viewer, canWatch, onWatch, watchingMatchId, panelProps }: {
  view: TournamentView
  index: number
  matches: MatchSummary[]
  viewer?: string
  canWatch: boolean
  onWatch?: (tableId: string) => void
  watchingMatchId?: string | null
  panelProps: ReturnType<typeof tabPanelProps>
}) {
  const { t } = useTranslation()
  const played = index < view.rounds.length
  let body: ReactNode
  if (!played) {
    body = (
      <p className="trn-future" data-testid="bracket-future">
        {index === 0
          ? t('lobby', 'trn_b_future_first')
          : t('lobby', 'trn_b_future_round', { number: index + 1, previous: index })}
      </p>
    )
  } else if (matches.length === 0) {
    body = <EmptyState size="sm">{t('lobby', 'bracket_empty')}</EmptyState>
  } else {
    body = (
      <div className="trn-match-grid">
        {matches.map((match) => (
          <TournamentMatchCard
            key={match.key}
            match={match}
            viewer={viewer}
            canWatch={canWatch}
            onWatch={onWatch}
            watchingMatchId={watchingMatchId}
          />
        ))}
      </div>
    )
  }
  return (
    <div {...panelProps} className="trn-round-panel" data-testid="bracket-round" data-round={index}>
      {body}
    </div>
  )
}

export default function TournamentRounds({ view, tournamentId, canWatch, onWatchMatch, watchingMatchId }: TournamentRoundsProps) {
  const { t } = useTranslation()
  const viewer = useStore((s) => s.conn?.username)
  const idBase = useId().replace(/:/g, '')
  const sinceArrival = useSinceArrival(view)
  const phone = useNarrowScreen()
  const [picked, setPicked] = useState<{ tournamentId: string | undefined; index: number } | null>(null)

  const phase: TournamentPhase = tournamentPhase(view.tournamentState)
  const elimination = isElimination(view)
  const hasTree = elimination && eliminationTree(view).columns.length > 0
  const perRound = useMemo(() => matchesByRound(view), [view])
  const total = roundTotal(view)
  const latest = currentRoundIndex(view)
  const selected = Math.min(
    picked && picked.tournamentId === tournamentId ? picked.index : Math.max(0, latest),
    Math.max(0, total - 1),
  )
  const idPrefix = `trn-rounds-${idBase}`
  const selectedId = String(selected)
  const watchable = canWatch ?? view.watchingAllowed

  if (phase === 'constructing') return <TournamentConstruction view={view} viewer={viewer} sinceArrival={sinceArrival} />
  if (phase === 'drafting') return <TournamentDrafting view={view} />

  if (elimination) {
    return hasTree ? (
      <TournamentEliminationTree
        view={view}
        viewer={viewer}
        canWatch={watchable}
        onWatch={onWatchMatch}
        watchingMatchId={watchingMatchId}
        stacked={phone}
      />
    ) : (
      <EmptyState data-testid="tournament-no-rounds">{t('lobby', 'bracket_no_rounds')}</EmptyState>
    )
  }
  if (total === 0) return <EmptyState data-testid="tournament-no-rounds">{t('lobby', 'bracket_no_rounds')}</EmptyState>

  const tabs: TabItem<string>[] = Array.from({ length: total }, (_, index) => {
    const matches = perRound[index] ?? []
    const finished = matches.filter((m) => m.finished).length
    const detail = matches.length > 0
      ? t('lobby', 'trn_b_finished_of', { done: finished, total: matches.length })
      : t('lobby', 'trn_b_not_paired')
    return {
      id: String(index),
      testId: 'bracket-round-tab',
      label: (
        <span className="trn-round-tab">
          <span>{t('lobby', 'tournament_round_label', { number: index + 1 })}</span>
          <small>{detail}</small>
        </span>
      ),
    }
  })

  return (
    <>
      <Tabs
        className="trn-round-tabs"
        items={tabs}
        value={selectedId}
        onChange={(id) => setPicked({ tournamentId, index: Number(id) })}
        idPrefix={idPrefix}
        label={t('lobby', 'trn_b_rounds_label')}
      />
      <RoundPanel
        view={view}
        index={selected}
        matches={perRound[selected] ?? []}
        viewer={viewer}
        canWatch={watchable}
        onWatch={onWatchMatch}
        watchingMatchId={watchingMatchId}
        panelProps={tabPanelProps(idPrefix, selectedId)}
      />
    </>
  )
}
