import { useEffect, type CSSProperties } from 'react'
import { useStore, isBlockingModal } from '../state/store'
import { clearCoinFlipFx, useCoinFlipFx } from './coinFlipFx'
import './CoinFlipOverlay.css'

type Vars = CSSProperties & Record<`--${string}`, string>

export default function CoinFlipOverlay() {
  const coin = useCoinFlipFx()
  const modalOpen = useStore(isBlockingModal)

  useEffect(() => {
    if (coin && modalOpen) clearCoinFlipFx()
  }, [coin, modalOpen])

  if (!coin || modalOpen) return null

  return (
    <div className="coin-flip-overlay" aria-hidden="true">
      <div
        key={coin.id}
        className={`coin-flip-coin ${coin.spin ? 'is-spin' : 'is-fade'}`}
        style={{ '--coin-dur': `${coin.duration}ms`, '--coin-color': coin.color } as Vars}
      >
        <div className="coin-body">
          <span className="coin-face coin-front">
            <span className="coin-name">{coin.name}</span>
          </span>
          <span className="coin-face coin-back" />
        </div>
      </div>
    </div>
  )
}
