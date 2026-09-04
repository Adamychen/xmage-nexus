import type { MouseEvent, ReactNode } from 'react'

interface ModalProps {
  backdropClassName: string
  dialogClassName: string
  labelledBy?: string
  label?: string
  testId?: string
  onBackdropClick?: (e: MouseEvent<HTMLDivElement>) => void
  children: ReactNode
  trailing?: ReactNode
}

export default function Modal({
  backdropClassName,
  dialogClassName,
  labelledBy,
  label,
  testId,
  onBackdropClick,
  children,
  trailing,
}: ModalProps) {
  return (
    <div className={backdropClassName} role="presentation" onClick={onBackdropClick}>
      <section
        className={dialogClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={label}
        data-testid={testId}
      >
        {children}
      </section>
      {trailing}
    </div>
  )
}
