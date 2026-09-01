import { useStore, setState } from '../state/store'
import * as cmds from '../net/commands'
import FormattedText from './FormattedText'
import { useTranslation } from '../i18n'

export default function UserRequestDialog() {
  const { t } = useTranslation()
  const request = useStore((s) => s.userRequest)
  if (!request) return null

  const close = () => setState({ userRequest: null })

  const onButton = async (action: string) => {
    if (request.gameId) {
      const result = await cmds.sendPlayerAction(action, request.gameId)
      if (!result.ok) setState({ error: result.error ?? t('dialogs', 'userrequest_error') })
    }
    close()
  }

  return (
    <div className="feedback-backdrop" role="presentation" onClick={close}>
      <section
        className="feedback-dialog user-request-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-request-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="feedback-kicker">
          <span className="kicker-icon">🤝</span> {t('dialogs', 'userrequest_title')}
        </div>
        <h2 id="user-request-title"><FormattedText text={request.title} /></h2>
        {request.message && <p className="feedback-prompt-message"><FormattedText text={request.message} /></p>}
        <div className="feedback-dialog-actions user-request-actions">
          {request.buttons.map((button, index) => (
            <button
              key={`${button.action}-${index}`}
              className={index === 0 ? 'primary send-btn' : 'cancel-btn'}
              onClick={() => void onButton(button.action)}
            >
              <FormattedText text={button.text} />
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
