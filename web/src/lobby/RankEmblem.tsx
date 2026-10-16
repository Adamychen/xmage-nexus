import { RANK_EMBLEM_SVG } from './rankEmblems'
import type { RankTier } from './ranking'

interface RankEmblemProps {
  tier: RankTier
  className?: string
}

/** Shield emblem of a league. The markup is a build-time constant, never user input. */
export default function RankEmblem({ tier, className = '' }: RankEmblemProps) {
  return (
    <span
      className={`rank-emblem ${className}`.trim()}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: RANK_EMBLEM_SVG[tier] }}
    />
  )
}
