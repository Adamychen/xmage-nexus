import type { GameView } from '../net/types'
import type { FeedbackPrompt } from './feedback'
import { useTranslation } from '../i18n'
import './PriorityOrb.css'

interface PriorityOrbProps {
  game: GameView | null
  feedback: FeedbackPrompt | null
  canPass: boolean
  onPass: () => void
  busy?: boolean
}

export default function PriorityOrb({
  game,
  feedback,
  canPass,
  onPass,
  busy = false,
}: PriorityOrbProps) {
  const { t } = useTranslation()
  const stackItems = Object.keys(game?.stack ?? {}).length

  const waiting = !canPass || busy
  let label: string
  if (busy) label = t('common', 'loading')
  else if (waiting) label = t('common', 'loading')
  else if (stackItems > 0) label = t('game', 'resolve')
  else if (feedback?.mode === 'combat') label = t('game', 'pass_priority')
  else label = t('game', 'pass_priority')

  const isResolve = !waiting && stackItems > 0

  return (
    <button
      type="button"
      className={`priority-orb ${waiting ? 'waiting' : isResolve ? 'resolve' : 'active'}`}
      data-testid="priority-orb"
      disabled={waiting}
      onClick={onPass}
      title={t('game', 'action_main_hint')}
    >
      <span className="priority-orb-ring" aria-hidden="true" />
      <span className="priority-orb-label">{label}</span>
      {stackItems > 0 && !waiting && <span className="priority-orb-count">{stackItems}</span>}
    </button>
  )
}
