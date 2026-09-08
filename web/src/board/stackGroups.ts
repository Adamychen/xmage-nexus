import type { PermanentView } from '../net/types'
import { isTokenCard } from '../cards/cardImages'

export const STACK_GROUP_MIN = 3

export type StackGroupKind = 'land' | 'token' | 'creature-token'

export interface StackGroup {
  key: string
  name: string
  kind: StackGroupKind
  items: [string, PermanentView][]
}

export interface GroupStackablesOpts {
  busyIds?: Set<string>
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

export function stackGroupKeyOf(
  id: string,
  perm: PermanentView,
  kind: 'creatures' | 'lands' | 'other',
  busyIds?: Set<string>,
): { key: string; name: string; groupKind: StackGroupKind } | null {
  const name = perm.name || 'Card'
  if (kind === 'lands') {
    return { key: `land:${name}`, name, groupKind: 'land' }
  }
  if (!isTokenCard(perm)) return null
  if (hasAlteredFace(perm)) return null
  if (hasCounters(perm)) return null
  if ((perm.damage ?? 0) > 0) return null
  if (kind === 'other') {
    return { key: `token:${name}:${tappedFlag(perm)}`, name, groupKind: 'token' }
  }
  if (busyIds?.has(id)) return null
  if (perm.mutated === true) return null
  const pt = `${perm.power ?? ''}/${perm.toughness ?? ''}`
  return { key: `ctoken:${name}:${tappedFlag(perm)}:${pt}`, name, groupKind: 'creature-token' }
}

export function groupStackables(
  entries: [string, PermanentView][],
  kind: 'creatures' | 'lands' | 'other',
  opts: GroupStackablesOpts = {},
): { groups: StackGroup[]; solos: [string, PermanentView][] } {
  const byKey = new Map<string, StackGroup>()
  const order: StackGroup[] = []
  for (const [id, perm] of entries) {
    const slot = stackGroupKeyOf(id, perm, kind, opts.busyIds)
    if (!slot) continue
    let group = byKey.get(slot.key)
    if (!group) {
      group = { key: slot.key, name: slot.name, kind: slot.groupKind, items: [] }
      byKey.set(slot.key, group)
      order.push(group)
    }
    group.items.push([id, perm])
  }
  const groups = order.filter((g) => g.items.length >= STACK_GROUP_MIN)
  const groupedIds = new Set<string>()
  for (const g of groups) for (const [id] of g.items) groupedIds.add(id)
  return { groups, solos: entries.filter(([id]) => !groupedIds.has(id)) }
}
