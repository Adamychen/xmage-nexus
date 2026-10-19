export const DECK_DIAL_HEIGHT = 188
export const DECK_TOP = 16
export const DECK_HEAD = 36
export const DECK_GAP = 12
export const DECK_CTRL = 26
export const DECK_TARGETS = 34
export const DECK_TAB = 30
export const DECK_CARD_RATIO = 1.4
export const DECK_CARD_MAX = 232
export const DECK_CARD_COMFORT = 170
export const DECK_CARD_MIN = 120
export const DECK_MIN_TABS = 2

export interface DeckFit {
  cardW: number
  maxTabs: number
  avail: number
}

export function stackDeckFit(wrapHeight: number, dockBottom: number, tabCount: number, maxTabs: number): DeckFit {
  const avail = Math.max(0, wrapHeight - dockBottom - DECK_DIAL_HEIGHT - DECK_GAP - DECK_TOP)
  const body = avail - DECK_HEAD - DECK_CTRL - DECK_TARGETS
  const wanted = Math.min(tabCount, maxTabs)
  const floor = Math.min(wanted, DECK_MIN_TABS)
  for (let tabs = wanted; tabs >= floor; tabs--) {
    const cardW = Math.min(DECK_CARD_MAX, Math.floor((body - tabs * DECK_TAB) / DECK_CARD_RATIO))
    if (cardW >= DECK_CARD_COMFORT) return { cardW, maxTabs: tabs, avail }
  }
  const cardW = Math.max(DECK_CARD_MIN, Math.min(DECK_CARD_MAX, Math.floor((body - floor * DECK_TAB) / DECK_CARD_RATIO)))
  return { cardW, maxTabs: floor, avail }
}
