import { useState } from 'react'
import { useStore, closeRollbackDialog, requestRollback, requestUndo } from '../state/store'
import { soundManager } from '../audio/soundManager'
import { useTranslation } from '../i18n'
import './RollbackDialog.css'

export default function RollbackDialog() {
  const { t } = useTranslation()
  const open = useStore((s) => s.rollbackDialogOpen)
  const game = useStore((s) => s.game)
  const gameId = useStore((s) => s.gameId)
  const [selectedTurns, setSelectedTurns] = useState<number>(0)
  const [sending, setSending] = useState(false)

  if (!open || !game || !gameId) return null

  const currentTurn = game.turn ?? 1
  const me = game.players?.find((p) => p.controlled)
  const hasPriority = !!me?.hasPriority

  const options: { turns: number; label: string }[] = [
    {
      turns: 0,
      label: t('dialogs', 'rollback_current_turn', { turn: currentTurn }),
    },
  ]
  if (currentTurn > 1) {
    options.push({
      turns: 1,
      label: t('dialogs', 'rollback_prev_turn', { turn: currentTurn - 1 }),
    })
  }
  if (currentTurn > 2) {
    options.push({
      turns: 2,
      label: t('dialogs', 'rollback_turns_ago', { count: 2, turn: currentTurn - 2 }),
    })
  }
  if (currentTurn > 3) {
    options.push({
      turns: 3,
      label: t('dialogs', 'rollback_turns_ago', { count: 3, turn: currentTurn - 3 }),
    })
  }

  const handleConfirm = async () => {
    soundManager.play('ui_click', 'ui')
    setSending(true)
    const res = await requestRollback(gameId, selectedTurns)
    setSending(false)
    if (res.ok) {
      soundManager.play('priority', 'game')
      closeRollbackDialog()
    }
  }

  const handleUndo = async () => {
    soundManager.play('ui_click', 'ui')
    setSending(true)
    const res = await requestUndo(gameId)
    setSending(false)
    if (res.ok) {
      soundManager.play('ui_click', 'ui')
      closeRollbackDialog()
    }
  }

  const handleClose = () => {
    soundManager.play('ui_click', 'ui')
    closeRollbackDialog()
  }

  return (
    <div className="feedback-backdrop" role="presentation" onClick={handleClose}>
      <section
        className="feedback-dialog rollback-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rollback-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="feedback-kicker">
          <span className="kicker-icon">⏪</span> {t('dialogs', 'rollback_title')}
        </div>
        <h2 id="rollback-title">{t('dialogs', 'rollback_title')}</h2>
        <p className="rollback-description">{t('dialogs', 'rollback_desc')}</p>

        {!hasPriority && (
          <div className="rollback-priority-notice" role="alert">
            ⚠️ {t('dialogs', 'rollback_priority_warn')}
          </div>
        )}

        <div className="rollback-turn-list">
          {options.map((opt) => (
            <label
              key={opt.turns}
              className={`rollback-turn-option ${selectedTurns === opt.turns ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="rollback-turns"
                value={opt.turns}
                checked={selectedTurns === opt.turns}
                onChange={() => setSelectedTurns(opt.turns)}
              />
              <span className="rollback-option-label">{opt.label}</span>
            </label>
          ))}
        </div>

        <div className="rollback-undo-box">
          <div className="rollback-undo-info">
            <span className="rollback-undo-title">{t('dialogs', 'rollback_undo_btn')}</span>
            <span className="rollback-undo-hint">{t('dialogs', 'rollback_undo_hint')}</span>
          </div>
          <button
            type="button"
            className="rollback-undo-btn"
            onClick={handleUndo}
            disabled={sending}
          >
            ↺ Undo
          </button>
        </div>

        <div className="feedback-dialog-actions rollback-actions">
          <button
            type="button"
            className="primary send-btn"
            onClick={handleConfirm}
            disabled={sending}
          >
            ⏪ {t('dialogs', 'rollback_confirm')}
          </button>
          <button
            type="button"
            className="cancel-btn"
            onClick={handleClose}
            disabled={sending}
          >
            {t('dialogs', 'rollback_cancel')}
          </button>
        </div>
      </section>
    </div>
  )
}
