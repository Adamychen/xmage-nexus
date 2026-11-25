/**
 * STK-1: how a cascade of stack objects fits the space it is given.
 *
 * The stack is drawn the way a pile lies mid-deal: the object about to resolve is in front, whole
 * and readable, and every object under it is offset up and to the left so only a sliver of its
 * edge shows. The sliver says "there is more under this", nothing else; the card you have to read
 * is the front one.
 *
 * Both the card size and the offset come from the room the cascade has, never from a constant
 * tuned on one screen. The cascade claims that room along both axes, so the measurement feeding
 * this function only ever reads the box it was handed, never the cascade's own answer.
 */
/**
 * The shape of the picture we actually draw, not of the cardboard: Scryfall's `normal` images are
 * 488 x 680, so 680 / 488. The box has to be the file's shape for the file to fill it exactly, and
 * only then does a rounding of the box land on the card's own printed corner.
 */
export const CASCADE_RATIO = 680 / 488
export const CASCADE_CARD_MAX = 230
export const CASCADE_CARD_MIN = 96
/** Sliver of a covered card, as a share of the card's own width and height. */
export const CASCADE_PEEK_X = 0.11
export const CASCADE_PEEK_Y = 0.075
/** Past this many objects the tail is folded away rather than drawn as ever-thinner slivers. */
export const CASCADE_MAX_SHOWN = 5

export interface CascadeFit {
  /** Card width in pixels. */
  cardW: number
  /** Pixels each card is offset left of the one in front of it. */
  stepX: number
  /** Pixels each card is offset above the one in front of it. */
  stepY: number
  /** How many objects are drawn; the rest are counted on the front card. */
  shown: number
}

/**
 * A cascade for `count` objects inside `width` x `height` pixels.
 *
 * The card is as large as both sides allow once the slivers behind it are accounted for. When the
 * stack is deeper than `CASCADE_MAX_SHOWN`, only that many are drawn: a sixth sliver carries no
 * information that a count does not carry better.
 */
export function stackCascadeFit(width: number, height: number, count: number): CascadeFit {
  const n = Math.max(1, count)
  const shown = Math.min(n, CASCADE_MAX_SHOWN)
  const behind = shown - 1

  // card + behind * card * peek <= side, on each axis.
  const byWidth = width / (1 + behind * CASCADE_PEEK_X)
  const byHeight = height > 0 ? height / (CASCADE_RATIO * (1 + behind * CASCADE_PEEK_Y)) : byWidth

  const cardW = Math.max(CASCADE_CARD_MIN, Math.min(CASCADE_CARD_MAX, Math.floor(Math.min(byWidth, byHeight))))
  return {
    cardW,
    stepX: Math.round(cardW * CASCADE_PEEK_X),
    stepY: Math.round(cardW * CASCADE_RATIO * CASCADE_PEEK_Y),
    shown,
  }
}
