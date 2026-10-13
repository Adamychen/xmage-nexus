import showcaseArt from '../data/showcaseArt.generated.json'

/**
 * Art local (web/public/showcase/) para piezas decorativas: demos de presets,
 * mini-tableros del picker de playmats… Son ~13 artes reales generados por
 * `scripts/gen-showcase-art.mjs`, no el pipeline de arte de partida (ese es
 * `scryfallClient.ts` con su cola y caché). Se usan commitados porque el e2e
 * aborta todo request externo y el picker tiene que pintar igual offline.
 */
const ART = showcaseArt as Record<string, string>

/** URL local del arte recortado de la carta, o null si no está en el set del showcase. */
export function showcaseArtUrl(cardName: string | null | undefined): string | null {
  if (!cardName) return null
  const path = ART[cardName]
  if (!path) return null
  // Mismo tratamiento que los símbolos de maná: el prefijo depende de BASE_URL
  // ('/' en web, './' en el build Tauri).
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
  const cleanBase = base.endsWith('/') ? base : `${base}/`
  return `${cleanBase}${path.startsWith('/') ? path.slice(1) : path}`
}
