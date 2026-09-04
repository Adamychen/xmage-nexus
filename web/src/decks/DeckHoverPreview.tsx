import { useTranslation } from '../i18n'

export interface HoverPreview {
  url: string
  backUrl?: string | null
  x: number
  y: number
  name?: string
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
          <img src={preview.backUrl} alt={`${preview.name ?? 'Carta'} (${t('wiki', 'face_back')})`} />
        </div>
      )}
    </div>
  )
}
