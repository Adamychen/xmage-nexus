import type { ReactNode } from 'react'
import { ManaPip } from './ArenaManaSymbols'
import './ManaPie.css'

export type ManaPieSlice = {
  key: string
  label: string
  value: number
  color: string
  pip?: string
  icon?: ReactNode
}

const GAP_PX = 2

export function manaShare(value: number, total: number): string {
  if (total <= 0 || value <= 0) return '0%'
  const share = (value / total) * 100
  if (share < 1) return '<1%'
  return `${Math.round(share)}%`
}

export default function ManaPie({
  slices,
  size = 104,
  thickness,
  centerValue,
  ariaLabel,
  title,
}: {
  slices: ManaPieSlice[]
  size?: number
  thickness?: number
  centerValue?: number | string
  ariaLabel: string
  title?: string
}) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  if (total <= 0) return null

  const stroke = thickness ?? Math.round(size * 0.26)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const gap = slices.length > 1 ? GAP_PX : 0
  let cursor = 0
  const arcs = slices.map((slice) => {
    const length = (slice.value / total) * circumference
    const sliceGap = Math.min(gap, length * 0.35)
    const start = cursor
    cursor += length
    return { slice, dash: Math.max(0.6, length - sliceGap), offset: start + sliceGap / 2 }
  })

  return (
    <div className="mana-pie" style={{ width: size, height: size }} title={title}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel}>
        <circle className="mana-pie-track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
        {arcs.map(({ slice, dash, offset }) => (
          <circle
            key={slice.key}
            className="mana-pie-slice"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          >
            <title>{`${slice.label}: ${slice.value} (${manaShare(slice.value, total)})`}</title>
          </circle>
        ))}
      </svg>
      {centerValue != null && <span className="mana-pie-center">{centerValue}</span>}
    </div>
  )
}

export function ManaPieLegend({ slices, total }: { slices: ManaPieSlice[]; total: number }) {
  return (
    <ul className="mana-pie-legend">
      {slices.map((slice) => (
        <li
          key={slice.key}
          className="mana-pie-legend-row"
          title={`${slice.label}: ${slice.value} (${manaShare(slice.value, total)})`}
        >
          {slice.pip ? (
            <ManaPip symbol={slice.pip} size={14} />
          ) : (
            <span className="mana-pie-legend-icon" style={{ color: slice.color }}>{slice.icon}</span>
          )}
          <span className="mana-pie-legend-name">{slice.label}</span>
          <span className="mana-pie-legend-count">{slice.value}</span>
          <span className="mana-pie-legend-pct">{manaShare(slice.value, total)}</span>
        </li>
      ))}
    </ul>
  )
}
