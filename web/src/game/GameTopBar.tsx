import type { ReactNode } from 'react'
import { useTranslation } from '../i18n'
import type { GameView } from '../net/types'
import { PhaseName } from './PhaseBar'
import { dayNightStateOf } from '../board/dayNight'
import Icon from '../ui/Icon'
import { useChangeFlag } from './useChangeFlag'
import './GameTopBar.css'

interface GameTopBarProps {
  game: GameView | null
  center: ReactNode
  menu: ReactNode
  toggles: ReactNode
}

export default function GameTopBar({ game, center, menu, toggles }: GameTopBarProps) {
  const { t } = useTranslation()
  const dayNight = dayNightStateOf(game)
  const [turnGlow, clearTurnGlow] = useChangeFlag(game?.turn)
  const [skyTurn, clearSkyTurn] = useChangeFlag(dayNight?.isNight ?? null, 1400)
  const skyTurning = skyTurn && !!dayNight
  return (
    <div className="game-topbar" data-testid="game-topbar">
      {skyTurning && (
        <span
          key={dayNight.isNight ? 'night' : 'day'}
          className={`game-topbar-sky ${dayNight.isNight ? 'to-night' : 'to-day'}`}
          data-testid="topbar-sky"
          aria-hidden="true"
          onAnimationEnd={clearSkyTurn}
        />
      )}
      <div className="game-topbar-left">
        {menu}
        {game && (
          <div className="game-topbar-turn" data-testid="game-status">
            <span
              className={`game-topbar-turn-num${turnGlow ? ' turn-glow' : ''}`}
              onAnimationEnd={turnGlow ? clearTurnGlow : undefined}
            >
              {t('game', 'turn')} {game.turn}
            </span>
            <PhaseName step={game.step ?? ''} />
            {dayNight && (
              <span className={`game-topbar-daynight ${dayNight.isNight ? 'is-night' : 'is-day'}${skyTurning ? ' is-turning' : ''}`} data-testid="topbar-daynight">
                <Icon name={dayNight.isNight ? 'moon' : 'sun'} size={12} />
                {dayNight.isNight ? t('game', 'mechanics_night') : t('game', 'mechanics_day')}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="game-topbar-center">{center}</div>
      <div className="game-topbar-right">{toggles}</div>
    </div>
  )
}
