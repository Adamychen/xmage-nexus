import type { PermanentView } from '../net/types'
import { isTokenCard } from '../cards/cardImages'

export const STACK_GROUP_MIN = 3
export const TOKEN_PILE_FAN_DELAY_MS = 1000
/** BRD-20: the largest pile that still fans out; beyond it the fan is a smear, not a row of cards. */
export const PILE_FAN_MAX = 12

export type StackGroupKind = 'land' | 'token' | 'creature-token'

export interface StackGroup {
  key: string
  name: string
  kind: StackGroupKind
  items: [string, PermanentView][]
}

export interface GroupStackablesOpts {
  excludeIds?: Set<string>
  /** Smallest group that stacks (STACK_GROUP_MIN unless given). */
  min?: number
  /** CMB-17: what a creature is doing in the combat, so attackers of one seat pile together and
   *  apart from the ones attacking someone else (`combatPileKeys`). */
  combatKeys?: Map<string, string>
}

function hasCounters(perm: PermanentView): boolean {
  return (perm.counters ?? []).length > 0
}

function hasAlteredFace(perm: PermanentView): boolean {
  return (
    perm.faceDown === true ||
    perm.morphed === true ||
    perm.disguised === true ||
    perm.manifested === true ||
    perm.cloaked === true
  )
}

function tappedFlag(perm: PermanentView): string {
  return perm.tapped === true ? 't' : 'u'
}

/** BRD-20: a creature that cannot act yet is not the same card to the player as one that can. */
function sicknessFlag(perm: PermanentView): string {
  return perm.summoningSickness === true ? 's' : 'r'
}

export function stackGroupKeyOf(
  id: string,
  perm: PermanentView,
  kind: 'creatures' | 'lands' | 'other',
  excludeIds?: Set<string>,
  combatKey?: string,
): { key: string; name: string; groupKind: StackGroupKind } | null {
  const name = perm.name || 'Card'
  if (excludeIds?.has(id)) return null
  if ((perm.attachments ?? []).length > 0 || perm.mutated === true) return null
  if (kind === 'lands') {
    return { key: `land:${name}:${tappedFlag(perm)}`, name, groupKind: 'land' }
  }
  if (!isTokenCard(perm)) return null
  if (hasAlteredFace(perm)) return null
  if (hasCounters(perm)) return null
  if ((perm.damage ?? 0) > 0) return null
  if (kind === 'other') {
    return { key: `token:${name}:${tappedFlag(perm)}`, name, groupKind: 'token' }
  }
  const pt = `${perm.power ?? ''}/${perm.toughness ?? ''}`
  const combat = combatKey ? `:${combatKey}` : ''
  return { key: `ctoken:${name}:${tappedFlag(perm)}:${sicknessFlag(perm)}:${pt}${combat}`, name, groupKind: 'creature-token' }
}

export function groupStackables(
  entries: [string, PermanentView][],
  kind: 'creatures' | 'lands' | 'other',
  opts: GroupStackablesOpts = {},
): { groups: StackGroup[]; solos: [string, PermanentView][] } {
  const byKey = new Map<string, StackGroup>()
  const order: StackGroup[] = []
  for (const [id, perm] of entries) {
    const slot = stackGroupKeyOf(id, perm, kind, opts.excludeIds, opts.combatKeys?.get(id))
    if (!slot) continue
    let group = byKey.get(slot.key)
    if (!group) {
      group = { key: slot.key, name: slot.name, kind: slot.groupKind, items: [] }
      byKey.set(slot.key, group)
      order.push(group)
    }
    group.items.push([id, perm])
  }
  /** BRD-20: a pile holds the whole group. Copies that the game is asking the player to pick leave
   *  it through `excludeIds`, so a pile never hides a card that has to be reachable. */
  const groups = order.filter((g) => g.items.length >= (opts.min ?? STACK_GROUP_MIN))
  const groupedIds = new Set<string>()
  for (const g of groups) for (const [id] of g.items) groupedIds.add(id)
  return { groups, solos: entries.filter(([id]) => !groupedIds.has(id)) }
}
