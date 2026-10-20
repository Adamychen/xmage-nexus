export interface CardIconLike {
  cardIconType?: string
  text?: string
  hint?: string
}

export function iconKey(icon: CardIconLike): string {
  return `${icon.cardIconType ?? ''}|${icon.text ?? ''}|${icon.hint ?? ''}`
}

export function isGoadIcon(icon: CardIconLike): boolean {
  return icon.cardIconType === 'OTHER_HAS_RESTRICTIONS' && /goad/i.test(icon.hint ?? '')
}

/** Keys of the icons in `next` that `prev` did not carry. */
export function gainedIconKeys(prev: readonly CardIconLike[] | undefined, next: readonly CardIconLike[] | undefined): string[] {
  const before = new Set((prev ?? []).map(iconKey))
  return (next ?? []).map(iconKey).filter((key) => !before.has(key))
}
