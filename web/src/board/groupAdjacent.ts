export interface AdjacentGroup<T> {
  items: T[]
  start: number
}

export function groupAdjacent<T>(items: T[], signatureOf: (item: T) => string | null): AdjacentGroup<T>[] {
  const groups: AdjacentGroup<T>[] = []
  let lastSignature: string | null = null
  items.forEach((item, index) => {
    const signature = signatureOf(item)
    const last = groups[groups.length - 1]
    if (signature !== null && last && signature === lastSignature) {
      last.items.push(item)
    } else {
      groups.push({ items: [item], start: index })
    }
    lastSignature = signature
  })
  return groups
}
