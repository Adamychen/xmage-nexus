import { useTranslation } from '../i18n'

export interface HoverPreview {
  url: string
  backUrl?: string | null
  x: number
  y: number
  name?: string
}

export function hoverPreviewPosition(rect: DOMRect | undefined, dualFace: boolean): { x: number; y: number } {
  const previewWidth = dualFace ? 520 : 255
  if (!rect) {
    return { x: window.innerWidth / 2 - previewWidth / 2, y: window.innerHeight / 2 - 180 }
  }
  return {
    x: rect.left > window.innerWidth / 2
      ? Math.max(10, rect.left - previewWidth - 15)
      : Math.min(window.innerWidth - previewWidth - 15, rect.right + 15),
    y: Math.max(30, Math.min(window.innerHeight - 380, rect.top - 40)),
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
