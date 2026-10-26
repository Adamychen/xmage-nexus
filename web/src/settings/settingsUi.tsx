import { useId, type CSSProperties, type ReactNode } from 'react'
import { Switch } from '../ui/Toggle'

interface ControlIds {
  controlId: string
  labelId: string
  hintId: string | undefined
}

interface GroupProps {
  title?: ReactNode
  hint?: ReactNode
  settingId?: string
  testId?: string
  className?: string
  children: ReactNode
}

/** One titled card of setting rows (SET-5). With `settingId` the whole group is one searchable setting (SET-6). */
export function SettingsGroup({ title, hint, settingId, testId, className = '', children }: GroupProps) {
  return (
    <section className={`settings-group ${className}`.trim()} data-setting={settingId} data-testid={testId}>
      {title != null && <h3 className="settings-group-title">{title}</h3>}
      {hint != null && hint !== '' && <p className="settings-group-hint">{hint}</p>}
      <div className="settings-group-body">{children}</div>
    </section>
  )
}

interface RowProps {
  id: string
  label: ReactNode
  hint?: ReactNode
  disabled?: boolean
  testId?: string
  className?: string
  children: ReactNode | ((ids: ControlIds) => ReactNode)
}

/** Label and explanation on the left, the control on the right; a disabled row dims both texts together (SET-5). */
export function SettingsRow({ id, label, hint, disabled = false, testId, className = '', children }: RowProps) {
  const uid = useId()
  const hasHint = hint != null && hint !== false && hint !== ''
  const ids: ControlIds = { controlId: `${uid}c`, labelId: `${uid}l`, hintId: hasHint ? `${uid}h` : undefined }
  return (
    <div
      className={`settings-item settings-row${disabled ? ' is-disabled' : ''} ${className}`.trim()}
      data-setting={id}
      data-testid={testId}
    >
      <div className="settings-row-text">
        <label className="settings-row-label" id={ids.labelId} htmlFor={ids.controlId}>{label}</label>
        {hasHint && <span className="settings-row-hint" id={ids.hintId}>{hint}</span>}
      </div>
      <div className="settings-row-control">{typeof children === 'function' ? children(ids) : children}</div>
    </div>
  )
}

interface SwitchRowProps {
  id: string
  label: ReactNode
  hint?: ReactNode
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  testId?: string
  extra?: ReactNode
}

export function SwitchRow({ id, label, hint, checked, onChange, disabled, testId, extra }: SwitchRowProps) {
  return (
    <SettingsRow id={id} label={label} hint={hint} disabled={disabled}>
      {({ controlId, labelId, hintId }) => (
        <>
          {extra}
          <Switch
            id={controlId}
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            aria-labelledby={labelId}
            aria-describedby={hintId}
            data-testid={testId}
          />
        </>
      )}
    </SettingsRow>
  )
}

export interface SegmentOption<T extends string> {
  id: T
  label: ReactNode
  testId?: string
  disabled?: boolean
}

interface SegmentedProps<T extends string> {
  value: T | null
  options: ReadonlyArray<SegmentOption<T>>
  onChange: (next: T) => void
  labelledBy?: string
  label?: string
  disabled?: boolean
}

/** A fixed set of options as one segmented control: never a grid with empty columns (SET-5). */
export function Segmented<T extends string>({ value, options, onChange, labelledBy, label, disabled }: SegmentedProps<T>) {
  return (
    <div className="settings-seg" role="group" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={value === o.id ? 'selected' : undefined}
          aria-pressed={value === o.id}
          disabled={disabled || o.disabled}
          onClick={() => onChange(o.id)}
          data-testid={o.testId}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Grid style for a picker: one column per option, and on a narrow screen two only when they pair up, so no row is left with a hole (SET-7). */
export function pickerColumns(count: number): CSSProperties {
  return { '--cols': count, '--cols-narrow': count % 2 === 0 ? 2 : 1 } as CSSProperties
}
