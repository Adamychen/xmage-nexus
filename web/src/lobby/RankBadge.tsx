import { getRankInfo, getTierName, getRankLabel } from './ranking'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import './RankBadge.css'

interface RankBadgeProps {
  elo?: number | string | null
  showElo?: boolean
  compact?: boolean
  className?: string
}

export default function RankBadge({ elo, showElo = false, compact = false, className = '' }: RankBadgeProps) {
  const { t } = useTranslation()
  const rank = getRankInfo(elo)
  const tierName = getTierName(rank.tier, t)
  const label = getRankLabel(rank, t)
  const numericElo = typeof elo === 'number' ? elo : parseInt(String(elo ?? '1500'), 10) || 1500

  return (
    <div
      className={`rank-badge ${rank.tier.toLowerCase()} ${compact ? 'compact' : ''} ${className}`}
      style={{
        backgroundColor: rank.bg,
        borderColor: rank.border,
        color: rank.color,
      }}
      title={`${t('lobby', 'leaderboard_col_tier')}: ${label} (${numericElo} ELO)`}
    >
      <span className="rank-badge-icon"><Icon name={rank.icon} size={compact ? 10 : 12} /></span>
      <span className="rank-badge-name">{compact ? tierName : label}</span>
      {showElo && <span className="rank-badge-elo">({numericElo})</span>}
    </div>
  )
}
