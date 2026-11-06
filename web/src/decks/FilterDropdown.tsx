import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useEscape } from '../ui/useEscape'

export function FilterDropdown({
  label,
  summary,
  active,
  children,
  testId,
}: {
  label: string
  summary: ReactNode
  active: boolean
  children: (close: () => void) => ReactNode
  testId?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])
  useEscape(close, open)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div ref={rootRef} className="arena-filter-dd" data-testid={testId}>
      <span className="arena-chip-label">{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className={`arena-filter-select arena-filter-dd-trigger ${active ? 'is-active' : ''}`}
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="arena-filter-dd-summary">{summary}</span>
      </button>
      {open && (
        <div id={panelId} className="arena-filter-dd-panel" role="group" aria-label={label}>
          {children(close)}
        </div>
      )}
    </div>
  )
}
