import { useEffect, useState } from 'react'
import Button from '../../ui/Button'
import Checkbox from '../../ui/Checkbox'
import FormattedText from '../FormattedText'
import { DockPrompt, OrderPrompt, PromptAction } from '../GameDock'
import { PromptActionKey, PromptSecondKey } from './PromptKeys'
import { useTranslation, dynamicT } from '../../i18n'
import { getState } from '../../state/state'
import { setSetting } from '../../state/store'
import { addAutoAnswer } from '../autoAnswers'
import { isPlainBooleanAsk } from '../handPick'
import { localizeOptionLabel, localizeServerMessage } from '../serverMessageTranslation'
import type { UseFeedbackForm } from '../useFeedbackForm'
import './GenericDialog.css'
import './promptBars.css'

/** Where a question stops being a question and starts being the ability's text (PRM-18). */
const ASK_ORDER_MAX_CHARS = 120

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
  const message = localizeServerMessage(prompt.message, dynamicT(t))

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

  /* PRM-19: the answers are what this prompt asks for, so they take the corner the priority button
     would otherwise fill with "Loading…": the first one on the big key, the second on the small one
     above it, and anything beyond those two (never in a plain yes/no) stays listed in the bar. */
  const [first, second, ...rest] = prompt.options

  /* PRM-18: there is always a question, and it is read across the board like every other order.
     What the server sends as the message is sometimes the ability's whole rules text (it echoes the
     trigger it is asking about, which the stack already shows with that text); a paragraph of it in
     the order's display face would cover the board, so there the question is the one this prompt
     really asks — whether to use that source — and the text itself is left to the stack. A question
     that does not name its source says it after a dot, the way a target's order does. */
  const source = prompt.sourceName ?? prompt.title ?? null
  const shortAsk = message.length <= ASK_ORDER_MAX_CHARS ? message : null
  const namesSource = !!source && !!shortAsk && shortAsk.toLowerCase().includes(source.toLowerCase())
  const orderText = shortAsk
    ? (source && !namesSource ? `${shortAsk} · ${source}` : shortAsk)
    : source
      ? t('game', 'ask_use_source', { name: source })
      : message

  return (
    <>
    {orderText && (
      <OrderPrompt>
        <span className="board-order" data-testid="board-order">
          <FormattedText text={orderText} />
        </span>
      </OrderPrompt>
    )}
    <PromptAction>
      {first && (
        <PromptActionKey
          tone="done"
          label={<FormattedText text={localizeOptionLabel(first.label, dynamicT(t))} />}
          shortcut="1"
          disabled={busy}
          onClick={() => choose(first)}
        />
      )}
    </PromptAction>
    <DockPrompt>
      <div
        className="action-prompt-bar ask-prompt-bar is-keys-only"
        role="group"
        aria-label={orderText}
        onKeyDown={onOptionsKeyDown}
      >
        {rest.length > 0 && (
          <div className="feedback-options feedback-options-wrap">
            <div className="feedback-options-grid compact-grid">
              {rest.map((option, idx) => (
                <Button
                  key={option.id}
                  variant="ghost"
                  className="feedback-choice-card"
                  disabled={busy}
                  aria-keyshortcuts={String(idx + 3)}
                  onClick={() => choose(option)}
                >
                  <span className="choice-number">{idx + 3}</span>
                  <span className="choice-text"><FormattedText text={localizeOptionLabel(option.label, dynamicT(t))} /></span>
                </Button>
              ))}
            </div>
          </div>
        )}
        {rememberable && (
          <Checkbox
            className="feedback-remember-answer"
            checked={rememberAnswer}
            disabled={busy}
            onChange={setRememberAnswer}
            label={t('game', 'auto_answer_remember')}
          />
        )}
        <div className="action-prompt-actions">
          {second && (
            <PromptSecondKey
              tone="deny"
              label={<FormattedText text={localizeOptionLabel(second.label, dynamicT(t))} />}
              shortcut="2"
              disabled={busy}
              onClick={() => choose(second)}
            />
          )}
        </div>
      </div>
    </DockPrompt>
    </>
  )
}
