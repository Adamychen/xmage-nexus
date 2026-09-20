import { useEscape } from './useEscape'
import Button from './Button'
import DialogShell from './DialogShell'
import type { ConfirmRequest } from './confirmDialog'
import { resolveConfirm } from './confirmDialog'
import './ConfirmModal.css'

interface ConfirmModalProps {
  request: ConfirmRequest
}

export default function ConfirmModal({ request }: ConfirmModalProps) {
  useEscape(() => resolveConfirm(request.id, false))

  const cancel = () => resolveConfirm(request.id, false)

  return (
    <DialogShell
      labelledBy="confirm-modal-title"
      titleId="confirm-modal-title"
      testId="confirm-modal"
      size="sm"
      zIndex={2000}
      legacyBackdropClass="confirm-backdrop"
      legacyPanelClass="confirm-modal"
      kickerIcon="alert"
      kickerLabel={request.title.toUpperCase()}
      title={request.title}
      message={request.message}
      onBackdropClick={cancel}
      actions={
        <>
          {!request.hideCancel && (
            <Button variant="subtle" size="lg" data-testid="confirm-modal-cancel" onClick={cancel} autoFocus>
              {request.cancelLabel}
            </Button>
          )}
          <Button
            variant={request.danger ? 'danger' : 'primary'}
            size="lg"
            data-testid="confirm-modal-ok"
            onClick={() => resolveConfirm(request.id, true)}
            autoFocus={request.hideCancel}
          >
            {request.okLabel}
          </Button>
        </>
      }
    >
      {null}
    </DialogShell>
  )
}
