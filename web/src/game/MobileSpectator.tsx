import { useState } from 'react'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import Tabs from '../ui/Tabs'
import EmptyState from '../ui/EmptyState'
import { useGame } from '../state/store'
import { useTranslation } from '../i18n'
import type { PlayerView } from '../net/types'
import ActionFeed from './ActionFeed'
import GameChat from './GameChat'
import GameMenu from './GameMenu'
import { PhaseName } from './PhaseBar'
import './MobileSpectator.css'

type Pane = 'stack' | 'log' | 'chat'

function pileSize(pile: unknown): number {
  return pile && typeof pile === 'object' ? Object.keys(pile).length : 0
}

function PlayerRow({ player, activeId }: { player: PlayerView; activeId: string | null | undefined }) {
  const { t } = useTranslation()
  const active = player.playerId === activeId
  const gone = player.hasLeft || player.life <= 0
  return (
    <li
      className={`mspec-player${active ? ' is-active' : ''}${player.hasPriority ? ' has-priority' : ''}${gone ? ' is-gone' : ''}`}
      data-testid="mspec-player"
    >
      <span className="mspec-name">{player.name}</span>
      <span className="mspec-life" aria-label={t('game', 'life')}>{player.life}</span>
      <span className="mspec-counts">
        <span title={t('game', 'hand')}>
          <Icon name="hand" size={12} /> {player.handCount}
        </span>
        <span title={t('game', 'library')}>
          <Icon name="layers" size={12} /> {player.libraryCount}
        </span>
        <span title={t('game', 'graveyard')}>
          <Icon name="trash" size={12} /> {pileSize(player.graveyard)}
        </span>
        <span title={t('game', 'spectator_permanents')}>
          <Icon name="castle" size={12} /> {pileSize(player.battlefield)}
        </span>
      </span>
    </li>
  )
}

export default function MobileSpectator({ onFullBoard }: { onFullBoard: () => void }) {
  const { t } = useTranslation()
  const game = useGame()
  const [pane, setPane] = useState<Pane>('log')
  const players = game?.players ?? []
  const stack = Object.values(game?.stack ?? {})

  return (
    <div className="mspec" data-testid="mobile-spectator">
      <header className="mspec-head">
        <div className="mspec-turn" data-testid="mspec-turn">
          <span>
            {t('game', 'turn')} {game?.turn ?? 0}
          </span>
          <PhaseName step={game?.step ?? ''} />
        </div>
        <div className="mspec-head-actions">
          <Button size="sm" variant="ghost" data-testid="mspec-full" onClick={onFullBoard}>
            <Icon name="maximize" size={12} /> {t('game', 'spectator_full_board')}
          </Button>
          <GameMenu />
        </div>
      </header>

      <ul className="mspec-players">
        {players.map((p) => (
          <PlayerRow key={p.playerId} player={p} activeId={game?.activePlayerId} />
        ))}
      </ul>

      <Tabs
        variant="segmented"
        size="sm"
        label={t('game', 'spectator_panels')}
        value={pane}
        onChange={setPane}
        items={[
          { id: 'stack', label: `${t('game', 'stack')} (${stack.length})`, testId: 'mspec-tab-stack' },
          { id: 'log', label: t('game', 'tab_log'), testId: 'mspec-tab-log' },
          { id: 'chat', label: t('game', 'tab_chat'), testId: 'mspec-tab-chat' },
        ]}
      />

      <div className="mspec-pane" data-testid={`mspec-pane-${pane}`}>
        {pane === 'stack' ? (
          stack.length === 0 ? (
            <EmptyState title={t('game', 'spectator_stack_empty')} />
          ) : (
            <ol className="mspec-stack">
              {stack.map((card, index) => (
                <li key={card.id ?? index}>
                  <strong>{card.name}</strong>
                  {card.controllerName ? <span> · {card.controllerName}</span> : null}
                </li>
              ))}
            </ol>
          )
        ) : pane === 'log' ? (
          <ActionFeed />
        ) : (
          <GameChat />
        )}
      </div>
    </div>
  )
}
