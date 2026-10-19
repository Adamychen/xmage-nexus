import type { PlayerView } from '../net/types'
import type { ActionFeedItem } from './gameEventParser'

export const TICKER_LINES = 4

const HIDDEN_TYPES: ReadonlySet<ActionFeedItem['type']> = new Set(['turn', 'phase', 'chat'])

export interface TickerSegment {
  text: string
  strong: boolean
}

export interface TickerLine {
  id: string
  ownerId: string | null
  segments: TickerSegment[]
}

export function emphasize(text: string, names: readonly (string | undefined)[]): TickerSegment[] {
  const wanted = [...new Set(names.filter((n): n is string => !!n && n.trim().length > 1))].sort((a, b) => b.length - a.length)
  const spans: Array<[number, number]> = []
  for (const name of wanted) {
    let from = 0
    for (;;) {
      const at = text.indexOf(name, from)
      if (at < 0) break
      const end = at + name.length
      if (!spans.some(([s, e]) => at < e && end > s)) spans.push([at, end])
      from = end
    }
  }
  spans.sort((a, b) => a[0] - b[0])
  const out: TickerSegment[] = []
  let cursor = 0
  for (const [s, e] of spans) {
    if (s > cursor) out.push({ text: text.slice(cursor, s), strong: false })
    out.push({ text: text.slice(s, e), strong: true })
    cursor = e
  }
  if (cursor < text.length) out.push({ text: text.slice(cursor), strong: false })
  return out
}

function ownerOf(item: ActionFeedItem, players: readonly PlayerView[]): PlayerView | undefined {
  if (item.playerName) {
    const named = players.find((p) => p.name === item.playerName)
    if (named) return named
  }
  const leading = players.find((p) => item.description.startsWith(p.name))
  if (leading || !item.cardName) return leading
  const card = item.cardName.trim().toLowerCase()
  return players.find((p) =>
    Object.values(p.battlefield ?? {}).some((perm) => (perm.displayName || perm.name || '').trim().toLowerCase() === card),
  )
}

export function tickerLines(items: readonly ActionFeedItem[], players: readonly PlayerView[] = []): TickerLine[] {
  const recent = items.filter((item) => !HIDDEN_TYPES.has(item.type)).slice(-TICKER_LINES).reverse()
  const playerNames = players.map((p) => p.name)
  return recent.map((item) => {
    const owner = ownerOf(item, players)
    return {
      id: item.id,
      ownerId: owner?.playerId ?? null,
      segments: emphasize(item.description, [item.playerName, item.cardName, item.targetName, ...playerNames]),
    }
  })
}
