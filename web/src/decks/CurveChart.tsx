import { useMemo } from 'react'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import { isLandCard, fallbackCmc, basicLandKind, isManaSourceCard, type BasicLandKind } from './deckUtils'
import { parseManaSymbols, ManaPip } from './ArenaManaSymbols'
import Icon from '../ui/Icon'
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

  const { buckets, maxBucket, totalLands, totalCreatures, totalSpells, avgCmc, pips, basics, nonbasicLands, sourceLands, sourceNonlands, distByCmc } = useMemo(() => {
    const b = Array(8).fill(0) as number[]
    let lands = 0
    let creatures = 0
    let spells = 0
    let totalSpellCmc = 0
    let spellCount = 0
    const pipCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }
    const basicCounts: Record<BasicLandKind, number> = { Plains: 0, Island: 0, Swamp: 0, Mountain: 0, Forest: 0, Wastes: 0 }
    let nonbasic = 0
    let srcLands = 0
    let srcNonlands = 0
    const dist: Record<string, number>[] = Array.from({ length: 8 }, () => ({ W: 0, U: 0, B: 0, R: 0, G: 0 }))

    for (const c of cards) {
      const key = `${c.setCode}/${c.cardNumber}`
      const entry = meta?.get(key) ?? meta?.get(c.cardName.toLowerCase())

      let cmc = 0
      let typeLine = ''
      let manaCost = ''
      let oracleText = ''

      if (typeof entry === 'number') {
        cmc = entry
      } else if (entry && typeof entry === 'object') {
        cmc = entry.cmc ?? 0
        typeLine = entry.typeLine ?? ''
        manaCost = entry.manaCost ?? ''
        oracleText = entry.oracleText ?? ''
      } else {
        cmc = fallbackCmc(c.cardName)
      }

      if (isLandCard(c.cardName, typeLine)) {
        lands += c.amount
        srcLands += c.amount
        const kind = basicLandKind(c.cardName)
        if (kind) basicCounts[kind] += c.amount
        else nonbasic += c.amount
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

        if (isManaSourceCard(typeLine, oracleText)) srcNonlands += c.amount

        if (manaCost) {
          const syms = parseManaSymbols(manaCost)
          for (const s of syms) {
            const up = s.toUpperCase()
            if (up in pipCounts) {
              pipCounts[up] += c.amount
            }
            if (up in dist[idx]) {
              dist[idx][up] += c.amount
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
      basics: basicCounts,
      nonbasicLands: nonbasic,
      sourceLands: srcLands,
      sourceNonlands: srcNonlands,
      distByCmc: dist,
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
  const donutGradient = (entries: [string, number][], total: number) => {
    if (total <= 0) return 'conic-gradient(#3a3a3a 0deg 360deg)'
    let acc = 0
    return `conic-gradient(${entries.map(([sym, cnt]) => {
      const m = COLOR_META[sym] ?? COLOR_META.C
      const start = (acc / total) * 360
      acc += cnt
      const end = (acc / total) * 360
      return `${m.color} ${start}deg ${end}deg`
    }).join(', ')})`
  }
  const gradient = donutGradient(activePips, totalPips)

  const BASIC_SYMBOLS: { kind: BasicLandKind; symbol: string }[] = [
    { kind: 'Plains', symbol: 'W' },
    { kind: 'Island', symbol: 'U' },
    { kind: 'Swamp', symbol: 'B' },
    { kind: 'Mountain', symbol: 'R' },
    { kind: 'Forest', symbol: 'G' },
    { kind: 'Wastes', symbol: 'C' },
  ]
  const activeBasics = BASIC_SYMBOLS.map(({ kind, symbol }) => ({ kind, symbol, count: basics[kind] })).filter((e) => e.count > 0)
  const totalBasics = activeBasics.reduce((s, e) => s + e.count, 0)
  const basicsGradient = donutGradient(activeBasics.map((e) => [e.symbol, e.count]), totalBasics)

  const totalSources = sourceLands + sourceNonlands
  const sourcesGradient = donutGradient([['G', sourceLands], ['C', sourceNonlands]], totalSources)

  const distMax = Math.max(1, ...distByCmc.map((d) => Object.values(d).reduce((s, v) => s + v, 0)))
  const DIST_ORDER = ['W', 'U', 'B', 'R', 'G']

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
          <span className="curve-stat-name"><Icon name="tree" size={12} /> {t('decks', 'builder_lands')}</span>
          <span className="curve-stat-val">{totalLands}</span>
        </div>
        <div className="curve-stat-pill">
          <span className="curve-stat-name"><Icon name="swords" size={12} /> {t('decks', 'builder_creatures')}</span>
          <span className="curve-stat-val">{totalCreatures}</span>
        </div>
        <div className="curve-stat-pill">
          <span className="curve-stat-name"><Icon name="sparkles" size={12} /> {t('decks', 'builder_spells')}</span>
          <span className="curve-stat-val">{totalSpells}</span>
        </div>
        <div className="curve-stat-pill">
          <span className="curve-stat-name"><Icon name="scale" size={12} /> {t('decks', 'avg_cmc')}</span>
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
      {totalSources > 0 && (
        <div className="curve-mana-section">
          <div className="curve-section-title">{t('decks', 'mana_sources')} · {totalSources}</div>
          <div className="curve-pips-row">
            <div
              className="curve-color-donut"
              style={{ background: sourcesGradient }}
              title={`${t('decks', 'mana_from_lands')}: ${sourceLands} · ${t('decks', 'mana_from_nonlands')}: ${sourceNonlands}`}
              aria-label="mana sources breakdown"
            >
              <span className="curve-donut-hole" />
            </div>
            <div className="curve-pips-list">
              <span className="curve-pip-item" title={t('decks', 'mana_from_lands')}>
                <Icon name="tree" size={15} />
                <span>{sourceLands}</span>
              </span>
              <span className="curve-pip-item" title={t('decks', 'mana_from_nonlands')}>
                <Icon name="sparkles" size={15} />
                <span>{sourceNonlands}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {totalBasics > 0 && (
        <div className="curve-mana-section">
          <div className="curve-section-title">
            {t('decks', 'mana_basic_lands')} · {totalBasics}
            {nonbasicLands > 0 && <span className="curve-section-sub"> · {t('decks', 'mana_nonbasic_lands')}: {nonbasicLands}</span>}
          </div>
          <div className="curve-pips-row">
            <div
              className="curve-color-donut"
              style={{ background: basicsGradient }}
              title={activeBasics.map((e) => `${e.kind}:${e.count}`).join(' ')}
              aria-label="basic land breakdown"
            >
              <span className="curve-donut-hole" />
            </div>
            <div className="curve-pips-list">
              {activeBasics.map((e) => (
                <span key={e.kind} className="curve-pip-item" title={`${e.count} ${e.kind}`}>
                  <ManaPip symbol={e.symbol} size={15} />
                  <span>{e.count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {totalPips > 0 && (
        <div className="curve-mana-section">
          <div className="curve-section-title">{t('decks', 'mana_distribution')}</div>
          <div className="curve-dist-rows">
            {distByCmc.map((d, i) => {
              const total = DIST_ORDER.reduce((s, k) => s + d[k], 0)
              if (total === 0) return null
              return (
                <div key={i} className="curve-dist-row">
                  <span className="curve-dist-label">{i === 7 ? '7+' : i}</span>
                  <div className="curve-dist-track">
                    {DIST_ORDER.map((k) => {
                      const w = (d[k] / distMax) * 100
                      if (w <= 0) return null
                      return (
                        <div
                          key={k}
                          className="curve-dist-seg"
                          style={{ width: `${w}%`, background: (COLOR_META[k] ?? COLOR_META.C).color }}
                          title={`${k}: ${d[k]}`}
                        />
                      )
                    })}
                  </div>
                  <span className="curve-dist-total">{total}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
