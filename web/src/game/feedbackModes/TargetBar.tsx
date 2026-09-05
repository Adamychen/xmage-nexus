import FormattedText from '../FormattedText'
import Icon, { type IconName } from '../../ui/Icon'
import { useTranslation } from '../../i18n'
import { localizeServerMessage } from '../serverMessageTranslation'
import type { UseFeedbackForm } from '../useFeedbackForm'

export default function TargetBar({ form }: { form: UseFeedbackForm }) {
  const { t } = useTranslation()
  const { prompt, busy, cancel, finishOptionalTarget } = form
  if (!prompt) return null
  const chosenCount = prompt.chosenTargets?.length ?? 0
  const isDiscard = /descart|discard/i.test(prompt.message)
  const titleText = prompt.isStartingPlayer
    ? t('game', 'who_starts')
    : isDiscard
      ? t('game', 'choose_discard')
      : (prompt.sourceName ?? t('game', 'choose_target'))
  const localizedMessage = localizeServerMessage(prompt.message, t as any)
  const hintText = prompt.isStartingPlayer
    ? t('game', 'starting_player_board_hint')
    : chosenCount > 0
      ? t('game', 'targeting_chosen', { count: chosenCount })
      : (localizedMessage ? <FormattedText text={localizedMessage} /> : t('game', 'targeting_hint'))
  const icon: IconName = prompt.isStartingPlayer ? 'dice' : isDiscard ? 'trash' : 'target'

  return (
    <div className="action-prompt-bar targeting-bar">
      <div className="action-prompt-info">
        <span className="action-prompt-title">
          <span className="action-prompt-icon" aria-hidden="true"><Icon name={icon} size={14} /></span>{' '}
          <FormattedText text={titleText} />
        </span>
        <span className="action-prompt-hint">
          {hintText}
        </span>
      </div>
      <div className="action-prompt-actions">
        {prompt.required === false && (
          <button disabled={busy} onClick={finishOptionalTarget}>{t('game', 'targeting_finish')}</button>
        )}
        {!prompt.isStartingPlayer && (
          <button disabled={busy} onClick={cancel} className="cancel-btn">{t('game', 'targeting_cancel')}</button>
        )}
      </div>
    </div>
  )
}
