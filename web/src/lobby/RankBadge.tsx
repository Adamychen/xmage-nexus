import { getRankInfo, getTierName, getRankLabel } from './ranking'
import RankEmblem from './RankEmblem'
import { useTranslation } from '../i18n'
import './RankBadge.css'

interface RankBadgeProps {
  elo?: number | string | null
  showElo?: boolean
  compact?: boolean
  iconOnly?: boolean
  className?: string
}

export default function RankBadge({ elo, showElo = false, compact = false, iconOnly = false, className = '' }: RankBadgeProps) {
  const { t } = useTranslation()
  const rank = getRankInfo(elo)
  const tierName = getTierName(rank.tier, t)
  const label = getRankLabel(rank, t)
  const numericElo = typeof elo === 'number' ? elo : parseInt(String(elo ?? '1500'), 10) || 1500

  return (
    <div
      className={`rank-badge ${rank.tier.toLowerCase()} ${compact ? 'compact' : ''} ${iconOnly ? 'icon-only' : ''} ${className}`}
      style={{
        backgroundColor: iconOnly ? undefined : rank.bg,
        borderColor: rank.border,
        color: rank.color,
      }}
      title={`${t('lobby', 'leaderboard_col_tier')}: ${label} (${numericElo})`}
    >
      <span className="rank-badge-icon"><RankEmblem tier={rank.tier} /></span>
      {!iconOnly && <span className="rank-badge-name">{compact ? tierName : label}</span>}
      {showElo && !iconOnly && <span className="rank-badge-elo">({numericElo})</span>}
    </div>
  )
}
