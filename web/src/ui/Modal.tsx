import { useEffect, useRef, useState } from 'react'
import type { HTMLAttributes, CSSProperties, MouseEvent, ReactNode } from 'react'

const MODAL_Z_BASE = 500
const MODAL_Z_MAX = 1999

let modalZCounter = MODAL_Z_BASE
const activeModalZ = new Set<number>()

function nextModalZ(): number {
  for (let i = 0; i < 500; i++) {
    modalZCounter++
    if (modalZCounter > MODAL_Z_MAX) modalZCounter = MODAL_Z_BASE + 1
    if (!activeModalZ.has(modalZCounter)) return modalZCounter
  }
  return MODAL_Z_MAX
}

/** Costura de test para el asignador de z-index. */
export const __modalAllocator = { next: nextModalZ, active: activeModalZ, max: MODAL_Z_MAX }

function isTopmostModal(z: number): boolean {
  let max = 0
  for (const v of activeModalZ) max = Math.max(max, v)
  return z >= max
}

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
  const backdropStyle: CSSProperties = { zIndex: z }
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    activeModalZ.add(z)
    return () => {
      activeModalZ.delete(z)
    }
  }, [z])

  useEffect(() => {
    if (!onEscape) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (!isTopmostModal(z)) return
      e.preventDefault()
      onEscape()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onEscape, z])

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
      if (e.key !== 'Tab' || !isTopmostModal(z)) return
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
  }, [z])

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onBackdropClick?.(e)
  }
  return (
    <div className={backdropClassName} role="presentation" style={backdropStyle} onClick={handleBackdropClick}>
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
