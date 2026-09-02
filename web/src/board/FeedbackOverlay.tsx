import { useFeedbackFx } from './feedbackFx'
import './FeedbackOverlay.css'

export default function FeedbackOverlay() {
  const { floaters, banner } = useFeedbackFx()
  if (floaters.length === 0 && !banner) return null

  return (
    <div className="feedback-overlay" aria-hidden="true">
      {floaters.map((f) => (
        <span
          key={f.id}
          className={`fx-floater fx-decorate ${f.tone}`}
          style={{ left: f.x, top: f.y, animationDuration: `${f.duration}ms` }}
        >
          {f.text}
        </span>
      ))}
      {banner && (
        <div
          key={banner.id}
          className="fx-banner fx-decorate"
          style={{ animationDuration: `${banner.duration}ms` }}
        >
          <span className="fx-banner-text">{banner.text}</span>
          {banner.sub && <span className="fx-banner-sub">{banner.sub}</span>}
        </div>
      )}
    </div>
  )
}
