import type { FeedbackPrompt } from './feedback'
import { sendValue } from './useFeedbackForm'
import FormattedText from './FormattedText'
import DialogShell from '../ui/DialogShell'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import { localizeOptionLabel, localizeServerMessage } from './serverMessageTranslation'
import './VotingDialog.css'

interface VotingDialogProps {
  prompt: FeedbackPrompt
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
  busy: boolean
}

export default function VotingDialog({ prompt, send, busy }: VotingDialogProps) {
  const { t } = useTranslation()
  // Un voto de un único candidato llega como GAME_TARGET (mode 'uuid'), no solo
  // GAME_ASK (mode 'boolean') / GAME_CHOOSE_CHOICE (mode 'string') — sendValue()
  // elige el wire call correcto según prompt.mode en vez de asumir boolean/string.
  const choose = (value: string) => {
    void send(() => sendValue(prompt, value), t('errors', 'send_failed_vote'))
  }

  const left = prompt.options[0]
  const right = prompt.options[1]
  const hasTwo = prompt.options.length === 2 && left && right
  const stepMatch = /step\s+(\d+)\s+of\s+(\d+)/i.exec(prompt.message)
  const stepLabel = stepMatch
    ? t('dialogs', 'voting_step', { count: stepMatch[1], total: stepMatch[2] })
    : ''

  return (
    <DialogShell
      labelledBy="voting-title"
      titleId="voting-title"
      legacyBackdropClass="voting-backdrop"
      legacyPanelClass="voting-dialog"
      kickerIcon="check"
      kickerLabel={<>{t('dialogs', 'voting_title').toUpperCase()} {stepLabel}</>}
      title={<FormattedText text={prompt.title} />}
      message={<FormattedText text={localizeServerMessage(prompt.message, t as any)} />}
      sectionProps={{ 'aria-describedby': 'voting-hint' }}
    >        {hasTwo ? (
          <div className="voting-options">
            <button
              className="voting-btn voting-left"
              disabled={busy}
              onClick={() => choose(left.value)}
            >
              <span className="voting-btn-icon"><Icon name="check" size={16} /></span>
              <span className="voting-btn-label"><FormattedText text={localizeOptionLabel(left.label, t as any)} /></span>
            </button>
            <span className="voting-vs">VS</span>
            <button
              className="voting-btn voting-right"
              disabled={busy}
              onClick={() => choose(right.value)}
            >
              <span className="voting-btn-icon"><Icon name="circle" size={15} /></span>
              <span className="voting-btn-label"><FormattedText text={localizeOptionLabel(right.label, t as any)} /></span>
            </button>
          </div>
        ) : (
          <div className="voting-options voting-many">
            {prompt.options.map((opt) => (
              <button key={opt.id} className="voting-btn" disabled={busy} onClick={() => choose(opt.value)}>
                <FormattedText text={localizeOptionLabel(opt.label, t as any)} />
              </button>
            ))}
          </div>
        )}
        <div className="voting-hint" id="voting-hint">{t('dialogs', 'voting_hint')}</div>
    </DialogShell>
  )
}
