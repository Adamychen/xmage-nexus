import type { StackItem } from './ArenaCardStacks'

export interface StackLayoutOptions {
  copies: 'separate' | 'together'
  peek: number
  copyOffset: number
  cardHeight: number
}

export interface StackLayoutCard {
  key: string
  itemKey: string
  top: number
  z: number
  front: boolean
  amount: number
}

export interface StackLayout {
  cards: StackLayoutCard[]
  height: number
}

export function layoutStack(items: readonly StackItem[], opts: StackLayoutOptions): StackLayout {
  const cards: StackLayoutCard[] = []
  let cursor = 0
  for (const item of items) {
    const amount = item.card.amount
    if (opts.copies === 'together') {
      cards.push({ key: item.key, itemKey: item.key, top: cursor, z: cards.length, front: true, amount })
      cursor += opts.peek
      continue
    }
    const copies = Math.max(1, amount)
    for (let i = 0; i < copies; i++) {
      cards.push({
        key: `${item.key}#${i}`,
        itemKey: item.key,
        top: cursor + i * opts.copyOffset,
        z: cards.length,
        front: i === copies - 1,
        amount,
      })
    }
    cursor += (copies - 1) * opts.copyOffset + opts.peek
  }
  const last = cards[cards.length - 1]
  return { cards, height: last ? last.top + opts.cardHeight : 0 }
}
