import { useState } from 'react'
import Tabs from '../ui/Tabs'
import CloseButton from '../ui/CloseButton'
import { DrawerBody, useDrawerTabs, type DrawerTab } from './GameDrawer'
import { DrawerHeadSlotContext } from './drawerHeadSlot'
import './SidePanel.css'

export type SidePanelTab = Exclude<DrawerTab, 'stack'>

interface SidePanelProps {
  tab: SidePanelTab
  onTabChange: (tab: SidePanelTab) => void
  onClose: () => void
  hasCommanders: boolean
  hasActiveMechanics: boolean
}

export default function SidePanel({ tab, onTabChange, onClose, hasCommanders, hasActiveMechanics }: SidePanelProps) {
  const [headSlot, setHeadSlot] = useState<HTMLElement | null>(null)
  const tabs = useDrawerTabs(tab, 0, hasCommanders, hasActiveMechanics).filter(
    (item): item is typeof item & { id: SidePanelTab } => item.id !== 'stack' && !item.hidden,
  )
  return (
    <aside className="side-panel chrome-surface" data-testid="side-panel" data-tab={tab}>
      <header className="side-panel-head">
        <Tabs
          variant="underline"
          size="sm"
          value={tab}
          onChange={onTabChange}
          items={tabs.map((item) => ({ id: item.id, label: item.label, badge: item.badge, title: item.title, testId: `side-panel-tab-${item.id}` }))}
        />
        <div className="side-panel-head-actions" ref={setHeadSlot} data-testid="game-drawer-head-actions" />
        <CloseButton variant="plain" size="sm" onClick={onClose} />
      </header>
      <DrawerHeadSlotContext.Provider value={headSlot}>
        <div className="side-panel-content">
          <DrawerBody tab={tab} />
        </div>
      </DrawerHeadSlotContext.Provider>
    </aside>
  )
}
