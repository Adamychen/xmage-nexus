/** Manos ajenas visibles (Mindslaver & cía.: el servidor las envía en `opponentHands`). */
export function switchableHandKeys(opponentHands: unknown): string[] {
  if (!opponentHands || typeof opponentHands !== 'object') return []
  const rec = opponentHands as Record<string, unknown>
  return Object.keys(rec).filter((k) => {
    const v = rec[k]
    return !!v && typeof v === 'object' && Object.keys(v as Record<string, unknown>).length > 0
  })
}
