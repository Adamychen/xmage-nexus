import { useRef } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import './primitives.css'

export interface TabItem<T extends string = string> {
  id: T
  label?: ReactNode
  icon?: IconName
  badge?: ReactNode
  title?: string
  className?: string
  testId?: string
  hidden?: boolean
  disabled?: boolean
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  variant?: 'pill' | 'segmented' | 'underline'
  size?: 'sm' | 'md'
  label?: string
  idPrefix?: string
  className?: string
}

export function tabPanelProps(idPrefix: string, id: string) {
  return { role: 'tabpanel' as const, id: `${idPrefix}-panel-${id}`, 'aria-labelledby': `${idPrefix}-tab-${id}` }
}

export default function Tabs<T extends string>({
  items,
  value,
  onChange,
  variant = 'pill',
  size = 'md',
  label,
  idPrefix,
  className = '',
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)
  const visible = items.filter((item) => !item.hidden)

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = visible.filter((item) => !item.disabled)
    const index = enabled.findIndex((item) => item.id === value)
    let next = -1
    if (event.key === 'ArrowRight') next = (index + 1) % enabled.length
    else if (event.key === 'ArrowLeft') next = (index - 1 + enabled.length) % enabled.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = enabled.length - 1
    if (next < 0 || enabled.length === 0) return
    event.preventDefault()
    onChange(enabled[next].id)
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')
    buttons?.[next]?.focus()
  }

  const cls = ['ui-tabs', `ui-tabs--${variant}`, size === 'sm' ? 'ui-tabs--sm' : '', className].filter(Boolean).join(' ')
  return (
    <div ref={listRef} className={cls} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {visible.map((item) => {
        const selected = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${item.id}` : undefined}
            aria-selected={selected}
            aria-controls={idPrefix ? `${idPrefix}-panel-${item.id}` : undefined}
            tabIndex={selected ? 0 : -1}
            className={['ui-tab', item.label ? '' : 'ui-tab--icon', item.className].filter(Boolean).join(' ')}
            data-testid={item.testId}
            title={item.title}
            aria-label={item.label ? undefined : item.title}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
          >
            {item.icon && <Icon name={item.icon} size={size === 'sm' ? 12 : 14} />}
            {item.label}
            {item.badge}
          </button>
        )
      })}
    </div>
  )
}
