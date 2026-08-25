export function parseManaSymbols(manaCost?: string): string[] {
  if (!manaCost) return []
  const matches = manaCost.match(/\{([^}]+)\}/g)
  if (!matches) {
    // If format like "2UU" without braces
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

export function ManaPip({ symbol, size = 16 }: { symbol: string; size?: number }) {
  const s = symbol.toUpperCase().trim()

  // Colors
  if (s === 'W') {
    return (
      <span className="mana-symbol sym-w" style={{ width: size, height: size }} title="Blanco">
        <svg viewBox="0 0 100 100" width={size} height={size}>
          <circle cx="50" cy="50" r="48" fill="#f9faf4" stroke="#d4c99c" strokeWidth="3" />
          <path d="M50 20 L58 40 L80 42 L62 56 L68 78 L50 64 L32 78 L38 56 L20 42 L42 40 Z" fill="#d9b626" />
        </svg>
      </span>
    )
  }

  if (s === 'U') {
    return (
      <span className="mana-symbol sym-u" style={{ width: size, height: size }} title="Azul">
        <svg viewBox="0 0 100 100" width={size} height={size}>
          <circle cx="50" cy="50" r="48" fill="#0e68ab" stroke="#40b5f5" strokeWidth="3" />
          <path d="M50 18 C50 18 30 48 30 65 C30 78 39 84 50 84 C61 84 70 78 70 65 C70 48 50 18 50 18 Z" fill="#bfe7fc" />
        </svg>
      </span>
    )
  }

  if (s === 'B') {
    return (
      <span className="mana-symbol sym-b" style={{ width: size, height: size }} title="Negro">
        <svg viewBox="0 0 100 100" width={size} height={size}>
          <circle cx="50" cy="50" r="48" fill="#1b1716" stroke="#4a423e" strokeWidth="3" />
          <path d="M50 22 C34 22 28 36 28 50 C28 62 36 70 42 78 L42 82 L46 82 L46 76 L54 76 L54 82 L58 82 L58 78 C64 70 72 62 72 50 C72 36 66 22 50 22 Z M40 50 C37 50 35 46 37 42 C39 38 43 40 43 44 C43 48 41 50 40 50 Z M60 50 C59 50 57 48 57 44 C57 40 61 38 63 42 C65 46 63 50 60 50 Z" fill="#cfc7c0" />
        </svg>
      </span>
    )
  }

  if (s === 'R') {
    return (
      <span className="mana-symbol sym-r" style={{ width: size, height: size }} title="Rojo">
        <svg viewBox="0 0 100 100" width={size} height={size}>
          <circle cx="50" cy="50" r="48" fill="#d3202a" stroke="#ff8269" strokeWidth="3" />
          <path d="M50 18 C46 32 32 38 32 54 C32 68 40 82 56 82 C68 82 72 72 70 60 C68 48 58 42 62 30 C54 36 52 46 48 46 C44 46 46 32 50 18 Z" fill="#ffd7b3" />
        </svg>
      </span>
    )
  }

  if (s === 'G') {
    return (
      <span className="mana-symbol sym-g" style={{ width: size, height: size }} title="Verde">
        <svg viewBox="0 0 100 100" width={size} height={size}>
          <circle cx="50" cy="50" r="48" fill="#00733e" stroke="#5bd186" strokeWidth="3" />
          <path d="M50 18 C38 32 26 40 26 56 C26 70 36 82 50 82 C64 82 74 70 74 56 C74 40 62 32 50 18 Z M45 42 L55 42 L55 74 L45 74 Z" fill="#c4f7d4" />
        </svg>
      </span>
    )
  }

  if (s === 'C') {
    return (
      <span className="mana-symbol sym-c" style={{ width: size, height: size }} title="Incoloro">
        <svg viewBox="0 0 100 100" width={size} height={size}>
          <circle cx="50" cy="50" r="48" fill="#8c8d8f" stroke="#cccccc" strokeWidth="3" />
          <polygon points="50,22 72,50 50,78 28,50" fill="#f0f0f2" />
        </svg>
      </span>
    )
  }

  // Generic numbers (0, 1, 2, 3, 4, 5, 6, 7, 8, 9, X, etc.)
  return (
    <span className="mana-symbol sym-generic" style={{ width: size, height: size, fontSize: Math.max(10, size * 0.68) }} title={`Maná ${s}`}>
      {s}
    </span>
  )
}

export function ManaCost({ manaCost, size = 16 }: { manaCost?: string; size?: number }) {
  const symbols = parseManaSymbols(manaCost)
  if (symbols.length === 0) return null
  return (
    <span className="mana-cost-display">
      {symbols.map((sym, idx) => (
        <ManaPip key={`${sym}-${idx}`} symbol={sym} size={size} />
      ))}
    </span>
  )
}
