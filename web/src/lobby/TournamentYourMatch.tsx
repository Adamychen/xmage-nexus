import { plural, useTranslation } from '../i18n'
import type { TournamentView } from '../net/types'
import { currentRoundIndex, findMyMatch, myStanding } from './tournament/matches'
import { parsePlayerResults } from './tournament/parse'
import { currentRoundMatches, ordinalLabel } from './tournamentPresentation'
import TournamentMatchCard from './TournamentMatchCard'

interface Props {
  view: TournamentView
  username: string
  title?: string
}

export default function TournamentYourMatch({ view, username, title }: Props) {
  const { t, lang } = useTranslation()
  const current = currentRoundIndex(view)
  const roundNumber = current + 1
  const mine = findMyMatch(view, username)
  const standing = myStanding(view, username)
  const currentMatch = mine && mine.roundIndex === current ? mine.match : null
  const me = view.players.find((p) => p.name === username)
  const results = parsePlayerResults(me?.results)
  const byeNow = results?.some((r) => r.round === roundNumber && r.bye) ?? false

  const matches = currentRoundMatches(view)
  const done = matches.filter((m) => m.finished).length

  let note: string | null = null
  if (currentMatch?.live) {
    note = null
  } else if (byeNow) {
    note = t('lobby', 'trn_b_bye', { number: roundNumber })
  } else if (current < 0 || matches.length === 0) {
    note = t('lobby', 'trn_b_waiting_pairing', { number: Math.max(1, roundNumber) })
  } else if (done < matches.length) {
    note = t('lobby', 'trn_b_waiting_round', { number: roundNumber, done, total: matches.length })
  } else {
    note = t('lobby', 'trn_b_round_over', { number: roundNumber, next: roundNumber + 1 })
  }

  return (
    <section className="trn-your" aria-labelledby="trn-your-title" data-testid="your-match">
      <header className="trn-your-head">
        <h3 id="trn-your-title" className="trn-your-title">{title ?? t('lobby', 'trn_b_your_match')}</h3>
        {standing && (
          <p className="trn-your-standing" data-testid="your-standing">
            <span>{t('lobby', 'trn_b_standing', { rank: ordinalLabel(standing.rank, lang, t), points: plural('lobby', 'trn_b_points', standing.points) })}</span>
            {standing.tiedWith > 0 && <span className="trn-your-tie">{plural('lobby', 'trn_b_tied', standing.tiedWith)}</span>}
          </p>
        )}
      </header>
      {currentMatch && (
        <TournamentMatchCard match={currentMatch} viewer={username} featured />
      )}
      {note && <p className="trn-your-note" data-testid="your-match-note">{note}</p>}
    </section>
  )
}
