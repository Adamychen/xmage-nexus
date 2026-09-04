import * as cmds from '../../net/commands'
import { setState, addLog } from '../state'
import type { SideboardCard, SideboardScreenState } from '../state'
import { t as tStatic, translateError } from '../../i18n'
import { awaitCardMeta } from '../../cards/cardImages'
import type { Snapshot } from './context'

export function handleSideboard(data: unknown, s: Snapshot): void {
  const d = (data ?? {}) as {
    deck?: { name?: string; cards?: Record<string, Record<string, unknown>>; sideboard?: Record<string, Record<string, unknown>> }
    currentTableId?: string
    parentTableId?: string
    time?: number
    flag?: boolean
  } | null
  const tableId = d?.currentTableId
  if (!tableId) return
  const deckName = d?.deck?.name ?? tStatic('decks','import_placeholder')
  const time = d?.time ?? 180
  const limited = d?.flag === true
  const rawCards = d?.deck?.cards ?? {}
  const rawSide = d?.deck?.sideboard ?? {}
  const resolve = (cards: Record<string, Record<string, unknown>>): Promise<SideboardCard[]> => {
    const entries = Object.entries(cards)
    return Promise.all(entries.map(async ([id, sc]) => {
      const setCode = String(sc.expansionSetCode ?? '')
      const cardNumber = String(sc.cardNumber ?? '')
      const meta = await awaitCardMeta(setCode, cardNumber)
      return {
        instanceId: id,
        setCode,
        cardNumber,
        name: meta?.name ?? `${setCode || '?'}/${cardNumber || '?'}`,
      }
    }))
  }
  void Promise.all([resolve(rawCards), resolve(rawSide)]).then(([maindeck, sideboard]) => {
    const screen: SideboardScreenState = {
      deckName,
      maindeck,
      sideboard,
      tableId,
      parentTableId: d?.parentTableId ?? null,
      timeLeft: time,
      limited,
    }
    setState({ sideboardScreen: screen, gameEnd: null })
    addLog('partida', `Sideboard: ${maindeck.length} main / ${sideboard.length} side — tienes ${time}s para ajustar`)
    if (s.settings.autoSubmitSideboard) {
      const group = (cards: SideboardCard[]) => {
        const map = new Map<string, { cardName: string; setCode: string; cardNumber: string; amount: number }>()
        for (const c of cards) {
          const key = `${c.name}|${c.setCode}|${c.cardNumber}`
          const existing = map.get(key)
          if (existing) {
            existing.amount++
          } else {
            map.set(key, { cardName: c.name, setCode: c.setCode, cardNumber: c.cardNumber, amount: 1 })
          }
        }
        return Array.from(map.values())
      }
      const deck = {
        name: deckName,
        cards: group(maindeck),
        sideboard: group(sideboard),
      }
      void cmds.submitDeck(tableId, deck).then((res) => {
        if (!res.ok) {
          const detail = typeof res.error === 'string' ? res.error : 'submitDeck'
          addLog('error', `Auto-submit de sideboard falló: ${detail}`)
          setState({ error: translateError(detail, 'submitDeck') })
        }
      })
    }
  })
}
