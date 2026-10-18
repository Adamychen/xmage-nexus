import { useEffect, useRef, useState, useCallback } from 'react'
import Tabs from '../ui/Tabs'
import EmptyState from '../ui/EmptyState'
import { useStore, isBlockingModal } from '../state/store'
import { useFeedItems } from './useFeedItems'
import ActionFeedCard from './ActionFeedCard'
import FormattedText from './FormattedText'
import FloatingCardPreview from '../board/FloatingCardPreview'
import type { CardView, PermanentView } from '../net/types'
import { useTranslation } from '../i18n'
import './ActionFeed.css'

interface ActionFeedProps {
  onHover?: (card: CardView | PermanentView | null, rect?: DOMRect) => void
}

export default function ActionFeed({ onHover }: ActionFeedProps) {
  const { t } = useTranslation()
  const log = useStore((s) => s.log)
  const [viewMode, setViewMode] = useState<'visual' | 'raw'>('visual')
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
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

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40
    setAutoScroll(isAtBottom)
  }

  useEffect(() => {
    const box = containerRef.current
    if (autoScroll && box && typeof box.scrollTo === 'function') box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' })
  }, [feedItems.length, autoScroll, viewMode])

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
        <span className="action-count-tag">{feedItems.length === 1 ? t('game', 'feed_events_one') : t('game', 'feed_events', { count: feedItems.length })}</span>
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
