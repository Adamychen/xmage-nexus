import { useMemo } from 'react'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import { isLandCard, fallbackCmc } from './deckUtils'
import { parseManaSymbols, ManaPip } from './ArenaManaSymbols'
import { useTranslation } from '../i18n'
import './CurveChart.css'

export default function CurveChart({
  cards,
  meta,
}: {
  cards: DeckCard[]
  meta?: Map<string, CardStripMeta> | Map<string, number>
}) {
  const { t } = useTranslation()

  const { buckets, maxBucket, totalLands, totalCreatures, totalSpells, avgCmc, pips } = useMemo(() => {
    const b = Array(8).fill(0) as number[]
    let lands = 0
    let creatures = 0
    let spells = 0
    let totalSpellCmc = 0
    let spellCount = 0
    const pipCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }

    for (const c of cards) {
      const key = `${c.setCode}/${c.cardNumber}`
      const entry = meta?.get(key) ?? meta?.get(c.cardName.toLowerCase())

      let cmc = 0
      let typeLine = ''
      let manaCost = ''

      if (typeof entry === 'number') {
        cmc = entry
      } else if (entry && typeof entry === 'object') {
        cmc = entry.cmc ?? 0
        typeLine = entry.typeLine ?? ''
        manaCost = entry.manaCost ?? ''
      } else {
        cmc = fallbackCmc(c.cardName)
      }

      if (isLandCard(c.cardName, typeLine)) {
        lands += c.amount
      } else {
        if (/creature|criatura/i.test(typeLine)) {
          creatures += c.amount
        } else {
          spells += c.amount
        }
        spellCount += c.amount
        totalSpellCmc += cmc * c.amount

        const idx = cmc >= 7 ? 7 : Math.max(0, Math.floor(cmc))
        b[idx] += c.amount

        if (manaCost) {
          const syms = parseManaSymbols(manaCost)
          for (const s of syms) {
            const up = s.toUpperCase()
            if (up in pipCounts) {
              pipCounts[up] += c.amount
            }
          }
        }
      }
    }

    let max = 0
    for (const count of b) {
      if (count > max) max = count
    }
    if (max === 0) max = 1

    const avg = spellCount > 0 ? (totalSpellCmc / spellCount).toFixed(1) : '0.0'

    return {
      buckets: b,
      maxBucket: max,
      totalLands: lands,
      totalCreatures: creatures,
      totalSpells: spells,
      avgCmc: avg,
      pips: pipCounts,
    }
  }, [cards, meta])

  const activePips = Object.entries(pips).filter(([_, count]) => count > 0)
  const totalPips = activePips.reduce((s, [, c]) => s + c, 0)
  const COLOR_META: Record<string, { label: string; color: string }> = {
    W: { label: 'W', color: '#f0e6c8' },
    U: { label: 'U', color: '#5aa0d8' },
    B: { label: 'B', color: '#7a7a7a' },
    R: { label: 'R', color: '#d94a3a' },
    G: { label: 'G', color: '#4caf6e' },
    C: { label: 'C', color: '#9aa0a6' },
  }
  let accum = 0
  const gradient = totalPips > 0
    ? `conic-gradient(${activePips.map(([sym, cnt]) => {
        const meta = COLOR_META[sym] ?? COLOR_META.C
        const start = (accum / totalPips) * 360
        accum += cnt
        const end = (accum / totalPips) * 360
        return `${meta.color} ${start}deg ${end}deg`
      }).join(', ')})`
    : 'conic-gradient(#3a3a3a 0deg 360deg)'

  return (
    <div className="curve-chart">
      <div className="curve-bars">
        {buckets.map((v, i) => {
          const heightPercent = v > 0 ? Math.max(8, (v / maxBucket) * 100) : 0
          return (
            <div key={i} className="curve-bar-col">
              <span className="curve-count">{v > 0 ? v : ''}</span>
              <div className="curve-bar-track">
                <div
                  className="curve-bar-fill"
                  style={{ height: `${heightPercent}%` }}
                  title={`CMC ${i === 7 ? '7+' : i}: ${v}`}
                />
              </div>
              <span className="curve-label">{i === 7 ? '7+' : i}</span>
            </div>
          )
        })}
      </div>

      <div className="curve-stats-grid">
        <div className="curve-stat-pill">
          <span className="curve-stat-name">🏞️ {t('decks', 'builder_lands')}</span>
          <span className="curve-stat-val">{totalLands}</span>
        </div>
        <div className="curve-stat-pill">
          <span className="curve-stat-name">⚔️ {t('decks', 'builder_creatures')}</span>
          <span className="curve-stat-val">{totalCreatures}</span>
        </div>
        <div className="curve-stat-pill">
          <span className="curve-stat-name">✨ {t('decks', 'builder_spells')}</span>
          <span className="curve-stat-val">{totalSpells}</span>
        </div>
        <div className="curve-stat-pill">
          <span className="curve-stat-name">⚖️ {t('decks', 'avg_cmc')}</span>
          <span className="curve-stat-val">{avgCmc}</span>
        </div>
      </div>

      {activePips.length > 0 && (
        <div className="curve-pips-row">
          <div
            className="curve-color-donut"
            style={{ background: gradient }}
            title={activePips.map(([s, c]) => `${s}:${c}`).join(' ')}
            aria-label="color breakdown"
          >
            <span className="curve-donut-hole" />
          </div>
          <div className="curve-pips-list">
            {activePips.map(([symbol, count]) => (
              <span key={symbol} className="curve-pip-item" title={`${count} ${symbol}`}>
                <ManaPip symbol={symbol} size={15} />
                <span>{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
