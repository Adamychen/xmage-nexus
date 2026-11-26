import { useLayoutEffect, useRef } from 'react'
import { useFeedbackFx, type FeedbackFxState } from './feedbackFx'
import { ARENA_EASE, fxTimeline } from '../fx/fxEngine'
import { vfx } from '../fx/vfxEngine'
import './FeedbackOverlay.css'

type FeedbackBanner = NonNullable<FeedbackFxState['banner']>
type FeedbackFloater = FeedbackFxState['floaters'][number]

function BannerItem({ banner }: { banner: FeedbackBanner }) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const durS = Math.max(0.5, banner.duration / 1000)
    const tl = fxTimeline(undefined, { allowReducedMotion: true })
    if (!tl) return

    const cx = typeof window !== 'undefined' ? window.innerWidth / 2 : 0
    const cy = typeof window !== 'undefined' ? window.innerHeight / 2 : 0
    if (cx > 0 && cy > 0) {
      const color = banner.own ? 'gold' : 'arena'
      vfx.shockwave(cx, cy, color, { startR: 24, endR: banner.own ? 220 : 170, lineWidth: banner.own ? 3.5 : 2.5, duration: 0.5 })
      vfx.sparkBurst(cx, cy, color, { count: banner.own ? 22 : 12, speed: 210, size: 3.4, life: 0.52, gravity: -55 })
    }

    tl.fromTo(
      el,
      { opacity: 0, scale: 0.88 },
      { opacity: 1, scale: 1, duration: Math.min(0.24, durS * 0.22), ease: ARENA_EASE.snapOut },
    )
      .to(el, { duration: Math.max(0.15, durS * 0.56) })
      .to(el, { opacity: 0, scale: 1.04, duration: Math.min(0.28, durS * 0.22), ease: 'power2.in' })

    return () => { tl.kill() }
  }, [banner])

  return (
    <div
      ref={ref}
      className="fx-banner fx-decorate"
      data-own={banner.own ? '1' : undefined}
      data-testid="fx-banner"
      style={{ animationDuration: `${banner.duration}ms` }}
    >
      <span className="fx-banner-sweep" aria-hidden="true" />
      {banner.sub && <span className="fx-banner-sub">{banner.sub}</span>}
      <span className="fx-banner-text">{banner.text}</span>
    </div>
  )
}

function FloaterItem({ floater }: { floater: FeedbackFloater }) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const durS = Math.max(0.35, floater.duration / 1000)
    const tl = fxTimeline(undefined, { allowReducedMotion: true })
    if (!tl) return

    tl.fromTo(
      el,
      { opacity: 0, y: 6, scale: 0.72 },
      { opacity: 1, y: -10, scale: 1.12, duration: durS * 0.22, ease: ARENA_EASE.pop },
    )
      .to(el, { scale: 1, y: -22, duration: durS * 0.45, ease: 'power1.out' })
      .to(el, { opacity: 0, y: -38, duration: durS * 0.33, ease: 'power1.in' })

    return () => { tl.kill() }
  }, [floater])

  return (
    <span
      ref={ref}
      className={`fx-floater fx-decorate ${floater.tone}${floater.boxed ? ' is-boxed' : ''}`}
      style={{ left: floater.x, top: floater.y, animationDuration: `${floater.duration}ms` }}
    >
      {floater.text}
    </span>
  )
}

export default function FeedbackOverlay() {
  const { floaters, banner } = useFeedbackFx()
  if (floaters.length === 0 && !banner) return null

  return (
    <div className="feedback-overlay" aria-hidden="true">
      {floaters.map((f) => (
        <FloaterItem key={f.id} floater={f} />
      ))}
      {banner && <BannerItem key={banner.id} banner={banner} />}
    </div>
  )
}
