import { useEffect, useLayoutEffect, useRef, type CSSProperties } from 'react'
import { useStore, isBlockingModal } from '../state/store'
import { clearCoinFlipFx, useCoinFlipFx } from './coinFlipFx'
import { ARENA_EASE, fxTimeline } from '../fx/fxEngine'
import { vfx } from '../fx/vfxEngine'
import './CoinFlipOverlay.css'

type Vars = CSSProperties & Record<`--${string}`, string>

export default function CoinFlipOverlay() {
  const coin = useCoinFlipFx()
  const modalOpen = useStore(isBlockingModal)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (coin && modalOpen) clearCoinFlipFx()
  }, [coin, modalOpen])

  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!coin || modalOpen || !body) return
    const durS = Math.max(0.4, coin.duration / 1000)

    if (!coin.spin) {
      const tl = fxTimeline(undefined, { allowReducedMotion: true })
      tl?.fromTo(body, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'power2.out' })
      return () => { tl?.kill() }
    }

    const tl = fxTimeline()
    if (!tl) return

    const spinDur = durS * 0.52
    tl.fromTo(
      body,
      { y: 50, scale: 0.72, rotateX: 0, opacity: 0 },
      { y: -65, scale: 1.24, rotateX: 720, opacity: 1, duration: spinDur * 0.55, ease: ARENA_EASE.snapOut },
    )
      .to(body, { y: 0, scale: 1, rotateX: 1440, duration: spinDur * 0.45, ease: ARENA_EASE.slamIn })
      .call(() => {
        const rect = body.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          vfx.mythicBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 'gold')
        }
      })
      .to(body, { scale: 1.06, duration: 0.08, yoyo: true, repeat: 1, ease: ARENA_EASE.pop })

    return () => { tl.kill() }
  }, [coin, modalOpen])

  if (!coin || modalOpen) return null

  return (
    <div className="coin-flip-overlay" aria-hidden="true">
      <div
        key={coin.id}
        className={`coin-flip-coin ${coin.spin ? 'is-spin' : 'is-fade'}`}
        style={{ '--coin-dur': `${coin.duration}ms`, '--coin-color': coin.color } as Vars}
      >
        <div ref={bodyRef} className="coin-body">
          <span className="coin-face coin-front">
            <span className="coin-name">{coin.name}</span>
          </span>
          <span className="coin-face coin-back" />
        </div>
      </div>
    </div>
  )
}
