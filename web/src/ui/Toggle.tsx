import { useId, type ReactNode } from 'react'
import './Toggle.css'

interface SwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  title?: string
  disabled?: boolean
  'aria-describedby'?: string
}

export function Switch({ checked, onChange, title, disabled, 'aria-describedby': describedBy }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={describedBy}
      title={title}
      disabled={disabled}
      className={`ui-toggle ${checked ? 'on' : ''}`}
      onClick={(e) => {
        e.preventDefault()
        onChange(!checked)
      }}
    >
      <span className="ui-toggle-knob" />
    </button>
  )
}

interface Props extends SwitchProps {
  label: ReactNode
  hint?: ReactNode
}

export default function Toggle({ label, title, disabled, hint, ...switchProps }: Props) {
  const hintId = useId()
  const hasHint = hint != null && hint !== false && hint !== ''
  return (
    <div className="ui-toggle-field">
      <label className={`ui-toggle-row${disabled ? ' is-disabled' : ''}`} title={title}>
        <span className="ui-toggle-label">{label}</span>
        <Switch
          disabled={disabled}
          aria-describedby={hasHint ? hintId : undefined}
          {...switchProps}
        />
      </label>
      {hasHint && <p id={hintId} className="ui-toggle-hint">{hint}</p>}
    </div>
  )
}
