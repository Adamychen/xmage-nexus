import { useEffect, useState } from 'react'
import type { ScryfallSearchCard } from './scryfallSearch'
import type { EdhrecCommanderData } from './edhrec'
import { collectSuggestionNames, fetchEdhrecCommander, resolveCardsByNames } from './edhrec'

export const SUGGESTIONS_PER_LIST = 12

export type SuggestionsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not_found'; commanderName: string }
  | { status: 'ready'; data: EdhrecCommanderData; cards: Map<string, ScryfallSearchCard> }

export function useEdhrecSuggestions(commanderName: string | null, enabled: boolean) {
  const [state, setState] = useState<SuggestionsState>({ status: 'loading' })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!enabled || !commanderName) return
    let cancelled = false
    setState({ status: 'loading' })
    void (async () => {
      const result = await fetchEdhrecCommander(commanderName)
      if (cancelled) return
      if (result.status === 'not_found') {
        setState({ status: 'not_found', commanderName })
        return
      }
      if (result.status === 'error') {
        setState({ status: 'error' })
        return
      }
      const names = collectSuggestionNames(result.data.lists, SUGGESTIONS_PER_LIST)
      const cards = await resolveCardsByNames(names)
      if (cancelled) return
      setState({ status: 'ready', data: result.data, cards })
    })()
    return () => {
      cancelled = true
    }
  }, [commanderName, enabled, nonce])

  return { state, retry: () => setNonce((n) => n + 1) }
}
