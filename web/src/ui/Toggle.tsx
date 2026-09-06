import './Toggle.css'

interface Props {
  checked: boolean
  onChange: (next: boolean) => void
  label: React.ReactNode
  title?: string
}

export default function Toggle({ checked, onChange, label, title }: Props) {
  return (
    <label className="ui-toggle-row" title={title}>
      <span className="ui-toggle-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
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
