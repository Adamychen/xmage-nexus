import type { PermanentView } from '../net/types'
import { isTokenCard } from '../cards/cardImages'

export const STACK_GROUP_MIN = 3
export const TOKEN_PILE_MAX = 5
export const TOKEN_PILE_FAN_DELAY_MS = 1000

export type StackGroupKind = 'land' | 'token' | 'creature-token'

export interface StackGroup {
  key: string
  name: string
  kind: StackGroupKind
  items: [string, PermanentView][]
}

export interface GroupStackablesOpts {
  excludeIds?: Set<string>
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
  excludeIds?: Set<string>,
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
  return { key: `ctoken:${name}:${tappedFlag(perm)}:${pt}`, name, groupKind: 'creature-token' }
}

function chunkPile(group: StackGroup): StackGroup[] {
  const chunks: StackGroup[] = []
  for (let i = 0; i < group.items.length; i += TOKEN_PILE_MAX) {
    const items = group.items.slice(i, i + TOKEN_PILE_MAX)
    if (items.length < 2) continue
    chunks.push({ ...group, key: i === 0 ? group.key : `${group.key}#${i / TOKEN_PILE_MAX}`, items })
  }
  return chunks
}

export function groupStackables(
  entries: [string, PermanentView][],
  kind: 'creatures' | 'lands' | 'other',
  opts: GroupStackablesOpts = {},
): { groups: StackGroup[]; solos: [string, PermanentView][] } {
  const byKey = new Map<string, StackGroup>()
  const order: StackGroup[] = []
  for (const [id, perm] of entries) {
    const slot = stackGroupKeyOf(id, perm, kind, opts.excludeIds)
    if (!slot) continue
    let group = byKey.get(slot.key)
    if (!group) {
      group = { key: slot.key, name: slot.name, kind: slot.groupKind, items: [] }
      byKey.set(slot.key, group)
      order.push(group)
    }
    group.items.push([id, perm])
  }
  const groups = order.filter((g) => g.items.length >= STACK_GROUP_MIN).flatMap(chunkPile)
  const groupedIds = new Set<string>()
  for (const g of groups) for (const [id] of g.items) groupedIds.add(id)
  return { groups, solos: entries.filter(([id]) => !groupedIds.has(id)) }
}
