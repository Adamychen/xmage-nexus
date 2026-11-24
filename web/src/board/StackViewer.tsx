import { useState } from 'react'
import type { CardView, GameView, PlayerView } from '../net/types'
import { useStore } from '../state/store'
import { plural, useTranslation } from '../i18n'
import FormattedText from '../game/FormattedText'
import Icon from '../ui/Icon'
import { clickableProps } from '../ui/clickable'
import ZoneViewer from './ZoneViewer'
import CardSlot from './CardSlot'
import { StackCardFace } from './StackCardFace'
import { useStackText } from './StackBubble'
import { findCardViewInGame } from './boardShared'
import { getControllerInfo, isStackAbility, stackTargetIds } from './stackEntries'
import { seatColorVar, seatIndexOf } from './seatColor'

interface StackViewerProps {
  entries: [string, CardView][]
  players?: PlayerView[]
  myPlayerId?: string | null
  targetIds: Set<string>
  onCardClick?: (id: string) => void
  onClose: () => void
}

type Target =
  | { kind: 'stack'; id: string; position: number; card: CardView }
  | { kind: 'card'; id: string; card: CardView }
  | { kind: 'player'; id: string; player: PlayerView }

function resolveTargets(card: CardView, entries: [string, CardView][], game: GameView | null): Target[] {
  return stackTargetIds(card).flatMap((id): Target[] => {
    const at = entries.findIndex(([entryId]) => entryId === id)
    if (at >= 0) return [{ kind: 'stack', id, position: at + 1, card: entries[at][1] }]
    const player = game?.players?.find((p) => p.playerId === id)
    if (player) return [{ kind: 'player', id, player }]
    const hit = findCardViewInGame(game, id)
    return hit ? [{ kind: 'card', id, card: hit.view as CardView }] : []
  })
}

function ReadPanel({ card, targets, players }: { card: CardView; targets: Target[]; players?: PlayerView[] }) {
  const { t } = useTranslation()
  const { name, lines, xLine } = useStackText(card)
  return (
    <aside className="stack-viewer-aside" data-testid="stack-viewer-aside" aria-live="polite">
      <h4 className="stack-viewer-aside-name">
        {isStackAbility(card) && <Icon name="zap" size={12} />}
        {name}
      </h4>
      {(lines.length > 0 || xLine) && (
        <div className="stack-viewer-aside-text">
          {lines.map((line, i) => <p key={i}><FormattedText text={line} cardName={name} /></p>)}
          {xLine && <p className="stack-bubble-x">{xLine}</p>}
        </div>
      )}
      {targets.length > 0 && (
        <div className="stack-viewer-targets">
          <span className="stack-viewer-targets-label">{t('game', 'stack_viewer_targets')}</span>
          {targets.map((target) => (
            <div key={target.id} className={`stack-viewer-target is-${target.kind}`} data-testid="stack-viewer-target">
              {target.kind === 'card' && (
                <CardSlot cardId={target.id} card={target.card} className="stack-viewer-target-card" />
              )}
              {target.kind === 'stack' && (
                <span className="stack-viewer-target-chip">#{target.position} · {t('game', 'stack_viewer_on_stack')}</span>
              )}
              {target.kind === 'player' && (
                <span
                  className="stack-viewer-target-chip is-player"
                  style={{ ['--seat' as string]: seatColorVar(seatIndexOf(players, target.player.playerId)) }}
                >
                  <Icon name="user" size={12} /> {target.player.name}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  )
}

/**
 * STK-11, STK-12: the whole stack in the zone viewer, laid out like the cascade (the object about to
 * resolve at the right, on top), with what the object being read does and aims at beside the fan.
 */
export default function StackViewer({ entries, players, myPlayerId, targetIds, onCardClick, onClose }: StackViewerProps) {
  const { t } = useTranslation()
  const cardRender = useStore((s) => s.settings.cardRender)
  const game = useStore((s) => s.game)
  const [readId, setReadId] = useState<string | null>(null)
  const reading = entries.find(([id]) => id === readId) ?? entries[0]
  const targets = reading ? resolveTargets(reading[1], entries, game) : []
  const targetedOnStack = new Set(targets.filter((target) => target.kind === 'stack').map((target) => target.id))

  return (
    <ZoneViewer
      title={t('game', 'pile_stack')}
      count={`${entries.length} ${plural('dialogs', 'viewer_card', entries.length)}`}
      className="stack-viewer"
      testId="stack-viewer"
      itemCount={entries.length}
      startAtEnd
      aside={reading && <ReadPanel card={reading[1]} targets={targets} players={players} />}
      onClose={onClose}
    >
      {[...entries].reverse().map(([id, card], i) => {
        const index = entries.length - 1 - i
        const ctrl = getControllerInfo(card, id, players, myPlayerId, t)
        const targetable = targetIds.has(id)
        const onClick = targetable && onCardClick ? () => onCardClick(id) : undefined
        return (
          <div
            key={id}
            className={[
              'pile-card-wrapper zone-fan-item stack-viewer-item',
              index === 0 ? 'is-top-card' : '',
              reading?.[0] === id ? 'is-read' : '',
              targetedOnStack.has(id) ? 'is-targeted' : '',
            ].filter(Boolean).join(' ')}
            data-card-id={id}
            onMouseEnter={() => setReadId(id)}
            onFocus={() => setReadId(id)}
          >
            <div className={`pile-position-badge${index === 0 ? ' top-badge' : ''}`}>
              {index === 0 ? <><Icon name="star" size={10} /> #1</> : `#${index + 1}`}
              <span
                className={`stack-viewer-ctrl ${ctrl.isMe ? 'is-me' : 'is-opp'}`}
                style={{ ['--seat' as string]: seatColorVar(seatIndexOf(players, ctrl.id)) }}
              >
                {isStackAbility(card) && <Icon name="zap" size={10} />}
                {ctrl.name}
              </span>
            </div>
            <div
              className={`pile-card stack-viewer-card${targetable ? ' targetable' : ''}`}
              onClick={onClick}
              {...clickableProps(onClick)}
            >
              <StackCardFace card={card} rendered={cardRender === 'rendered'} />
            </div>
          </div>
        )
      })}
    </ZoneViewer>
  )
}
