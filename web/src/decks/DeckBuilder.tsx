import { useEffect, useMemo, useState, useRef } from 'react'
import { getDeckStorage } from './storage'
import type { DeckV2 } from './types'
import { deckMainCount, deckSideCount } from './types'
import type { ScryfallSearchCard } from './scryfallSearch'
import { scryfallCardImage, scryfallCardBackImage } from './scryfallSearch'
import SearchPanel from './SearchPanel'
import DeckListPanel from './DeckListPanel'
import Icon from '../ui/Icon'
import { ArenaDeckHeader } from './ArenaDeckHeader'
import { BasicLandAdder } from './BasicLandAdder'
import { SampleHandModal } from './SampleHandModal'
import { CardPrintingsModal } from './CardPrintingsModal'
import { DeckInspectorModal } from './DeckInspectorModal'
import CurveChart from './CurveChart'
import { DeckImportModal } from './DeckImportModal'
import type { CardStripMeta } from './ArenaCardStrip'
import { applySuggestion, fetchDeckIssues } from './deckIssues'
import { deckCardKey } from './deckCardOps'
import type { DeckValidationResult } from '../net/types'
import { useStore, setMyDeck } from '../state/store'
import type { DeckCard } from '../lobby/decks'
import { useTranslation } from '../i18n'
import LanguageSelector from '../i18n/LanguageSelector'
import { useDeckMetadata } from './useDeckMetadata'
import { useDeckMutations } from './useDeckMutations'
import { useDeckValidation, type ServerIssueItem } from './useDeckValidation'
import DeckBuilderFooter from './DeckBuilderFooter'
import DeckServerIssues from './DeckServerIssues'
import DeckHoverPreview, { type HoverPreview } from './DeckHoverPreview'
import './DeckBuilder.css'

export default function DeckBuilder({ deckId, onClose }: { deckId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [deck, setDeck] = useState<DeckV2 | null>(null)
  const [name, setName] = useState('')
  const [format, setFormat] = useState<DeckV2['format']>('Freeform')
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [hoverPreview, setHoverPreview] = useState<HoverPreview | null>(null)
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
  const wsAlive = useStore((s) => s.wsAlive)
  const debounceRef = useRef<number | null>(null)

  const { metaMap, setMetaMap, updateMetaForDeck, cmcNumberMap } = useDeckMetadata()
  const { validationReport, mergedCardIssues, serverFlaggedKeys, serverIssueList } = useDeckValidation(
    deck, metaMap, serverIssues, format,
  )

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
  }, [deckId, wsAlive])

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

  const mutations = useDeckMutations({
    deck, schedulePersist, metaMap, setMetaMap, updateMetaForDeck,
    serverFlaggedKeys, printingTargetCard, setPrintingTargetCard,
  })

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

  const handleRepairIssue = (from: ServerIssueItem['from'], to: NonNullable<ServerIssueItem['to']>) => {
    if (!deck) return
    schedulePersist(applySuggestion(deck, from, to))
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

      <DeckServerIssues issues={serverIssueList} onRepair={handleRepairIssue} />

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
                  mutations.handleDec(data.key)
                }
              } catch {}
            }
          }}
        >
          {isCollectionDragOver && (
            <div className="arena-remove-drop-hint">
              <span><Icon name="trash" size={14} /></span> {t('decks', 'builder_drag_hint')}
            </div>
          )}
          <SearchPanel
            onAdd={mutations.handleAddFromSearch}
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
                  <Icon name="chart" size={13} /> {t('decks', 'builder_mana_curve')}
                </span>
                <div className="deck-curve-panel-actions">
                  <button
                    type="button"
                    className="deck-curve-inspect-btn"
                    onClick={() => setShowInspector(true)}
                    title={t('decks', 'inspect_double_click')}
                  >
                    <Icon name="search" size={12} /> <Icon name="chart" size={12} />
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
            onAddLand={mutations.handleAddBasicLand}
            onRemoveLand={mutations.handleRemoveBasicLand}
            onApplySuggestedLands={mutations.handleApplySuggestedLands}
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
            onInc={mutations.handleInc}
            onDec={mutations.handleDec}
            onRemove={mutations.handleRemove}
            onSetCover={mutations.handleSetCover}
            onHover={handleHoverCard}
            onLeave={handleLeaveCard}
            onChangePrinting={mutations.handleChangePrinting}
            onDropCard={mutations.handleDropCardOnDeck}
            onSwap={mutations.handleSwap}
            onDropFile={mutations.handleDropFile}
          />

          <DeckBuilderFooter
            deck={deck}
            equippedName={equipped?.name}
            onImport={() => setShowImportModal(true)}
            onSample={() => setShowSampleHand(true)}
            onEquip={() => setMyDeck(deck)}
            onClose={onClose}
          />
        </section>
      </div>

      {/* Deck Import & Paste List Modal */}
      {showImportModal && deck && (
        <DeckImportModal
          deckName={deck.name}
          onImport={mutations.handleApplyImport}
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
          onSelectPrinting={mutations.handleApplyPrinting}
          onClose={() => setPrintingTargetCard(null)}
        />
      )}

      {/* Floating Card Image Preview on Hover */}
      {!isDragging && hoverPreview && (
        <DeckHoverPreview preview={hoverPreview} />
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
