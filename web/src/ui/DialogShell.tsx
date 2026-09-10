import type { HTMLAttributes, MouseEvent, ReactNode } from 'react'
import Modal from './Modal'
import Icon, { type IconName } from './Icon'
import './DialogShell.css'

export interface DialogShellProps {
  labelledBy: string
  titleId?: string
  testId?: string
  size?: 'sm' | 'md' | 'lg'
  legacyPanelClass?: string
  legacyBackdropClass?: string
  kickerIcon: IconName
  kickerLabel: ReactNode
  title: ReactNode
  sourceName?: ReactNode
  message?: ReactNode
  search?: ReactNode
  children: ReactNode
  actions?: ReactNode
  aside?: ReactNode
  trailing?: ReactNode
  topRight?: ReactNode
  sectionProps?: Omit<HTMLAttributes<HTMLElement>, 'className'>
  onBackdropClick?: (e: MouseEvent<HTMLDivElement>) => void
}

export default function DialogShell({
  labelledBy,
  titleId,
  testId,
  size = 'md',
  legacyPanelClass,
  legacyBackdropClass,
  kickerIcon,
  kickerLabel,
  title,
  sourceName,
  message,
  search,
  children,
  actions,
  aside,
  trailing,
  topRight,
  sectionProps,
  onBackdropClick,
}: DialogShellProps) {
  return (
    <Modal
      backdropClassName={['dlg-backdrop', legacyBackdropClass].filter(Boolean).join(' ')}
      dialogClassName={['dlg-panel', `dlg-${size}`, legacyPanelClass].filter(Boolean).join(' ')}
      labelledBy={labelledBy}
      testId={testId}
      trailing={trailing}
      onBackdropClick={onBackdropClick}
      sectionProps={sectionProps}
    >
      <div className="dlg-head">
        <div className="dlg-kicker">
          <span className="kicker-icon"><Icon name={kickerIcon} size={13} /></span> {kickerLabel}
        </div>
        {topRight && <div className="dlg-head-right">{topRight}</div>}
      </div>
      <h2 id={titleId} className="dlg-title">{title}</h2>
      {sourceName != null && sourceName !== '' && (
        <div className="dlg-source">{sourceName}</div>
      )}
      {message != null && message !== '' && (
        <p className="dlg-message">{message}</p>
      )}
      {search}
      {children}
      {actions && <div className="dlg-actions">{actions}</div>}
      {aside}
    </Modal>
  )
}
