import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useStore } from '../state/store'
import { parseGameEvent, type ActionFeedItem } from './gameEventParser'
import ActionFeedCard from './ActionFeedCard'
import FormattedText, { cleanMageHtml } from './FormattedText'
import FloatingCardPreview from '../board/FloatingCardPreview'
import type { CardView } from '../net/types'
import { useTranslation } from '../i18n'
import './ActionFeed.css'

interface ActionFeedProps {
  onHover?: (card: any, rect?: DOMRect) => void
}

export default function ActionFeed({ onHover }: ActionFeedProps) {
  const { t } = useTranslation()
  const log = useStore((s) => s.log)
  const game = useStore((s) => s.game)
  const [viewMode, setViewMode] = useState<'visual' | 'raw'>('visual')
  const feedEndRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [hoverCard, setHoverCard] = useState<CardView | null>(null)
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null)

  const myPlayer = game?.players?.find((p) => p.controlled)
  const myPlayerName = myPlayer?.name

  const handleCardHover = useCallback(
    (card: any, rect?: DOMRect) => {
      setHoverCard(card ?? null)
      setHoverRect(rect ?? null)
      if (onHover) onHover(card, rect)
    },
    [onHover]
  )

  const feedItems = useMemo((): ActionFeedItem[] => {
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
        items.push(parsed)
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
  }, [log, myPlayerName])

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40
    setAutoScroll(isAtBottom)
  }

  useEffect(() => {
    if (autoScroll && feedEndRef.current && typeof feedEndRef.current.scrollIntoView === 'function') {
      feedEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [feedItems.length, autoScroll, viewMode])

  return (
    <div className="action-feed-container">
      <div className="action-feed-controls">
        <div className="action-feed-mode-toggle">
          <button
            type="button"
            className={`mode-btn ${viewMode === 'visual' ? 'active' : ''}`}
            onClick={() => setViewMode('visual')}
            title={t('game', 'visual_feed')}
          >
            🎨 {t('game', 'visual_feed')}
          </button>
          <button
            type="button"
            className={`mode-btn ${viewMode === 'raw' ? 'active' : ''}`}
            onClick={() => setViewMode('raw')}
            title={t('game', 'text_feed')}
          >
            📜 {t('game', 'text_feed')}
          </button>
        </div>
        <span className="action-count-tag">{t('game', 'feed_events', { count: feedItems.length })}</span>
      </div>

      <div
        className="action-feed-list game-log-entries"
        ref={containerRef}
        onScroll={handleScroll}
      >
        {viewMode === 'visual' ? (
          feedItems.length === 0 ? (
            <div className="action-feed-empty">{t('game', 'feed_waiting')}</div>
          ) : (
            feedItems.map((item) => (
              <ActionFeedCard key={item.id} item={item} onHover={handleCardHover} />
            ))
          )
        ) : (
          <div className="action-feed-raw-list">
            {log.slice(-100).filter((e) => (e.channel ?? 'game') === 'game').map((entry, i) => (
              <div key={entry.id ?? i} className="game-log-entry">
                <span className="game-log-text">
                  <FormattedText text={entry.text} onHover={handleCardHover} />
                </span>
              </div>
            ))}
          </div>
        )}
        <div ref={feedEndRef} />
      </div>

      <FloatingCardPreview
        card={hoverCard}
        anchorRect={hoverRect}
        fixedSide="left"
      />
    </div>
  )
}
