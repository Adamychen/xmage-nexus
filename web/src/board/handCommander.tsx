import type { CardView, PlayerView } from '../net/types'
import CardSlot from './CardSlot'
import CommanderMark from './CommanderMark'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import { useNarrowScreen } from '../game/useNarrowScreen'
import { parseCommandList } from './CommandZone'
import { commanderTax } from './commanders'
import './handCommander.css'

/**
 * BRD-32: the uncast commander (and companion) is drawn with the hand, as the card it is, because
 * that is where its owner looks for something to cast. It is drawn apart from the hand proper, so
 * it never reads as one more card drawn this game, and the command zone on the board keeps what is
 * not a card in a hand: the emblems, the planes and the dungeons.
 *
 * It follows the hand wherever the hand is drawn, the fan, the column or the row, because the
 * question it answers is the same in all three. A phone keeps the command zone on the board: the
 * hand there has no room to spare.
 */
export function useCommanderInHand(): boolean {
  return !useNarrowScreen()
}

export interface HandTrailingCard {
  id: string
  card: CardView
  /** Extra mana the next cast costs (commander tax); 0 for a companion or a first cast. */
  tax: number
  companion: boolean
}

export function useHandCommander(player: PlayerView | undefined, enabled: boolean, helperEmblems?: Record<string, CardView>): HandTrailingCard[] {
  const inHand = useCommanderInHand()
  if (!enabled || !player || !inHand) return []
  return parseCommandList(player.commandList, { ...(player.helperCards ?? {}), ...(helperEmblems ?? {}) })
    .filter((item) => item.isCommander || item.isCompanion)
    .map((item) => ({
      id: item.id,
      card: item.card,
      tax: item.isCompanion ? 0 : commanderTax(item.castCount),
      companion: !!item.isCompanion,
    }))
}

/**
 * The commander as the hand draws it: the card, ringed in gold so it is told apart from the cards
 * beside it, with its tax when casting it again costs more. The column and the row use it; the fan
 * draws its own, because there the card is also tilted and lifted with the rest.
 */
export function HandCommanderSlot({
  item,
  playable = false,
  target = false,
  onClick,
  onHover,
  className = '',
}: {
  item: HandTrailingCard
  playable?: boolean
  target?: boolean
  onClick?: (id: string) => void
  onHover?: (card: CardView | null, rect?: DOMRect) => void
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <div
      className={`hand-commander${className ? ` ${className}` : ''}`}
      data-testid="hand-trailing"
      data-trailing-id={item.id}
      onMouseEnter={onHover ? (e) => onHover(item.card, e.currentTarget.getBoundingClientRect()) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
    >
      <CardSlot
        cardId={item.id}
        card={item.card}
        onClick={onClick ? () => onClick(item.id) : undefined}
        isPlayable={playable}
        isTarget={target}
        className="hand-card hand-trailing-card"
      />
      {item.companion ? (
        <div className="companion-badge" title={t('board', 'zone_command')}>
          <Icon name="star" size={13} />
        </div>
      ) : (
        <div
          className="commander-badge"
          title={item.tax > 0 ? t('board', 'commander_tax', { tax: item.tax, count: item.tax / 2 }) : t('board', 'zone_command')}
          data-testid={item.tax > 0 ? 'commander-tax' : undefined}
          data-tax={item.tax > 0 ? item.tax : undefined}
        >
          <CommanderMark />
          {item.tax > 0 && <span className="commander-tax">{`+${item.tax}`}</span>}
        </div>
      )}
    </div>
  )
}
