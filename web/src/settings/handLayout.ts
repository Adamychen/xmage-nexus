import type { OptionPreviewKind } from './OptionPreview'

/**
 * SET-16: the hand is drawn one of three ways, and the setting is that one choice. Behind it the
 * board still reads two flags, `handRail` and `handRow`, which is why the choice is turned into
 * the pair here instead of in the control: a pair written by hand can say two things at once.
 */
export const HAND_LAYOUTS = ['fan', 'column', 'row'] as const

export type HandLayout = (typeof HAND_LAYOUTS)[number]

export interface HandFlags {
  handRail: boolean
  handRow: boolean
}

/** The thumbnail each layout is shown with. */
export const HAND_LAYOUT_PREVIEW: Record<HandLayout, OptionPreviewKind> = {
  fan: 'handFan',
  column: 'handRail',
  row: 'handRow',
}

/**
 * Which layout a pair of flags stands for. The column wins when both are on, the order the board
 * reads them in (`BoardShell`: a row is drawn only when the rail is not), so an older setting that
 * has both is shown as what the player is actually looking at.
 */
export function handLayoutOf({ handRail, handRow }: HandFlags): HandLayout {
  if (handRail) return 'column'
  return handRow ? 'row' : 'fan'
}

/** The flags a layout stands for. Exactly one of the two is ever on. */
export function handLayoutFlags(layout: HandLayout): HandFlags {
  return { handRail: layout === 'column', handRow: layout === 'row' }
}
