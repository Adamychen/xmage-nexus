import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import Tabs from '../ui/Tabs'
import EmptyState from '../ui/EmptyState'
import { useStore, isBlockingModal } from '../state/store'
import { useFeedItems } from './useFeedItems'
import ActionFeedCard from './ActionFeedCard'
import FormattedText from './FormattedText'
import { formatFeedTime } from './feedTime'
import FloatingCardPreview from '../board/FloatingCardPreview'
import type { CardView, PermanentView } from '../net/types'
import { useTranslation, plural } from '../i18n'
import './ActionFeed.css'

interface ActionFeedProps {
  onHover?: (card: CardView | PermanentView | null, rect?: DOMRect) => void
}

export default function ActionFeed({ onHover }: ActionFeedProps) {
  const { t, lang } = useTranslation()
  const log = useStore((s) => s.log)
  const [viewMode, setViewMode] = useState<'visual' | 'raw'>('visual')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const pinnedToBottom = useRef(true)
  const followedHeight = useRef(0)
  const [hoverCard, setHoverCard] = useState<CardView | null>(null)
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null)

  const modalOpen = useStore(isBlockingModal)
  useEffect(() => {
    if (modalOpen) {
      setHoverCard(null)
      setHoverRect(null)
    }
  }, [modalOpen])

  const handleCardHover = useCallback(
    (card: CardView | PermanentView | null, rect?: DOMRect) => {
      if (modalOpen) {
        setHoverCard(null)
        setHoverRect(null)
        return
      }
      setHoverCard(card ?? null)
      setHoverRect(rect ?? null)
      if (onHover) onHover(card, rect)
    },
    [onHover, modalOpen]
  )

  const feedItems = useFeedItems()

  const handleScroll = useCallback(() => {
    const box = containerRef.current
    if (!box) return
    pinnedToBottom.current = Math.min(followedHeight.current, box.scrollHeight) - box.scrollTop - box.clientHeight < 40
  }, [])

  const followBottom = useCallback(() => {
    const box = containerRef.current
    if (!box || !pinnedToBottom.current) return
    box.scrollTop = box.scrollHeight
    followedHeight.current = box.scrollHeight
  }, [])

  useLayoutEffect(() => {
    handleScroll()
    followBottom()
  }, [feedItems, viewMode, handleScroll, followBottom])

  useEffect(() => {
    const box = containerRef.current
    if (!box || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(followBottom)
    observer.observe(box)
    return () => observer.disconnect()
  }, [followBottom])

  return (
    <div className="action-feed-container">
      <div className="action-feed-controls">
        <Tabs
          variant="segmented"
          size="sm"
          value={viewMode}
          onChange={setViewMode}
          items={[
            { id: 'visual', icon: 'palette', label: t('game', 'visual_feed'), title: t('game', 'visual_feed') },
            { id: 'raw', icon: 'scrollText', label: t('game', 'text_feed'), title: t('game', 'text_feed') },
          ]}
        />
        <span className="action-count-tag">{plural('game', 'feed_events', feedItems.length)}</span>
      </div>

      <div
        className="action-feed-list game-log-entries"
        ref={containerRef}
        onScroll={handleScroll}
      >
        {viewMode === 'visual' ? (
          feedItems.length === 0 ? (
            <EmptyState fill italic>{t('game', 'feed_waiting')}</EmptyState>
          ) : (
            feedItems.map((item) => (
              <ActionFeedCard key={item.id} item={item} onHover={handleCardHover} />
            ))
          )
        ) : (
          <div className="action-feed-raw-list">
            {log.slice(-100).filter((e) => (e.channel ?? 'game') === 'game').map((entry, i) => (
              <div key={entry.id ?? i} className="game-log-entry">
                <span className="game-log-time">{formatFeedTime(entry.time, lang)}</span>
                <span className="game-log-text">
                  <FormattedText text={entry.text} onHover={handleCardHover} />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <FloatingCardPreview
        card={hoverCard}
        anchorRect={hoverRect}
        fixedSide="left"
      />
    </div>
  )
}
