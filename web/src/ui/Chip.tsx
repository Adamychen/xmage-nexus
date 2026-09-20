import type { HTMLAttributes, ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import './primitives.css'

export type ChipTone = 'neutral' | 'brand' | 'gold' | 'ok' | 'warn' | 'err'

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone
  icon?: IconName
  solid?: boolean
  size?: 'xs' | 'sm' | 'md'
  pill?: boolean
  children?: ReactNode
}

export default function Chip({ tone = 'neutral', icon, solid = false, size = 'sm', pill = false, className = '', children, ...props }: ChipProps) {
  const cls = ['ui-chip', `ui-chip--${tone}`, solid ? 'ui-chip--solid' : '', size !== 'sm' ? `ui-chip--${size}` : '', pill ? 'ui-chip--pill' : '', className].filter(Boolean).join(' ')
  return (
    <span className={cls} {...props}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}
