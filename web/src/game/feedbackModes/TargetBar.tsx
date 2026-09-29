import FormattedText from '../FormattedText'
import Button from '../../ui/Button'
import IconButton from '../../ui/IconButton'
import Icon, { type IconName } from '../../ui/Icon'
import { useTranslation } from '../../i18n'
import { localizeServerMessage } from '../serverMessageTranslation'
import type { UseFeedbackForm } from '../useFeedbackForm'
import { stripTargetProgress, targetProgressLabel } from '../feedback'
import { DockPrompt } from '../GameDock'
import './promptBars.css'

export default function TargetBar({ form, onExpand }: { form: UseFeedbackForm; onExpand?: () => void }) {
  const { t } = useTranslation()
  const { prompt, busy, finishOptionalTarget } = form
  if (!prompt) return null
  const isDiscard = /descart|discard/i.test(prompt.message)
  const titleText = prompt.isStartingPlayer
    ? t('game', 'who_starts')
    : isDiscard
      ? t('game', 'choose_discard')
      : prompt.isLibraryOrderPick
        ? t('game', 'library_order_title')
        : (prompt.sourceName ?? t('game', 'choose_target'))
  const localizedMessage = localizeServerMessage(stripTargetProgress(prompt.message), t as any)
  const hintText = prompt.isStartingPlayer
    ? t('game', 'starting_player_board_hint')
    : (localizedMessage ? <FormattedText text={localizedMessage} /> : t('game', 'targeting_hint'))
  const progressText = !prompt.isStartingPlayer && prompt.progress ? targetProgressLabel(prompt.progress, t as never) : null
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
            {progressText && <span className="action-prompt-progress" data-testid="target-progress"> · {progressText}</span>}
          </span>
        </div>
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
          {prompt.required === false && (
            <Button disabled={busy} onClick={finishOptionalTarget}>{t('game', 'targeting_finish')}</Button>
          )}
        </div>
      </div>
    </DockPrompt>
  )
}
