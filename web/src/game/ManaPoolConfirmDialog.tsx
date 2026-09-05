import Modal from '../ui/Modal'
import { useTranslation } from '../i18n'

interface ManaPoolConfirmDialogProps {
  count: number
  onConfirm: () => void
  onCancel: () => void
}

export default function ManaPoolConfirmDialog({ count, onConfirm, onCancel }: ManaPoolConfirmDialogProps) {
  const { t } = useTranslation()
  return (
    <Modal backdropClassName="mana-confirm-backdrop" dialogClassName="mana-confirm-dialog" labelledBy="mana-confirm-title">
      <div className="mana-confirm-kicker">🔋 {t('game', 'mana_payment_title').toUpperCase()}</div>
      <h2 id="mana-confirm-title">{t('game', 'mana_confirm_title')}</h2>
      <p className="mana-confirm-message">{t('game', 'mana_confirm_message', { count })}</p>
      <div className="mana-confirm-actions">
        <button type="button" className="mana-confirm-yes" data-testid="mana-confirm-yes" onClick={onConfirm}>
          {t('game', 'string_confirm')}
        </button>
        <button type="button" className="mana-confirm-no" data-testid="mana-confirm-no" onClick={onCancel}>
          {t('game', 'string_cancel')}
        </button>
      </div>
    </Modal>
  )
}
