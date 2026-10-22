import type { PermanentView } from '../net/types'
import { isMarqueePermanent } from './marquee'

/** The band a permanent is drawn in. A creature that is also a land (Dryad Arbor, an animated Mutavault) fights, so it sits with the creatures, as on the desktop client. */
export function permanentKind(perm: PermanentView): 'creatures' | 'lands' | 'other' {
  const types = perm.cardTypes ?? []
  if (types.some((t) => t === 'Creature' || t.toLowerCase() === 'creature')) return 'creatures'
  if (types.some((t) => t === 'Land' || t.toLowerCase() === 'land')) return 'lands'
  return 'other'
}

export interface BandFill {
  creatures: boolean
  permanents: boolean
}

/** Which of the two bands of a zone holds anything (attachments ride on their host, phased-out permanents do not exist). */
export function bandFill(
  battlefield: Record<string, PermanentView> | null | undefined,
  commander: boolean,
  marqueeColumn = false,
): BandFill {
  const perms = Object.entries(battlefield ?? {}).filter(([, p]) => p.phasedIn !== false)
  const attached = new Set<string>()
  for (const [, p] of perms) for (const id of p.attachments ?? []) attached.add(id)
  let creatures = commander
  let permanents = false
  for (const [id, p] of perms) {
    if (attached.has(id)) continue
    const kind = permanentKind(p)
    if (kind === 'creatures') creatures = true
    else if (kind === 'lands') permanents = true
    else if (isMarqueePermanent(p)) {
      if (!marqueeColumn) creatures = true
    }
    else permanents = true
  }
  return { creatures, permanents }
}

export const BAND_FR_FULL = 4
export const BAND_FR_EMPTY = 1

export interface BandShares {
  creaturesFr: number
  permanentsFr: number
  /** Share of the zone's card area taken by the taller band: what its card height is sized from. */
  tallest: number
  /** True when the two bands differ, i.e. the grid must deviate from the equal 1fr / 1fr split. */
  uneven: boolean
}

/**
 * An empty band yields its height to the other one, so a board with few
 * permanents gets big, legible cards. Both bands filled (or both empty) keeps
 * the equal split, which is the size the zone has always had.
 */
export function bandShares(fill: BandFill): BandShares {
  if (fill.creatures === fill.permanents) {
    return { creaturesFr: BAND_FR_FULL, permanentsFr: BAND_FR_FULL, tallest: 0.5, uneven: false }
  }
  const creaturesFr = fill.creatures ? BAND_FR_FULL : BAND_FR_EMPTY
  const permanentsFr = fill.permanents ? BAND_FR_FULL : BAND_FR_EMPTY
  return { creaturesFr, permanentsFr, tallest: BAND_FR_FULL / (BAND_FR_FULL + BAND_FR_EMPTY), uneven: true }
}
