import type { ButtonHTMLAttributes } from 'react'
import Icon, { type IconName } from './Icon'
import type { ChipTone } from './Chip'
import './primitives.css'

export interface ChipButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  activeTone?: ChipTone
  icon?: IconName
  size?: 'xs' | 'sm' | 'md'
  pill?: boolean
}

export default function ChipButton({
  active,
  activeTone = 'brand',
  icon,
  size = 'md',
  pill = false,
  className = '',
  type = 'button',
  children,
  ...props
}: ChipButtonProps) {
  const cls = [
    'ui-chip',
    'ui-chip--btn',
    `ui-chip--${active ? activeTone : 'neutral'}`,
    size !== 'sm' ? `ui-chip--${size}` : '',
    pill ? 'ui-chip--pill' : '',
    className,
  ].filter(Boolean).join(' ')
  return (
    <button type={type} className={cls} aria-pressed={active} {...props}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </button>
  )
}
