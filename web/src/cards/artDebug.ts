/**
 * CRD-9: `?artdebug=1` writes, on every card drawn, the key its art was resolved with and the
 * printing the server sent for it. It is how a card that shows the wrong printing is told apart
 * from one the server sends with a different printing, which cannot be read from a screenshot of
 * the art alone: the two paths (board and stack) share one resolver, so what differs is the input.
 */
export function artDebugOn(): boolean {
  try {
    return new URLSearchParams(window.location.search).has('artdebug')
  } catch {
    return false
  }
}

/** `SET/number` as the server sent it, or a dash where it sent nothing. */
export function printedAs(card: { expansionSetCode?: string | null; cardNumber?: string | null }): string {
  const set = (card.expansionSetCode ?? '').trim()
  const num = (card.cardNumber ?? '').trim()
  return set || num ? `${set || '-'}/${num || '-'}` : '-'
}
