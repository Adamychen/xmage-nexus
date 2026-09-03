import type { GameView } from '../net/types'
import type { FeedbackPrompt } from './feedback'
import { useTranslation } from '../i18n'
import './ActionButton.css'

interface ActionButtonProps {
  game: GameView | null
  feedback: FeedbackPrompt | null
  gameId: string | null
  canPass: boolean
  onPass: () => void
  busy?: boolean
}

export default function ActionButton({
  game,
  feedback,
  canPass,
  onPass,
  busy = false,
}: ActionButtonProps) {
  const { t } = useTranslation()
  const me = game?.players?.find((p) => p.controlled)
  const opp = game?.players?.find((p) => !p.controlled)
  const stackItems = Object.keys(game?.stack ?? {}).length

  let label = t('game', 'pass_priority')
  let sublabel: string | null = null
  let modeClass = 'action-pass'
  let modeIcon = '▶️'

  if (stackItems > 0) {
    label = t('game', 'resolve')
    sublabel = `${t('game', 'stack')} (${stackItems})`
    modeClass = 'action-resolve'
    modeIcon = '⚡'
  } else if (feedback?.mode === 'combat') {
    const isAtk = feedback.title.toLowerCase().includes('atacan') || feedback.title.toLowerCase().includes('attack')
    label = isAtk
      ? t('game', 'confirm_attackers')
      : t('game', 'confirm_blockers')
    modeClass = 'action-combat'
    modeIcon = '⚔️'
  } else if (me?.hasPriority) {
    label = t('game', 'pass_priority')
    sublabel = me.isActive ? t('game', 'turn') : t('game', 'priority')
    modeClass = 'action-priority'
    modeIcon = '▶️'
  } else if (!me?.hasPriority && opp?.hasPriority) {
    label = t('game', 'waiting_opponent')
    sublabel = opp.name
    modeClass = 'action-waiting'
    modeIcon = '⏳'
  } else if (!canPass) {
    label = `${t('common', 'loading')}`
    modeClass = 'action-waiting'
    modeIcon = '⏳'
  }

  const isInteractive = canPass && !busy && modeClass !== 'action-waiting'

  return (
    <div className="action-button-container">
      <button
        type="button"
        className={`big-action-btn ${modeClass} ${isInteractive ? 'interactive' : 'disabled'}`}
        disabled={!isInteractive}
        onClick={onPass}
        title={t('game', 'action_main_hint')}
      >
        <span className="action-btn-glow" aria-hidden="true" />
        <div className="action-btn-content">
          <span className="action-btn-label">
            <span className="action-btn-icon" aria-hidden="true">{modeIcon}</span>{' '}
            {busy ? t('game', 'action_sending') : label}
          </span>
          {sublabel && !busy && <span className="action-btn-sublabel">{sublabel}</span>}
        </div>
        <kbd className="action-btn-shortcut">{t('wiki', 'shortcuts_space').split(':')[0]}</kbd>
      </button>
    </div>
  )
}
