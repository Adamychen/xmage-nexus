import type { FeedbackPrompt } from './feedback'
import { sendValue } from './useFeedbackForm'
import FormattedText from './FormattedText'
import ArenaPromptShell from './arena/ArenaPromptShell'
import Icon from '../ui/Icon'
import { useTranslation, dynamicT } from '../i18n'
import { localizeOptionLabel, localizeServerMessage } from './serverMessageTranslation'
import './VotingDialog.css'

interface VotingDialogProps {
  prompt: FeedbackPrompt
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
  busy: boolean
}

export default function VotingDialog({ prompt, send, busy }: VotingDialogProps) {
  const { t } = useTranslation()
  const choose = (value: string) => {
    void send(() => sendValue(prompt, value), t('errors', 'send_failed_vote'))
  }

  const left = prompt.options[0]
  const right = prompt.options[1]
  const hasTwo = prompt.options.length === 2 && left && right
  const stepMatch = /step\s+(\d+)\s+of\s+(\d+)/i.exec(prompt.message)
  const stepLabel = stepMatch
    ? ` — ${t('dialogs', 'voting_step', { count: stepMatch[1], total: stepMatch[2] })}`
    : ''

  return (
    <div className="arena-voting">
      <ArenaPromptShell
        title={<><FormattedText text={prompt.title} />{stepLabel}</>}
        instruction={<FormattedText text={localizeServerMessage(prompt.message, dynamicT(t))} />}
        backdropClassName="voting-backdrop"
        dialogClassName="voting-dialog"
        testId="voting-prompt"
        describedBy="voting-hint"
        footer={<div className="voting-hint" id="voting-hint">{t('dialogs', 'voting_hint')}</div>}
      >
        <section className="arena-prompt-zone arena-voting-zone">
          {hasTwo ? (
            <div className="voting-options">
              <button
                type="button"
                className="voting-btn voting-left"
                disabled={busy}
                onClick={() => choose(left.value)}
              >
                <span className="voting-btn-icon"><Icon name="check" size={22} /></span>
                <span className="voting-btn-label"><FormattedText text={localizeOptionLabel(left.label, dynamicT(t))} /></span>
              </button>
              <span className="voting-vs">VS</span>
              <button
                type="button"
                className="voting-btn voting-right"
                disabled={busy}
                onClick={() => choose(right.value)}
              >
                <span className="voting-btn-icon"><Icon name="circle" size={20} /></span>
                <span className="voting-btn-label"><FormattedText text={localizeOptionLabel(right.label, dynamicT(t))} /></span>
              </button>
            </div>
          ) : (
            <div className="voting-options voting-many">
              {prompt.options.map((opt) => (
                <button
                  type="button"
                  key={opt.id}
                  className="voting-btn"
                  disabled={busy}
                  onClick={() => choose(opt.value)}
                >
                  <span className="voting-btn-label"><FormattedText text={localizeOptionLabel(opt.label, dynamicT(t))} /></span>
                </button>
              ))}
            </div>
          )}
        </section>
      </ArenaPromptShell>
    </div>
  )
}
