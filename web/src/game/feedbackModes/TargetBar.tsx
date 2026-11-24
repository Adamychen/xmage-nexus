import FormattedText from '../FormattedText'
import IconButton from '../../ui/IconButton'
import Icon from '../../ui/Icon'
import { useTranslation, dynamicT } from '../../i18n'
import { localizeServerMessage } from '../serverMessageTranslation'
import type { UseFeedbackForm } from '../useFeedbackForm'
import { stripTargetProgress, targetProgressLabel } from '../feedback'
import { DockPrompt, OrderPrompt, PromptAction } from '../GameDock'
import { usePromptCancelKey } from '../usePromptCancelKey'
import './promptBars.css'

export default function TargetBar({ form, onExpand }: { form: UseFeedbackForm; onExpand?: () => void }) {
  const { t } = useTranslation()
  const { prompt, busy, finishOptionalTarget } = form
  usePromptCancelKey(prompt?.cancelable && !busy ? finishOptionalTarget : null)
  if (!prompt) return null
  const isDiscard = /descart|discard/i.test(prompt.message)
  const titleText = prompt.isStartingPlayer
    ? t('game', 'who_starts')
    : isDiscard
      ? t('game', 'choose_discard')
      : prompt.isLibraryOrderPick
        ? t('game', 'library_order_title')
        : (prompt.sourceName ?? t('game', 'choose_target'))
  const localizedMessage = localizeServerMessage(stripTargetProgress(prompt.message), dynamicT(t))
  // PRM-18: la orden dice qué hacer, así que es la frase del servidor ("Elige un objetivo para
  // Rayo"); el nombre de la carta a secas no es una orden, es un sustantivo. Sin frase, el título.
  // Y cuando la frase no nombra a quien pregunta, se añade detrás: hace falta saber de quién es el
  // objetivo, y el nombre solo no basta como orden.
  const sourceName = prompt.isStartingPlayer ? null : (prompt.sourceName ?? null)
  const said = localizedMessage || titleText
  const namesSource = !!sourceName && said.toLowerCase().includes(sourceName.toLowerCase())
  const orderText = sourceName && !namesSource ? `${said} · ${sourceName}` : said
  const progressText = !prompt.isStartingPlayer && prompt.progress ? targetProgressLabel(prompt.progress, dynamicT(t)) : null
  // PRM-18: with the order on the board and no hint left, a required target with nothing to press
  // would leave an empty box in the corner. Nothing to say, nothing drawn.
  const dockHasSomething = !!progressText || !!onExpand

  return (
    <>
    <OrderPrompt>
      <span className="board-order" data-testid="board-order">
        <FormattedText text={orderText} />
      </span>
    </OrderPrompt>
    {prompt.required === false && (
      <PromptAction>
        {/* PRM-19: dejar el objetivo es la acción que responde, y va donde el jugador ya mira. */}
        <button
          type="button"
          className={`prompt-action-btn ${prompt.cancelable ? 'is-leave' : 'is-done'}`}
          data-testid="prompt-action"
          disabled={busy}
          onClick={finishOptionalTarget}
          aria-keyshortcuts={prompt.cancelable ? 'Escape' : undefined}
        >
          <span className="prompt-action-icon" aria-hidden="true"><Icon name={prompt.cancelable ? 'x' : 'check'} size={15} /></span>
          <span className="prompt-action-label">{prompt.cancelable ? t('game', 'targeting_cancel') : t('game', 'targeting_finish')}</span>
        </button>
      </PromptAction>
    )}
    {dockHasSomething && (
    <DockPrompt>
      <div className="action-prompt-bar targeting-bar">
        {/* TGT-1: how many of the targets are picked is a count, not a hint: it stays. */}
        {progressText && (
          <div className="action-prompt-info">
            <span className="action-prompt-progress" data-testid="target-progress">{progressText}</span>
          </div>
        )}
        <div className="action-prompt-actions">
          {onExpand && (
            <IconButton
              label={t('game', 'hand_pick_expand')}
              icon="maximize"
              size="sm"
              className="hand-pick-expand"
              data-testid="hand-pick-expand"
              disabled={busy}
              onClick={onExpand}
            />
          )}
        </div>
      </div>
    </DockPrompt>
    )}
    </>
  )
}
