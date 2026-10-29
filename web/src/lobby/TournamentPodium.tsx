import Icon from '../ui/Icon'
import { plural, useTranslation } from '../i18n'
import type { PodiumEntry } from './tournament/matches'
import { ordinalLabel } from './tournamentPresentation'

export default function TournamentPodium({ entries, champion }: { entries: PodiumEntry[]; champion: boolean }) {
  const { t, lang } = useTranslation()
  if (entries.length === 0) return null
  return (
    <section className={`trn-podium ${champion ? 'is-champion' : ''}`} aria-label={t('lobby', 'trn_c_podium_label')} data-testid="tournament-podium">
      <ol className="trn-podium-list">
        {entries.map((entry, index) => {
          const rank = index + 1
          return (
            <li key={entry.name} className="trn-podium-place" data-rank={rank} data-testid="podium-place">
              <Icon name={rank === 1 ? 'trophy' : 'medal'} size={18} />
              <span className="trn-podium-rank">{champion ? t('lobby', 'trn_c_champion') : ordinalLabel(rank, lang, t)}</span>
              <strong className="trn-podium-name">{entry.name}</strong>
              <span className="trn-podium-points">{plural('lobby', 'trn_b_points', entry.points)}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
