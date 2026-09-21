import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import Button, { type ButtonProps } from './Button'
import Icon from './Icon'
import { useEscape } from './useEscape'
import './primitives.css'

export interface DropdownMenuProps {
  label: ReactNode
  icon?: ButtonProps['icon']
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  disabled?: boolean
  align?: 'start' | 'end'
  direction?: 'up' | 'down'
  className?: string
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
  'data-testid': testId,
  children,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useEscape(close, open)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, close])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const cls = ['ui-dropdown', className].filter(Boolean).join(' ')
  return (
    <div ref={rootRef} className={cls}>
      <Button
        variant={variant}
        size={size}
        icon={icon}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid={testId}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <Icon name={direction === 'up' ? 'chevronUp' : 'chevronDown'} size={12} />
      </Button>
      {open && (
        <div
          role="menu"
          className={`ui-dropdown-menu ui-dropdown-menu--${direction} ui-dropdown-menu--${align}`}
          onClick={close}
        >
          {children}
        </div>
      )}
    </div>
  )
}
