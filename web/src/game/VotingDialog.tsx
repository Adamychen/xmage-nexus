import * as cmds from '../net/commands'
import type { FeedbackPrompt } from './feedback'
import FormattedText from './FormattedText'
import './VotingDialog.css'

interface VotingDialogProps {
  prompt: FeedbackPrompt
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
  busy: boolean
}

export default function VotingDialog({ prompt, send, busy }: VotingDialogProps) {
  const choose = (value: string) => {
    const isBool = prompt.mode === 'boolean'
    void send(
      () => (isBool ? cmds.sendPlayerBoolean(value === 'true', prompt.gameId) : cmds.sendPlayerString(value, prompt.gameId)),
      'No se pudo enviar el voto',
    )
  }

  const left = prompt.options[0]
  const right = prompt.options[1]
  const hasTwo = prompt.options.length === 2 && left && right
  const stepMatch = /step\s+(\d+)\s+of\s+(\d+)/i.exec(prompt.message)

  return (
    <div className="voting-backdrop" role="presentation">
      <section className="voting-dialog" role="dialog" aria-modal="true" aria-labelledby="voting-title">
        <div className="voting-kicker">🗳️ VOTACIÓN {stepMatch ? `${stepMatch[1]}/${stepMatch[2]}` : ''}</div>
        <h2 id="voting-title"><FormattedText text={prompt.title} /></h2>
        <p className="voting-msg"><FormattedText text={prompt.message} /></p>
        {hasTwo ? (
          <div className="voting-options">
            <button
              className="voting-btn voting-left"
              disabled={busy}
              onClick={() => choose(left.value)}
            >
              <span className="voting-btn-icon">✅</span>
              <span className="voting-btn-label"><FormattedText text={left.label} /></span>
            </button>
            <span className="voting-vs">VS</span>
            <button
              className="voting-btn voting-right"
              disabled={busy}
              onClick={() => choose(right.value)}
            >
              <span className="voting-btn-icon">🔵</span>
              <span className="voting-btn-label"><FormattedText text={right.label} /></span>
            </button>
          </div>
        ) : (
          <div className="voting-options voting-many">
            {prompt.options.map((opt) => (
              <button key={opt.id} className="voting-btn" disabled={busy} onClick={() => choose(opt.value)}>
                <FormattedText text={opt.label} />
              </button>
            ))}
          </div>
        )}
        <div className="voting-hint">Tu voto es secreto hasta que todos hayan elegido</div>
      </section>
    </div>
  )
}
