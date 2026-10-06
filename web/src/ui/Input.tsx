import { forwardRef, type InputHTMLAttributes } from 'react'
import './primitives.css'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md' | 'lg'
  /** Narrow numeric/port boxes instead of the full width of the field. */
  inline?: boolean
}

/** Text-like input on the shared field styling (base look lives in styles.css). */
const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', inline = false, className = '', type = 'text', ...props },
  ref,
) {
  const cls = ['ui-input', `ui-input--${size}`, inline ? 'ui-input--inline' : '', className].filter(Boolean).join(' ')
  return <input ref={ref} type={type} className={cls} {...props} />
})

export default Input
