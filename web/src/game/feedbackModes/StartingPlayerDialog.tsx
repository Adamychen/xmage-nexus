import FormattedText from '../FormattedText'
import Icon from '../../ui/Icon'
import ArenaPromptShell from '../arena/ArenaPromptShell'
import { useTranslation } from '../../i18n'
import { sendValue, type UseFeedbackForm } from '../useFeedbackForm'
import './StartingPlayerDialog.css'

export default function StartingPlayerDialog({ form }: { form: UseFeedbackForm }) {
  const { t } = useTranslation()
  const { prompt, busy, send } = form
  if (!prompt) return null
  return (
    <div className="arena-starting-player">
      <ArenaPromptShell
        title={t('game', 'who_starts')}
        instruction={<FormattedText text={prompt.message} />}
        backdropClassName="feedback-backdrop"
        dialogClassName="feedback-dialog starting-player-dialog"
        testId="starting-player-prompt"
        footer={null}
      >
        <section className="arena-prompt-zone arena-sp-zone">
          <div className="starting-player-options">
            {prompt.options.map((option) => (
              <button
                type="button"
                key={option.id}
                className="starting-player-btn"
                disabled={busy}
                onClick={() => void send(() => sendValue(prompt, option.value), t('errors', 'send_failed'))}
              >
                <span className="sp-avatar"><Icon name="user" size={26} /></span>
                <span className="sp-name"><FormattedText text={option.label} /></span>
                <span className="sp-action">{t('game', 'starting_player_starts_first')}</span>
              </button>
            ))}
          </div>
        </section>
      </ArenaPromptShell>
    </div>
  )
}
