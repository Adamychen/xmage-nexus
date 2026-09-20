import './Toggle.css'

interface SwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  title?: string
  disabled?: boolean
}

export function Switch({ checked, onChange, title, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
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
  label: React.ReactNode
}

export default function Toggle({ label, title, disabled, ...switchProps }: Props) {
  return (
    <label className={`ui-toggle-row${disabled ? ' is-disabled' : ''}`} title={title}>
      <span className="ui-toggle-label">{label}</span>
      <Switch disabled={disabled} {...switchProps} />
    </label>
  )
}
