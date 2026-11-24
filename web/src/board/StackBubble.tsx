import { useMemo } from 'react'
import type { CardView } from '../net/types'
import FormattedText from '../game/FormattedText'
import { useLocalizedCardName, useLocalizedCardText } from '../cards/cardLocalization'
import { stackCardText } from '../cards/frame/stackCardText'
import { useTranslation } from '../i18n'
import Icon from '../ui/Icon'
import { getControllerInfo, isCopyCard, isStackAbility } from './stackEntries'

type ControllerInfo = ReturnType<typeof getControllerInfo>

export type StackBubblePlacement = 'below' | 'inside'

interface StackBubbleProps {
  card: CardView
  ctrl: ControllerInfo
  /** How far back in the cascade the card being read lies: the tail points at it. */
  depth: number
  placement: StackBubblePlacement
  onEnter: () => void
  onLeave: () => void
}

/**
 * STK-10: what the object being read will do, in a bubble hanging from the cascade, always open: the
 * strip of chips the front card used to carry over its art heads the server's text.
 */
export default function StackBubble({ card, ctrl, depth, placement, onEnter, onLeave }: StackBubbleProps) {
  const { t } = useTranslation()
  const ability = isStackAbility(card)
  const copy = isCopyCard(card)
  const face = ability && card.sourceCard ? card.sourceCard : card
  const { text: localized } = useLocalizedCardText(face)
  const { displayName } = useLocalizedCardName(face)
  const { lines, xLine } = useMemo(() => stackCardText(card, ability ? null : localized?.rules), [card, ability, localized])
  const name = displayName || card.displayName || card.name || ''
  const hasText = lines.length > 0 || !!xLine
  return (
    <div
      className={`stack-bubble is-${placement}${hasText ? ' is-open' : ''}`}
      data-testid="stack-bubble"
      data-card-ref={card.id}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ ['--read-i' as string]: depth }}
    >
      <div className="stack-bubble-tab" data-testid="stack-bubble-tab">
        <span className={`stack-controller-pill ${ctrl.isMe ? 'is-me' : 'is-opp'}`} title={`${t('game', 'controller')}: ${ctrl.name}`}>
          <span className="ctrl-icon"><Icon name={ctrl.avatarIcon} size={12} /></span>
          <span className="ctrl-name">{ctrl.name}</span>
        </span>
        {ability && <span className="stack-bubble-kind" aria-hidden="true"><Icon name="zap" size={11} /></span>}
        {copy && <span className="stack-tl-copy-badge"><Icon name="sparkles" size={11} /> {t('game', 'copy_badge')}</span>}
        <span className="stack-bubble-name">{name}</span>
      </div>
      {hasText && (
        <div key={String(card.id)} className="stack-bubble-body" data-testid="stack-bubble-body">
          {lines.map((line, i) => (
            <p key={i}><FormattedText text={line} cardName={name} /></p>
          ))}
          {xLine && <p className="stack-bubble-x">{xLine}</p>}
        </div>
      )}
    </div>
  )
}
