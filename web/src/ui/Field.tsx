import { cloneElement, isValidElement, useId, type HTMLAttributes, type ReactElement, type ReactNode } from 'react'
import './primitives.css'

export interface FieldProps extends Omit<HTMLAttributes<HTMLElement>, 'children'> {
  label: ReactNode
  /** Below the control: a format note or a warning about the value. */
  hint?: ReactNode
  /** `warn` when the hint is a caution about the field (e.g. it is disabled). */
  hintTone?: 'muted' | 'warn'
  /** Below the control, announced; pass `aria-invalid` to the control too. */
  error?: ReactNode
  /** `group` for a set of controls (chips, radios): a labelled `div` instead
   *  of a `<label>`, which may only wrap one control. */
  group?: boolean
  children: ReactNode
}

/** A form control with its label above it (and optional hint / error below).
 *  Hint and error stay outside the `<label>` so they do not become part of the
 *  control's name; a single control child is described by them instead. */
export default function Field({ label, hint, hintTone = 'muted', error, group = false, className = '', children, ...props }: FieldProps) {
  const id = useId()
  const cls = ['ui-field', className].filter(Boolean).join(' ')
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ')
  const notes = (
    <>
      {hint && <span className={`ui-field-hint${hintTone === 'warn' ? ' ui-field-hint--warn' : ''}`} id={`${id}-hint`}>{hint}</span>}
      {error && <span className="ui-field-error" id={`${id}-error`} role="alert">{error}</span>}
    </>
  )
  if (group) {
    return (
      <div role="group" aria-labelledby={`${id}-label`} aria-describedby={describedBy || undefined} className={cls} {...props}>
        <span className="ui-field-label" id={`${id}-label`}>{label}</span>
        {children}
        {notes}
      </div>
    )
  }
  const control = describedBy && isValidElement(children)
    ? cloneElement(children as ReactElement<{ 'aria-describedby'?: string }>, { 'aria-describedby': describedBy })
    : children
  return (
    <div className={cls} {...props}>
      <label className="ui-field-main">
        <span className="ui-field-label">{label}</span>
        {control}
      </label>
      {notes}
    </div>
  )
}
