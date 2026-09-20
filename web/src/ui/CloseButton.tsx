import type { ButtonHTMLAttributes } from 'react'
import Icon from './Icon'
import { useTranslation } from '../i18n'
import './primitives.css'

export interface CloseButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: 'solid' | 'plain'
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const ICON_SIZE = { sm: 13, md: 14, lg: 16 }

export default function CloseButton({
  variant = 'solid',
  size = 'md',
  label,
  className = '',
  type = 'button',
  ...props
}: CloseButtonProps) {
  const { t } = useTranslation()
  const text = label ?? t('common', 'close')
  const cls = ['ui-close', `ui-close--${variant}`, `ui-close--${size}`, className].filter(Boolean).join(' ')
  return (
    <button type={type} className={cls} aria-label={text} title={props.title ?? text} {...props}>
      <Icon name="x" size={ICON_SIZE[size]} />
    </button>
  )
}
