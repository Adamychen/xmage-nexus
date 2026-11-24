import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n'
import IconButton from '../ui/IconButton'
import CloseButton from '../ui/CloseButton'
import ActionFeed from './ActionFeed'
import GameChat from './GameChat'
import { useChatUnread } from './GameDrawer'
import { DrawerHeadSlotContext } from './drawerHeadSlot'
import './ChatLogPanel.css'

export type ChatLogTab = 'log' | 'chat'

const STRIP_GAP = 8

function useStripAnchor(panelRef: React.RefObject<HTMLElement | null>): boolean {
  const [anchored, setAnchored] = useState(false)
  useLayoutEffect(() => {
    const panel = panelRef.current
    const wrap = panel?.closest<HTMLElement>('.board-wrap')
    if (!panel || !wrap) {
      setAnchored(true)
      return
    }
    const measure = () => {
      const strip = wrap.querySelector<HTMLElement>('[data-testid="game-strip"]')
      if (!strip) {
        panel.style.removeProperty('--chatlog-top')
        return
      }
      const wrapRect = wrap.getBoundingClientRect()
      const zoom = wrap.offsetHeight > 0 ? wrapRect.height / wrap.offsetHeight : 1
      const top = Math.max(0, (strip.getBoundingClientRect().bottom - wrapRect.top) / (zoom > 0 ? zoom : 1)) + STRIP_GAP
      panel.style.setProperty('--chatlog-top', `${Math.round(top)}px`)
    }
    measure()
    setAnchored(true)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(wrap)
    window.addEventListener('resize', measure)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [panelRef])
  return anchored
}

const TABS: Array<{ id: ChatLogTab; icon: 'history' | 'chat'; key: 'tab_log' | 'tab_chat' }> = [
  { id: 'log', icon: 'history', key: 'tab_log' },
  { id: 'chat', icon: 'chat', key: 'tab_chat' },
]

export function ChatLogToggles({ active, onToggle }: { active: ChatLogTab | null; onToggle: (tab: ChatLogTab) => void }) {
  const { t } = useTranslation()
  const unread = useChatUnread(active === 'chat')
  return (
    <div className="drawer-toggles chatlog-toggles" role="toolbar">
      {TABS.map((tab) => (
        <IconButton
          key={tab.id}
          icon={tab.icon}
          label={t('game', tab.key)}
          variant="ghost"
          size="sm"
          className={`right-tab-btn drawer-toggle${active === tab.id ? ' is-active' : ''}`}
          aria-pressed={active === tab.id}
          data-testid={`chatlog-toggle-${tab.id}`}
          onClick={() => onToggle(tab.id)}
        >
          {tab.id === 'chat' && unread > 0 && (
            <span className="right-tab-badge" data-testid="chat-unread">{unread > 9 ? '9+' : unread}</span>
          )}
        </IconButton>
      ))}
    </div>
  )
}

interface ChatLogPanelProps {
  tab: ChatLogTab
  onTabChange: (tab: ChatLogTab) => void
  onClose: () => void
}

export default function ChatLogPanel({ tab, onTabChange, onClose }: ChatLogPanelProps) {
  const { t } = useTranslation()
  const [headSlot, setHeadSlot] = useState<HTMLElement | null>(null)
  const panelRef = useRef<HTMLElement>(null)
  const anchored = useStripAnchor(panelRef)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <aside ref={panelRef} className="chatlog-panel chrome-surface" data-testid="chatlog-panel" data-tab={tab}>
      <header className="chatlog-head">
        <div className="chatlog-tabs" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              className={`chatlog-tab${item.id === tab ? ' is-active' : ''}`}
              aria-selected={item.id === tab}
              data-testid={`chatlog-tab-${item.id}`}
              onClick={() => onTabChange(item.id)}
            >
              {t('game', item.key)}
            </button>
          ))}
        </div>
        <div className="chatlog-head-actions" ref={setHeadSlot} data-testid="game-drawer-head-actions" />
        <CloseButton variant="plain" size="sm" onClick={onClose} />
      </header>
      <DrawerHeadSlotContext.Provider value={headSlot}>
        <div className="chatlog-content" role="tabpanel">
          {anchored && (tab === 'log' ? <ActionFeed /> : <GameChat />)}
        </div>
      </DrawerHeadSlotContext.Provider>
    </aside>
  )
}
