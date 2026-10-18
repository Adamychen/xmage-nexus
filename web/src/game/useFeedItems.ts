import { useMemo } from 'react'
import { useStore } from '../state/store'
import { useTranslation } from '../i18n'
import { parseGameEvent, toFeedItem, type ActionFeedItem } from './gameEventParser'
import { cleanMageHtml } from './FormattedText'

export function useFeedItems(): ActionFeedItem[] {
  const { t } = useTranslation()
  const log = useStore((s) => s.log)
  const myPlayerName = useStore((s) => s.game?.players?.find((p) => p.controlled)?.name)
  return useMemo((): ActionFeedItem[] => {
    const items: ActionFeedItem[] = []
    const seenRaw = new Set<string>()

    for (let i = 0; i < log.length; i++) {
      const entry = log[i]
      if ((entry.channel ?? 'game') !== 'game') continue
      const key = `${entry.time}-${entry.text}`
      if (seenRaw.has(key)) continue
      seenRaw.add(key)

      const parsed = parseGameEvent(entry.text, myPlayerName, `log-${entry.id ?? i}`)
      if (parsed) {
        items.push(toFeedItem(parsed, t))
      } else if (entry.text) {
        items.push({
          id: `log-sys-${entry.id ?? i}`,
          type: 'system',
          description: cleanMageHtml(entry.text),
          rawText: entry.text,
          timestamp: entry.time,
        })
      }
    }

    return items
  }, [log, myPlayerName, t])
}
