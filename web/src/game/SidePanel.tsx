import { useRef, useState, type KeyboardEvent } from 'react'
import Icon from '../ui/Icon'
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
  mechanicsCount: number
}

export default function SidePanel({ tab, onTabChange, onClose, hasCommanders, hasActiveMechanics, mechanicsCount }: SidePanelProps) {
  const [headSlot, setHeadSlot] = useState<HTMLElement | null>(null)
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const tabs = useDrawerTabs(tab, 0, hasCommanders, hasActiveMechanics, mechanicsCount).filter(
    (item): item is typeof item & { id: SidePanelTab } => item.id !== 'stack' && !item.hidden,
  )
  const active = tabs.find((item) => item.id === tab)

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const step = event.key === 'ArrowRight' ? 1 : -1
    const next = (index + step + tabs.length) % tabs.length
    onTabChange(tabs[next].id)
    buttons.current[next]?.focus()
  }

  return (
    <aside className="side-panel chrome-surface" data-testid="side-panel" data-tab={tab}>
      <header className="side-panel-head">
        <div className="side-panel-tabs" role="tablist">
          {tabs.map((item, index) => {
            const selected = item.id === tab
            return (
              <button
                key={item.id}
                ref={(node) => {
                  buttons.current[index] = node
                }}
                type="button"
                role="tab"
                id={`side-panel-tab-${item.id}`}
                className={`side-panel-tab${selected ? ' is-active' : ''}`}
                aria-selected={selected}
                aria-label={item.title}
                title={item.title}
                tabIndex={selected ? 0 : -1}
                data-testid={`side-panel-tab-${item.id}`}
                onClick={() => onTabChange(item.id)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
              >
                <Icon name={item.icon} size={18} />
                {item.badge}
              </button>
            )
          })}
        </div>
        <CloseButton className="side-panel-close" variant="plain" size="md" onClick={onClose} />
      </header>
      <div className="side-panel-title">
        <h2 className="side-panel-title-text">{active?.title ?? ''}</h2>
        <div className="side-panel-head-actions" ref={setHeadSlot} data-testid="game-drawer-head-actions" />
      </div>
      <DrawerHeadSlotContext.Provider value={headSlot}>
        <div className="side-panel-content" role="tabpanel" aria-labelledby={`side-panel-tab-${tab}`}>
          <DrawerBody tab={tab} />
        </div>
      </DrawerHeadSlotContext.Provider>
    </aside>
  )
}
