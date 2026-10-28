import type { CardStripMeta } from './ArenaCardStrip'

export function isMetaLoaded(meta: CardStripMeta | undefined): meta is CardStripMeta {
  return typeof meta?.typeLine === 'string' && meta.typeLine.length > 0
}
