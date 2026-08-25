import type { DeckCard } from '../lobby/decks'

export default function CurveChart({ cards, meta }: { cards: DeckCard[]; meta: Map<string, number> }) {
  const buckets = Array(8).fill(0) as number[]
  let max = 0
  for (const c of cards) {
    const key = `${c.setCode}/${c.cardNumber}`
    const cmc = meta.get(key) ?? meta.get(c.cardName.toLowerCase()) ?? 0
    const idx = cmc >= 7 ? 7 : cmc
    buckets[idx] += c.amount
    max = Math.max(max, buckets[idx])
  }
  if (max === 0) max = 1
  return (
    <div className="curve-chart">
      <div className="curve-bars">
        {buckets.map((v, i) => (
          <div key={i} className="curve-bar-col">
            <div className="curve-bar-track">
              <div className="curve-bar-fill" style={{ height: `${(v / max) * 100}%` }} title={`${i === 7 ? '7+' : i}: ${v}`} />
            </div>
            <span className="curve-label">{i === 7 ? '7+' : i}</span>
            <span className="curve-count">{v || ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
