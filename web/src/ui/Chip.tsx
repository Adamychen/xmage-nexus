import type { HTMLAttributes, ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import './primitives.css'

export type ChipTone = 'neutral' | 'brand' | 'gold' | 'ok' | 'warn' | 'err'

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: ChipTone
  icon?: IconName
  solid?: boolean
  children?: ReactNode
}

export default function Chip({ tone = 'neutral', icon, solid = false, className = '', children, ...props }: ChipProps) {
  const cls = ['ui-chip', `ui-chip--${tone}`, solid ? 'ui-chip--solid' : '', className].filter(Boolean).join(' ')
  return (
    <span className={cls} {...props}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}
