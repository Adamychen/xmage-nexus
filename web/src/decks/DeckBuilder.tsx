import { useEffect, useMemo, useState, useRef } from 'react'
import { getDeckStorage } from './storage'
import type { DeckV2 } from './types'
import { deckMainCount, deckSideCount } from './types'
import { exportDck, exportArena, parseAnyDeck } from './parseDck'
import type { ScryfallSearchCard } from './scryfallSearch'
import SearchPanel from './SearchPanel'
import DeckListPanel from './DeckListPanel'
import CurveChart from './CurveChart'
import { useStore, setMyDeck } from '../state/store'
import type { DeckCard } from '../lobby/decks'
import './DeckBuilder.css'

function deckCardKey(c: DeckCard): string { return `${c.setCode}:${c.cardNumber}:${c.cardName}` }

export default function DeckBuilder({ deckId, onClose }: { deckId: string; onClose: () => void }) {
  const [deck, setDeck] = useState<DeckV2 | null>(null)
  const [name, setName] = useState('')
  const [format, setFormat] = useState<DeckV2['format']>('Freeform')
  const [metaMap, setMetaMap] = useState<Map<string, number>>(new Map())
  const [searchMeta, setSearchMeta] = useState<Map<string, ScryfallSearchCard>>(new Map())
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const storage = useMemo(() => getDeckStorage(), [])
  const equipped = useStore((s) => s.myDeck)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    void (async () => {
      const d = await storage.get(deckId)
      if (d) {
        setDeck(d); setName(d.name); setFormat(d.format)
        const m = new Map<string, number>()
        for (const c of [...d.cards, ...d.sideboard]) {
          m.set(`${c.setCode}/${c.cardNumber}`, 0)
          m.set(c.cardName.toLowerCase(), 0)
        }
        setMetaMap(m)
      }
    })()
  }, [deckId])

  const persist = async (next: DeckV2) => {
    setSaveState('saving')
    await storage.put({ ...next, updatedAt: Date.now() })
    setSaveState('saved')
    setTimeout(() => setSaveState('idle'), 1200)
  }

  const schedulePersist = (next: DeckV2) => {
    setDeck(next)
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => { void persist(next) }, 800)
  }

  const handleAddFromSearch = (card: ScryfallSearchCard) => {
    if (!deck) return
    const setCode = card.set.toUpperCase()
    const cardNumber = card.collector_number
    const cardName = card.name
    const key = `${setCode}:${cardNumber}:${cardName}`
    const existingIdx = deck.cards.findIndex((c) => deckCardKey(c) === key)
    let nextCards: DeckCard[]
    if (existingIdx >= 0) {
      nextCards = deck.cards.map((c, i) => i === existingIdx ? { ...c, amount: Math.min(99, c.amount + 1) } : c)
    } else {
      nextCards = [...deck.cards, { cardName, setCode, cardNumber, amount: 1 }]
    }
    const m = new Map(searchMeta)
    m.set(`${setCode}/${cardNumber}`, card)
    m.set(cardName.toLowerCase(), card)
    setSearchMeta(m)
    const mm = new Map(metaMap)
    mm.set(`${setCode}/${cardNumber}`, card.cmc)
    mm.set(cardName.toLowerCase(), card.cmc)
    setMetaMap(mm)
    schedulePersist({ ...deck, cards: nextCards, coverCard: deck.coverCard ?? nextCards[0] })
  }

  const updateMetaForDeck = (cards: DeckCard[]) => {
    const m = new Map(metaMap)
    const toFetch: DeckCard[] = []
    for (const c of cards) {
      const k = `${c.setCode}/${c.cardNumber}`
      if (!m.has(k) && c.setCode && c.cardNumber !== '0') toFetch.push(c)
    }
    if (toFetch.length === 0) return
    for (const c of toFetch.slice(0, 8)) {
      fetch(`https://api.scryfall.com/cards/${c.setCode}/${c.cardNumber}?format=json`, { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return
          const cmc = data.cmc ?? 0
          setMetaMap((prev) => {
            const nxt = new Map(prev)
            nxt.set(`${c.setCode}/${c.cardNumber}`, cmc)
            nxt.set(c.cardName.toLowerCase(), cmc)
            return nxt
          })
        }).catch(() => {})
    }
  }

  useEffect(() => { if (deck) updateMetaForDeck(deck.cards) }, [deck?.cards.length])

  const handleInc = (k: string) => {
    if (!deck) return
    const isSide = k.startsWith('sb:')
    const key = isSide ? k.slice(3) : k
    if (isSide) {
      schedulePersist({ ...deck, sideboard: deck.sideboard.map((c) => deckCardKey(c) === key ? { ...c, amount: Math.min(99, c.amount + 1) } : c) })
    } else {
      schedulePersist({ ...deck, cards: deck.cards.map((c) => deckCardKey(c) === key ? { ...c, amount: Math.min(99, c.amount + 1) } : c) })
    }
  }
  const handleDec = (k: string) => {
    if (!deck) return
    const isSide = k.startsWith('sb:')
    const key = isSide ? k.slice(3) : k
    if (isSide) {
      const next = deck.sideboard.flatMap((c) => deckCardKey(c) === key ? (c.amount <= 1 ? [] : [{ ...c, amount: c.amount - 1 }]) : [c])
      schedulePersist({ ...deck, sideboard: next })
    } else {
      const next = deck.cards.flatMap((c) => deckCardKey(c) === key ? (c.amount <= 1 ? [] : [{ ...c, amount: c.amount - 1 }]) : [c])
      schedulePersist({ ...deck, cards: next })
    }
  }
  const handleRemove = (k: string) => {
    if (!deck) return
    const isSide = k.startsWith('sb:')
    const key = isSide ? k.slice(3) : k
    if (isSide) schedulePersist({ ...deck, sideboard: deck.sideboard.filter((c) => deckCardKey(c) !== key) })
    else schedulePersist({ ...deck, cards: deck.cards.filter((c) => deckCardKey(c) !== key) })
  }
  const handleSetCover = (c: DeckCard) => { if (!deck) return; schedulePersist({ ...deck, coverCard: c }) }

  const mainByCmc = useMemo(() => {
    const map = new Map<number, DeckCard[]>()
    for (let i = 0; i <= 7; i++) map.set(i, [])
    if (!deck) return map
    for (const c of deck.cards) {
      const k = `${c.setCode}/${c.cardNumber}`
      const cmc = metaMap.get(k) ?? metaMap.get(c.cardName.toLowerCase()) ?? 0
      const bucket = cmc >= 7 ? 7 : cmc
      map.get(bucket)!.push(c)
    }
    return map
  }, [deck, metaMap])

  const mainCount = deck ? deckMainCount(deck) : 0
  const sideCount = deck ? deckSideCount(deck) : 0
  const valid = mainCount >= 60 && sideCount <= 15
  const coverKey = deck?.coverCard ? deckCardKey(deck.coverCard) : null

  if (!deck) return <div className="deck-builder loading">Cargando mazo…</div>

  return (
    <div className="deck-builder">
      <header className="deck-builder-top">
        <button type="button" className="builder-back" onClick={onClose}>← Galería</button>
        <input className="builder-name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => { if (name.trim() && name !== deck.name) schedulePersist({ ...deck, name: name.trim() }) }} placeholder="Nombre del mazo" />
        <select value={format} onChange={(e) => { const f = e.target.value as DeckV2['format']; setFormat(f); schedulePersist({ ...deck, format: f }) }} className="builder-format">
          <option>Freeform</option><option>Standard</option><option>Modern</option><option>Pioneer</option><option>Commander</option><option>Brawl</option>
        </select>
        <span className={`builder-count ${valid ? 'ok' : 'bad'}`}>{mainCount}/60 {sideCount > 0 && `· SB ${sideCount}/15`}</span>
        <span className="builder-save">{saveState === 'saving' ? 'Guardando…' : saveState === 'saved' ? 'Guardado ✓' : ''}</span>
        <div className="builder-actions">
          <button type="button" className="builder-act" onClick={async () => {
            const text = exportDck(deck)
            try { await navigator.clipboard.writeText(text) } catch {}
            const blob = new Blob([text], { type: 'text/plain' }); const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = `${deck.name}.dck`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000)
          }}>Export .DCK</button>
          <button type="button" className="builder-act" onClick={async () => {
            const text = exportArena(deck)
            try { await navigator.clipboard.writeText(text) } catch {}
            const blob = new Blob([text], { type: 'text/plain' }); const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url; a.download = `${deck.name}.txt`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000)
          }}>Export Arena</button>
          <button type="button" className={`builder-act primary ${equipped?.name === deck.name ? 'is-equipped' : ''}`} onClick={() => { setMyDeck(deck); }}> {equipped?.name === deck.name ? '✓ Equipado' : 'Equipar'}</button>
          <button type="button" className="builder-done" onClick={onClose}>Done</button>
        </div>
      </header>

      <div className="deck-builder-body">
        <aside className="builder-left">
          <SearchPanel onAdd={handleAddFromSearch} />
        </aside>
        <section className="builder-right">
          <div className="builder-curve">
            <span className="curve-title">Curva de maná</span>
            <CurveChart cards={deck.cards} meta={metaMap} />
          </div>
          <div className="builder-import-mini">
            <textarea placeholder="Pega .dck o Arena aquí y pulsa Añadir…  Ej: 4 [LEA:292] Mountain" rows={2} id="mini-import" />
            <button type="button" className="mini-add-btn" onClick={() => {
              const el = document.getElementById('mini-import') as HTMLTextAreaElement | null
              if (!el || !el.value.trim()) return
              const parsed = parseAnyDeck(el.value, deck.name)
              if (!parsed) return
              const merged: DeckCard[] = [...deck.cards]
              for (const c of parsed.cards) {
                const k = deckCardKey(c)
                const idx = merged.findIndex((x) => deckCardKey(x) === k)
                if (idx >= 0) merged[idx] = { ...merged[idx], amount: Math.min(99, merged[idx].amount + c.amount) }
                else merged.push(c)
              }
              const sb = [...deck.sideboard, ...parsed.sideboard]
              schedulePersist({ ...deck, cards: merged, sideboard: sb })
              el.value = ''
            }}>+ Añadir al mazo</button>
          </div>
          <DeckListPanel mainByCmc={mainByCmc} sideboard={deck.sideboard} coverKey={coverKey} onInc={handleInc} onDec={handleDec} onRemove={handleRemove} onSetCover={handleSetCover} onDropFile={async (f) => {
            const text = await f.text(); const parsed = parseAnyDeck(text, deck.name)
            if (!parsed) return
            const merged: DeckCard[] = [...deck.cards]
            for (const c of parsed.cards) {
              const k = deckCardKey(c)
              const idx = merged.findIndex((x) => deckCardKey(x) === k)
              if (idx >= 0) merged[idx] = { ...merged[idx], amount: Math.min(99, merged[idx].amount + c.amount) }
              else merged.push(c)
            }
            schedulePersist({ ...deck, cards: merged, sideboard: [...deck.sideboard, ...parsed.sideboard] })
          }} />
          {!valid && <div className="builder-warn">Mazo no válido para competitivo: {mainCount < 60 ? `${mainCount}/60 en principal` : ''} {mainCount < 60 && sideCount > 15 ? '·' : ''} {sideCount > 15 ? `banquillo ${sideCount}/15 excedido` : ''}</div>}
        </section>
      </div>
    </div>
  )
}
