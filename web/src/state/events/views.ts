import { getState, setState, addLog } from '../state'
import { t as tStatic } from '../../i18n'
import { feedbackCards } from '../../game/feedback'
import type { FeedbackCard } from '../../game/feedback'

export function handleViewLimitedDeck(data: unknown): void {
  const d = data as { deck?: { cards?: unknown }; cards?: unknown; currentTableId?: string; parentTableId?: string; time?: number } | null
  const view = (d?.deck?.cards ?? d?.cards) as Record<string, unknown> | undefined
  const cards = feedbackCards({ cardsView1: view }) ?? []
  setState({ viewer: { title: tStatic('decks','my_decks'), cards } })
  addLog('partida', 'Viendo mazo limitado')
}

export function handleViewSideboard(data: unknown): void {
  const d = data as { gameId?: string; playerId?: string } | null
  const g = getState().game
  const player = g?.players?.find((p) => String(p.playerId) === String(d?.playerId))
  const view = (player?.sideboard ?? {}) as Record<string, unknown>
  const cards: FeedbackCard[] = feedbackCards({ cardsView1: view }) ?? []
  setState({ viewer: { title: 'Sideboard', cards } })
  addLog('partida', 'Viendo sideboard')
}
