import { useId, useState, type ReactNode } from 'react'
import Icon from '../../ui/Icon'

/** An optional group of settings folded away by default. Its summary stays
 *  visible while folded, so a non-default value is never hidden. */
export default function Collapsible({ title, summary, defaultOpen = false, children }: {
  title: ReactNode
  summary?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  return (
    <div className={`create-collapsible${open ? ' open' : ''}`}>
      <button
        type="button"
        className="create-collapsible-head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="create-collapsible-title">{title}</span>
        {!open && summary && <span className="create-collapsible-summary">{summary}</span>}
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={13} />
      </button>
      <div id={bodyId} hidden={!open} className="create-collapsible-body">
        {children}
      </div>
    </div>
  )
}
