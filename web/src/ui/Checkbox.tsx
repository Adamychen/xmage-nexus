import type { LabelHTMLAttributes, ReactNode } from 'react'
import Icon, { type IconName } from './Icon'
import './primitives.css'

export interface CheckboxProps extends Omit<LabelHTMLAttributes<HTMLLabelElement>, 'onChange'> {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  description?: ReactNode
  icon?: IconName
  card?: boolean
  disabled?: boolean
  inputTestId?: string
}

export default function Checkbox({
  checked,
  onChange,
  label,
  description,
  icon,
  card = false,
  disabled,
  inputTestId,
  className = '',
  ...props
}: CheckboxProps) {
  const cls = ['ui-check', card ? 'ui-check--card' : '', className].filter(Boolean).join(' ')
  return (
    <label className={cls} {...props}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        data-testid={inputTestId}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ui-check-text">
        <span className="ui-check-label">
          {icon && <Icon name={icon} size={12} />}
          {label}
        </span>
        {description && <span className="ui-check-desc">{description}</span>}
      </span>
    </label>
  )
}
