import { useEffect, useState } from 'react'
import type { HTMLAttributes, CSSProperties, MouseEvent, ReactNode } from 'react'

const MODAL_Z_BASE = 500
const MODAL_Z_MAX = 1999

let modalZCounter = MODAL_Z_BASE
const activeModalZ = new Set<number>()

function nextModalZ(): number {
  modalZCounter = Math.min(modalZCounter + 1, MODAL_Z_MAX)
  return modalZCounter
}

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

  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onBackdropClick?.(e)
  }
  return (
    <div className={backdropClassName} role="presentation" style={backdropStyle} onClick={handleBackdropClick}>
      <section
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
