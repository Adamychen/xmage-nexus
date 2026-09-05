import Icon from '../ui/Icon'

export interface ContextMenuItem {
  id: string
  label: string
  icon?: import('../ui/Icon').IconName
  danger?: boolean
  disabled?: boolean
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onSelect: (id: string) => void
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onSelect, onClose }: ContextMenuProps) {
  return (
    <>
      <div className="context-menu-overlay" onClick={onClose} />
      <div
        className="context-menu"
        style={{ left: x, top: y }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            className={`context-menu-item ${item.danger ? 'danger' : ''}`}
            disabled={item.disabled}
            onClick={() => { onSelect(item.id); onClose() }}
          >
            {item.icon && <span className="context-menu-icon"><Icon name={item.icon} size={13} /></span>}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </>
  )
}

export const CARD_CONTEXT_ITEMS: ContextMenuItem[] = [
  { id: 'tap', label: 'Tap / Girar', icon: 'refresh' },
  { id: 'rotate', label: 'Rotar 90°', icon: 'refresh' },
  { id: 'flip', label: 'Voltear', icon: 'refresh' },
  { id: 'move', label: 'Mover a...', icon: 'send' },
  { id: 'group', label: 'Agrupar', icon: 'copy' },
  { id: 'counter', label: '+1/+1 Contador', icon: 'plus' },
  { id: 'remove-counter', label: 'Quitar contador', icon: 'minus' },
  { id: 'destroy', label: 'Destruir', icon: 'trash', danger: true },
]