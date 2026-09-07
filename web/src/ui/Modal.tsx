import type { HTMLAttributes, MouseEvent, ReactNode } from 'react'

interface ModalProps {
  backdropClassName: string
  dialogClassName: string
  labelledBy?: string
  label?: string
  testId?: string
  onBackdropClick?: (e: MouseEvent<HTMLDivElement>) => void
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
  onBackdropClick,
  children,
  trailing,
  sectionProps,
}: ModalProps) {
  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onBackdropClick?.(e)
  }
  return (
    <div className={backdropClassName} role="presentation" onClick={handleBackdropClick}>
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
