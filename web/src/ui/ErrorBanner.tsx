import Icon from './Icon'
import { useTranslation } from '../i18n'
import './ErrorBanner.css'

interface ErrorBannerProps {
  message: string | null | undefined
  onClose?: () => void
  testId?: string
  className?: string
}

export default function ErrorBanner({ message, onClose, testId, className }: ErrorBannerProps) {
  const { t, tError } = useTranslation()
  if (!message) return null
  return (
    <div
      className={`error-banner${className ? ` ${className}` : ''}`}
      role="alert"
      data-testid={testId}
    >
      <span className="error-banner-icon" aria-hidden="true">
        <Icon name="alert" size={15} />
      </span>
      <span className="error-banner-msg">{tError(message)}</span>
      {onClose && (
        <button
          type="button"
          className="error-banner-close"
          onClick={onClose}
          title={t('common', 'close')}
          aria-label={t('common', 'close')}
        >
          <Icon name="x" size={13} />
        </button>
      )}
    </div>
  )
}
