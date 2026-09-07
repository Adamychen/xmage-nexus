import FormattedText from '../FormattedText'
import Icon from '../../ui/Icon'
import DialogShell from '../../ui/DialogShell'
import { useTranslation } from '../../i18n'
import { sendValue, type UseFeedbackForm } from '../useFeedbackForm'

export default function StartingPlayerDialog({ form }: { form: UseFeedbackForm }) {
  const { t } = useTranslation()
  const { prompt, busy, send } = form
  if (!prompt) return null
  return (
    <DialogShell
      labelledBy="sp-title"
      titleId="sp-title"
      legacyBackdropClass="feedback-backdrop"
      legacyPanelClass="feedback-dialog starting-player-dialog"
      kickerIcon="swords"
      kickerLabel={t('game', 'turn')}
      title={t('game', 'who_starts')}
      message={<FormattedText text={prompt.message} />}
    >
      <div className="starting-player-options">
        {prompt.options.map((option) => (
          <button
            key={option.id}
            className="starting-player-btn"
            disabled={busy}
            onClick={() => void send(() => sendValue(prompt, option.value), t('errors', 'send_failed'))}
          >
            <span className="sp-avatar"><Icon name="user" size={20} /></span>
            <span className="sp-name"><FormattedText text={option.label} /></span>
            <span className="sp-action">{t('game', 'starting_player_starts_first')}</span>
          </button>
        ))}
      </div>
    </DialogShell>
  )
}
