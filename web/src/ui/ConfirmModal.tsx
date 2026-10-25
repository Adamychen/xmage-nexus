import { useEffect, useRef } from 'react'
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
  const cancelFirst = !!request.danger && !request.hideCancel
  const cancelRef = useRef<HTMLButtonElement>(null)
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    ;(cancelFirst ? cancelRef.current : okRef.current)?.focus()
  }, [cancelFirst])

  return (
    <DialogShell
      labelledBy="confirm-modal-title"
      titleId="confirm-modal-title"
      testId="confirm-modal"
      size="sm"
      ornate
      zIndex={2000}
      legacyBackdropClass="confirm-backdrop"
      legacyPanelClass="confirm-modal"
      title={request.title}
      message={request.message}
      onBackdropClick={cancel}
      actions={
        <>
          {!request.hideCancel && (
            <Button
              ref={cancelRef}
              variant="subtle"
              size="lg"
              data-testid="confirm-modal-cancel"
              onClick={cancel}
              autoFocus={cancelFirst}
            >
              {request.cancelLabel}
            </Button>
          )}
          <Button
            ref={okRef}
            variant={request.danger ? 'danger' : 'primary'}
            size="lg"
            data-testid="confirm-modal-ok"
            onClick={() => resolveConfirm(request.id, true)}
            autoFocus={!cancelFirst}
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
