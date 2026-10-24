export const CARD_PREVIEW_SCALE_MIN = 0.75
export const CARD_PREVIEW_SCALE_MAX = 2
export const CARD_PREVIEW_SCALE_STEP = 0.05
export const CARD_PREVIEW_SCALE_DEFAULT = 1

export const PREVIEW_BASE_WIDTH = 320
export const PREVIEW_BASE_HEIGHT = 448
export const KEYWORDS_BASE_WIDTH = 240
export const KEYWORDS_GAP = 10

export function normalizeCardPreviewScale(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return CARD_PREVIEW_SCALE_DEFAULT
  const clamped = Math.min(CARD_PREVIEW_SCALE_MAX, Math.max(CARD_PREVIEW_SCALE_MIN, value))
  const stepped = Math.round(clamped / CARD_PREVIEW_SCALE_STEP) * CARD_PREVIEW_SCALE_STEP
  return Math.round(stepped * 100) / 100
}

export function cardPreviewPercent(scale: number): number {
  return Math.round(normalizeCardPreviewScale(scale) * 100)
}

export function previewWidthAt(scale: number, withKeywords: boolean): number {
  return withKeywords ? (PREVIEW_BASE_WIDTH + KEYWORDS_BASE_WIDTH) * scale + KEYWORDS_GAP : PREVIEW_BASE_WIDTH * scale
}

export function fitPreviewScale(scale: number, availableWidth: number, availableHeight: number, withKeywords: boolean): number {
  const widthFit = withKeywords
    ? (availableWidth - KEYWORDS_GAP) / (PREVIEW_BASE_WIDTH + KEYWORDS_BASE_WIDTH)
    : availableWidth / PREVIEW_BASE_WIDTH
  const heightFit = availableHeight / PREVIEW_BASE_HEIGHT
  const fitted = Math.min(scale, widthFit, heightFit)
  return Math.max(0.1, Math.floor(fitted * 1000) / 1000)
}
