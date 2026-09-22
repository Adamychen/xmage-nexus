import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useGame, useStore } from '../state/store'
import { useTranslation } from '../i18n'
import IconButton from '../ui/IconButton'
import CloseButton from '../ui/CloseButton'
import type { IconName } from '../ui/Icon'
import ActionFeed from './ActionFeed'
import GameChat, { isGameChatEntry } from './GameChat'
import DeckTrackerPanel from './DeckTrackerPanel'
import MechanicsTray from './MechanicsTray'
import CommanderDamageMatrix from './CommanderDamageMatrix'
import { DrawerHeadSlotContext } from './drawerHeadSlot'
import './GameDrawer.css'

export type DrawerTab = 'stack' | 'log' | 'chat' | 'tracker' | 'commander' | 'mechanics'

interface DrawerTabDef {
  id: DrawerTab
  icon: IconName
  label: string
  title: string
  badge?: ReactNode
  hidden?: boolean
}

function useChatUnread(chatOpen: boolean): number {
  const total = useStore((s) => s.log.reduce((n, e) => n + (isGameChatEntry(e) ? 1 : 0), 0))
  const [seen, setSeen] = useState(total)
  useEffect(() => {
    if (chatOpen || total < seen) setSeen(total)
  }, [chatOpen, total, seen])
  return chatOpen ? 0 : Math.max(0, total - seen)
}

function useDrawerTabs(active: DrawerTab | null, stackCount: number, hasCommanders: boolean, hasActiveMechanics: boolean): DrawerTabDef[] {
  const { t } = useTranslation()
  const unread = useChatUnread(active === 'chat')
  return [
    {
      id: 'stack',
      icon: 'wand',
      label: t('game', 'tab_stack'),
      title: t('game', 'tab_stack'),
      badge: stackCount > 0 && <span className="right-tab-badge active-stack" data-testid="stack-count">{stackCount}</span>,
    },
    { id: 'log', icon: 'history', label: t('game', 'tab_log'), title: t('game', 'tab_log') },
    {
      id: 'chat',
      icon: 'chat',
      label: t('game', 'tab_chat'),
      title: t('game', 'tab_chat'),
      badge: unread > 0 && <span className="right-tab-badge" data-testid="chat-unread">{unread > 9 ? '9+' : unread}</span>,
    },
    { id: 'tracker', icon: 'layers', label: t('game', 'tab_tracker'), title: t('game', 'tab_tracker') },
    { id: 'commander', icon: 'crown', label: t('game', 'tab_commander'), title: t('game', 'commander_damage'), hidden: !hasCommanders },
    {
      id: 'mechanics',
      icon: 'gem',
      label: t('game', 'tab_mechanics'),
      title: t('game', 'tab_mechanics'),
      badge: hasActiveMechanics && <span className="right-tab-badge active-mechanics">★</span>,
    },
  ]
}

interface DrawerTogglesProps {
  active: DrawerTab | null
  stackCount: number
  onToggle: (tab: DrawerTab) => void
  hasCommanders: boolean
  hasActiveMechanics: boolean
}

export function DrawerToggles({ active, stackCount, onToggle, hasCommanders, hasActiveMechanics }: DrawerTogglesProps) {
  const tabs = useDrawerTabs(active, stackCount, hasCommanders, hasActiveMechanics)
  return (
    <div className="drawer-toggles" role="toolbar">
      {tabs.filter((tab) => !tab.hidden).map((tab) => (
        <IconButton
          key={tab.id}
          icon={tab.icon}
          label={tab.title}
          variant="ghost"
          size="sm"
          className={`right-tab-btn drawer-toggle${active === tab.id ? ' is-active' : ''}`}
          aria-pressed={active === tab.id}
          data-testid={`drawer-tab-${tab.id}`}
          onClick={() => onToggle(tab.id)}
        >
          {tab.badge}
        </IconButton>
      ))}
    </div>
  )
}

export default function GameDrawer({ tab, stackCount, stack, onClose }: { tab: DrawerTab; stackCount: number; stack: ReactNode; onClose: () => void }) {
  const { t } = useTranslation()
  const game = useGame()
  const [headSlot, setHeadSlot] = useState<HTMLElement | null>(null)
  const titles: Record<DrawerTab, string> = {
    stack: `${t('game', 'stack')} (${stackCount})`,
    log: t('game', 'tab_log'),
    chat: t('game', 'tab_chat'),
    tracker: t('game', 'tab_tracker'),
    commander: t('game', 'commander_damage'),
    mechanics: t('game', 'tab_mechanics'),
  }
  return (
    <aside className="game-drawer" data-testid="game-drawer" data-tab={tab}>
      <header className="game-drawer-head">
        <span className="game-drawer-title">{titles[tab]}</span>
        <div className="game-drawer-head-actions" ref={setHeadSlot} data-testid="game-drawer-head-actions" />
        <CloseButton variant="plain" size="sm" onClick={onClose} />
      </header>
      <DrawerHeadSlotContext.Provider value={headSlot}>
      <div className="game-drawer-content">
        {tab === 'stack' ? (
          stack
        ) : tab === 'log' ? (
          <ActionFeed />
        ) : tab === 'chat' ? (
          <GameChat />
        ) : tab === 'tracker' ? (
          <DeckTrackerPanel />
        ) : tab === 'commander' ? (
          <div className="sidebar-commander-tab">
            <CommanderDamageMatrix game={game} />
          </div>
        ) : (
          <MechanicsTray />
        )}
      </div>
      </DrawerHeadSlotContext.Provider>
    </aside>
  )
}
