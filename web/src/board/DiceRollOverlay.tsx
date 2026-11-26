import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { useDiceRollFx } from './diceRollFx'
import { fxTimeline } from '../fx/fxEngine'
import { vfx } from '../fx/vfxEngine'
import './DiceRollOverlay.css'

type Vars = CSSProperties & Record<`--${string}`, string>

function shapeOf(sides: number | null): string {
  if (sides === null) return 'is-planar'
  return sides === 6 ? 'is-d6' : 'is-dn'
}

function planarFace(result: string): string {
  const r = result.toLowerCase()
  if (r.includes('chaos')) return '✺'
  if (r.includes('planar')) return '⏣'
  return ''
}

export default function DiceRollOverlay() {
  const roll = useDiceRollFx()
  const rowRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const row = rowRef.current
    if (!roll || !row) return
    const dice = Array.from(row.querySelectorAll<HTMLElement>('.dice-die'))
    if (dice.length === 0) return

    if (!roll.spin) {
      const tl = fxTimeline(undefined, { allowReducedMotion: true })
      tl?.fromTo(dice, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'power2.out' })
      return () => { tl?.kill() }
    }

    const tl = fxTimeline()
    if (!tl) return

    dice.forEach((die, i) => {
      const at = i * 0.08
      tl.fromTo(
        die,
        { y: -70, rotation: -360, scale: 0.55, opacity: 0 },
        { y: 0, rotation: 0, scale: 1, opacity: 1, duration: 0.42, ease: 'bounce.out' },
        at,
      ).call(
        () => {
          const rect = die.getBoundingClientRect()
          if (rect.width > 0 && rect.height > 0) {
            vfx.sparkBurst(rect.left + rect.width / 2, rect.top + rect.height / 2, 'gold', {
              count: 10,
              speed: 170,
              size: 3.2,
              life: 0.34,
              gravity: 110,
            })
          }
        },
        undefined,
        at + 0.22,
      )
    })

    return () => { tl.kill() }
  }, [roll])

  if (!roll) return null

  return (
    <div className="dice-roll-overlay" aria-hidden="true">
      <div
        key={roll.id}
        className={`dice-roll ${roll.spin ? 'is-spin' : 'is-fade'}`}
        data-testid="fx-dice-roll"
        style={{ '--dice-dur': `${roll.duration}ms`, '--dice-color': roll.color } as Vars}
      >
        <div ref={rowRef} className="dice-row">
          {roll.results.map((result, i) => (
            <span
              key={i}
              className={`dice-die ${shapeOf(roll.sides)}`}
              data-result={result}
              style={{ '--die-i': String(i) } as Vars}
            >
              <span className="dice-face">{roll.sides === null ? planarFace(result) : result}</span>
            </span>
          ))}
        </div>
        <span className="dice-caption">
          <span className="dice-name">{roll.player}</span>
          <span className="dice-kind">{roll.sides === null ? roll.results.join(', ') : `d${roll.sides}`}</span>
        </span>
      </div>
    </div>
  )
}
