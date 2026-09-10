import { useEffect } from 'react'
import DialogShell from './DialogShell'
import type { ConfirmRequest } from './confirmDialog'
import { resolveConfirm } from './confirmDialog'
import './ConfirmModal.css'

interface ConfirmModalProps {
  request: ConfirmRequest
}

export default function ConfirmModal({ request }: ConfirmModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolveConfirm(request.id, false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [request.id])

  const cancel = () => resolveConfirm(request.id, false)

  return (
    <DialogShell
      labelledBy="confirm-modal-title"
      titleId="confirm-modal-title"
      testId="confirm-modal"
      size="sm"
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
            <button
              type="button"
              className="dlg-btn dlg-btn-cancel"
              data-testid="confirm-modal-cancel"
              onClick={cancel}
              autoFocus
            >
              {request.cancelLabel}
            </button>
          )}
          <button
            type="button"
            className={request.danger ? 'dlg-btn confirm-ok-danger' : 'dlg-btn dlg-btn-primary'}
            data-testid="confirm-modal-ok"
            onClick={() => resolveConfirm(request.id, true)}
            autoFocus={request.hideCancel}
          >
            {request.okLabel}
          </button>
        </>
      }
    >
      {null}
    </DialogShell>
  )
}
