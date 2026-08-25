import type { Deck, DeckCard } from '../lobby/decks'

const DCK_LINE = /^(SB:\s*)?(\d+)\s*\[([^:\]]+):([^\]]+)\]\s*(.+?)\s*$/
const NAME_RE = /^NAME:\s*(.*)\s*$/
const AUTHOR_RE = /^AUTHOR:\s*(.*)\s*$/
const LAYOUT_RE = /^LAYOUT\s+(MAIN|SIDEBOARD):/

export function parseDck(text: string, fallbackName = 'Mazo Importado'): Deck | null {
  const lines = text.split(/\r?\n/)
  let name: string | null = null
  const cards: DeckCard[] = []
  const sideboard: DeckCard[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#')) continue
    if (LAYOUT_RE.test(line)) continue
    const nameMatch = line.match(NAME_RE)
    if (nameMatch) {
      name = nameMatch[1].trim() || null
      continue
    }
    if (AUTHOR_RE.test(line)) continue
    if (/^\[(COMMANDER|COMPANION|MAIN|SIDEBOARD)\]/i.test(line)) continue
    if (/^\[.*\]$/.test(line)) continue

    const m = line.match(DCK_LINE)
    if (m) {
      const isSideboard = !!m[1]
      const amount = parseInt(m[2], 10) || 1
      const setCode = m[3].trim()
      const cardNumber = m[4].trim()
      const cardName = m[5].trim()
      if (!cardName) continue
      const entry: DeckCard = { cardName, setCode, cardNumber, amount }
      if (isSideboard) sideboard.push(entry)
      else cards.push(entry)
      continue
    }
  }

  if (cards.length === 0 && sideboard.length === 0) return null
  return {
    name: name || fallbackName,
    cards,
    sideboard,
  }
}

export function parseAnyDeck(text: string, fallbackName = 'Mazo Importado'): Deck | null {
  if (/^\s*NAME:/m.test(text) || /\[.*:.*\].*\n/.test(text) && /SB:/.test(text)) {
    const dck = parseDck(text, fallbackName)
    if (dck) return dck
  }
  if (/\[.*:.*\]/.test(text)) {
    const dck = parseDck(text, fallbackName)
    if (dck) return dck
  }
  return parseArenaLike(text, fallbackName)
}

function parseArenaLike(text: string, fallbackName: string): Deck | null {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0)
  if (lines.length === 0) return null
  const cards: DeckCard[] = []
  const sideboard: DeckCard[] = []
  let isSideboard = false
  let headerSeen = false

  for (const line of lines) {
    const low = line.toLowerCase()
    if (low === 'deck' || low === 'main' || low === 'mainboard' || low === '[main]' || low === 'maindeck') {
      isSideboard = false
      headerSeen = true
      continue
    }
    if (low === 'sideboard' || low === '[sideboard]' || low === 'companion' || low === '[companion]') {
      isSideboard = true
      headerSeen = true
      continue
    }
    if (low.startsWith('//')) {
      if (low.includes('sideboard')) {
        isSideboard = true
        headerSeen = true
      }
      continue
    }
    if (line.startsWith('SB:')) {
      const rest = line.slice(3).trim()
      const m = rest.match(/^(\d+)x?\s+(.+?)(?:\s+\(([A-Za-z0-9_]+)\)\s+(\S+))?\s*$/)
      if (m) {
        const amount = parseInt(m[1], 10) || 1
        sideboard.push({ cardName: m[2].trim(), setCode: m[3] || 'M10', cardNumber: m[4] || '1', amount })
      } else {
        const m2 = rest.match(/^(.+)$/)
        if (m2) sideboard.push({ cardName: m2[1].trim(), setCode: 'M10', cardNumber: '1', amount: 1 })
      }
      continue
    }

    const m = line.match(/^(\d+)x?\s+([^(\n\r]+?)(?:\s+\(([A-Za-z0-9_]+)\)\s+(\S+))?$/)
    if (m) {
      const amount = parseInt(m[1], 10) || 1
      const cardName = m[2].trim().replace(/\s*\/\/.*$/, '').trim()
      if (!cardName || /^(creatures?|instants?|sorcer|enchant|artifacts?|lands?|planeswalkers?)$/i.test(cardName)) continue
      const setCode = m[3] || 'M10'
      const cardNumber = m[4] || '1'
      const item: DeckCard = { cardName, setCode, cardNumber, amount }
      if (isSideboard) sideboard.push(item)
      else cards.push(item)
      continue
    }
    if (/^\d+\s+\[.*:.*\]/.test(line)) {
      const dck = line.match(/^(\d+)\s*\[([^:]+):([^\]]+)\]\s*(.+)$/)
      if (dck) {
        const item: DeckCard = { cardName: dck[4].trim(), setCode: dck[2].trim(), cardNumber: dck[3].trim(), amount: parseInt(dck[1], 10) || 1 }
        if (isSideboard) sideboard.push(item)
        else cards.push(item)
      }
      continue
    }
  }

  if (!headerSeen && lines.some((l) => l.trim() === '')) {
    // fallback handled via SB: already
  }

  if (cards.length === 0 && sideboard.length === 0) return null
  return { name: fallbackName, cards, sideboard }
}

export function exportDck(deck: Deck): string {
  const out: string[] = []
  out.push(`NAME:${deck.name}`)
  const grouped = new Map<string, DeckCard>()
  for (const c of deck.cards) {
    const k = `M@${c.setCode}:${c.cardNumber}:${c.cardName}`
    const prev = grouped.get(k)
    if (prev) prev.amount += c.amount
    else grouped.set(k, { ...c })
  }
  for (const c of grouped.values()) {
    out.push(`${c.amount} [${c.setCode}:${c.cardNumber}] ${c.cardName}`)
  }
  const groupedSb = new Map<string, DeckCard>()
  for (const c of deck.sideboard) {
    const k = `S@${c.setCode}:${c.cardNumber}:${c.cardName}`
    const prev = groupedSb.get(k)
    if (prev) prev.amount += c.amount
    else groupedSb.set(k, { ...c })
  }
  for (const c of groupedSb.values()) {
    out.push(`SB: ${c.amount} [${c.setCode}:${c.cardNumber}] ${c.cardName}`)
  }
  return out.join('\n') + '\n'
}

export function exportArena(deck: Deck): string {
  const out: string[] = []
  out.push('Deck')
  for (const c of deck.cards) {
    out.push(`${c.amount} ${c.cardName} (${c.setCode}) ${c.cardNumber}`)
  }
  if (deck.sideboard.length > 0) {
    out.push('')
    out.push('Sideboard')
    for (const c of deck.sideboard) {
      out.push(`${c.amount} ${c.cardName} (${c.setCode}) ${c.cardNumber}`)
    }
  }
  return out.join('\n') + '\n'
}

export function exportTxt(deck: Deck): string {
  const out: string[] = []
  for (const c of deck.cards) out.push(`${c.amount} ${c.cardName}`)
  if (deck.sideboard.length > 0) {
    out.push('')
    for (const c of deck.sideboard) out.push(`SB: ${c.amount} ${c.cardName}`)
  }
  return out.join('\n') + '\n'
}
