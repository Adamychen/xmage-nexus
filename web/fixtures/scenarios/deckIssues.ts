import { makeBaseScenario } from '../fake'
import { TABLE } from '../table-names'
import type { DeckValidationResult } from '../../src/net/types'

/**
 * Escenario del FixtureServer para deckvalidation.spec.ts: mesa del lobby y
 * acción `validateDeck` que marca "Rhystic Tutor" (CY #77) como impresión
 * inexistente en el servidor (con sugerencia PCY #77) y devuelve el mazo
 * corregido sin esa carta.
 */

export const BAD_CARD = { cardName: 'Rhystic Tutor', setCode: 'CY', cardNumber: '77' }
export const GOOD_SUGGESTION = { cardName: 'Rhystic Tutor', setCode: 'PCY', cardNumber: '77' }

interface DeckArg {
  name?: string
  cards?: Array<{ cardName: string; setCode: string; cardNumber: string; amount: number }>
  sideboard?: Array<{ cardName: string; setCode: string; cardNumber: string; amount: number }>
}

export function deckIssuesScenario(): ReturnType<typeof makeBaseScenario> {
  return makeBaseScenario({
    tableId: 'table-deck-issues-1',
    tableName: TABLE.deckIssues,
    gameId: 'game-deck-issues-1',
    seats: [
      { playerName: 'host-e2e', seatIndex: 0, playerType: 'HUMAN' },
      { playerName: '', seatIndex: 1, playerType: 'HUMAN' },
    ],
    onValidateDeck(deck?: DeckArg): DeckValidationResult {
      const cards = [...(deck?.cards ?? []), ...(deck?.sideboard ?? [])]
      const hasBad = cards.some(
        (c) => c.cardName === BAD_CARD.cardName && c.setCode === BAD_CARD.setCode && c.cardNumber === BAD_CARD.cardNumber,
      )
      if (!hasBad) {
        return { ready: true, missing: [], mismatches: [] }
      }
      const stripBad = (list: NonNullable<DeckArg['cards']>) => list.filter((c) => !(c.cardName === BAD_CARD.cardName && c.setCode === BAD_CARD.setCode))
      return {
        ready: true,
        missing: [
          {
            ...BAD_CARD,
            amount: cards
              .filter((c) => c.cardName === BAD_CARD.cardName && c.setCode === BAD_CARD.setCode)
              .reduce((acc, c) => acc + c.amount, 0),
            reason: 'OUTDATED_PRINTING',
            suggestions: [GOOD_SUGGESTION],
          },
        ],
        mismatches: [],
        fixedDeck: {
          name: deck?.name ?? '',
          cards: stripBad(deck?.cards ?? []),
          sideboard: stripBad(deck?.sideboard ?? []),
        },
      }
    },
  })
}
