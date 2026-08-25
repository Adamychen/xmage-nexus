import { useState, useMemo } from 'react'
import type { ScryfallSearchCard } from './scryfallSearch'
import { useScryfallSearch } from './scryfallSearch'
import { ArenaFilterBar } from './ArenaFilterBar'
import { ArenaCardGrid } from './ArenaCardGrid'
import type { DeckFormat } from './types'
import { FORMAT_CONFIGS } from './formatRules'
import './SearchPanel.css'

export default function SearchPanel({
  onAdd,
  countMap = new Map(),
  format = 'Freeform',
  onHover,
  onLeave,
}: {
  onAdd: (card: ScryfallSearchCard) => void
  countMap?: Map<string, number>
  format?: DeckFormat
  onHover?: (card: ScryfallSearchCard, rect: DOMRect) => void
  onLeave?: () => void
}) {
  const [rawQuery, setRawQuery] = useState('')
  const [colorFilter, setColorFilter] = useState<Set<string>>(new Set())
  const [cmcFilter, setCmcFilter] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)

  const config = FORMAT_CONFIGS[format] ?? FORMAT_CONFIGS.Freeform

  // Construct query string for Scryfall
  const scryfallQuery = useMemo(() => {
    const parts: string[] = []
    if (rawQuery.trim()) {
      parts.push(rawQuery.trim())
    } else {
      // Default query when empty: popular staples
      parts.push('game:paper -t:basic')
    }

    if (config.scryfallKey) {
      parts.push(`f:${config.scryfallKey}`)
    }

    if (colorFilter.size > 0) {
      if (colorFilter.has('C')) {
        parts.push('c:c')
      } else {
        parts.push(`c<=${[...colorFilter].join('').toLowerCase()}`)
      }
    }

    if (typeFilter) {
      parts.push(`t:${typeFilter.toLowerCase()}`)
    }

    if (cmcFilter !== null) {
      if (cmcFilter >= 7) parts.push('cmc>=7')
      else parts.push(`cmc=${cmcFilter}`)
    }

    return parts.join(' ')
  }, [rawQuery, colorFilter, typeFilter, cmcFilter])

  const { result, loading, error } = useScryfallSearch(scryfallQuery)

  const toggleColor = (c: string) => {
    const next = new Set(colorFilter)
    if (next.has(c)) next.delete(c)
    else next.add(c)
    setColorFilter(next)
  }

  const handleReset = () => {
    setRawQuery('')
    setColorFilter(new Set())
    setCmcFilter(null)
    setTypeFilter(null)
  }

  const cards = result?.data ?? []

  return (
    <div className="arena-search-panel">
      <ArenaFilterBar
        query={rawQuery}
        onQueryChange={setRawQuery}
        colorFilter={colorFilter}
        onToggleColor={toggleColor}
        cmcFilter={cmcFilter}
        onCmcChange={setCmcFilter}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        onReset={handleReset}
      />
      <ArenaCardGrid
        cards={cards}
        loading={loading}
        error={error}
        totalCards={result?.total_cards}
        countMap={countMap}
        onAdd={onAdd}
        onHover={onHover}
        onLeave={onLeave}
      />
    </div>
  )
}
