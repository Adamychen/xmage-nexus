import './Toggle.css'

interface Props {
  checked: boolean
  onChange: (next: boolean) => void
  label: React.ReactNode
  title?: string
  disabled?: boolean
}

export default function Toggle({ checked, onChange, label, title, disabled }: Props) {
  return (
    <label className={`ui-toggle-row${disabled ? ' is-disabled' : ''}`} title={title}>
      <span className="ui-toggle-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`ui-toggle ${checked ? 'on' : ''}`}
        onClick={(e) => {
          e.preventDefault()
          onChange(!checked)
        }}
      >
        <span className="ui-toggle-knob" />
      </button>
    </label>
  )
}
