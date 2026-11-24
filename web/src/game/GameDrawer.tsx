import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useGame, useStore } from '../state/store'
import { useTranslation } from '../i18n'
import IconButton from '../ui/IconButton'
import CloseButton from '../ui/CloseButton'
import type { IconName } from '../ui/Icon'
import { isGameChatEntry } from './GameChat'
import MechanicsTray from './MechanicsTray'
import CommanderDamageMatrix from './CommanderDamageMatrix'
import { DrawerHeadSlotContext } from './drawerHeadSlot'
import './GameDrawer.css'

export type DrawerTab = 'commander' | 'mechanics'

interface DrawerTabDef {
  id: DrawerTab
  icon: IconName
  label: string
  title: string
  badge?: ReactNode
  hidden?: boolean
}

export function useChatUnread(chatOpen: boolean): number {
  const total = useStore((s) => s.log.reduce((n, e) => n + (isGameChatEntry(e) ? 1 : 0), 0))
  const [seen, setSeen] = useState(total)
  useEffect(() => {
    if (chatOpen || total < seen) setSeen(total)
  }, [chatOpen, total, seen])
  return chatOpen ? 0 : Math.max(0, total - seen)
}

export function useDrawerTabs(hasCommanders: boolean, hasActiveMechanics: boolean, mechanicsCount?: number): DrawerTabDef[] {
  const { t } = useTranslation()
  return [
    { id: 'commander', icon: 'crown', label: t('game', 'tab_commander'), title: t('game', 'commander_damage'), hidden: !hasCommanders },
    {
      id: 'mechanics',
      icon: 'sparkles',
      label: t('game', 'tab_mechanics'),
      title: t('game', 'tab_mechanics'),
      badge: hasActiveMechanics && (
        <span className="right-tab-badge active-mechanics" data-testid="mechanics-count">{mechanicsCount ?? '★'}</span>
      ),
    },
  ]
}

interface DrawerTogglesProps {
  active: DrawerTab | null
  onToggle: (tab: DrawerTab) => void
  hasCommanders: boolean
  hasActiveMechanics: boolean
  exclude?: readonly DrawerTab[]
  mechanicsCount?: number
}

export function DrawerToggles({ active, onToggle, hasCommanders, hasActiveMechanics, exclude = [], mechanicsCount }: DrawerTogglesProps) {
  const tabs = useDrawerTabs(hasCommanders, hasActiveMechanics, mechanicsCount).filter((tab) => !exclude.includes(tab.id))
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

export function DrawerBody({ tab }: { tab: DrawerTab }) {
  const game = useGame()
  return (
    <>
      {tab === 'commander' ? (
        <div className="sidebar-commander-tab">
          <CommanderDamageMatrix game={game} defaultView="cards" />
        </div>
      ) : (
        <MechanicsTray />
      )}
    </>
  )
}

export default function GameDrawer({ tab, onClose }: { tab: DrawerTab; onClose: () => void }) {
  const { t } = useTranslation()
  const [headSlot, setHeadSlot] = useState<HTMLElement | null>(null)
  const titles: Record<DrawerTab, string> = {
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
        <DrawerBody tab={tab} />
      </div>
      </DrawerHeadSlotContext.Provider>
    </aside>
  )
}
