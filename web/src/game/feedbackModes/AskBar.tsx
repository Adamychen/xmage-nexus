import { useEffect, useState } from 'react'
import Button from '../../ui/Button'
import Checkbox from '../../ui/Checkbox'
import FormattedText from '../FormattedText'
import Icon from '../../ui/Icon'
import { DockPrompt } from '../GameDock'
import { useTranslation } from '../../i18n'
import { getState } from '../../state/state'
import { setSetting } from '../../state/store'
import { addAutoAnswer } from '../autoAnswers'
import { isPlainBooleanAsk } from '../handPick'
import { localizeOptionLabel, localizeServerMessage } from '../serverMessageTranslation'
import type { UseFeedbackForm } from '../useFeedbackForm'
import './GenericDialog.css'
import './promptBars.css'

/**
 * Non-modal decision bar for plain yes/no asks (pay life, optional costs, ward,
 * cascade…): the board and hand stay visible and hoverable while the player
 * answers, instead of a full-screen backdrop hiding the game state.
 */
export default function AskBar({ form }: { form: UseFeedbackForm }) {
  const { t } = useTranslation()
  const { prompt, busy, selectOption } = form
  const [rememberAnswer, setRememberAnswer] = useState(false)

  useEffect(() => {
    setRememberAnswer(false)
  }, [prompt?.method, prompt?.gameId, prompt?.message])

  if (!prompt) return null

  const rememberable = isPlainBooleanAsk(prompt)
  const message = localizeServerMessage(prompt.message, t as never)

  const choose = (option: { id: string; label: string; value: string }) => {
    if (busy) return
    if (rememberAnswer && rememberable) {
      const rules = getState().settings.autoAnswers ?? []
      setSetting('autoAnswers', addAutoAnswer(rules, prompt.message, option.value === 'true', prompt.autoAnswerKey))
    }
    selectOption(option)
  }

  const onOptionsKeyDown = (e: React.KeyboardEvent) => {
    if (busy) return
    if (e.key >= '1' && e.key <= '9') {
      const option = prompt.options[Number(e.key) - 1]
      if (option) {
        e.preventDefault()
        choose(option)
      }
    }
  }

  return (
    <DockPrompt>
      <div
        className="action-prompt-bar ask-prompt-bar feedback-dialog"
        role="group"
        aria-labelledby="ask-bar-title"
      >
        <div className="action-prompt-info">
          <span className="action-prompt-title" id="ask-bar-title">
            <span className="action-prompt-icon" aria-hidden="true"><Icon name="info" size={14} /></span>{' '}
            {t('game', 'feedback_kicker_confirm')}
          </span>
          {prompt.sourceName && (
            <span className="action-prompt-source" data-testid="ask-source">
              <FormattedText text={prompt.sourceName} />
            </span>
          )}
          {message && (
            <span className="action-prompt-msg" role="status" aria-live="polite">
              <FormattedText text={message} />
            </span>
          )}
        </div>
        <div className="feedback-options feedback-options-wrap">
          <div className="feedback-options-grid compact-grid" onKeyDown={onOptionsKeyDown}>
            {prompt.options.map((option, idx) => (
              <Button
                key={option.id}
                variant="ghost"
                className="feedback-choice-card"
                disabled={busy}
                aria-keyshortcuts={idx < 9 ? String(idx + 1) : undefined}
                onClick={() => choose(option)}
              >
                <span className="choice-number">{idx + 1}</span>
                <span className="choice-text"><FormattedText text={localizeOptionLabel(option.label, t as never)} /></span>
              </Button>
            ))}
          </div>
        </div>
        {rememberable && (
          <Checkbox
            className="feedback-remember-answer"
            checked={rememberAnswer}
            disabled={busy}
            onChange={setRememberAnswer}
            label={t('game', 'auto_answer_remember')}
          />
        )}
      </div>
    </DockPrompt>
  )
}
