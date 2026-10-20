import type { CSSProperties } from 'react'
import { useDiceRollFx } from './diceRollFx'
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
  if (!roll) return null

  return (
    <div className="dice-roll-overlay" aria-hidden="true">
      <div
        key={roll.id}
        className={`dice-roll ${roll.spin ? 'is-spin' : 'is-fade'}`}
        data-testid="fx-dice-roll"
        style={{ '--dice-dur': `${roll.duration}ms`, '--dice-color': roll.color } as Vars}
      >
        <div className="dice-row">
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
