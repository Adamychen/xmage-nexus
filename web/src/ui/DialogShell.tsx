import type { HTMLAttributes, MouseEvent, ReactNode } from 'react'
import Modal from './Modal'
import Icon, { type IconName } from './Icon'
import { useTranslation } from '../i18n'
import './DialogShell.css'

export interface DialogShellProps {
  labelledBy: string
  titleId?: string
  testId?: string
  size?: 'sm' | 'md' | 'lg'
  legacyPanelClass?: string
  legacyBackdropClass?: string
  zIndex?: number
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
  onClose?: () => void
}

export default function DialogShell({
  labelledBy,
  titleId,
  testId,
  size = 'md',
  legacyPanelClass,
  legacyBackdropClass,
  zIndex,
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
  onClose,
}: DialogShellProps) {
  const { t } = useTranslation()

  return (
    <Modal
      backdropClassName={['dlg-backdrop', legacyBackdropClass].filter(Boolean).join(' ')}
      dialogClassName={['dlg-panel', `dlg-${size}`, legacyPanelClass].filter(Boolean).join(' ')}
      labelledBy={labelledBy}
      testId={testId}
      zIndex={zIndex}
      trailing={trailing}
      onBackdropClick={onBackdropClick}
      onEscape={onClose}
      sectionProps={sectionProps}
    >
      <div className="dlg-head">
        <div className="dlg-kicker">
          <span className="kicker-icon"><Icon name={kickerIcon} size={13} /></span> {kickerLabel}
        </div>
        <div className="dlg-head-right">
          {onClose && (
            <button
              type="button"
              className="dlg-close"
              onClick={onClose}
              data-testid={testId ? `${testId}-close` : undefined}
              title={t('common', 'close')}
              aria-label={t('common', 'close')}
            >
              ✕
            </button>
          )}
          {topRight && <div className="dlg-head-right-extra">{topRight}</div>}
        </div>
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
