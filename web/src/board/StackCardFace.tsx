import type { CardView } from '../net/types'
import { useCardImageUrl } from '../cards/useCardImageUrl'
import { useLocalizedCardName } from '../cards/cardLocalization'
import RenderedCard from '../cards/rendered/RenderedCard'
import Icon from '../ui/Icon'
import { isStackAbility } from './stackEntries'
import { artDebugOn, printedAs } from '../cards/artDebug'
import { cardKey } from '../cards/cardImages'

/** STK-1: the face of one object on the stack, drawn as the card it is. */
export function StackCardFace({ card, rendered }: { card: CardView; rendered: boolean }) {
  const imgUrl = useCardImageUrl(card)
  if (rendered) return <RenderedCard card={card} className="stack-thumb-img" />
  return (
    <div className="stack-thumb">
      {artDebugOn() && <span className="art-debug" data-art-where="stack">{cardKey(card) ?? 'none'} · {printedAs(card)}</span>}
      {imgUrl ? (
        /* The whole card, not a crop of its art: the one in front is the one you read, and its
           own printed title is the name, so nothing above it repeats that name. */
        <img src={imgUrl} alt="" className="stack-thumb-img" draggable={false} />
      ) : (
        <div className="stack-thumb-placeholder">
          <Icon name={isStackAbility(card) ? 'zap' : 'layers'} size={18} />
          <StackEntryCardName card={card} />
        </div>
      )}
    </div>
  )
}

export function StackEntryCardName({ card }: { card: CardView }) {
  const { displayName, originalName } = useLocalizedCardName(card)
  const isTranslated = displayName !== originalName

  return (
    <span
      className="stack-tl-name"
      title={isTranslated ? `${originalName} (${displayName})` : undefined}
    >
      {displayName}
    </span>
  )
}
