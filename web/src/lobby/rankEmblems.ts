import bronce from './rank-emblems/bronce.svg?raw'
import plata from './rank-emblems/plata.svg?raw'
import oro from './rank-emblems/oro.svg?raw'
import platino from './rank-emblems/platino.svg?raw'
import diamante from './rank-emblems/diamante.svg?raw'
import mitico from './rank-emblems/mitico.svg?raw'
import type { RankTier } from './ranking'

/** Static SVG markup per league; colored through `currentColor`. */
export const RANK_EMBLEM_SVG: Record<RankTier, string> = {
  BRONZE: bronce,
  SILVER: plata,
  GOLD: oro,
  PLATINUM: platino,
  DIAMOND: diamante,
  MYTHIC: mitico,
}
