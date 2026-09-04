import type { FeedbackOption } from './types'

export function isMulliganAsk(message: string): boolean {
  return /mulligan|keep your hand|keep hand/i.test(message)
}

export function isStartingPlayerMessage(message: string): boolean {
  return /who goes first|choose.*start|starting player|who will go first|empieza primero|quién empieza|lanzamiento|primer turno/i.test(message)
}

export function isVotingAsk(message: string, question?: string): boolean {
  return /vote|voting|voted|votar|votación|council|will of the council/i.test(message) || /vote/i.test(question ?? '')
}

export function isDiscardMessage(message: string): boolean {
  return /descart|discard/i.test(message)
}

export function isLondonBottoming(message: string): boolean {
  return /^select a card to put on the bottom of (your|the) library/i.test(message)
}

export function detectPlaneswalkerChoice(options: FeedbackOption[], message: string): { isPW: boolean; deltas?: (number | null)[] } {
  const isPW = options.some((o) => /^([+-]?\d+)\s*:/.test(o.label)) || /planeswalker|lealtad|loyalty/i.test(message)
  if (!isPW) return { isPW: false }
  return {
    isPW: true,
    deltas: options.map((o) => {
      const m = /^([+-]?\d+)\s*:/.exec(o.label)
      return m ? parseInt(m[1], 10) : null
    }),
  }
}

export function booleanValueOf(label: string, index: number): string {
  // XMage: el mulligan usa sendPlayerBoolean(true) para TOMAR mulligan y false para mantener.
  if (/mulligan/i.test(label)) return 'true'
  if (/keep/i.test(label)) return 'false'
  if (/no|cancel/i.test(label)) return 'false'
  if (/yes|confirm|ok/i.test(label)) return 'true'
  return index === 0 ? 'true' : 'false'
}
