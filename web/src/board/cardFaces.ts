import type { CardView, PermanentView } from '../net/types'
import { hiddenFaceDownName } from '../cards/cardImages'

export type InspectableCard = CardView | PermanentView

export function activeCardFace(card: InspectableCard, showBackFace: boolean): InspectableCard {
  const hiddenName = hiddenFaceDownName(card as CardView)
  if (hiddenName) {
    return {
      ...card,
      name: hiddenName,
      displayName: hiddenName,
      faceDown: false,
      isToken: false,
      expansionSetCode: '',
      cardNumber: '0',
      imageFileName: '',
      imageNumber: 0,
    } as unknown as InspectableCard
  }

  const isTransformedOnField = (card as PermanentView).transformed === true
  const shouldShowBack = isTransformedOnField ? !showBackFace : showBackFace

  if (!shouldShowBack) {
    return { ...card, isFrontFace: true, isSecondCardFace: false } as unknown as InspectableCard
  }
  if (card.secondCardFace) {
    return {
      ...card.secondCardFace,
      isSecondCardFace: true,
      expansionSetCode: card.secondCardFace.expansionSetCode || card.expansionSetCode,
      cardNumber: card.secondCardFace.cardNumber || card.cardNumber,
    } as unknown as InspectableCard
  }
  if (card.alternateName) {
    return {
      ...card,
      name: card.alternateName,
      displayName: card.alternateName,
      isSecondCardFace: true,
    } as unknown as InspectableCard
  }
  return { ...card, isSecondCardFace: true } as unknown as InspectableCard
}
