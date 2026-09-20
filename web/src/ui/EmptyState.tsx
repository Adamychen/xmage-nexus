import type { HTMLAttributes, ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import './primitives.css'

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: IconName
  iconSize?: number
  title?: ReactNode
  action?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  boxed?: boolean
  fill?: boolean
  italic?: boolean
}

export default function EmptyState({
  icon,
  iconSize = 28,
  title,
  action,
  size = 'md',
  boxed = false,
  fill = false,
  italic = false,
  className = '',
  children,
  ...props
}: EmptyStateProps) {
  const cls = [
    'ui-empty',
    `ui-empty--${size}`,
    boxed ? 'ui-empty--boxed' : '',
    fill ? 'ui-empty--fill' : '',
    italic ? 'ui-empty--italic' : '',
    className,
  ].filter(Boolean).join(' ')
  return (
    <div className={cls} {...props}>
      {icon && <span className="ui-empty-icon"><Icon name={icon} size={iconSize} /></span>}
      {title && <strong className="ui-empty-title">{title}</strong>}
      {children && <div className="ui-empty-desc">{children}</div>}
      {action}
    </div>
  )
}
