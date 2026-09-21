import FormattedText from '../FormattedText'
import Button from '../../ui/Button'
import Icon, { type IconName } from '../../ui/Icon'
import { useTranslation } from '../../i18n'
import { localizeServerMessage } from '../serverMessageTranslation'
import type { UseFeedbackForm } from '../useFeedbackForm'
import { DockPrompt } from '../GameDock'
import './promptBars.css'

export default function TargetBar({ form }: { form: UseFeedbackForm }) {
  const { t } = useTranslation()
  const { prompt, busy, finishOptionalTarget } = form
  if (!prompt) return null
  const chosenCount = prompt.chosenTargets?.length ?? 0
  const isDiscard = /descart|discard/i.test(prompt.message)
  const titleText = prompt.isStartingPlayer
    ? t('game', 'who_starts')
    : isDiscard
      ? t('game', 'choose_discard')
      : prompt.isLibraryOrderPick
        ? t('game', 'library_order_title')
        : (prompt.sourceName ?? t('game', 'choose_target'))
  const localizedMessage = localizeServerMessage(prompt.message, t as any)
  const hintText = prompt.isStartingPlayer
    ? t('game', 'starting_player_board_hint')
    : chosenCount > 0
      ? t('game', 'targeting_chosen', { count: chosenCount })
      : (localizedMessage ? <FormattedText text={localizedMessage} /> : t('game', 'targeting_hint'))
  const icon: IconName = prompt.isStartingPlayer ? 'dice' : isDiscard ? 'trash' : 'target'

  return (
    <DockPrompt>
      <div className="action-prompt-bar targeting-bar">
        <div className="action-prompt-info">
          <span className="action-prompt-title">
            <span className="action-prompt-icon" aria-hidden="true"><Icon name={icon} size={14} /></span>{' '}
            <FormattedText text={titleText} />
          </span>
          <span className="action-prompt-hint" role="status" aria-live="polite">
            {hintText}
          </span>
        </div>
        <div className="action-prompt-actions">
          {prompt.required === false && (
            <Button disabled={busy} onClick={finishOptionalTarget}>{t('game', 'targeting_finish')}</Button>
          )}
        </div>
      </div>
    </DockPrompt>
  )
}
