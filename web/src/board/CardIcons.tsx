interface CardIcon {
  cardIconType?: string
  text?: string
  hint?: string
}

function abbrev(hint: string): string {
  const words = hint.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return words.slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

/**
 * Renders the restriction / ability icons the server sends on each card
 * (`cardIcons`). Goad and all combat restrictions (must/can't attack/block/untap/
 * transform) arrive as `OTHER_HAS_RESTRICTIONS` with the human text in `hint`;
 * ability icons (Reach, Trample, …) carry their name in `hint`. This is the
 * client-side piece that actually surfaces goad — the engine state reaches us
 * through the view's restriction icon, not a dedicated field.
 */
export default function CardIcons({ icons }: { icons?: CardIcon[] }) {
  if (!icons || icons.length === 0) return null
  const restrictions = icons.filter((i) => i.cardIconType === 'OTHER_HAS_RESTRICTIONS')
  const others = icons.filter((i) => i.cardIconType !== 'OTHER_HAS_RESTRICTIONS')
  if (restrictions.length === 0 && others.length === 0) return null

  return (
    <div className="card-icons">
      {restrictions.map((r, i) => (
        <span
          key={`r${i}`}
          className="card-icon restriction"
          title={r.hint?.replace(/<br>/g, '\n') ?? 'Restricción'}
        >
          {r.text || '⚠'}
        </span>
      ))}
      {others.map((o, i) => (
        <span key={`a${i}`} className="card-icon ability" title={o.hint}>
          {o.text || abbrev(o.hint ?? '')}
        </span>
      ))}
    </div>
  )
}
