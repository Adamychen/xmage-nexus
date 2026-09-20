import type { ComponentProps, ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import './primitives.css'

export interface IconButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  label: string
  icon?: IconName
  variant?: 'subtle' | 'ghost' | 'primary'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  round?: boolean
  children?: ReactNode
}

const ICON_SIZE = { xs: 12, sm: 13, md: 15, lg: 17, xl: 20 }

export default function IconButton({
  label,
  icon,
  variant = 'subtle',
  size = 'md',
  round = false,
  className = '',
  type = 'button',
  children,
  ...props
}: IconButtonProps) {
  const cls = ['ui-icon-btn', `ui-icon-btn--${variant}`, `ui-icon-btn--${size}`, round ? 'ui-icon-btn--round' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={cls} aria-label={label} title={props.title ?? label} {...props}>
      {icon && <Icon name={icon} size={ICON_SIZE[size]} />}
      {children}
    </button>
  )
}
