export const PUBLIC_RANKING_HASH = '#/ranking'

export function isPublicRankingHash(hash: string): boolean {
  return /^#\/ranking\b/.test(hash)
}
