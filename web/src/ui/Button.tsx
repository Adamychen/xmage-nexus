import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import './primitives.css'

export type ButtonVariant = 'primary' | 'secondary' | 'subtle' | 'soft' | 'success' | 'ghost' | 'danger' | 'soft-danger' | 'link'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  block?: boolean
  children?: ReactNode
}

const ICON_SIZE: Record<ButtonSize, number> = { sm: 13, md: 15, lg: 17 }

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  block = false,
  className = '',
  type = 'button',
  children,
  ...props
}, ref) {
  const cls = ['ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`, block ? 'ui-btn--block' : '', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button ref={ref} type={type} className={cls} {...props}>
      {icon && <Icon name={icon} size={ICON_SIZE[size]} />}
      {children}
    </button>
  )
})

export default Button
