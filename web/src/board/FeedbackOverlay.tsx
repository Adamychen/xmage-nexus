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
          className={`fx-floater fx-decorate ${f.tone}${f.boxed ? ' is-boxed' : ''}`}
          style={{ left: f.x, top: f.y, animationDuration: `${f.duration}ms` }}
        >
          {f.text}
        </span>
      ))}
      {banner && (
        <div
          key={banner.id}
          className="fx-banner fx-decorate"
          data-own={banner.own ? '1' : undefined}
          data-testid="fx-banner"
          style={{ animationDuration: `${banner.duration}ms` }}
        >
          <span className="fx-banner-sweep" aria-hidden="true" />
          {/* FX-10: who the turn belongs to is the headline; "Turno de" is the label above it. */}
          {banner.sub && <span className="fx-banner-sub">{banner.sub}</span>}
          <span className="fx-banner-text">{banner.text}</span>
        </div>
      )}
    </div>
  )
}
