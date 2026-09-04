import FormattedText from '../FormattedText'
import Icon from '../../ui/Icon'
import Modal from '../../ui/Modal'
import { useTranslation } from '../../i18n'
import { sendValue, type UseFeedbackForm } from '../useFeedbackForm'

export default function StartingPlayerDialog({ form }: { form: UseFeedbackForm }) {
  const { t } = useTranslation()
  const { prompt, busy, send } = form
  if (!prompt) return null
  return (
    <Modal backdropClassName="feedback-backdrop" dialogClassName="feedback-dialog starting-player-dialog" labelledBy="sp-title">
      <div className="feedback-kicker"><Icon name="swords" size={13} /> {t('game', 'turn')}</div>
      <h2 id="sp-title">{t('game', 'who_starts')}</h2>
      <p><FormattedText text={prompt.message} /></p>
      <div className="starting-player-options">
        {prompt.options.map((option) => (
          <button
            key={option.id}
            className="starting-player-btn"
            disabled={busy}
            onClick={() => void send(() => sendValue(prompt, option.value), t('errors', 'send_failed'))}
          >
            <span className="sp-avatar">🧙</span>
            <span className="sp-name"><FormattedText text={option.label} /></span>
            <span className="sp-action">{t('game', 'starting_player_starts_first')}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
