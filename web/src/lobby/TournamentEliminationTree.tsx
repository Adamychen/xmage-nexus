import { useId, useMemo, type CSSProperties } from 'react'
import type { TournamentView } from '../net/types'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import { eliminationTree, podium, winnerOf, type MatchSummary } from './tournament/matches'
import { eliminationRoundNames } from './tournament/tournamentType'
import TournamentMatchCard from './TournamentMatchCard'
import { ELIMINATION_ROUND_KEYS } from './tournamentPresentation'

export interface TournamentEliminationTreeProps {
  view: TournamentView
  viewer?: string
  canWatch: boolean
  onWatch?: (tableId: string) => void
  watchingMatchId?: string | null
  /** One stacked list per round instead of the side-by-side tree (TRN-19). */
  stacked: boolean
}

/** Connector geometry in a 24 x 100 box: y is a share of the column height, x is pixels. */
function linkPath(count: number, parents: number): string {
  const at = (slot: number, of: number) => ((slot + 0.5) / of) * 100
  const parts: string[] = []
  for (let parent = 0; parent < parents; parent++) {
    const top = 2 * parent
    const bottom = top + 1
    if (top >= count) continue
    if (bottom < count) {
      parts.push(`M0 ${at(top, count)} H12 V${at(bottom, count)} M0 ${at(bottom, count)} H12`)
    } else {
      parts.push(`M0 ${at(top, count)} H12`)
    }
    parts.push(`M12 ${at(parent, parents)} H24`)
  }
  return parts.join(' ')
}

export default function TournamentEliminationTree({ view, viewer, canWatch, onWatch, watchingMatchId, stacked }: TournamentEliminationTreeProps) {
  const { t } = useTranslation()
  const idBase = useId().replace(/:/g, '')
  const columns = useMemo(() => eliminationTree(view).columns, [view])
  const names = eliminationRoundNames(columns.length)
  const champion = podium(view)[0]?.name ?? null

  const sideOf = (match: MatchSummary | null): string | null => {
    if (!match) return null
    const winner = winnerOf(match)
    if (winner) return winner
    if (!match.players) return null
    return t('lobby', 'trn_c_tbd_winners', { left: match.players[0], right: match.players[1] })
  }

  const emptyText = (index: number, slot: number): string => {
    if (index === 0) return t('lobby', 'trn_c_tbd_pair')
    const previous = columns[index - 1].matches
    const left = sideOf(previous[2 * slot] ?? null)
    const right = sideOf(previous[2 * slot + 1] ?? null)
    if (!left && !right) return t('lobby', 'trn_c_tbd_undecided')
    return t('lobby', 'trn_c_vs', { left: left ?? t('lobby', 'trn_c_tbd'), right: right ?? t('lobby', 'trn_c_tbd') })
  }

  const slotContent = (match: MatchSummary | null, index: number, slot: number) =>
    match ? (
      <TournamentMatchCard match={match} viewer={viewer} canWatch={canWatch} onWatch={onWatch} watchingMatchId={watchingMatchId} tree />
    ) : (
      <div className="trn-match is-placeholder" data-testid="tree-placeholder">
        <span>{emptyText(index, slot)}</span>
      </div>
    )

  return (
    <div className={`trn-tree ${stacked ? 'is-stacked' : ''}`} data-testid="elimination-tree">
      <ol
        className="trn-tree-rounds"
        aria-label={t('lobby', 'trn_c_tree_label')}
        style={stacked ? undefined : ({ '--trn-body-h': `calc(var(--trn-slot-h) * ${Math.max(1, columns[0]?.matches.length ?? 1)})` } as CSSProperties)}
      >
        {columns.map((column, index) => {
          const titleId = `${idBase}-round-${index}`
          const parents = index + 1 < columns.length ? columns[index + 1].matches.length : 1
          return (
            <li key={column.roundNum} className="trn-tree-round" data-testid="tree-round" data-round={column.roundNum}>
              <h4 className="trn-tree-title" id={titleId}>{t('lobby', ELIMINATION_ROUND_KEYS[names[index]])}</h4>
              <div className="trn-tree-body">
                <ol className="trn-tree-slots" aria-labelledby={titleId}>
                  {column.matches.map((match, slot) => (
                    <li key={slot} className="trn-tree-slot" data-testid="tree-slot" data-filled={match ? 'true' : 'false'}>
                      {slotContent(match, index, slot)}
                    </li>
                  ))}
                </ol>
                {!stacked && (
                  <svg className="trn-tree-link" viewBox="0 0 24 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                    <path d={linkPath(column.matches.length, parents)} />
                  </svg>
                )}
              </div>
            </li>
          )
        })}
        <li className="trn-tree-round is-champion" data-testid="tree-champion">
          <h4 className="trn-tree-title" id={`${idBase}-champion`}>{t('lobby', 'trn_c_champion')}</h4>
          <div className="trn-tree-body">
            <div className="trn-tree-champion-slot">
              <div className={`trn-champion ${champion ? 'is-decided' : ''}`} data-testid="tree-champion-box">
                {champion ? (
                  <>
                    <Icon name="trophy" size={18} />
                    <strong className="trn-champion-name" data-testid="tree-champion-name">{champion}</strong>
                  </>
                ) : (
                  <span>{t('lobby', 'trn_c_champion_tbd')}</span>
                )}
              </div>
            </div>
          </div>
        </li>
      </ol>
    </div>
  )
}
