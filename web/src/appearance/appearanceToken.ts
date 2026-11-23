import { CUSTOM_SLEEVE_ID, isValidSleeveId } from './sleeves'

/**
 * What a player tells the rest of the table about their own appearance (APR-6).
 *
 * XMage has no appearance of its own to carry, so the token travels in `userIdStr`, the one
 * free string of `UserData`: the server copies it verbatim and puts the whole object in every
 * `PlayerView`, so each client reads it next to the avatar and the flag it already reads from
 * there. The catalogue lives in this client, so the wire only ever names a catalogue entry.
 */
export const APPEARANCE_TOKEN_PREFIX = 'nxs1'

/** The proxy drops anything longer: the token rides in every game view, for every player. */
export const APPEARANCE_TOKEN_MAX = 120

export interface AppearanceChoice {
  /** A catalogue sleeve every client ships, never `custom`; null when the player declared none. */
  sleeveId: string | null
}

export function buildAppearanceToken(choice: AppearanceChoice): string {
  const parts: string[] = []
  const sleeve = choice.sleeveId
  if (sleeve && sleeve !== CUSTOM_SLEEVE_ID && isValidSleeveId(sleeve)) parts.push(`slv=${sleeve}`)
  return parts.length > 0 ? [APPEARANCE_TOKEN_PREFIX, ...parts].join(';') : ''
}

export function parseAppearanceToken(raw: unknown): AppearanceChoice {
  const none: AppearanceChoice = { sleeveId: null }
  if (typeof raw !== 'string' || raw.length > APPEARANCE_TOKEN_MAX) return none
  const [prefix, ...pairs] = raw.split(';')
  if (prefix !== APPEARANCE_TOKEN_PREFIX) return none
  let sleeveId: string | null = null
  for (const pair of pairs) {
    const eq = pair.indexOf('=')
    if (eq < 0) continue
    const key = pair.slice(0, eq)
    const value = pair.slice(eq + 1)
    // A sleeve this build cannot draw reads as none: `custom` is an image only its owner has,
    // and an id from a newer catalogue is a name this client never shipped.
    if (key === 'slv' && value !== CUSTOM_SLEEVE_ID && isValidSleeveId(value)) sleeveId = value
  }
  return { sleeveId }
}
