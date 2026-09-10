import { useStore, setState, armRollbackPending } from '../state/store'
import * as cmds from '../net/commands'
import FormattedText from './FormattedText'
import DialogShell from '../ui/DialogShell'
import { useTranslation } from '../i18n'

export default function UserRequestDialog() {
  const { t } = useTranslation()
  const request = useStore((s) => s.userRequest)
  if (!request) return null

  const close = () => setState({ userRequest: null })

  const onButton = async (action: string) => {
    if (request.gameId) {
      const result = await cmds.sendPlayerAction(action, request.gameId, request.relatedUserId)
      if (!result.ok) setState({ error: result.error ?? t('dialogs', 'userrequest_error') })
      // Aceptar un rollback arma la espera de la vista restaurada (ver armRollbackPending).
      else if (action === 'ADD_PERMISSION_TO_ROLLBACK_TURN') armRollbackPending(request.gameId)
    }
    close()
  }

  return (
    <DialogShell
      labelledBy="user-request-title"
      titleId="user-request-title"
      legacyBackdropClass="feedback-backdrop"
      legacyPanelClass="feedback-dialog user-request-dialog"
      kickerIcon="info"
      kickerLabel={t('dialogs', 'userrequest_title')}
      title={<FormattedText text={request.title} />}
      message={request.message ? <FormattedText text={request.message} /> : undefined}
      onBackdropClick={close}
    >
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
    </DialogShell>
  )
}
