import { useMemo, useState } from 'react'
import type { CardView } from '../net/types'
import RenderedCard from '../cards/rendered/RenderedCard'
import { cardLayout } from '../cards/rendered/cardLayout'
import { recordedFrames } from './galleryFixtures'

function collectCards(): CardView[] {
  const seen = new Map<string, CardView>()
  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== 'object' || depth > 8) return
    const obj = value as Record<string, unknown>
    if (typeof obj.name === 'string' && (Array.isArray(obj.cardTypes) || Array.isArray(obj.rules))) {
      const card = obj as unknown as CardView
      const key = `${cardLayout(card).kind}|${card.name}`
      if (!seen.has(key)) seen.set(key, card)
    }
    for (const child of Object.values(obj)) visit(child, depth + 1)
  }
  for (const frame of recordedFrames) visit(frame.gameView, 0)
  return [...seen.values()].sort((a, b) => cardLayout(a).kind.localeCompare(cardLayout(b).kind) || a.name.localeCompare(b.name))
}

export default function RenderedCardsGallery() {
  const cards = useMemo(collectCards, [])
  const [width, setWidth] = useState(260)
  return (
    <div style={{ padding: 'var(--sp-4)', height: '100%', overflow: 'auto', background: 'var(--ink-1)' }}>
      <label style={{ display: 'flex', gap: 'var(--sp-3)', color: 'var(--fg-1)', marginBottom: 'var(--sp-4)' }}>
        <span>{width}px</span>
        <input type="range" min={140} max={460} value={width} onChange={(e) => setWidth(Number(e.target.value))} />
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', alignItems: 'flex-start' }}>
        {cards.map((card, i) => (
          <figure key={`${card.name}-${i}`} style={{ margin: 0, width }} data-layout={cardLayout(card).kind}>
            <RenderedCard card={card} />
            <figcaption style={{ color: 'var(--fg-3)', fontSize: 'var(--fs-xs)' }}>{cardLayout(card).kind}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
