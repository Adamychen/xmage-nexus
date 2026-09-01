import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import * as cmds from '../net/commands'
import { useStore } from '../state/store'
import { setState, addLog } from '../state/state'
import type { SideboardCard } from '../state/state'
import type { DeckCard } from '../lobby/decks'
import { ArenaCardStrip } from '../decks/ArenaCardStrip'
import type { CardStripMeta } from '../decks/ArenaCardStrip'
import { validateDeckForFormat } from '../decks/formatRules'
import type { DeckFormat } from '../decks/types'
import { useTranslation } from '../i18n'
import { t as tStatic } from '../i18n'
import './SideboardScreen.css'

function deckCardKey(c: DeckCard): string {
  return `${c.setCode}:${c.cardNumber}:${c.cardName}`
}

function groupInstances(cards: SideboardCard[]): DeckCard[] {
  const map = new Map<string, DeckCard>()
  for (const c of cards) {
    const key = `${c.setCode}:${c.cardNumber}:${c.name}`
    const existing = map.get(key)
    if (existing) existing.amount++
    else map.set(key, { cardName: c.name, setCode: c.setCode, cardNumber: c.cardNumber, amount: 1 })
  }
  return [...map.values()]
}

function categorizeCard(typeLine?: string): string {
  if (!typeLine) return tStatic('game', 'category_other')
  const lower = typeLine.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (lower.includes('creature') || lower.includes('criatura')) return tStatic('game', 'category_creatures')
  if (lower.includes('planeswalker')) return tStatic('game', 'category_planeswalkers')
  if (lower.includes('instant')) return tStatic('game', 'category_instants')
  if (lower.includes('sorcery') || lower.includes('conjuro')) return tStatic('game', 'category_sorceries')
  if (lower.includes('enchantment') || lower.includes('encantamiento')) return tStatic('game', 'category_enchantments')
  if (lower.includes('artifact') || lower.includes('artefacto')) return tStatic('game', 'category_artifacts')
  if (lower.includes('land') || lower.includes('tierra')) return tStatic('game', 'category_lands')
  return tStatic('game', 'category_other')
}

export default function SideboardScreen() {
  const { t } = useTranslation()
  const screen = useStore((s) => s.sideboardScreen)
  const lobby = useStore((s) => s.lobby)
  const [main, setMain] = useState<DeckCard[]>([])
  const [side, setSide] = useState<DeckCard[]>([])
  const [metaMap, setMetaMap] = useState<Map<string, CardStripMeta>>(new Map())
  const [timeLeft, setTimeLeft] = useState(0)
  const [busy, setBusy] = useState(false)
  const [hoverPreview, setHoverPreview] = useState<{ url: string; backUrl?: string | null; x: number; y: number; name?: string } | null>(null)
  const [mainFilter, setMainFilter] = useState('')
  const [sideFilter, setSideFilter] = useState('')
  const [isMainDragOver, setIsMainDragOver] = useState(false)
  const [isSideDragOver, setIsSideDragOver] = useState(false)
  const submitRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    if (!screen) return
    setMain(groupInstances(screen.maindeck))
    setSide(groupInstances(screen.sideboard))
    setTimeLeft(screen.timeLeft)
    setMainFilter('')
    setSideFilter('')
  }, [screen?.tableId])

  const updateMetaForCards = useCallback((cards: DeckCard[]) => {
    const toFetch: DeckCard[] = []
    for (const c of cards) {
      const k = `${c.setCode}/${c.cardNumber}`
      if (!metaMap.has(k) && !metaMap.has(c.cardName.toLowerCase())) {
        toFetch.push(c)
      }
    }
    if (toFetch.length === 0) return
    for (const c of toFetch) {
      const url = c.setCode && c.cardNumber && c.cardNumber !== '0'
        ? `https://api.scryfall.com/cards/${c.setCode}/${c.cardNumber}?format=json`
        : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(c.cardName)}`
      fetch(url, { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data) return
          const meta: CardStripMeta = {
            artCropUrl: data.image_uris?.art_crop ?? data.card_faces?.[0]?.image_uris?.art_crop ?? null,
            imageUrl: data.image_uris?.normal ?? data.card_faces?.[0]?.image_uris?.normal ?? null,
            backImageUrl: data.card_faces?.[1]?.image_uris?.normal ?? null,
            manaCost: data.mana_cost ?? data.card_faces?.[0]?.mana_cost ?? '',
            cmc: data.cmc ?? 0,
            typeLine: data.type_line ?? data.card_faces?.[0]?.type_line ?? '',
            colors: data.colors ?? data.color_identity ?? [],
            legalities: data.legalities,
          }
          setMetaMap((prev) => {
            const nxt = new Map(prev)
            nxt.set(`${c.setCode}/${c.cardNumber}`, meta)
            nxt.set(c.cardName.toLowerCase(), meta)
            return nxt
          })
        })
        .catch(() => {})
    }
  }, [metaMap])

  useEffect(() => {
    if (main.length === 0 && side.length === 0) return
    updateMetaForCards([...main, ...side])
  }, [main.length, side.length])

  const handleHover = useCallback((card: DeckCard, meta?: CardStripMeta, rect?: DOMRect) => {
    let img: string | null = meta?.imageUrl ?? null
    let backImg: string | null = meta?.backImageUrl ?? null
    if (!img) {
      const m = metaMap.get(`${card.setCode}/${card.cardNumber}`) ?? metaMap.get(card.cardName.toLowerCase())
      img = m?.imageUrl ?? null
      backImg = m?.backImageUrl ?? null
    }
    if (!img && card.setCode && card.cardNumber) {
      // fallback via scryfall helpers if we have a Scryfall card shape not available
      img = null
    }
    if (!img) return
    const previewWidth = backImg ? 520 : 255
    let x = 0
    let y = 0
    if (rect) {
      if (rect.left > window.innerWidth / 2) {
        x = Math.max(10, rect.left - previewWidth - 15)
      } else {
        x = Math.min(window.innerWidth - previewWidth - 15, rect.right + 15)
      }
      y = Math.max(30, Math.min(window.innerHeight - 380, rect.top - 40))
    } else {
      x = window.innerWidth / 2 - previewWidth / 2
      y = window.innerHeight / 2 - 180
    }
    setHoverPreview({ url: img, backUrl: backImg, x, y, name: card.cardName })
  }, [metaMap])

  const handleLeave = useCallback(() => setHoverPreview(null), [])

  const handleInc = useCallback((actionKey: string) => {
    const isSide = actionKey.startsWith('sb:')
    const key = isSide ? actionKey.slice(3) : actionKey
    if (isSide) {
      setSide((prev) => prev.map((c) => (deckCardKey(c) === key ? { ...c, amount: Math.min(99, c.amount + 1) } : c)))
    } else {
      setMain((prev) => prev.map((c) => (deckCardKey(c) === key ? { ...c, amount: Math.min(99, c.amount + 1) } : c)))
    }
  }, [])

  const handleDec = useCallback((actionKey: string) => {
    const isSide = actionKey.startsWith('sb:')
    const key = isSide ? actionKey.slice(3) : actionKey
    if (isSide) {
      setSide((prev) => prev.flatMap((c) => (deckCardKey(c) === key ? (c.amount <= 1 ? [] : [{ ...c, amount: c.amount - 1 }]) : [c])))
    } else {
      setMain((prev) => prev.flatMap((c) => (deckCardKey(c) === key ? (c.amount <= 1 ? [] : [{ ...c, amount: c.amount - 1 }]) : [c])))
    }
  }, [])

  const handleRemove = useCallback((actionKey: string) => {
    const isSide = actionKey.startsWith('sb:')
    const key = isSide ? actionKey.slice(3) : actionKey
    if (isSide) {
      setSide((prev) => prev.filter((c) => deckCardKey(c) !== key))
    } else {
      setMain((prev) => prev.filter((c) => deckCardKey(c) !== key))
    }
  }, [])

  const moveOneToSide = useCallback((actionKey: string) => {
    const key = actionKey.startsWith('sb:') ? actionKey.slice(3) : actionKey
    // if called from side, ignore; only main -> side
    const src = main.find((c) => deckCardKey(c) === key)
    if (!src) return
    setMain((prev) => prev.flatMap((c) => (deckCardKey(c) === key ? (c.amount <= 1 ? [] : [{ ...c, amount: c.amount - 1 }]) : [c])))
    setSide((prev) => {
      const idx = prev.findIndex((c) => deckCardKey(c) === key)
      if (idx >= 0) return prev.map((c, i) => (i === idx ? { ...c, amount: c.amount + 1 } : c))
      return [...prev, { cardName: src.cardName, setCode: src.setCode, cardNumber: src.cardNumber, amount: 1 }]
    })
  }, [main])

  const moveOneToMain = useCallback((actionKey: string) => {
    const key = actionKey.startsWith('sb:') ? actionKey.slice(3) : actionKey
    const src = side.find((c) => deckCardKey(c) === key)
    if (!src) return
    setSide((prev) => prev.flatMap((c) => (deckCardKey(c) === key ? (c.amount <= 1 ? [] : [{ ...c, amount: c.amount - 1 }]) : [c])))
    setMain((prev) => {
      const idx = prev.findIndex((c) => deckCardKey(c) === key)
      if (idx >= 0) return prev.map((c, i) => (i === idx ? { ...c, amount: c.amount + 1 } : c))
      return [...prev, { cardName: src.cardName, setCode: src.setCode, cardNumber: src.cardNumber, amount: 1 }]
    })
  }, [side])

  const handleDropOnMain = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsMainDragOver(false)
    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return
    try {
      const data = JSON.parse(raw)
      if (data.source === 'sideboard' && data.key) {
        moveOneToMain(data.key)
      }
    } catch {}
  }, [moveOneToMain])

  const handleDropOnSide = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsSideDragOver(false)
    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return
    try {
      const data = JSON.parse(raw)
      if (data.source === 'main' && data.key) {
        moveOneToSide(data.key)
      } else if (data.source === 'sideboard' && data.key) {
        // reordering within same zone ignored
      }
    } catch {}
  }, [moveOneToSide])

  const submitDeck = useCallback(async () => {
    if (!screen || busy) return
    setBusy(true)
    try {
      const deck = {
        name: screen.deckName,
        cards: main,
        sideboard: side,
      }
      const result = await cmds.submitDeck(screen.tableId, deck)
      if (result.ok) {
        setState({ sideboardScreen: null })
        addLog('partida', t('game', 'sideboard_submit'))
      } else {
        addLog('error', `${t('errors', 'send_failed')}: ${result.error ?? t('errors', 'generic_error')}`)
      }
    } finally {
      setBusy(false)
    }
  }, [screen, main, side, busy])

  useEffect(() => { submitRef.current = submitDeck }, [submitDeck])

  useEffect(() => {
    if (!screen || timeLeft <= 0) return
    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer)
          void submitRef.current()
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [screen?.tableId])

  const formatForValidation: DeckFormat = useMemo(() => {
    if (screen?.limited) return 'Freeform' as DeckFormat
    // try to infer from lobby table deckType
    const tableId = screen?.tableId
    if (tableId && lobby) {
      const tables = Array.isArray(lobby.tables) ? lobby.tables : []
      const found = (tables as any[]).find((t: any) => t.tableId === tableId || t.id === tableId)
      const deckType = found?.deckType ?? found?.options?.deckType ?? ''
      const norm = String(deckType).toLowerCase()
      if (norm.includes('commander') || norm.includes('brawl')) return 'Commander'
      if (norm.includes('standard')) return 'Standard'
      if (norm.includes('modern')) return 'Modern'
      if (norm.includes('pioneer')) return 'Pioneer'
      if (norm.includes('legacy')) return 'Legacy'
      if (norm.includes('vintage')) return 'Vintage'
      if (norm.includes('pauper')) return 'Pauper'
      if (norm.includes('historic')) return 'Historic'
      if (norm.includes('timeless')) return 'Timeless'
    }
    return 'Standard'
  }, [screen?.limited, screen?.tableId, lobby])

  const validation = useMemo(() => {
    if (main.length === 0 && side.length === 0) return { isValid: true, issues: [] as any[], cardIssues: new Map() }
    const fakeDeck: any = {
      name: screen?.deckName ?? t('game', 'sideboard_main'),
      cards: main,
      sideboard: side,
      format: formatForValidation,
      id: 'sideboard-tmp',
      colors: [],
      createdAt: 0,
      updatedAt: 0,
      source: 'custom',
    }
    return validateDeckForFormat(fakeDeck, metaMap)
  }, [main, side, metaMap, formatForValidation, screen?.deckName])

  if (!screen) return null

  const mainTotal = main.reduce((s, c) => s + c.amount, 0)
  const sideTotal = side.reduce((s, c) => s + c.amount, 0)
  const minMain = screen.limited ? 40 : 60
  const mainValid = mainTotal >= minMain
  const sideValid = validation.issues.filter((i: any) => i.type === 'sideboard_size').length === 0
  const timerPct = Math.max(0, (timeLeft / (screen.timeLeft || 1)) * 100)
  const timerUrgent = timeLeft <= 30

  const categoriesOrder = [
    t('game', 'category_creatures'),
    t('game', 'category_planeswalkers'),
    t('game', 'category_instants'),
    t('game', 'category_sorceries'),
    t('game', 'category_artifacts'),
    t('game', 'category_enchantments'),
    t('game', 'category_lands'),
    t('game', 'category_other'),
  ] as const
  const groupedMain = new Map<string, DeckCard[]>()
  for (const cat of categoriesOrder) groupedMain.set(cat, [])
  const filteredMainForGroup = mainFilter.trim()
    ? main.filter((c) => c.cardName.toLowerCase().includes(mainFilter.toLowerCase()) || c.setCode.toLowerCase().includes(mainFilter.toLowerCase()))
    : main
  for (const card of filteredMainForGroup) {
    const meta = metaMap.get(`${card.setCode}/${card.cardNumber}`) ?? metaMap.get(card.cardName.toLowerCase())
    const cat = categorizeCard(meta?.typeLine)
    const list = groupedMain.get(cat) ?? groupedMain.get(t('game', 'category_other'))!
    list.push(card)
  }

  const filteredSide = sideFilter.trim()
    ? side.filter((c) => c.cardName.toLowerCase().includes(sideFilter.toLowerCase()) || c.setCode.toLowerCase().includes(sideFilter.toLowerCase()))
    : side

  return (
    <div className="sideboard-backdrop" role="presentation">
      <section className="sideboard-screen" role="dialog" aria-modal="true">
        <div className="sideboard-header">
          <div className="sideboard-title">
            <h2>Sideboard</h2>
            <span className="sideboard-deck-name">{screen.deckName}</span>
          </div>
          <div className={`sideboard-timer ${timerUrgent ? 'urgent' : ''}`}>
            <div className="sideboard-timer-bar" style={{ width: `${timerPct}%` }} />
            <span className="sideboard-timer-text">{formatTime(timeLeft)}</span>
          </div>
        </div>

        <div className="sideboard-columns">
          <div
            className={`sideboard-column ${isMainDragOver ? 'is-drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!isMainDragOver) setIsMainDragOver(true) }}
            onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsMainDragOver(false) }}
            onDrop={handleDropOnMain}
          >
            <div className="sideboard-col-header">
              <h3>{t('game', 'sideboard_main')}</h3>
              <span className={`sideboard-col-count ${mainValid ? 'valid' : 'invalid'}`}>{mainTotal}</span>
            </div>
            {main.length > 10 && (
              <input
                className="sideboard-filter"
                type="text"
                placeholder={t('game', 'sideboard_filter')}
                value={mainFilter}
                onChange={(e) => setMainFilter(e.target.value)}
              />
            )}
            <div className="sideboard-card-list sideboard-arena-list">
              {isMainDragOver && (
                <div className="arena-drop-target-hint"><span>✨</span> {t('game', 'sideboard_main')}</div>
              )}
              {categoriesOrder.map((cat) => {
                const list = groupedMain.get(cat) ?? []
                if (list.length === 0) return null
                const count = list.reduce((s, c) => s + c.amount, 0)
                return (
                  <div key={cat} className="deck-category-section">
                    <div className="deck-category-header"><span>{cat}</span><span className="deck-category-count">{count}</span></div>
                    {list.map((card) => {
                      const k = deckCardKey(card)
                      const meta = metaMap.get(`${card.setCode}/${card.cardNumber}`) ?? metaMap.get(card.cardName.toLowerCase())
                      const issue = validation.cardIssues.get(k)?.message ?? validation.cardIssues.get(card.cardName)?.message
                      return (
                        <ArenaCardStrip
                          key={k}
                          card={card}
                          meta={meta}
                          issue={issue}
                          onInc={handleInc}
                          onDec={handleDec}
                          onRemove={handleRemove}
                          onSwap={moveOneToSide}
                          swapLabel={`${t('game', 'sideboard_side')} →`}
                          onHover={handleHover}
                          onLeave={handleLeave}
                        />
                      )
                    })}
                  </div>
                )
              })}
              {main.length === 0 && (
                <div className="deck-list-empty-hint"><span>{t('game', 'sideboard_invalid')}</span></div>
              )}
            </div>
          </div>

          <div
            className={`sideboard-column ${isSideDragOver ? 'is-drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (!isSideDragOver) setIsSideDragOver(true) }}
            onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsSideDragOver(false) }}
            onDrop={handleDropOnSide}
          >
            <div className="sideboard-col-header">
              <h3>Sideboard</h3>
              <span className={`sideboard-col-count ${sideValid ? 'valid' : 'invalid'}`}>{sideTotal}/15</span>
            </div>
            {side.length > 10 && (
              <input
                className="sideboard-filter"
                type="text"
                placeholder={t('game', 'sideboard_filter')}
                value={sideFilter}
                onChange={(e) => setSideFilter(e.target.value)}
              />
            )}
            <div className="sideboard-card-list sideboard-arena-list">
              {isSideDragOver && (
                <div className="arena-drop-target-hint"><span>✨</span> {t('game', 'sideboard_side')}</div>
              )}
              {filteredSide.map((card) => {
                const k = `sb:${deckCardKey(card)}`
                const meta = metaMap.get(`${card.setCode}/${card.cardNumber}`) ?? metaMap.get(card.cardName.toLowerCase())
                const issue = validation.cardIssues.get(k)?.message ?? validation.cardIssues.get(card.cardName)?.message
                return (
                  <ArenaCardStrip
                    key={k}
                    card={card}
                    meta={meta}
                    sideboard
                    issue={issue}
                    onInc={handleInc}
                    onDec={handleDec}
                    onRemove={handleRemove}
                    onSwap={moveOneToMain}
                    swapLabel={`← ${t('game', 'sideboard_main')}`}
                    onHover={handleHover}
                    onLeave={handleLeave}
                  />
                )
              })}
              {filteredSide.length === 0 && side.length === 0 && (
                <div className="deck-list-empty-hint"><small>{t('game', 'sideboard_main')}</small></div>
              )}
            </div>
          </div>
        </div>

        {validation.issues.length > 0 && (
          <div className="sideboard-validation">
            {validation.issues.slice(0, 3).map((iss: any, i: number) => (
              <span key={i} className={`validation-issue ${iss.severity}`}>{iss.message}</span>
            ))}
          </div>
        )}

        <div className="sideboard-footer">
          <div className="sideboard-counts">
            <span className={mainValid ? 'valid' : 'invalid'}>{t('game', 'sideboard_main_count', { count: String(mainTotal), min: String(minMain) })}</span>
            <span className={sideValid ? 'valid' : 'invalid'}>{t('game', 'sideboard_side_count', { count: String(sideTotal), max: '15' })}</span>
          </div>
          <button
            className="primary"
            disabled={busy || !mainValid}
            onClick={() => void submitDeck()}
            title={!mainValid ? `${t('game', 'sideboard_main')}: ${minMain}` : undefined}
          >
            {busy ? t('game', 'action_sending') : t('game', 'sideboard_submit')}
          </button>
        </div>
      </section>
      {hoverPreview && (
        <div
          className={`arena-floating-preview ${hoverPreview.backUrl ? 'has-back-face' : ''}`}
          style={{ left: `${hoverPreview.x}px`, top: `${hoverPreview.y}px` }}
        >
          <div className="preview-face-card">
            {hoverPreview.backUrl && <span className="preview-face-label">Anverso</span>}
            <img src={hoverPreview.url} alt={hoverPreview.name ?? 'Anverso'} />
          </div>
          {hoverPreview.backUrl && (
            <div className="preview-face-card">
              <span className="preview-face-label">Reverso</span>
              <img src={hoverPreview.backUrl} alt={`${hoverPreview.name ?? 'Carta'} (Reverso)`} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
