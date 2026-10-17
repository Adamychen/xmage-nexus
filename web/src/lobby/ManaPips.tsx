const COLORS = ['w', 'u', 'b', 'r', 'g'] as const

export default function ManaPips() {
  return (
    <span className="mana-pips" aria-hidden="true">
      {COLORS.map((c, i) => (
        <span key={c} className="mana-pip" data-color={c} style={{ animationDelay: `${i * 0.16}s` }} />
      ))}
    </span>
  )
}
