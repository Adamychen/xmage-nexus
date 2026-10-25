import { useTranslation } from '../i18n'
import './DeckHoverPreview.css'

export interface HoverPreview {
  url: string
  backUrl?: string | null
  x: number
  y: number
  name?: string
}

const PREVIEW_FACE_MAX_W = 420
const PREVIEW_FACE_GAP = 16
const PREVIEW_MARGIN = 10

export function hoverPreviewFaceWidth(): number {
  return Math.min(PREVIEW_FACE_MAX_W, window.innerWidth * 0.48 - 24, ((window.innerHeight - 40) * 2.5) / 3.5)
}

export function hoverPreviewPosition(rect: DOMRect | undefined, dualFace: boolean): { x: number; y: number } {
  const faceWidth = hoverPreviewFaceWidth()
  const previewWidth = dualFace ? faceWidth * 2 + PREVIEW_FACE_GAP : faceWidth
  const previewHeight = (faceWidth * 3.5) / 2.5
  const maxX = window.innerWidth - previewWidth - PREVIEW_MARGIN
  const maxY = window.innerHeight - previewHeight - PREVIEW_MARGIN
  if (!rect) {
    return { x: Math.max(PREVIEW_MARGIN, (window.innerWidth - previewWidth) / 2), y: Math.max(PREVIEW_MARGIN, (window.innerHeight - previewHeight) / 2) }
  }
  return {
    x: rect.left > window.innerWidth / 2
      ? Math.max(PREVIEW_MARGIN, rect.left - previewWidth - 15)
      : Math.max(PREVIEW_MARGIN, Math.min(maxX, rect.right + 15)),
    y: Math.max(PREVIEW_MARGIN, Math.min(maxY, rect.top - 40)),
  }
}

export default function DeckHoverPreview({ preview }: { preview: HoverPreview | null }) {
  const { t } = useTranslation()
  if (!preview) return null
  return (
    <div
      className={`arena-floating-preview ${preview.backUrl ? 'has-back-face' : ''}`}
      style={{ left: `${preview.x}px`, top: `${preview.y}px` }}
    >
      <div className="preview-face-card">
        {preview.backUrl && <span className="preview-face-label">{t('wiki', 'face_front')}</span>}
        <img src={preview.url} alt={preview.name ?? t('wiki', 'face_front')} />
      </div>
      {preview.backUrl && (
        <div className="preview-face-card">
          <span className="preview-face-label">{t('wiki', 'face_back')}</span>
          <img src={preview.backUrl} alt={`${preview.name ?? t('decks', 'card')} (${t('wiki', 'face_back')})`} />
        </div>
      )}
    </div>
  )
}
