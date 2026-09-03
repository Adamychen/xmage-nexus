import { useState } from 'react'

export function symbolToSvgPath(rawSymbol: string): string {
  let clean = rawSymbol.replace(/^\{|\}$/g, '').toUpperCase().trim()
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
  const cleanBase = base.endsWith('/') ? base : `${base}/`
  if (clean === '∞') return `${cleanBase}symbols/INFINITY.svg`
  if (clean === '1/2' || clean === 'HALF') return `${cleanBase}symbols/HALF.svg`
  clean = clean.replace(/\//g, '')
  return `${cleanBase}symbols/${clean}.svg`
}

export function parseManaSymbols(manaCost?: string): string[] {
  if (!manaCost) return []
  const matches = manaCost.match(/\{([^}]+)\}/g)
  if (!matches) {
    const raw = manaCost.trim()
    const tokens: string[] = []
    let i = 0
    while (i < raw.length) {
      if (raw[i] === '{') {
        const close = raw.indexOf('}', i)
        if (close > i) {
          tokens.push(raw.slice(i + 1, close))
          i = close + 1
          continue
        }
      }
      tokens.push(raw[i].toUpperCase())
      i++
    }
    return tokens
  }
  return matches.map((m) => m.slice(1, -1))
}

export function ManaPip({
  symbol,
  size = 16,
  className = '',
}: {
  symbol: string
  size?: number
  className?: string
}) {
  const s = symbol.replace(/^\{|\}$/g, '').toUpperCase().trim()
  const [failed, setFailed] = useState(false)
  const svgUrl = symbolToSvgPath(s)

  if (failed) {
    return (
      <span
        className={`mana-symbol sym-generic ${className}`}
        style={{ width: size, height: size, fontSize: Math.max(9, size * 0.65) }}
        title={`Maná ${s}`}
      >
        {s}
      </span>
    )
  }

  return (
    <span
      className={`mana-symbol ${className}`.trim()}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle', position: 'relative' }}
      title={`{${s}}`}
    >
      <img
        src={svgUrl}
        alt={`{${s}}`}
        className="mana-symbol-svg"
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          display: 'block',
          flexShrink: 0,
        }}
        onError={() => setFailed(true)}
        loading="lazy"
        draggable={false}
      />
      <span className="visually-hidden">{`{${s}}`}</span>
    </span>
  )
}

export function ManaCost({
  manaCost,
  size = 16,
  className = '',
}: {
  manaCost?: string
  size?: number
  className?: string
}) {
  const symbols = parseManaSymbols(manaCost)
  if (symbols.length === 0) return null
  return (
    <span
      className={`mana-cost-display ${className}`.trim()}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}
    >
      {symbols.map((sym, idx) => (
        <ManaPip key={`${sym}-${idx}`} symbol={sym} size={size} />
      ))}
    </span>
  )
}
