import { useEffect, useMemo, useState, useRef } from 'react'
import { getDeckStorage } from './storage'
import type { DeckV2 } from './types'
import { deckMainCount, deckSideCount } from './types'
import { exportDck, exportArena, exportTxt, parseAnyDeck } from './parseDck'
import type { ScryfallSearchCard } from './scryfallSearch'
import { scryfallCardArtCrop, scryfallCardImage, scryfallCardBackImage } from './scryfallSearch'
import SearchPanel from './SearchPanel'
import DeckListPanel from './DeckListPanel'
import { ArenaDeckHeader } from './ArenaDeckHeader'
import { BasicLandAdder } from './BasicLandAdder'
import { BASIC_LAND_PRESETS, type BasicLandPreset } from './deckUtils'
import { SampleHandModal } from './SampleHandModal'
import { CardPrintingsModal } from './CardPrintingsModal'
import { DeckInspectorModal } from './DeckInspectorModal'
import CurveChart from './CurveChart'
import { DeckImportModal, type ImportResult } from './DeckImportModal'
import type { CardStripMeta } from './ArenaCardStrip'
import { validateDeckForFormat, type ValidationIssue } from './formatRules'
import { fetchDeckIssues, issueKeysFromReport } from './deckIssues'
import type { DeckValidationResult } from '../net/types'
import { useStore, setMyDeck } from '../state/store'
import type { DeckCard } from '../lobby/decks'
import { normalizeDeckCard } from './deckNormalize'
import { useTranslation } from '../i18n'
import LanguageSelector from '../i18n/LanguageSelector'
import { getEffectiveCardLang, setCachedCardName } from '../cards/cardLocalization'
import './DeckBuilder.css'

function deckCardKey(c: DeckCard): string {
  return `${c.setCode}:${c.cardNumber}:${c.cardName}`
}

export default function DeckBuilder({ deckId, onClose }: { deckId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [deck, setDeck] = useState<DeckV2 | null>(null)
  const [name, setName] = useState('')
  const [format, setFormat] = useState<DeckV2['format']>('Freeform')
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical')
  const [metaMap, setMetaMap] = useState<Map<string, CardStripMeta>>(new Map())
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [hoverPreview, setHoverPreview] = useState<{ url: string; backUrl?: string | null; x: number; y: number; name?: string } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const [isCollectionDragOver, setIsCollectionDragOver] = useState(false)
  const [showSampleHand, setShowSampleHand] = useState(false)
  const [showInspector, setShowInspector] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [printingTargetCard, setPrintingTargetCard] = useState<DeckCard | null>(null)
  const [serverIssues, setServerIssues] = useState<DeckValidationResult | null>(null)
  const [showCurve, setShowCurve] = useState(() => {
    try {
      const saved = localStorage.getItem('nexus_deck_show_curve')
      return saved !== null ? saved === 'true' : (typeof window !== 'undefined' ? window.innerHeight > 850 : false)
    } catch {
      return false
    }
  })

  const toggleCurve = () => {
    setShowCurve((prev) => {
      const next = !prev
      try {
        localStorage.setItem('nexus_deck_show_curve', String(next))
      } catch {}
      return next
    })
  }

  const storage = useMemo(() => getDeckStorage(), [])
  const equipped = useStore((s) => s.myDeck)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    const handleGlobalDragStart = () => {
      isDraggingRef.current = true
      setIsDragging(true)
      setHoverPreview(null)
    }
    const handleGlobalDragEnd = () => {
      isDraggingRef.current = false
      setIsDragging(false)
      setHoverPreview(null)
    }
    window.addEventListener('dragstart', handleGlobalDragStart, true)
    window.addEventListener('dragend', handleGlobalDragEnd, true)
    window.addEventListener('drop', handleGlobalDragEnd, true)
    return () => {
      window.removeEventListener('dragstart', handleGlobalDragStart, true)
      window.removeEventListener('dragend', handleGlobalDragEnd, true)
      window.removeEventListener('drop', handleGlobalDragEnd, true)
    }
  }, [])

  // Load deck data on mount
  useEffect(() => {
    void (async () => {
      const d = await storage.get(deckId)
      if (d) {
        setDeck(d)
        setName(d.name)
        setFormat(d.format)
        updateMetaForDeck([...d.cards, ...d.sideboard])
      }
    })()
  }, [deckId])

  // Pre-validación contra la BD de cartas del servidor (advisory, no bloquea).
  // Se ejecuta al abrir el mazo Y en vivo tras cada edición (debounce: la
  // validación hace un round-trip al proxy, no por cada tecla).
  const lastValidatedRef = useRef<DeckV2 | null>(null)
  useEffect(() => {
    setServerIssues(null)
    void (async () => {
      const d = await storage.get(deckId)
      if (!d) return
      lastValidatedRef.current = d
      const report = await fetchDeckIssues(d)
      setServerIssues(report)
    })()
  }, [deckId])

  useEffect(() => {
    if (!deck || deck === lastValidatedRef.current) return
    const timer = window.setTimeout(() => {
      lastValidatedRef.current = deck
      void fetchDeckIssues(deck).then((report) => setServerIssues(report))
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [deck])

  const persist = async (next: DeckV2) => {
    setSaveState('saving')
    await storage.put({ ...next, updatedAt: Date.now() })
    setSaveState('saved')
    setTimeout(() => setSaveState('idle'), 1200)
  }

  const schedulePersist = (next: DeckV2) => {
    setDeck(next)
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      void persist(next)
    }, 800)
  }

  // Count map for Diamond indicators in collection grid
  const countMap = useMemo(() => {
    const m = new Map<string, number>()
    if (!deck) return m
    for (const c of [...deck.cards, ...deck.sideboard]) {
      const keySetNum = `${c.setCode.toUpperCase()}/${c.cardNumber}`
      const keyName = c.cardName.toLowerCase()
      m.set(keySetNum, (m.get(keySetNum) ?? 0) + c.amount)
      m.set(keyName, (m.get(keyName) ?? 0) + c.amount)
    }
    return m
  }, [deck])

  // CMC numbers map for curve
  const cmcNumberMap = useMemo(() => {
    const m = new Map<string, number>()
    metaMap.forEach((meta, k) => {
      if (meta.cmc !== undefined) m.set(k, meta.cmc)
    })
    return m
  }, [metaMap])

  // Fetch Scryfall metadata for deck cards
  const updateMetaForDeck = (cards: DeckCard[]) => {
    const m = new Map(metaMap)
    const toFetch: DeckCard[] = []
    for (const c of cards) {
      const k = `${c.setCode}/${c.cardNumber}`
      if (!m.has(k) && !m.has(c.cardName.toLowerCase())) {
        toFetch.push(c)
      }
    }
    if (toFetch.length === 0) return

    const cardLang = getEffectiveCardLang()
    for (const c of toFetch) {
      const hasSetAndNum = c.setCode && c.cardNumber && c.cardNumber !== '0'
      const localizedUrl = hasSetAndNum && cardLang && cardLang !== 'en'
        ? `https://api.scryfall.com/cards/${c.setCode.toLowerCase()}/${c.cardNumber}/${cardLang}?format=json`
        : null
      const defaultUrl = hasSetAndNum
        ? `https://api.scryfall.com/cards/${c.setCode.toLowerCase()}/${c.cardNumber}?format=json`
        : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(c.cardName)}`

      const fetchMetadata = async () => {
        try {
          if (localizedUrl) {
            const locRes = await fetch(localizedUrl, { headers: { Accept: 'application/json' } })
            if (locRes.ok) return await locRes.json()
          }
          const defRes = await fetch(defaultUrl, { headers: { Accept: 'application/json' } })
          if (defRes.ok) return await defRes.json()
          return null
        } catch {
          return null
        }
      }

      fetchMetadata()
        .then((data) => {
          if (!data) return
          const printedName = data.printed_name || data.card_faces?.[0]?.printed_name
          if (printedName && cardLang && cardLang !== 'en') {
            setCachedCardName(c.cardName, printedName, cardLang)
          }
          const meta: CardStripMeta = {
            artCropUrl: data.image_uris?.art_crop ?? data.card_faces?.[0]?.image_uris?.art_crop ?? null,
            imageUrl: data.image_uris?.normal ?? data.card_faces?.[0]?.image_uris?.normal ?? null,
            backImageUrl: data.card_faces?.[1]?.image_uris?.normal ?? null,
            manaCost: data.mana_cost ?? data.card_faces?.[0]?.mana_cost ?? '',
            cmc: data.cmc ?? 0,
            typeLine: data.printed_type_line ?? data.type_line ?? data.card_faces?.[0]?.type_line ?? '',
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
  }

  useEffect(() => {
    if (deck) updateMetaForDeck([...deck.cards, ...deck.sideboard])
  }, [deck?.cards.length, deck?.sideboard.length])

  const handleAddFromSearch = (card: ScryfallSearchCard) => {
    if (!deck) return
    const raw = normalizeDeckCard({ cardName: card.name, setCode: card.set.toUpperCase(), cardNumber: card.collector_number, amount: 1 })
    const setCode = raw.setCode
    const cardNumber = raw.cardNumber
    const cardName = raw.cardName
    const key = `${setCode}:${cardNumber}:${cardName}`

    if (card.printed_name) {
      setCachedCardName(card.name, card.printed_name, card.lang || getEffectiveCardLang())
    }

    const existingIdx = deck.cards.findIndex((c) => deckCardKey(c) === key)
    let nextCards: DeckCard[]
    if (existingIdx >= 0) {
      nextCards = deck.cards.map((c, i) => (i === existingIdx ? { ...c, amount: Math.min(99, c.amount + 1) } : c))
    } else {
      nextCards = [...deck.cards, { cardName, setCode, cardNumber, amount: 1 }]
    }

    const m = new Map(metaMap)
    const meta: CardStripMeta = {
      artCropUrl: scryfallCardArtCrop(card),
      imageUrl: scryfallCardImage(card),
      backImageUrl: scryfallCardBackImage(card),
      manaCost: card.mana_cost ?? '',
      cmc: card.cmc ?? 0,
      typeLine: card.printed_type_line ?? card.type_line ?? '',
      colors: card.colors || card.color_identity || [],
      legalities: card.legalities,
    }
    m.set(`${setCode}/${cardNumber}`, meta)
    m.set(cardName.toLowerCase(), meta)
    setMetaMap(m)

    schedulePersist({
      ...deck,
      cards: nextCards,
      coverCard: deck.coverCard ?? nextCards[0],
    })
  }

  const moveOneBetween = (from: DeckCard[], to: DeckCard[], key: string): [DeckCard[], DeckCard[]] => {
    const idx = from.findIndex((c) => deckCardKey(c) === key)
    if (idx < 0) return [from, to]
    const card = from[idx]
    const nextFrom = card.amount <= 1
      ? from.filter((_, i) => i !== idx)
      : from.map((c, i) => (i === idx ? { ...c, amount: c.amount - 1 } : c))
    const toIdx = to.findIndex((c) => deckCardKey(c) === key)
    const nextTo = toIdx >= 0
      ? to.map((c, i) => (i === toIdx ? { ...c, amount: Math.min(99, c.amount + 1) } : c))
      : [...to, { ...card, amount: 1 }]
    return [nextFrom, nextTo]
  }

  const handleSwap = (k: string) => {
    if (!deck) return
    if (k.startsWith('sb:')) {
      const [nextSide, nextCards] = moveOneBetween(deck.sideboard, deck.cards, k.slice(3))
      schedulePersist({ ...deck, cards: nextCards, sideboard: nextSide })
    } else {
      const [nextCards, nextSide] = moveOneBetween(deck.cards, deck.sideboard, k)
      schedulePersist({ ...deck, cards: nextCards, sideboard: nextSide })
    }
  }

  const handleDropCardOnDeck = (cardData: any, target: 'main' | 'sideboard') => {
    if (!deck || !cardData?.cardName) return
    const setCode = (cardData.setCode || '').toUpperCase()
    const cardNumber = cardData.cardNumber || '0'
    const cardName = cardData.cardName
    const key = `${setCode}:${cardNumber}:${cardName}`
    const source: string = cardData.source ?? 'search'

    if (source === 'sideboard' && target === 'main') {
      const [nextSide, nextCards] = moveOneBetween(deck.sideboard, deck.cards, key)
      schedulePersist({ ...deck, cards: nextCards, sideboard: nextSide })
      return
    }
    if (source === 'main' && target === 'sideboard') {
      const [nextCards, nextSide] = moveOneBetween(deck.cards, deck.sideboard, key)
      schedulePersist({ ...deck, cards: nextCards, sideboard: nextSide })
      return
    }

    if (target === 'main') {
      const existingIdx = deck.cards.findIndex((c) => deckCardKey(c) === key)
      let nextCards: DeckCard[]
      if (existingIdx >= 0) {
        nextCards = deck.cards.map((c, i) => (i === existingIdx ? { ...c, amount: Math.min(99, c.amount + 1) } : c))
      } else {
        nextCards = [...deck.cards, { cardName, setCode, cardNumber, amount: 1 }]
      }
      schedulePersist({ ...deck, cards: nextCards, coverCard: deck.coverCard ?? nextCards[0] })
    } else {
      const existingIdx = deck.sideboard.findIndex((c) => deckCardKey(c) === key)
      let nextSide: DeckCard[]
      if (existingIdx >= 0) {
        nextSide = deck.sideboard.map((c, i) => (i === existingIdx ? { ...c, amount: Math.min(99, c.amount + 1) } : c))
      } else {
        nextSide = [...deck.sideboard, { cardName, setCode, cardNumber, amount: 1 }]
      }
      schedulePersist({ ...deck, sideboard: nextSide })
    }

    if (cardData.manaCost !== undefined || cardData.typeLine) {
      setMetaMap((prev) => {
        const nxt = new Map(prev)
        const meta: CardStripMeta = {
          artCropUrl: cardData.artCropUrl ?? null,
          imageUrl: cardData.imageUrl ?? null,
          backImageUrl: cardData.backImageUrl ?? null,
          manaCost: cardData.manaCost ?? '',
          cmc: cardData.cmc ?? 0,
          typeLine: cardData.typeLine ?? '',
          colors: cardData.colors ?? [],
          legalities: cardData.legalities,
        }
        nxt.set(`${setCode}/${cardNumber}`, meta)
        nxt.set(cardName.toLowerCase(), meta)
        return nxt
      })
    }
  }

  const handleInc = (k: string) => {
    if (!deck) return
    const isSide = k.startsWith('sb:')
    const key = isSide ? k.slice(3) : k
    if (isSide) {
      schedulePersist({
        ...deck,
        sideboard: deck.sideboard.map((c) => (deckCardKey(c) === key ? { ...c, amount: Math.min(99, c.amount + 1) } : c)),
      })
    } else {
      schedulePersist({
        ...deck,
        cards: deck.cards.map((c) => (deckCardKey(c) === key ? { ...c, amount: Math.min(99, c.amount + 1) } : c)),
      })
    }
  }

  const handleDec = (k: string) => {
    if (!deck) return
    const isSide = k.startsWith('sb:')
    const key = isSide ? k.slice(3) : k
    if (isSide) {
      const next = deck.sideboard.flatMap((c) =>
        deckCardKey(c) === key ? (c.amount <= 1 ? [] : [{ ...c, amount: c.amount - 1 }]) : [c]
      )
      schedulePersist({ ...deck, sideboard: next })
    } else {
      const next = deck.cards.flatMap((c) =>
        deckCardKey(c) === key ? (c.amount <= 1 ? [] : [{ ...c, amount: c.amount - 1 }]) : [c]
      )
      schedulePersist({ ...deck, cards: next })
    }
  }

  const handleRemove = (k: string) => {
    if (!deck) return
    const isSide = k.startsWith('sb:')
    const key = isSide ? k.slice(3) : k
    if (isSide) {
      schedulePersist({ ...deck, sideboard: deck.sideboard.filter((c) => deckCardKey(c) !== key) })
    } else {
      schedulePersist({ ...deck, cards: deck.cards.filter((c) => deckCardKey(c) !== key) })
    }
  }

  const handleSetCover = (c: DeckCard) => {
    if (!deck) return
    schedulePersist({ ...deck, coverCard: c })
  }

  const handleAddBasicLand = (preset: BasicLandPreset) => {
    if (!deck) return
    const existingIdx = deck.cards.findIndex(
      (c) => c.cardName.toLowerCase() === preset.name.toLowerCase()
    )
    let nextCards: DeckCard[]
    if (existingIdx >= 0) {
      nextCards = deck.cards.map((c, i) =>
        i === existingIdx ? { ...c, amount: Math.min(99, c.amount + 1) } : c
      )
    } else {
      nextCards = [
        ...deck.cards,
        { cardName: preset.name, setCode: preset.setCode, cardNumber: preset.cardNumber, amount: 1 },
      ]
    }
    schedulePersist({ ...deck, cards: nextCards, coverCard: deck.coverCard ?? nextCards[0] })
  }

  const handleRemoveBasicLand = (preset: BasicLandPreset) => {
    if (!deck) return
    const existingIdx = deck.cards.findIndex(
      (c) => c.cardName.toLowerCase() === preset.name.toLowerCase()
    )
    if (existingIdx < 0) return
    const nextCards = deck.cards.flatMap((c, i) => {
      if (i === existingIdx) {
        return c.amount <= 1 ? [] : [{ ...c, amount: c.amount - 1 }]
      }
      return [c]
    })
    schedulePersist({ ...deck, cards: nextCards })
  }

  const handleApplySuggestedLands = (
    suggested: { name: string; setCode: string; cardNumber: string; amount: number }[]
  ) => {
    if (!deck) return
    const basicNames = new Set(BASIC_LAND_PRESETS.map((p) => p.name.toLowerCase()))
    const nonBasicCards = deck.cards.filter((c) => !basicNames.has(c.cardName.toLowerCase()))
    const newLands: DeckCard[] = suggested.map((s) => ({
      cardName: s.name,
      setCode: s.setCode,
      cardNumber: s.cardNumber,
      amount: s.amount,
    }))
    const nextCards = [...nonBasicCards, ...newLands]
    schedulePersist({ ...deck, cards: nextCards, coverCard: deck.coverCard ?? nextCards[0] })
  }

  const handleChangePrinting = (card: DeckCard) => {
    setPrintingTargetCard(card)
  }

  const handleApplyPrinting = (setCode: string, cardNumber: string) => {
    if (!deck || !printingTargetCard) return
    const norm = normalizeDeckCard({ cardName: printingTargetCard.cardName, setCode, cardNumber, amount: 1 })
    setCode = norm.setCode
    cardNumber = norm.cardNumber
    const oldKey = deckCardKey(printingTargetCard)
    const updateCard = (c: DeckCard) => {
      if (deckCardKey(c) === oldKey) {
        return { ...c, setCode, cardNumber }
      }
      return c
    }
    const nextCards = deck.cards.map(updateCard)
    const nextSide = deck.sideboard.map(updateCard)
    schedulePersist({ ...deck, cards: nextCards, sideboard: nextSide })
    updateMetaForDeck([{ ...printingTargetCard, setCode, cardNumber }])
    setPrintingTargetCard(null)
  }

  const handleApplyImport = (result: ImportResult) => {
    if (!deck) return
    if (result.mode === 'replace') {
      const nextCards = result.cards
      const nextSide = result.sideboard
      schedulePersist({
        ...deck,
        cards: nextCards,
        sideboard: nextSide,
        coverCard: nextCards[0] ?? null,
      })
      updateMetaForDeck([...nextCards, ...nextSide])
    } else {
      const mergedCards: DeckCard[] = [...deck.cards]
      for (const c of result.cards) {
        const k = deckCardKey(c)
        const idx = mergedCards.findIndex((x) => deckCardKey(x) === k)
        if (idx >= 0) {
          mergedCards[idx] = { ...mergedCards[idx], amount: Math.min(99, mergedCards[idx].amount + c.amount) }
        } else {
          mergedCards.push(c)
        }
      }
      const mergedSide: DeckCard[] = [...deck.sideboard]
      for (const c of result.sideboard) {
        const k = deckCardKey(c)
        const idx = mergedSide.findIndex((x) => deckCardKey(x) === k)
        if (idx >= 0) {
          mergedSide[idx] = { ...mergedSide[idx], amount: Math.min(99, mergedSide[idx].amount + c.amount) }
        } else {
          mergedSide.push(c)
        }
      }
      schedulePersist({
        ...deck,
        cards: mergedCards,
        sideboard: mergedSide,
        coverCard: deck.coverCard ?? mergedCards[0] ?? null,
      })
      updateMetaForDeck([...result.cards, ...result.sideboard])
    }
  }

  // Hover floating card preview handler (supports dual-faced / transform cards)
  const handleHoverCard = (
    card: DeckCard | ScryfallSearchCard,
    meta?: CardStripMeta,
    rect?: DOMRect
  ) => {
    if (isDraggingRef.current) return
    let img: string | null = meta?.imageUrl ?? null
    let backImg: string | null = meta?.backImageUrl ?? null

    if (!img) {
      if ('image_uris' in card || 'card_faces' in card) {
        const sc = card as ScryfallSearchCard
        img = scryfallCardImage(sc)
        backImg = scryfallCardBackImage(sc)
      } else {
        const dc = card as DeckCard
        const m = metaMap.get(`${dc.setCode}/${dc.cardNumber}`) ?? metaMap.get(dc.cardName.toLowerCase())
        img = m?.imageUrl ?? null
        backImg = m?.backImageUrl ?? null
      }
    }

    if (!img) return

    const previewWidth = backImg ? 520 : 255
    let x = 0
    let y = 0
    if (rect) {
      // Place preview to the left of the deck strip or beside the grid card
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

    setHoverPreview({
      url: img,
      backUrl: backImg,
      x,
      y,
      name: 'name' in card ? card.name : (card as DeckCard).cardName,
    })
  }

  const handleLeaveCard = () => {
    setHoverPreview(null)
  }

  // Cover Card Art for Header
  const coverMeta = deck?.coverCard
    ? metaMap.get(`${deck.coverCard.setCode}/${deck.coverCard.cardNumber}`) ??
      metaMap.get(deck.coverCard.cardName.toLowerCase())
    : null

  const mainCount = deck ? deckMainCount(deck) : 0
  const sideCount = deck ? deckSideCount(deck) : 0
  const isCommanderFormat = format === 'Commander' || format === 'Brawl'
  const coverKey = deck?.coverCard ? deckCardKey(deck.coverCard) : null

  // Format validation report
  const validationReport = useMemo(() => {
    if (!deck) return { isValid: true, issues: [], cardIssues: new Map() }
    return validateDeckForFormat(deck, metaMap)
  }, [deck, metaMap, format])

  // merged format issues + server card issues (badge ⚠️ per strip)
  const mergedCardIssues = useMemo(() => {
    const merged = new Map(validationReport.cardIssues)
    if (!serverIssues || !deck) return merged
    const byKey = issueKeysFromReport(serverIssues)
    const addIssue = (card: { cardName: string; setCode: string; cardNumber: string }, message: string) => {
      const issue: ValidationIssue = { type: 'server_issue', message, severity: 'error', cardName: card.cardName }
      merged.set(`${card.setCode}:${card.cardNumber}:${card.cardName}`, issue)
      merged.set(card.cardName, issue)
    }
    for (const c of [...deck.cards, ...deck.sideboard]) {
      if (!byKey.has(`${c.cardName}|${c.setCode}|${c.cardNumber}`)) continue
      const miss = serverIssues.missing.find((m) => m.cardName === c.cardName && m.setCode === c.setCode && m.cardNumber === c.cardNumber)
      const mis = serverIssues.mismatches.find((m) => m.cardName === c.cardName && m.setCode === c.setCode && m.cardNumber === c.cardNumber)
      if (miss) {
        addIssue(c, miss.reason === 'OUTDATED_PRINTING' ? t('decks', 'issues_reason_outdated') : t('decks', 'issues_reason_unimplemented'))
      } else if (mis) {
        addIssue(c, t('decks', 'issues_mismatch_resolved', { resolved: mis.resolvedName }))
      }
    }
    return merged
  }, [validationReport, serverIssues, deck, t])

  if (!deck) return <div className="deck-builder loading">{t('common', 'loading')}</div>

  return (
    <div className="deck-builder">
      {/* Top Navbar */}
      <header className="arena-top-nav deck-builder-top">
        <div className="arena-nav-left">
          <button type="button" className="arena-nav-back builder-back" onClick={onClose}>
            <span>←</span> {t('decks', 'my_decks')}
          </button>
          <span className="deck-builder-title">{t('decks', 'builder_editor')}</span>
        </div>

        <div className="arena-nav-right">
          {saveState !== 'idle' && (
            <span className="builder-save-badge builder-save">
              {saveState === 'saving' ? t('common', 'loading') : `${t('common', 'done')} ✓`}
            </span>
          )}
          <LanguageSelector compact showCardLangToggle />
        </div>
      </header>

      {/* Main Builder Body Split View */}
      <div className="deck-builder-body">
        {/* Left: Card Library & Search */}
        <aside
          className={`builder-left ${isCollectionDragOver ? 'is-drag-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = e.dataTransfer.effectAllowed === 'move' ? 'move' : 'copy'
            if (!isCollectionDragOver) setIsCollectionDragOver(true)
          }}
          onDragLeave={(e) => {
            if (e.currentTarget.contains(e.relatedTarget as Node)) return
            setIsCollectionDragOver(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            setIsCollectionDragOver(false)
            const rawData = e.dataTransfer.getData('application/json')
            if (rawData) {
              try {
                const data = JSON.parse(rawData)
                if (data.source === 'main' || data.source === 'sideboard') {
                  handleDec(data.key)
                }
              } catch {}
            }
          }}
        >
          {isCollectionDragOver && (
            <div className="arena-remove-drop-hint">
              <span>🗑️</span> {t('decks', 'builder_drag_hint')}
            </div>
          )}
          <SearchPanel
            onAdd={handleAddFromSearch}
            countMap={countMap}
            format={format}
            onHover={(c, r) => handleHoverCard(c as any, undefined, r)}
            onLeave={handleLeaveCard}
          />
        </aside>

        {/* Right: Deck Panel */}
        <section className="builder-right">
          {/* Arena Deck Header Tile */}
          <ArenaDeckHeader
            name={name}
            onNameChange={(val) => {
              setName(val)
              schedulePersist({ ...deck, name: val })
            }}
            format={format}
            onFormatChange={(f) => {
              setFormat(f)
              schedulePersist({ ...deck, format: f })
            }}
            coverArtUrl={coverMeta?.artCropUrl}
            mainCount={mainCount}
            sideCount={sideCount}
            cards={deck.cards}
            metaMap={cmcNumberMap}
            issues={validationReport.issues}
            layout={layout}
            onToggleLayout={() => setLayout((l) => (l === 'vertical' ? 'horizontal' : 'vertical'))}
            isCurveOpen={showCurve}
            onToggleCurve={toggleCurve}
            onOpenInspector={() => setShowInspector(true)}
          />

          {/* Dedicated Collapsible Mana Curve & Stats Section */}
          {showCurve && (
            <div className="deck-curve-panel">
              <div className="deck-curve-panel-header">
                <span className="deck-curve-panel-title">
                  📊 {t('decks', 'builder_mana_curve')}
                </span>
                <div className="deck-curve-panel-actions">
                  <button
                    type="button"
                    className="deck-curve-inspect-btn"
                    onClick={() => setShowInspector(true)}
                    title={t('decks', 'inspect_double_click')}
                  >
                    🔍 📊
                  </button>
                  <button
                    type="button"
                    className="deck-curve-close-btn"
                    onClick={toggleCurve}
                    title={t('common', 'close')}
                  >
                    ▲
                  </button>
                </div>
              </div>
              <CurveChart cards={deck.cards} meta={metaMap} />
            </div>
          )}

          {/* Basic Land Quick Adder & Suggester */}
          <BasicLandAdder
            cards={deck.cards}
            metaMap={metaMap}
            format={format}
            onAddLand={handleAddBasicLand}
            onRemoveLand={handleRemoveBasicLand}
            onApplySuggestedLands={handleApplySuggestedLands}
          />

          {/* Deck List (Card Strips) */}
          <DeckListPanel
            cards={deck.cards}
            sideboard={deck.sideboard}
            coverKey={coverKey}
            isCommanderFormat={isCommanderFormat}
            metaMap={metaMap}
            cardIssues={mergedCardIssues}
            layout={layout}
            onInc={handleInc}
            onDec={handleDec}
            onRemove={handleRemove}
            onSetCover={handleSetCover}
            onHover={handleHoverCard}
            onLeave={handleLeaveCard}
            onChangePrinting={handleChangePrinting}
            onDropCard={handleDropCardOnDeck}
            onSwap={handleSwap}
            onDropFile={async (f) => {
              const text = await f.text()
              const parsed = parseAnyDeck(text, deck.name)
              if (!parsed) return
              const merged: DeckCard[] = [...deck.cards]
              for (const c of parsed.cards) {
                const k = deckCardKey(c)
                const idx = merged.findIndex((x) => deckCardKey(x) === k)
                if (idx >= 0) merged[idx] = { ...merged[idx], amount: Math.min(99, merged[idx].amount + c.amount) }
                else merged.push(c)
              }
              schedulePersist({ ...deck, cards: merged, sideboard: [...deck.sideboard, ...parsed.sideboard] })
            }}
          />

          {/* Footer with Quick Import & Big Done Button */}
          <div className="builder-deck-footer">
            <div className="builder-action-btns-row builder-actions">
              <button
                type="button"
                className="builder-act"
                title={`${t('decks', 'export_deck')} .dck — ${t('common', 'copied')}`}
                onClick={async () => {
                  const text = exportDck(deck)
                  let copied = false
                  try { await navigator.clipboard.writeText(text); copied = true } catch {}
                  const blob = new Blob([text], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${deck.name}.dck`
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                  setTimeout(() => URL.revokeObjectURL(url), 2000)
                  if (copied) {
                    const btn = document.activeElement as HTMLElement | null
                    if (btn) { const prev = btn.textContent; btn.textContent = `✓ ${t('common', 'copied')}`; setTimeout(() => { if (prev) btn.textContent = prev }, 1400) }
                  }
                }}
              >
                Export .DCK
              </button>
              <button
                type="button"
                className="builder-act"
                title={`${t('decks', 'export_deck')} Arena — ${t('common', 'copied')}`}
                onClick={async () => {
                  const text = exportArena(deck)
                  let copied = false
                  try { await navigator.clipboard.writeText(text); copied = true } catch {}
                  const blob = new Blob([text], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${deck.name}.txt`
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                  setTimeout(() => URL.revokeObjectURL(url), 2000)
                  if (copied) {
                    const btn = document.activeElement as HTMLElement | null
                    if (btn) { const prev = btn.textContent; btn.textContent = `✓ ${t('common', 'copied')}`; setTimeout(() => { if (prev) btn.textContent = prev }, 1400) }
                  }
                }}
              >
                Export Arena
              </button>
              <button
                type="button"
                className="builder-act"
                title={`${t('decks', 'export_deck')} Plain — ${t('common', 'copied')}`}
                onClick={async () => {
                  const text = exportTxt(deck)
                  let copied = false
                  try { await navigator.clipboard.writeText(text); copied = true } catch {}
                  const blob = new Blob([text], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `${deck.name}-plain.txt`
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                  setTimeout(() => URL.revokeObjectURL(url), 2000)
                  if (copied) {
                    const btn = document.activeElement as HTMLElement | null
                    if (btn) { const prev = btn.textContent; btn.textContent = `✓ ${t('common', 'copied')}`; setTimeout(() => { if (prev) btn.textContent = prev }, 1400) }
                  }
                }}
              >
                Export Plain
              </button>
              <button
                type="button"
                className="builder-act"
                onClick={() => setShowImportModal(true)}
                title={t('decks', 'import_hint')}
              >
                📥 {t('decks', 'import_deck')}
              </button>
              <button
                type="button"
                className="builder-act"
                onClick={() => setShowSampleHand(true)}
                title={t('decks', 'sample_london')}
              >
                🖐️ {t('decks', 'builder_sample')}
              </button>
              <button
                type="button"
                className={`builder-act primary ${equipped?.name === deck.name ? 'is-equipped' : ''}`}
                onClick={() => setMyDeck(deck)}
              >
                {equipped?.name === deck.name ? `✓ ${t('common', 'done')}` : t('common', 'confirm')}
              </button>
            </div>

            {/* Glowing Signature Done Button */}
            <button type="button" className="builder-done" onClick={onClose}>
              {t('common', 'save')}
            </button>
          </div>
        </section>
      </div>

      {/* Deck Import & Paste List Modal */}
      {showImportModal && deck && (
        <DeckImportModal
          deckName={deck.name}
          onImport={handleApplyImport}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {/* Sample Hand & Playtest Modal */}
      {showSampleHand && deck && (
        <SampleHandModal
          deckName={deck.name}
          cards={deck.cards}
          metaMap={metaMap}
          onClose={() => setShowSampleHand(false)}
        />
      )}

      {/* Card Printing & Alternate Art Selector Modal */}
      {printingTargetCard && (
        <CardPrintingsModal
          cardName={printingTargetCard.cardName}
          currentSet={printingTargetCard.setCode}
          currentNumber={printingTargetCard.cardNumber}
          onSelectPrinting={handleApplyPrinting}
          onClose={() => setPrintingTargetCard(null)}
        />
      )}

      {/* Floating Card Image Preview on Hover */}
      {!isDragging && hoverPreview && (
        <div
          className={`arena-floating-preview ${hoverPreview.backUrl ? 'has-back-face' : ''}`}
          style={{ left: `${hoverPreview.x}px`, top: `${hoverPreview.y}px` }}
        >
          <div className="preview-face-card">
            {hoverPreview.backUrl && <span className="preview-face-label">{t('wiki', 'face_front')}</span>}
            <img src={hoverPreview.url} alt={hoverPreview.name ?? t('wiki', 'face_front')} />
          </div>
          {hoverPreview.backUrl && (
            <div className="preview-face-card">
              <span className="preview-face-label">{t('wiki', 'face_back')}</span>
              <img src={hoverPreview.backUrl} alt={`${hoverPreview.name ?? 'Carta'} (${t('wiki', 'face_back')})`} />
            </div>
          )}
        </div>
      )}

      {/* Deck Inspector & Statistics Modal */}
      {showInspector && deck && (
        <DeckInspectorModal
          deck={deck}
          onClose={() => setShowInspector(false)}
          onEdit={() => setShowInspector(false)}
          onCopy={() => {}}
        />
      )}
    </div>
  )
}
