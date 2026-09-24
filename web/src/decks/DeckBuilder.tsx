import { useEffect, useMemo, useState, useRef } from 'react'
import IconButton from '../ui/IconButton'
import Button from '../ui/Button'
import { getDeckStorage } from './storage'
import type { DeckV2 } from './types'
import { deckMainCount, deckSideCount } from './types'
import type { ScryfallSearchCard } from './scryfallSearch'
import { scryfallCardImage, scryfallCardBackImage } from './scryfallSearch'
import SearchPanel from './SearchPanel'
import SuggestionsPanel from './SuggestionsPanel'
import Tabs from '../ui/Tabs'
import DeckListPanel from './DeckListPanel'
import Icon from '../ui/Icon'
import { ArenaDeckHeader } from './ArenaDeckHeader'
import { BasicLandAdder } from './BasicLandAdder'
import { SampleHandModal } from './SampleHandModal'
import { CardPrintingsModal } from './CardPrintingsModal'
import { DeckInspectorModal } from './DeckInspectorModal'
import CurveChart from './CurveChart'
import { DeckImportModal } from './DeckImportModal'
import { exportTxt } from './parseDck'
import type { CardStripMeta } from './ArenaCardStrip'
import { applySuggestion, fetchDeckIssues } from './deckIssues'
import { deckCardKey } from './deckCardOps'
import { withCommanderFirst, derivePartnerCard } from './deckUtils'
import { FORMAT_CONFIGS } from './formatRules'
import type { DeckValidationResult } from '../net/types'
import { useStore, setMyDeck } from '../state/store'
import { equippedDeckId } from '../state/persistence'
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
  const [loadFailed, setLoadFailed] = useState(false)
  const [name, setName] = useState('')
  const [format, setFormat] = useState<DeckV2['format']>('Freeform')
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [hoverPreview, setHoverPreview] = useState<HoverPreview | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const [isCollectionDragOver, setIsCollectionDragOver] = useState(false)
  const [showSampleHand, setShowSampleHand] = useState(false)
  const [showInspector, setShowInspector] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [printingTargetCard, setPrintingTargetCard] = useState<DeckCard | null>(null)
  const [serverIssues, setServerIssues] = useState<DeckValidationResult | null>(null)
  const [leftTab, setLeftTab] = useState<'search' | 'suggestions'>('search')
  const [showCurve, setShowCurve] = useState(() => {
    try {
      const saved = localStorage.getItem('nexus_deck_show_curve')
      const roomy = typeof window !== 'undefined' && window.innerHeight > 850
      return saved !== null ? saved === 'true' && roomy : roomy
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
  const [equippedId, setEquippedId] = useState<string | null>(() => equippedDeckId())
  const wsAlive = useStore((s) => s.wsAlive)
  const debounceRef = useRef<number | null>(null)
  const savedTimerRef = useRef<number | null>(null)
  const partnerMigratedRef = useRef(false)
  const deckRef = useRef<DeckV2 | null>(null)
  deckRef.current = deck

  useEffect(() => () => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
      const pending = deckRef.current
      if (pending) void persist(pending)
    }
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
  }, [])

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

  useEffect(() => {
    const onResize = () => {
      if (window.innerHeight < 780) setShowCurve(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Load deck data on mount
  useEffect(() => {
    partnerMigratedRef.current = false
    void (async () => {
      const d = await storage.get(deckId)
      if (d) {
        // Migración: mazos de Commander guardados antes de la designación
        // explícita usaban la portada como comandante. Si la portada sigue en
        // la lista principal, la conservamos como comandante designado.
        let loaded = d
        const config = FORMAT_CONFIGS[d.format] ?? FORMAT_CONFIGS.Freeform
        if (config.hasCommander && !d.commanderCard && d.coverCard) {
          const cover = d.coverCard
          if (d.cards.some((c) => deckCardKey(c) === deckCardKey(cover))) {
            loaded = { ...d, commanderCard: cover }
          }
        }
        setDeck(loaded)
        setName(loaded.name)
        setFormat(loaded.format)
        updateMetaForDeck([...loaded.cards, ...loaded.sideboard])
        if (loaded !== d) void storage.put(loaded)
      } else {
        setLoadFailed(true)
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

  useEffect(() => {
    if (partnerMigratedRef.current) return
    if (!deck || deck.partnerCard || !deck.commanderCard) return
    const config = FORMAT_CONFIGS[deck.format] ?? FORMAT_CONFIGS.Freeform
    if (!config.hasCommander) return
    const derived = derivePartnerCard(deck.cards, deck.commanderCard, metaMap)
    if (!derived) return
    partnerMigratedRef.current = true
    schedulePersist({ ...deck, partnerCard: derived })
  }, [deck, metaMap])

  const persist = async (next: DeckV2) => {
    setSaveState('saving')
    try {
      await storage.put({ ...next, updatedAt: Date.now() })
    } catch {
      setSaveState('error')
      return
    }
    setSaveState('saved')
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current)
    savedTimerRef.current = window.setTimeout(() => setSaveState('idle'), 1200)
  }

  const schedulePersist = (next: DeckV2) => {
    setDeck(next)
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null
      void persist(next)
    }, 800)
  }

  /** Cierra el editor sin perder la última edición pendiente del debounce. */
  const handleClose = () => {
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current)
      debounceRef.current = null
      if (deck) void persist(deck)
    }
    onClose()
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

    const previewWidth = Math.min(backImg ? 856 : 420, window.innerWidth - 20)
    const previewHeight = Math.min(588, window.innerHeight - 40)
    let x = 0
    let y = 0
    if (rect) {
      // Place preview to the left of the deck strip or beside the grid card
      if (rect.left > window.innerWidth / 2) {
        x = Math.max(10, rect.left - previewWidth - 15)
      } else {
        x = Math.min(window.innerWidth - previewWidth - 15, rect.right + 15)
      }
      y = Math.max(10, Math.min(window.innerHeight - previewHeight - 10, rect.top - 40))
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
  const isCommanderFormat = !!(FORMAT_CONFIGS[format] ?? FORMAT_CONFIGS.Freeform).hasCommander
  const commanderName = deck?.commanderCard?.cardName ?? null
  const coverKey = deck?.coverCard ? deckCardKey(deck.coverCard) : null

  if (!deck) {
    return (
      <div className="deck-builder loading">
        {loadFailed ? (
          <>
            <span>{t('decks', 'builder_deck_not_found')}</span>
            <Button onClick={onClose}>{t('common', 'close')}</Button>
          </>
        ) : (
          t('common', 'loading')
        )}
      </div>
    )
  }

  return (
    <div className="deck-builder">
      {/* Top Navbar */}
      <header className="arena-top-nav deck-builder-top">
        <div className="arena-nav-left">
          <Button variant="subtle" size="sm" className="builder-back" onClick={handleClose}>
            <span>←</span> {t('decks', 'my_decks')}
          </Button>
          <span className="deck-builder-title">{t('decks', 'builder_editor')}</span>
        </div>

        <div className="arena-nav-right">
          {saveState !== 'idle' && (
            saveState === 'error' ? (
              <button
                type="button"
                className="builder-save-badge builder-save-error"
                role="status"
                aria-live="polite"
                onClick={() => { if (deck) void persist(deck) }}
              >
                {t('decks', 'save_failed_retry')}
              </button>
            ) : (
              <span className="builder-save-badge builder-save" role="status" aria-live="polite">
                {saveState === 'saving' ? t('decks', 'builder_saving') : t('decks', 'builder_saved')}
              </span>
            )
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
              <span><Icon name="trash" size={14} /></span> {t('decks', 'builder_drag_remove_hint')}
            </div>
          )}
          <Tabs
            className="builder-left-tabs"
            variant="segmented"
            size="sm"
            value={leftTab}
            onChange={setLeftTab}
            items={[
              { id: 'search', label: t('decks', 'suggestions_tab_search') },
              {
                id: 'suggestions',
                label: t('decks', 'suggestions_tab'),
                title: !isCommanderFormat ? t('decks', 'suggestions_not_commander') : undefined,
              },
            ]}
          />
          {leftTab === 'search' ? (
            <SearchPanel
              onAdd={mutations.handleAddFromSearch}
              countMap={countMap}
              format={format}
              onHover={(c, r) => handleHoverCard(c as any, undefined, r)}
              onLeave={handleLeaveCard}
            />
          ) : (
            <SuggestionsPanel
              commanderName={commanderName}
              isCommanderFormat={isCommanderFormat}
              countMap={countMap}
              onAdd={mutations.handleAddFromSearch}
              onHover={(c, r) => handleHoverCard(c as any, undefined, r)}
              onLeave={handleLeaveCard}
            />
          )}
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
                  <Button variant="subtle" size="sm"
                    onClick={() => setShowInspector(true)}
                    title={t('decks', 'inspect_double_click')}>
                    <Icon name="search" size={12} /> <Icon name="chart" size={12} />
                  </Button>
                  <IconButton label={t('decks', 'builder_hide_curve')} size="sm"
                    onClick={toggleCurve}>
                    ▲
                  </IconButton>
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
            commanderCard={deck.commanderCard}
            partnerCard={deck.partnerCard}
            isCommanderFormat={isCommanderFormat}
            format={format}
            metaMap={metaMap}
            cardIssues={mergedCardIssues}
            layout={layout}
            onInc={mutations.handleInc}
            onDec={mutations.handleDec}
            onRemove={mutations.handleRemove}
            onSetCover={mutations.handleSetCover}
            onSetCommander={mutations.handleSetCommander}
            onSetPartner={mutations.handleSetPartner}
            onHover={handleHoverCard}
            onLeave={handleLeaveCard}
            onChangePrinting={mutations.handleChangePrinting}
            onDropCard={mutations.handleDropCardOnDeck}
            onSwap={mutations.handleSwap}
            onDropFile={mutations.handleDropFile}
          />

          <DeckBuilderFooter
            deck={deck}
            isEquipped={equippedId === deck.id}
            onImport={() => setShowImportModal(true)}
            onSample={() => setShowSampleHand(true)}
            onEquip={() => {
              setMyDeck({ ...deck, cards: withCommanderFirst(deck.cards, deck.commanderCard, deck.partnerCard) })
              setEquippedId(deck.id)
            }}
            onClose={handleClose}
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
          onCopy={async () => {
            try {
              await navigator.clipboard.writeText(exportTxt(deck))
              return true
            } catch {
              return false
            }
          }}
        />
      )}
    </div>
  )
}
