import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { GameView } from '../net/types'
import type { FeedbackPrompt } from './feedback'
import { useTranslation } from '../i18n'
import PassMenu from './PassMenu'
import Icon, { type IconName } from '../ui/Icon'
import { activeSkipOf } from './skips'
import { controlInfo } from '../state/control'
import { useStore } from '../state/store'
import { formatTimer, useTickingTimer } from '../utils/timer'
import { LONG_WAIT_SECS, formatElapsed, useElapsedSeconds, waitingState, type WaitingState } from './waitingState'
import './ActionButton.css'

interface ActionButtonProps {
  game: GameView | null
  feedback: FeedbackPrompt | null
  gameId: string | null
  canPass: boolean
  onPass: () => void
  onSkip: (action: string) => void
  busy?: boolean
  variant?: 'bar' | 'dial'
}

const SHORTCUT_HINT = /\s*[(（][^)）]*[)）]\s*$/
const NAME_SLOT = '\u0000'

function NamedLabel({ template, name }: { template: string; name: string }) {
  const at = template.indexOf(NAME_SLOT)
  if (!name || at < 0) return <>{template.replace(NAME_SLOT, name)}</>
  return (
    <>
      {template.slice(0, at)}
      <span className="action-btn-name" data-testid="action-btn-name">{name}</span>
      {template.slice(at + NAME_SLOT.length)}
    </>
  )
}

function WaitingClock({ waiting }: { waiting: WaitingState | null }) {
  const { t } = useTranslation()
  const elapsed = useElapsedSeconds(waiting?.key ?? null)
  const timeLeft = useTickingTimer(waiting?.timeLeftSecs ?? 0, waiting?.timeLeftSecs != null)
  if (!waiting) return null
  const long = elapsed >= LONG_WAIT_SECS
  return (
    <span
      className={`action-btn-sublabel action-waiting-clock ${long ? 'is-long' : ''}`}
      data-testid="waiting-clock"
      data-elapsed={elapsed}
      title={long ? t('game', 'waiting_long_hint') : undefined}
    >
      <span className="action-waiting-thinking">{t('game', 'waiting_thinking', { time: formatElapsed(elapsed) })}</span>
      {waiting.timeLeftSecs != null && (
        <span className="action-waiting-left">
          <span className="action-waiting-sep">{' · '}</span>
          <Icon name="timer" size={10} /> {t('game', 'waiting_time_left', { time: formatTimer(timeLeft) })}
        </span>
      )}
    </span>
  )
}

export default function ActionButton({
  game,
  feedback,
  gameId: _gameId,
  canPass,
  onPass,
  onSkip,
  busy = false,
  variant = 'bar',
}: ActionButtonProps) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const me = game?.players?.find((p) => p.controlled)
  const waitingFor = useStore((s) => s.waitingFor)
  const waiting = waitingState(game, feedback, waitingFor)
  const stackItems = Object.keys(game?.stack ?? {}).length
  const activeSkip = activeSkipOf(me)
  const control = controlInfo(game)

  useEffect(() => {
    if (!menuOpen) return
    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  const passLabel = t('game', 'pass_priority').replace(SHORTCUT_HINT, '')
  let label = passLabel
  let labelNode: ReactNode = null
  let sublabel: string | null = null
  let modeClass = 'action-pass'
  let modeIcon: IconName = 'play'

  if (waiting?.preGame) {
    label = waiting.name ? t('game', 'mulligan_waiting_for', { name: waiting.name }) : t('game', 'mulligan_waiting_others')
    if (waiting.name) labelNode = <NamedLabel template={t('game', 'mulligan_waiting_for', { name: NAME_SLOT })} name={waiting.name} />
    modeClass = 'action-waiting'
    modeIcon = 'hourglass'
  } else if (waiting) {
    label = t('game', 'waiting_for', { name: waiting.name })
    labelNode = <NamedLabel template={t('game', 'waiting_for', { name: NAME_SLOT })} name={waiting.name} />
    modeClass = 'action-waiting'
    modeIcon = 'hourglass'
  } else if (stackItems > 0) {
    label = t('game', 'resolve')
    sublabel = `${t('game', 'stack')} (${stackItems})`
    modeClass = 'action-resolve'
    modeIcon = 'zap'
  } else if (feedback?.mode === 'combat') {
    const isAtk = feedback.isDeclaringAttackers === true
    label = isAtk
      ? t('game', 'confirm_attackers')
      : t('game', 'confirm_blockers')
    modeClass = 'action-combat'
    modeIcon = 'swords'
  } else if (me?.hasPriority) {
    label = passLabel
    // The sublabel is the only place that says whose turn it is. "Priority" on
    // its own does not separate "I am playing" from "I am answering", which is
    // exactly what the reporter could not tell apart (issue #12).
    sublabel = me.isActive ? t('game', 'your_turn') : t('game', 'opponent_turn')
    modeClass = 'action-priority'
    modeIcon = 'play'
  } else if (control.priorityIsControlled) {
    label = passLabel
    sublabel = t('game', 'controlling_turn', { name: control.actingName ?? '' })
    modeClass = 'action-priority'
    modeIcon = 'play'
  } else if (!canPass) {
    label = `${t('common', 'loading')}`
    modeClass = 'action-waiting'
    modeIcon = 'hourglass'
  }

  if (activeSkip && modeClass !== 'action-waiting') {
    sublabel = t('game', 'skip_active_to', { dest: t('game', activeSkip.labelKey) })
  }

  const isInteractive = canPass && !busy && modeClass !== 'action-waiting'

  return (
    <div className={`action-button-container${variant === 'dial' ? ' action-button-container--dial' : ''}`} ref={containerRef}>
      <div className={`big-action-split ${activeSkip ? 'has-skip' : ''}`}>
        <button
          type="button"
          className={`big-action-btn ${modeClass} ${isInteractive ? 'interactive' : 'disabled'}`}
          disabled={!isInteractive}
          onClick={onPass}
          title={waiting?.preGame ? `${label}. ${t('game', 'mulligan_waiting_hint')}` : waiting ? label : t('game', 'action_main_hint')}
        >
          <span className="action-btn-glow" aria-hidden="true" />
          <div className="action-btn-content">
            <span className="action-btn-label">
              <span className="action-btn-icon" aria-hidden="true"><Icon name={modeIcon} size={15} /></span>{' '}
              {busy ? t('game', 'action_sending') : (labelNode ?? label)}
            </span>
            {sublabel && !busy && <span className="action-btn-sublabel">{sublabel}</span>}
            {waiting && !busy && <WaitingClock waiting={waiting} />}
          </div>
          <kbd className="action-btn-shortcut">{t('wiki', 'shortcuts_space').split(':')[0]}</kbd>
        </button>
        {!!me && (
          <button
            type="button"
            className={`big-action-toggle ${menuOpen ? 'is-open' : ''}`}
            data-testid="pass-split-toggle"
            title={t('game', 'pass_options')}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            ▾
          </button>
        )}
      </div>
      {menuOpen && (
        <PassMenu
          game={game}
          onSkip={(action) => {
            setMenuOpen(false)
            onSkip(action)
          }}
        />
      )}
    </div>
  )
}
