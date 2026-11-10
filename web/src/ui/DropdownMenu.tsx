import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import Button, { type ButtonProps } from './Button'
import Icon from './Icon'
import { useEscape } from './useEscape'
import { menuKeyDown, surfaceClassOf, useAnchoredPanel, useMenuFocus } from './anchoredPanel'
import './primitives.css'
import './Select.css'

export interface DropdownMenuProps {
  label: ReactNode
  icon?: ButtonProps['icon']
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  disabled?: boolean
  align?: 'start' | 'end'
  direction?: 'up' | 'down'
  className?: string
  menuClassName?: string
  hideChevron?: boolean
  'aria-label'?: string
  'data-testid'?: string
  children: ReactNode
}

export default function DropdownMenu({
  label,
  icon,
  variant = 'subtle',
  size = 'sm',
  disabled = false,
  align = 'start',
  direction = 'down',
  className = '',
  menuClassName = '',
  hideChevron = false,
  'aria-label': ariaLabel,
  'data-testid': testId,
  children,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const [surface, setSurface] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const close = useCallback((returnFocus = true) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])
  const closeOnEscape = useCallback(() => close(true), [close])
  useEscape(closeOnEscape, open)
  useAnchoredPanel(open, triggerRef, panelRef, { prefer: direction === 'up' ? 'up' : 'down', align, matchWidth: false })
  useMenuFocus(open, panelRef)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      close(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, close])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const openMenu = () => {
    if (disabled) return
    setSurface(surfaceClassOf(rootRef.current))
    setOpen(true)
  }

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      openMenu()
    }
  }

  const cls = ['ui-dropdown', className].filter(Boolean).join(' ')
  const panelCls = ['ui-popover', 'ui-popover--fixed', 'ui-menu-panel', menuClassName, surface].filter(Boolean).join(' ')
  return (
    <div ref={rootRef} className={cls}>
      <Button
        ref={triggerRef}
        variant={variant}
        size={size}
        icon={icon}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        data-testid={testId}
        onClick={() => (open ? close(true) : openMenu())}
        onKeyDown={onTriggerKeyDown}
      >
        {label}
        {!hideChevron && <Icon name={direction === 'up' ? 'chevronUp' : 'chevronDown'} size={12} />}
      </Button>
      {open && createPortal(
        <div
          ref={panelRef}
          role="menu"
          className={panelCls}
          onKeyDown={(e) => menuKeyDown(e, panelRef.current, () => close(false))}
          onClick={() => close(true)}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  )
}
