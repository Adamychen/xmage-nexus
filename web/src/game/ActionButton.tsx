import { useEffect, useRef, useState } from 'react'
import type { GameView } from '../net/types'
import type { FeedbackPrompt } from './feedback'
import { useTranslation } from '../i18n'
import PassMenu from './PassMenu'
import { activeSkipOf } from './skips'
import './ActionButton.css'

interface ActionButtonProps {
  game: GameView | null
  feedback: FeedbackPrompt | null
  gameId: string | null
  canPass: boolean
  onPass: () => void
  onSkip: (action: string) => void
  busy?: boolean
}

export default function ActionButton({
  game,
  feedback,
  gameId: _gameId,
  canPass,
  onPass,
  onSkip,
  busy = false,
}: ActionButtonProps) {
  const { t } = useTranslation()
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const me = game?.players?.find((p) => p.controlled)
  const opp = game?.players?.find((p) => !p.controlled)
  const stackItems = Object.keys(game?.stack ?? {}).length
  const activeSkip = activeSkipOf(me)

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

  if (activeSkip && modeClass !== 'action-waiting') {
    sublabel = t('game', 'skip_active_to', { dest: t('game', activeSkip.labelKey) })
  }

  const isInteractive = canPass && !busy && modeClass !== 'action-waiting'

  return (
    <div className="action-button-container" ref={containerRef}>
      <div className={`big-action-split ${activeSkip ? 'has-skip' : ''}`}>
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
