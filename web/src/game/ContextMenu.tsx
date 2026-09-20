import { useEscape } from '../ui/useEscape'
import MenuItem from '../ui/MenuItem'
import Icon from '../ui/Icon'
import './ContextMenu.css'

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
  menuRef?: React.Ref<HTMLDivElement>
}

export default function ContextMenu({ x, y, items, onSelect, onClose, menuRef }: ContextMenuProps) {
  useEscape(onClose)
  return (
    <>
      <div className="context-menu-overlay" onClick={onClose} aria-hidden />
      <div
        ref={menuRef}
        className="context-menu"
        style={{ left: x, top: y }}
      >
        {items.map((item) => (
          <MenuItem
            key={item.id}
            data-testid={`ctx-${item.id}`}
            danger={item.danger}
            disabled={item.disabled}
            onClick={() => { onSelect(item.id); onClose() }}
          >
            {item.icon && <span className="context-menu-icon"><Icon name={item.icon} size={13} /></span>}
            <span>{item.label}</span>
          </MenuItem>
        ))}
      </div>
    </>
  )
}