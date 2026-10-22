import { useEffect, useRef, useState } from 'react'
import type { HTMLAttributes, CSSProperties, MouseEvent, ReactNode } from 'react'
import { isTopLayer, useLayer } from './useEscape'

const MODAL_Z_BASE = 500
const MODAL_Z_MAX = 1999

let modalZCounter = MODAL_Z_BASE
const activeModalZ = new Set<number>()

function nextModalZ(): number {
  if (modalZCounter >= MODAL_Z_MAX && activeModalZ.size === 0) modalZCounter = MODAL_Z_BASE
  let top = modalZCounter
  for (const v of activeModalZ) top = Math.max(top, v)
  modalZCounter = Math.min(top + 1, MODAL_Z_MAX)
  return modalZCounter
}

/** Costura de test para el asignador de z-index. */
export const __modalAllocator = { next: nextModalZ, active: activeModalZ, max: MODAL_Z_MAX }

interface ModalProps {
  backdropClassName: string
  dialogClassName: string
  labelledBy?: string
  label?: string
  testId?: string
  zIndex?: number
  onBackdropClick?: (e: MouseEvent<HTMLDivElement>) => void
  onEscape?: () => void
  children: ReactNode
  trailing?: ReactNode
  sectionProps?: Omit<HTMLAttributes<HTMLElement>, 'className'>
}

export default function Modal({
  backdropClassName,
  dialogClassName,
  labelledBy,
  label,
  testId,
  zIndex,
  onBackdropClick,
  onEscape,
  children,
  trailing,
  sectionProps,
}: ModalProps) {
  const [z] = useState(() => zIndex ?? nextModalZ())
  const [peek, setPeek] = useState(false)
  const backdropStyle: CSSProperties = { zIndex: z }
  const sectionRef = useRef<HTMLElement>(null)
  const layer = useLayer()

  useEffect(() => {
    activeModalZ.add(z)
    return () => {
      activeModalZ.delete(z)
    }
  }, [z])

  // Alt held = peek at the board behind the dialog (visual only: the backdrop
  // keeps intercepting clicks, so no accidental game actions while peeking).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        e.preventDefault()
        setPeek(true)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        e.preventDefault()
        setPeek(false)
      }
    }
    const onBlur = () => setPeek(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  useEffect(() => {
    if (!onEscape) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !isTopLayer(layer)) return
      e.preventDefault()
      onEscape()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onEscape, layer])

  // Foco inicial + trampa de Tab: al abrir, el foco entra al diálogo (primer
  // control o la sección) y Tab/Shift+Tab ciclan dentro mientras sea el modal
  // superior. Al cerrar se restaura el foco previo.
  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const prev = document.activeElement as HTMLElement | null
    const focusables = (): HTMLElement[] =>
      [...section.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )].filter((el) => el.getAttribute('aria-hidden') !== 'true')
    const initial = focusables()[0]
    if (initial) {
      initial.focus()
    } else {
      section.tabIndex = -1
      section.focus()
    }
    const trapTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !isTopLayer(layer)) return
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', trapTab, true)
    return () => {
      document.removeEventListener('keydown', trapTab, true)
      prev?.focus?.()
    }
  }, [z, layer])

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onBackdropClick?.(e)
  }
  return (
    <div className={backdropClassName} role="presentation" style={backdropStyle} data-peek={peek ? '1' : undefined} onClick={handleBackdropClick}>
      <section
        ref={sectionRef}
        className={dialogClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={label}
        data-testid={testId}
        {...sectionProps}
      >
        {children}
      </section>
      {trailing}
    </div>
  )
}
