import { useId, useMemo } from 'react'
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
  open: boolean
  placement: StackBubblePlacement
  onToggle: () => void
  onEnter: () => void
  onLeave: () => void
}

/** STK-9: the name and the server's text of a stack object, localized, as the bubble and the viewer read it. */
export function useStackText(card: CardView) {
  const ability = isStackAbility(card)
  const face = ability && card.sourceCard ? card.sourceCard : card
  const { text: localized } = useLocalizedCardText(face)
  const { displayName } = useLocalizedCardName(face)
  const { lines, xLine } = useMemo(() => stackCardText(card, ability ? null : localized?.rules), [card, ability, localized])
  const name = displayName || card.displayName || card.name || ''
  return { name, lines, xLine, hasText: lines.length > 0 || !!xLine }
}

/**
 * STK-10: what the object being read will do, in a bubble hanging from the cascade. Folded, it is
 * the strip of chips the front card used to carry over its art, with a chevron that says there is
 * more; open, the same strip heads the server's text.
 */
export default function StackBubble({ card, ctrl, depth, open, placement, onToggle, onEnter, onLeave }: StackBubbleProps) {
  const { t } = useTranslation()
  const bodyId = useId()
  const ability = isStackAbility(card)
  const copy = isCopyCard(card)
  const { name, lines, xLine, hasText } = useStackText(card)
  const label = open ? t('game', 'stack_text_hide') : t('game', 'stack_text_show')
  return (
    <div
      className={`stack-bubble is-${placement}${open && hasText ? ' is-open' : ''}`}
      data-testid="stack-bubble"
      data-card-ref={card.id}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ ['--read-i' as string]: depth }}
    >
      <button
        type="button"
        className="stack-bubble-tab"
        data-testid="stack-bubble-tab"
        aria-expanded={hasText ? open : undefined}
        aria-controls={hasText ? bodyId : undefined}
        aria-label={hasText ? `${name}: ${label}` : name}
        title={hasText ? label : undefined}
        onClick={hasText ? onToggle : undefined}
        onFocus={onEnter}
        onBlur={onLeave}
      >
        <span className={`stack-controller-pill ${ctrl.isMe ? 'is-me' : 'is-opp'}`} title={`${t('game', 'controller')}: ${ctrl.name}`}>
          <span className="ctrl-icon"><Icon name={ctrl.avatarIcon} size={12} /></span>
          <span className="ctrl-name">{ctrl.name}</span>
        </span>
        {ability && <span className="stack-bubble-kind" aria-hidden="true"><Icon name="zap" size={11} /></span>}
        {copy && <span className="stack-tl-copy-badge"><Icon name="sparkles" size={11} /> {t('game', 'copy_badge')}</span>}
        <span className="stack-bubble-name">{name}</span>
        {hasText && (
          <span className="stack-bubble-chevron" aria-hidden="true">
            <Icon name={open ? 'chevronUp' : 'chevronDown'} size={14} />
          </span>
        )}
      </button>
      {hasText && (
        <div key={String(card.id)} className="stack-bubble-body" id={bodyId} data-testid="stack-bubble-body" hidden={!open}>
          {lines.map((line, i) => (
            <p key={i}><FormattedText text={line} cardName={name} /></p>
          ))}
          {xLine && <p className="stack-bubble-x">{xLine}</p>}
        </div>
      )}
    </div>
  )
}
