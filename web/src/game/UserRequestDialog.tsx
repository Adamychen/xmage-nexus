import { useState } from 'react'
import { useStore, setState } from '../state/store'
import * as cmds from '../net/commands'
import FormattedText from './FormattedText'
import Button from '../ui/Button'
import DialogShell from '../ui/DialogShell'
import { useTranslation, dynamicT } from '../i18n'
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
      title={<FormattedText text={localizeServerMessage(request.title, dynamicT(t))} />}
      message={request.message ? <FormattedText text={localizeServerMessage(request.message, dynamicT(t))} /> : undefined}
    >
        <div className="feedback-dialog-actions user-request-actions">
          {request.buttons.map((button, index) => (
            <Button
              key={`${button.action}-${index}`}
              variant={index === 0 ? 'primary' : 'subtle'}
              className={index === 0 ? undefined : 'cancel-btn'}
              disabled={busy}
              onClick={() => void onButton(button.action)}
            >
              <FormattedText text={button.text} />
            </Button>
          ))}
        </div>
    </DialogShell>
  )
}
