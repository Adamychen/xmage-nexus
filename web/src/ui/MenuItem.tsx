import type { ComponentProps } from 'react'
import Icon, { type IconName } from './Icon'
import './primitives.css'

export interface MenuItemProps extends ComponentProps<'button'> {
  icon?: IconName
  danger?: boolean
  selected?: boolean
}

export default function MenuItem({
  icon,
  danger = false,
  selected = false,
  className = '',
  type = 'button',
  children,
  ...props
}: MenuItemProps) {
  const cls = ['ui-menu-item', danger ? 'ui-menu-item--danger' : '', selected ? 'ui-menu-item--selected' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={cls} {...props}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </button>
  )
}
