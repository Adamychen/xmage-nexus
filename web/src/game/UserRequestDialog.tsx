import { useState } from 'react'
import { useStore, setState, armRollbackPending } from '../state/store'
import * as cmds from '../net/commands'
import FormattedText from './FormattedText'
import DialogShell from '../ui/DialogShell'
import { useTranslation } from '../i18n'
import { localizeServerMessage } from './serverMessageTranslation'

export default function UserRequestDialog() {
  const { t } = useTranslation()
  const request = useStore((s) => s.userRequest)
  const [busy, setBusy] = useState(false)
  if (!request) return null

  const close = () => setState({ userRequest: null })

  const onButton = async (action: string) => {
    if (busy) return
    setBusy(true)
    try {
      if (request.gameId) {
        const result = await cmds.sendPlayerAction(action, request.gameId, request.relatedUserId)
        if (!result.ok) setState({ error: result.error ?? t('dialogs', 'userrequest_error') })
        // Aceptar un rollback arma la espera de la vista restaurada (ver armRollbackPending).
        else if (action === 'ADD_PERMISSION_TO_ROLLBACK_TURN') armRollbackPending(request.gameId)
      }
      close()
    } finally {
      setBusy(false)
    }
  }

  return (
    <DialogShell
      labelledBy="user-request-title"
      titleId="user-request-title"
      legacyBackdropClass="feedback-backdrop"
      legacyPanelClass="feedback-dialog user-request-dialog"
      kickerIcon="info"
      kickerLabel={t('dialogs', 'userrequest_title')}
      title={<FormattedText text={localizeServerMessage(request.title, t as any)} />}
      message={request.message ? <FormattedText text={localizeServerMessage(request.message, t as any)} /> : undefined}
      onBackdropClick={close}
    >
        <div className="feedback-dialog-actions user-request-actions">
          {request.buttons.map((button, index) => (
            <button
              key={`${button.action}-${index}`}
              className={index === 0 ? 'primary send-btn' : 'cancel-btn'}
              disabled={busy}
              onClick={() => void onButton(button.action)}
            >
              <FormattedText text={button.text} />
            </button>
          ))}
        </div>
    </DialogShell>
  )
}
