import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import IconButton from '../ui/IconButton'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import Icon from '../ui/Icon'
import Tabs from '../ui/Tabs'
import { getDeckStorage } from './storage'
import type { DeckV2 } from './types'
import { deckMainCount, deckSideCount } from './types'
import type { ScryfallSearchCard } from './scryfallSearch'
import { scryfallCardImage, scryfallCardBackImage } from './scryfallSearch'
import SearchPanel from './SearchPanel'
import SuggestionsPanel from './SuggestionsPanel'
import DeckListPanel from './DeckListPanel'
import { SampleHandModal } from './SampleHandModal'
import { CardPrintingsModal } from './CardPrintingsModal'
import { cardArtPreference } from '../cards/artPreferences'
import { peekCustomCardArt } from '../cards/customCardArt'
import { DeckInspectorModal } from './DeckInspectorModal'
import { DeckImportModal } from './DeckImportModal'
import { exportTxt } from './parseDck'
import type { CardStripMeta } from './ArenaCardStrip'
import { applySuggestions, deckIssueKey, fetchDeckIssues, fetchFormatIssues, type DeckFix } from './deckIssues'
import { aggregateCards, deckCardKey } from './deckCardOps'
import { commanderCardsFor, derivePartnerCard, withCommanderFirst } from './deckUtils'
import { FORMAT_CONFIGS } from './formatRules'
import type { DeckFormatValidationResult, DeckValidationResult } from '../net/types'
import { useStore, setMyDeck } from '../state/store'
import { equippedDeckId } from '../state/persistence'
import { useSettings } from '../state/selectors'
import { setSetting } from '../state/actions'
import { deckRef as deckKeyOf, getAllAvailableDecks, type DeckCard } from '../lobby/decks'
import { useTranslation } from '../i18n'
import { useDeckMetadata } from './useDeckMetadata'
import { useDeckMutations, type PileTarget, type StackDropPayload } from './useDeckMutations'
import { useDeckValidation } from './useDeckValidation'
import { useCommanderEligibility, commanderEligibleFor } from './useCommanderEligibility'
import DeckServerIssues from './DeckServerIssues'
import DeckFormatIssues from './DeckFormatIssues'
import { DeckEditorTopBar } from './DeckEditorTopBar'
import { DeckEditorToolbar } from './DeckEditorToolbar'
import {
  DeckEditorPhoneBottomBar,
  DeckEditorPhoneControls,
  DeckEditorPhoneTopBar,
  DeckEditorSheet,
  useCreditsClearance,
  type PhoneZone,
} from './DeckEditorPhone'
import { useDeckPhoneLayout } from './useDeckPhoneLayout'
import { CardFocusPanel } from './CardFocusPanel'
import { DeckNumbersPanel } from './DeckNumbersPanel'
import { ArenaCardStacks, type NewPileColumn, type StackColumn } from './ArenaCardStacks'
import { buildStackColumns, canSeparateCreatures, splitCreatureRows, type BuildStackOptions } from './stackColumns'
import { useStackLabels } from './useStackLabels'
import { useStackColumnWidth } from './useStackColumnWidth'
import { normalizeStackPiles, pilesHolding, pruneStackPiles, seedStackPiles } from './stackPiles'
import { isMetaLoaded } from './metaLoaded'
import { normalizeDeckStacksScale } from './stacksScale'
import { createHoverPreviewStore, HoverPreviewLayer } from './hoverPreviewStore'
import { useEventCallback } from '../utils/useEventCallback'
import './DeckBuilder.css'

type FocusZone = 'main' | 'side'
interface DeckEntry {
  card: DeckCard
  zone: FocusZone
}

const EMPTY_CARDS: DeckCard[] = []
const DROP_MIME = 'application/json'

function zoneKey(card: DeckCard, zone: FocusZone): string {
  return zone === 'side' ? `sb:${deckCardKey(card)}` : deckCardKey(card)
}

function copiesByKey(list: DeckCard[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const card of list) {
    const key = deckCardKey(card)
    counts.set(key, (counts.get(key) ?? 0) + card.amount)
  }
  return counts
}

function parseStackPayload(e: DragEvent<HTMLElement>): StackDropPayload | null {
  try {
    const parsed: unknown = JSON.parse(e.dataTransfer.getData(DROP_MIME))
    return typeof parsed === 'object' && parsed !== null ? (parsed as StackDropPayload) : null
  } catch {
    return null
  }
}

function hasDragType(e: DragEvent<HTMLElement>, type: string): boolean {
  return Array.from(e.dataTransfer.types ?? []).includes(type)
}

function stackRegionDrop(
  onPayload: ((payload: StackDropPayload) => void) | null,
  onFile: (file: File) => void,
) {
  return {
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!hasDragType(e, 'Files') && !(onPayload && hasDragType(e, DROP_MIME))) return
      e.preventDefault()
      e.dataTransfer.dropEffect = e.dataTransfer.effectAllowed === 'move' ? 'move' : 'copy'
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      const file = e.dataTransfer.files?.[0]
      if (file) {
        e.preventDefault()
        onFile(file)
        return
      }
      if (!onPayload) return
      e.preventDefault()
      const payload = parseStackPayload(e)
      if (payload) onPayload(payload)
    },
  }
}

export default function DeckBuilder({ deckId, onClose }: { deckId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const {
    deckEditorView: view,
    deckStacksGroup: group,
    deckStacksSort: sort,
    deckStacksCopies: copies,
    deckStacksScale,
    deckEditorDrawer: drawerOpen,
    deckStacksSeparateCreatures: separateCreatures,
  } = useSettings()
  const scale = normalizeDeckStacksScale(deckStacksScale)
  const [deck, setDeck] = useState<DeckV2 | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [previewStore] = useState(createHoverPreviewStore)
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const touchPinnedRef = useRef(false)
  const [isCollectionDragOver, setIsCollectionDragOver] = useState(false)
  const [showSampleHand, setShowSampleHand] = useState(false)
  const [showInspector, setShowInspector] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [printingTargetCard, setPrintingTargetCard] = useState<DeckCard | null>(null)
  const [serverIssues, setServerIssues] = useState<DeckValidationResult | null>(null)
  const [formatIssues, setFormatIssues] = useState<DeckFormatValidationResult | null>(null)
  const [leftTab, setLeftTab] = useState<'search' | 'suggestions'>('search')
  const [gridSize, setGridSize] = useState(50)
  const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical')
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [hoverKey, setHoverKey] = useState<string | null>(null)
  const [sideFolded, setSideFolded] = useState(false)
  const [sideHeadOver, setSideHeadOver] = useState(false)
  const [pilesEl, setPilesEl] = useState<HTMLElement | null>(null)
  const phone = useDeckPhoneLayout()
  const creditsClearance = useCreditsClearance()
  const [phoneZone, setPhoneZone] = useState<PhoneZone>('main')
  const [phoneSheet, setPhoneSheet] = useState<'catalogue' | 'curve' | 'card' | null>(null)

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

  const { metaMap, setMetaMap, updateMetaForDeck } = useDeckMetadata()
  const commanderEligibilityMap = useCommanderEligibility(deck, wsAlive)
  const { validationReport, mergedCardIssues, serverFlaggedKeys, serverIssueList, xmageDeckIssues } = useDeckValidation(
    deck, metaMap, serverIssues, deck?.format ?? 'Freeform', commanderEligibilityMap, formatIssues,
  )

  useEffect(() => {
    const handleGlobalDragStart = () => {
      isDraggingRef.current = true
      setIsDragging(true)
      previewStore.set(null)
    }
    const handleGlobalDragEnd = () => {
      isDraggingRef.current = false
      setIsDragging(false)
      previewStore.set(null)
    }
    const handlePointerCapture = (e: PointerEvent) => {
      touchPinnedRef.current = e.pointerType === 'touch'
      if (touchPinnedRef.current && e.type === 'pointerdown') previewStore.set(null)
    }
    window.addEventListener('dragstart', handleGlobalDragStart, true)
    window.addEventListener('dragend', handleGlobalDragEnd, true)
    window.addEventListener('drop', handleGlobalDragEnd, true)
    window.addEventListener('pointerdown', handlePointerCapture, true)
    window.addEventListener('pointermove', handlePointerCapture, true)
    return () => {
      window.removeEventListener('dragstart', handleGlobalDragStart, true)
      window.removeEventListener('dragend', handleGlobalDragEnd, true)
      window.removeEventListener('drop', handleGlobalDragEnd, true)
      window.removeEventListener('pointerdown', handlePointerCapture, true)
      window.removeEventListener('pointermove', handlePointerCapture, true)
    }
  }, [previewStore])

  useEffect(() => {
    partnerMigratedRef.current = false
    void (async () => {
      const stored = await storage.get(deckId)
      const d = stored
        ?? (await storage.list()).find((c) => c.id === deckId || (!c.id && c.name === deckId))
        ?? (getAllAvailableDecks().find((c) => deckKeyOf(c) === deckId) as DeckV2 | undefined)
      if (d) {
        let loaded = d
        const config = FORMAT_CONFIGS[d.format] ?? FORMAT_CONFIGS.Freeform
        if (config.hasCommander && !d.commanderCard && d.coverCard) {
          const cover = d.coverCard
          if (d.cards.some((c) => deckCardKey(c) === deckCardKey(cover))) {
            loaded = { ...d, commanderCard: cover }
          }
        }
        const stackPiles = normalizeStackPiles(loaded.stackPiles, loaded.cards)
        setDeck(stackPiles ? { ...loaded, stackPiles } : loaded)
        updateMetaForDeck([...loaded.cards, ...loaded.sideboard])
        if (loaded !== d) void storage.put(loaded)
      } else {
        setLoadFailed(true)
      }
    })()
  }, [deckId])

  const lastValidatedRef = useRef<DeckV2 | null>(null)
  const validationSeqRef = useRef(0)
  const validateNow = useCallback((d: DeckV2) => {
    const seq = ++validationSeqRef.current
    void Promise.all([fetchDeckIssues(d, d.format), fetchFormatIssues(d, d.format)]).then(([report, formatReport]) => {
      if (seq !== validationSeqRef.current) return
      setServerIssues(report)
      setFormatIssues(formatReport)
    })
  }, [])
  useEffect(() => {
    setServerIssues(null)
    setFormatIssues(null)
    void (async () => {
      const d = await storage.get(deckId)
      if (!d) return
      lastValidatedRef.current = d
      validateNow(d)
    })()
  }, [deckId, wsAlive, validateNow])

  useEffect(() => {
    if (!deck || deck === lastValidatedRef.current) return
    const timer = window.setTimeout(() => {
      lastValidatedRef.current = deck
      validateNow(deck)
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [deck, validateNow])

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
    const pruned = next.stackPiles ? { ...next, stackPiles: pruneStackPiles(next.stackPiles, next.cards) } : next
    setDeck(pruned)
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      debounceRef.current = null
      void persist(pruned)
    }, 800)
  }
  const schedulePersistStable = useEventCallback(schedulePersist)

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
    commanderEligibilityMap,
  })

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

  const handleHoverCard = (
    card: DeckCard | ScryfallSearchCard,
    meta?: CardStripMeta,
    rect?: DOMRect
  ) => {
    if (isDraggingRef.current) return
    const hoverName = 'name' in card ? card.name : (card as DeckCard).cardName
    const customArt = peekCustomCardArt(hoverName)
    let img: string | null = customArt ?? meta?.imageUrl ?? null
    let backImg: string | null = customArt ? null : (meta?.backImageUrl ?? null)

    if (!img) {
      if ('image_uris' in card || 'card_faces' in card) {
        const sc = card as ScryfallSearchCard
        img = scryfallCardImage(sc)
        backImg = scryfallCardBackImage(sc)
      } else {
        const dc = card as DeckCard
        const m = metaMap.get(`${dc.setCode}/${dc.cardNumber}`) ?? metaMap.get(dc.cardName.toLowerCase())
        img = customArt ?? m?.imageUrl ?? null
        backImg = customArt ? null : (m?.backImageUrl ?? null)
      }
    }

    if (!img) return

    const previewWidth = Math.min(backImg ? 856 : 420, window.innerWidth - 20)
    const previewHeight = Math.min(588, window.innerHeight - 40)
    let x = 0
    let y = 0
    if (rect) {
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

    previewStore.set({
      url: img,
      backUrl: backImg,
      x,
      y,
      name: hoverName,
    })
  }

  const handleLeaveCard = () => {
    if (touchPinnedRef.current) return
    previewStore.set(null)
  }

  const stableInc = useEventCallback(mutations.handleInc)
  const stableDec = useEventCallback(mutations.handleDec)
  const stableRemove = useEventCallback(mutations.handleRemove)
  const stableSetCover = useEventCallback(mutations.handleSetCover)
  const stableSetCommander = useEventCallback(mutations.handleSetCommander)
  const stableSetPartner = useEventCallback(mutations.handleSetPartner)
  const stableChangePrinting = useEventCallback(mutations.handleChangePrinting)
  const stableDropCard = useEventCallback(mutations.handleDropCardOnDeck)
  const stableSwap = useEventCallback(mutations.handleSwap)
  const stableHover = useEventCallback(handleHoverCard)
  const stableLeave = useEventCallback(handleLeaveCard)

  const handleRepairIssue = (fixes: DeckFix[]) => {
    if (!deck) return
    const next = applySuggestions(deck, fixes)
    schedulePersist(next)
    updateMetaForDeck([...next.cards, ...next.sideboard])
    setServerIssues((prev) => {
      if (!prev) return null
      const fixedFromKeys = new Set(fixes.map((f) => deckIssueKey(f.from.cardName, f.from.setCode, f.from.cardNumber)))
      const keep = (c: { cardName: string; setCode: string; cardNumber: string }) =>
        !fixedFromKeys.has(deckIssueKey(c.cardName, c.setCode, c.cardNumber))
      return {
        ...prev,
        missing: prev.missing.filter(keep),
        mismatches: prev.mismatches.filter(keep),
      }
    })
  }

  const mainList = deck?.cards ?? EMPTY_CARDS
  const sideList = deck?.sideboard ?? EMPTY_CARDS
  const mainAgg = useMemo(() => aggregateCards(mainList), [mainList])
  const sideAgg = useMemo(() => aggregateCards(sideList), [sideList])
  const mainCopies = useMemo(() => copiesByKey(mainList), [mainList])
  const sideCopies = useMemo(() => copiesByKey(sideList), [sideList])
  const deckLookup = useMemo(() => {
    const lookup = new Map<string, DeckEntry>()
    for (const card of mainAgg) lookup.set(deckCardKey(card), { card, zone: 'main' })
    for (const card of sideAgg) lookup.set(`sb:${deckCardKey(card)}`, { card, zone: 'side' })
    return lookup
  }, [mainAgg, sideAgg])

  useEffect(() => {
    if (selectedKey !== null && !deckLookup.has(selectedKey)) setSelectedKey(null)
  }, [selectedKey, deckLookup])

  const metaOf = useCallback(
    (card: DeckCard) => metaMap.get(`${card.setCode}/${card.cardNumber}`) ?? metaMap.get(card.cardName.toLowerCase()),
    [metaMap],
  )

  const stackLabels = useStackLabels()
  const labelsRef = useRef(stackLabels)
  labelsRef.current = stackLabels
  const typeLabels = stackLabels.type
  const piles = deck?.stackPiles
  const format = deck?.format ?? 'Freeform'
  const config = FORMAT_CONFIGS[format] ?? FORMAT_CONFIGS.Freeform
  const isCommanderFormat = !!config.hasCommander
  const commanderCard = deck?.commanderCard ?? null
  const partnerCard = deck?.partnerCard ?? null
  const coverCard = deck?.coverCard ?? null

  const commanderCards = useMemo(
    () => (isCommanderFormat && mainAgg.length > 0
      ? commanderCardsFor(mainAgg, commanderCard, partnerCard, metaMap)
      : EMPTY_CARDS),
    [isCommanderFormat, mainAgg, commanderCard, partnerCard, metaMap],
  )
  const commanderKeys = useMemo(() => new Set(commanderCards.map((c) => deckCardKey(c))), [commanderCards])

  const creatureRows = separateCreatures && canSeparateCreatures(group)
  const mainRows = useMemo(() => {
    const opts: BuildStackOptions = { group, sort, labels: { ...labelsRef.current, type: typeLabels }, piles, commanderKeys }
    return creatureRows
      ? splitCreatureRows(mainAgg, metaOf, opts)
      : { creatures: buildStackColumns(mainAgg, metaOf, opts), others: [] }
  }, [creatureRows, mainAgg, metaOf, group, sort, piles, commanderKeys, typeLabels])
  const sideColumns = useMemo(
    () => buildStackColumns(sideAgg, metaOf, {
      group,
      sort,
      labels: { ...labelsRef.current, type: typeLabels },
      keyPrefix: 'sb:',
      singlePile: group === 'free' ? { id: 'sideboard', label: t('decks', 'sideboard') } : undefined,
    }),
    [sideAgg, metaOf, group, sort, t, typeLabels],
  )

  useEffect(() => {
    if (!deck || group !== 'free' || deck.cards.length === 0) return
    if (deck.stackPiles && deck.stackPiles.piles.length > 0) return
    if (!deck.cards.every((c) => isMetaLoaded(metaOf(c)))) return
    schedulePersistStable({ ...deck, stackPiles: seedStackPiles(deck.cards, metaOf, typeLabels) })
  }, [deck, group, metaOf, typeLabels, schedulePersistStable])

  const mainCount = deck ? deckMainCount(deck) : 0
  const sideCount = deck ? deckSideCount(deck) : 0
  const sideLimit = config.maxSideboard
  const sideOver = sideLimit > 0 && sideCount > sideLimit
  const newPileLabel = t('decks', 'pile_default_name', { n: (piles?.piles.length ?? 0) + 1 })
  const newPileColumn: NewPileColumn | undefined = group === 'free'
    ? { label: t('decks', 'pile_new'), hint: t('decks', 'pile_drop_hint') }
    : undefined

  const selectedEntry = selectedKey !== null ? deckLookup.get(selectedKey) ?? null : null
  const hoverEntry = hoverKey !== null ? deckLookup.get(hoverKey) ?? null : null
  const coverEntry = coverCard ? deckLookup.get(deckCardKey(coverCard)) ?? null : null
  const focus = phone ? selectedEntry : view === 'piles' ? (selectedEntry ?? hoverEntry ?? coverEntry) : null
  const focusZone: FocusZone = focus?.zone ?? 'main'
  const focusCard = focus?.card ?? null
  const focusBare = focusCard ? deckCardKey(focusCard) : ''
  const focusMeta = focusCard ? metaOf(focusCard) : undefined
  const focusIssue = focusCard
    ? mergedCardIssues.get(zoneKey(focusCard, focusZone))?.message ?? mergedCardIssues.get(focusCard.cardName)?.message
    : undefined
  const designated = (c: DeckCard | null) => focus !== null && focusZone === 'main' && c !== null && deckCardKey(c) === focusBare

  const onMoveToPile = (pileId: string) => {
    if (focusCard) mutations.handleAssignPile(focusBare, { kind: 'pile', pileId })
  }
  const onNewPile = () => {
    if (focusCard) mutations.handleAssignPile(focusBare, { kind: 'new', label: newPileLabel })
  }

  const dropTargetPile = (columnId: string): PileTarget | undefined => {
    if (group !== 'free') return undefined
    if (columnId === '__new__') return { kind: 'new', label: newPileLabel }
    if (columnId === 'unsorted' || piles?.piles.some((p) => p.id === columnId)) return { kind: 'pile', pileId: columnId }
    return undefined
  }
  const dropOnStacks = (zone: FocusZone, columnId: string, payload: StackDropPayload) => {
    mutations.handleStacksDrop(zone, payload, zone === 'main' ? dropTargetPile(columnId) : undefined)
  }
  const dropFile = (file: File) => { void mutations.handleDropFile(file) }
  const mainRegionDrop = stackRegionDrop(mainCount === 0 ? (p) => mutations.handleStacksDrop('main', p) : null, dropFile)
  const sideRegionDrop = stackRegionDrop(sideCount === 0 ? (p) => mutations.handleStacksDrop('side', p) : null, dropFile)
  const sideHeadDrop = {
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!hasDragType(e, DROP_MIME)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = e.dataTransfer.effectAllowed === 'move' ? 'move' : 'copy'
      setSideHeadOver(true)
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
      setSideHeadOver(false)
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      setSideHeadOver(false)
      const payload = parseStackPayload(e)
      if (!payload) return
      e.preventDefault()
      e.stopPropagation()
      mutations.handleStacksDrop('side', payload)
    },
  }

  const selectCard = (key: string) => {
    setSelectedKey(key)
    if (phone) setPhoneSheet('card')
  }
  const hoverMain = (card: DeckCard) => setHoverKey(deckCardKey(card))
  const hoverSide = (card: DeckCard) => setHoverKey(`sb:${deckCardKey(card)}`)

  const stacksFor = (zone: FocusZone, stackScale: number, columns: StackColumn[]) => (
    <ArenaCardStacks
      columns={columns}
      copies={copies}
      scale={stackScale}
      zone={zone}
      selectedKey={selectedKey}
      onSelect={selectCard}
      onInc={mutations.handleInc}
      onDec={mutations.handleDec}
      onSwap={mutations.handleSwap}
      onHover={zone === 'main' ? hoverMain : hoverSide}
      onDropCard={(columnId, payload) => dropOnStacks(zone, columnId, payload)}
      newPileColumn={zone === 'main' ? newPileColumn : undefined}
      onRenamePile={zone === 'main' ? mutations.handleRenamePile : undefined}
      onRemovePile={zone === 'main' ? mutations.handleRemovePile : undefined}
    />
  )

  const mainStacks = (stackScale: number) => {
    if (!creatureRows) return stacksFor('main', stackScale, mainRows.creatures)
    return (['creatures', 'others'] as const)
      .filter((row) => mainRows[row].length > 0)
      .map((row) => (
        <div key={row} className="deck-editor-pile-row" data-row={row}>
          {stacksFor('main', stackScale, mainRows[row])}
        </div>
      ))
  }

  const columnWidth = useStackColumnWidth(pilesEl, scale / 100, mainCount > 0)
  const pilesStyle = {
    '--stack-scale': scale / 100,
    ...(columnWidth ? { '--stack-col': `${columnWidth}px` } : null),
  } as CSSProperties

  const coverMeta = coverCard
    ? metaMap.get(`${coverCard.setCode}/${coverCard.cardNumber}`) ??
      metaMap.get(coverCard.cardName.toLowerCase())
    : null
  const commanderName = commanderCard?.cardName ?? null

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

  const pilesView = view === 'piles'
  const closePhoneSheet = () => setPhoneSheet(null)
  const openInspector = () => {
    if (phone) setPhoneSheet(null)
    setShowInspector(true)
  }
  const equipDeck = () => {
    setMyDeck({ ...deck, cards: withCommanderFirst(deck.cards, deck.commanderCard, deck.partnerCard) })
    setEquippedId(deck.id)
  }
  const zoneRegionDrop = phoneZone === 'main' ? mainRegionDrop : sideRegionDrop
  const sideEmpty = <div className="deck-editor-side-empty">{t('decks', 'builder_side_empty')}</div>
  const mainEmpty = <EmptyState boxed size="lg" icon="layers" iconSize={22} title={t('decks', 'deck_no_cards')} />

  const focusPanel = focus ? (
    <CardFocusPanel
      card={focus.card}
      meta={focusMeta}
      zone={focusZone}
      inMain={mainCopies.get(focusBare) ?? 0}
      inSide={sideCopies.get(focusBare) ?? 0}
      issue={focusIssue}
      isCommanderFormat={isCommanderFormat}
      isCommander={designated(commanderCard)}
      isPartner={designated(partnerCard)}
      canBeCommander={commanderEligibleFor(commanderEligibilityMap, focus.card.cardName, focusMeta) !== false}
      isCover={designated(coverCard)}
      piles={focusZone === 'main' && group === 'free' ? (piles?.piles ?? []) : undefined}
      currentPileIds={focusZone === 'main' && piles && focusCard ? pilesHolding(piles, focusBare, focusCard.amount) : undefined}
      onDec={(c) => mutations.handleDec(zoneKey(c, focusZone))}
      onInc={(c) => mutations.handleInc(zoneKey(c, focusZone))}
      onRemoveAll={(c) => mutations.handleRemove(zoneKey(c, focusZone))}
      onSwapZone={(c) => mutations.handleSwap(zoneKey(c, focusZone))}
      onChangePrinting={mutations.handleChangePrinting}
      onSetCover={mutations.handleSetCover}
      onSetCommander={mutations.handleSetCommander}
      onSetPartner={mutations.handleSetPartner}
      onMoveToPile={onMoveToPile}
      onNewPile={onNewPile}
    />
  ) : null

  const numbersPanel = (
    <DeckNumbersPanel
      cards={mainList}
      metaOf={metaOf}
      format={format}
      metaMap={metaMap}
      onAddLand={mutations.handleAddBasicLand}
      onRemoveLand={mutations.handleRemoveBasicLand}
      onApplySuggestedLands={mutations.handleApplySuggestedLands}
      onOpenInspector={openInspector}
    />
  )

  const catalogue = (
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
          onHover={(c, r) => handleHoverCard(c, undefined, r)}
          onLeave={handleLeaveCard}
          gridSize={gridSize}
          onGridSizeChange={setGridSize}
        />
      ) : (
        <SuggestionsPanel
          commanderName={commanderName}
          isCommanderFormat={isCommanderFormat}
          countMap={countMap}
          onAdd={mutations.handleAddFromSearch}
          onHover={(c, r) => handleHoverCard(c, undefined, r)}
          onLeave={handleLeaveCard}
          gridSize={gridSize}
          onGridSizeChange={setGridSize}
        />
      )}
    </aside>
  )

  const pilesSection = (
    <section
      ref={setPilesEl}
      className="deck-editor-piles"
      data-testid="deck-editor-piles"
      style={pilesStyle}
      {...mainRegionDrop}
    >
      {mainCount === 0 ? mainEmpty : mainStacks(scale / 100)}
    </section>
  )

  const sideBand = (
    <section
      className={`deck-editor-side-band${sideFolded ? ' is-folded' : ''}`}
      data-testid="deck-editor-side-band"
      {...sideRegionDrop}
    >
      <header className={`deck-editor-side-head${sideHeadOver ? ' is-drop-target' : ''}`} {...sideHeadDrop}>
        <span className="deck-editor-side-title">{t('decks', 'sideboard')}</span>
        <span className={`deck-editor-side-count${sideOver ? ' is-over' : ''}`}>
          {sideLimit > 0 ? `${sideCount}/${sideLimit}` : sideCount}
        </span>
        <IconButton
          label={t('decks', 'side_band_toggle')}
          icon={sideFolded ? 'chevronDown' : 'chevronUp'}
          size="sm"
          aria-expanded={!sideFolded}
          onClick={() => setSideFolded((folded) => !folded)}
        />
      </header>
      {!sideFolded && (sideCount === 0 ? sideEmpty : (
        <div className="deck-editor-side-body">{stacksFor('side', 1, sideColumns)}</div>
      ))}
    </section>
  )

  const phonePilesSection = (
    <section
      ref={setPilesEl}
      className="deck-editor-piles"
      data-testid="deck-editor-piles"
      data-zone={phoneZone}
      style={pilesStyle}
      {...zoneRegionDrop}
    >
      {phoneZone === 'main'
        ? (mainCount === 0 ? mainEmpty : mainStacks(scale / 100))
        : (sideCount === 0 ? sideEmpty : stacksFor('side', scale / 100, sideColumns))}
    </section>
  )

  const listView = (
    <div className="deck-editor-list">
      <DeckListPanel
        cards={deck.cards}
        sideboard={deck.sideboard}
        coverKey={coverCard ? deckCardKey(coverCard) : null}
        commanderCard={deck.commanderCard}
        partnerCard={deck.partnerCard}
        isCommanderFormat={isCommanderFormat}
        format={format}
        metaMap={metaMap}
        commanderEligibilityMap={commanderEligibilityMap}
        cardIssues={mergedCardIssues}
        layout={layout}
        onInc={stableInc}
        onDec={stableDec}
        onRemove={stableRemove}
        onSetCover={stableSetCover}
        onSetCommander={stableSetCommander}
        onSetPartner={stableSetPartner}
        onHover={stableHover}
        onLeave={stableLeave}
        onChangePrinting={stableChangePrinting}
        onDropCard={stableDropCard}
        onSwap={stableSwap}
        onDropFile={mutations.handleDropFile}
      />
    </div>
  )

  const mainEl = (
    <main className={`deck-editor-main${phone ? ' deck-editor-main--phone' : ''}`}>
      {pilesView
        ? (phone ? phonePilesSection : <>{pilesSection}{sideBand}</>)
        : listView}
    </main>
  )

  return (
    <div className={`deck-builder${phone ? ' deck-builder--phone' : ''}`}>
      {phone ? (
        <DeckEditorPhoneTopBar
          name={deck.name}
          onNameChange={(val) => schedulePersist({ ...deck, name: val })}
          format={deck.format}
          onFormatChange={(f) => schedulePersist({ ...deck, format: f })}
          mainCount={mainCount}
          sideCount={sideCount}
          issues={validationReport.issues}
          saveState={saveState}
          onRetrySave={() => { void persist(deck) }}
          onBack={handleClose}
          deck={deck}
          isEquipped={equippedId === deck.id}
          onImport={() => setShowImportModal(true)}
          onSample={() => setShowSampleHand(true)}
          onEquip={equipDeck}
          view={view}
          onViewChange={(next) => setSetting('deckEditorView', next)}
          copies={copies}
          onCopiesChange={(next) => setSetting('deckStacksCopies', next)}
          sort={sort}
          onSortChange={(next) => setSetting('deckStacksSort', next)}
          group={group}
          separateCreatures={separateCreatures}
          onSeparateCreaturesChange={(next) => setSetting('deckStacksSeparateCreatures', next)}
          scale={scale}
          onScaleChange={(next) => setSetting('deckStacksScale', normalizeDeckStacksScale(next))}
        />
      ) : (
        <DeckEditorTopBar
          name={deck.name}
          onNameChange={(val) => schedulePersist({ ...deck, name: val })}
          format={deck.format}
          onFormatChange={(f) => schedulePersist({ ...deck, format: f })}
          coverArtUrl={coverMeta?.artCropUrl}
          mainCount={mainCount}
          sideCount={sideCount}
          issues={validationReport.issues}
          saveState={saveState}
          onRetrySave={() => { void persist(deck) }}
          onBack={handleClose}
          deck={deck}
          isEquipped={equippedId === deck.id}
          onImport={() => setShowImportModal(true)}
          onSample={() => setShowSampleHand(true)}
          onEquip={equipDeck}
          onDone={handleClose}
        />
      )}

      <DeckServerIssues issues={serverIssueList} onRepair={handleRepairIssue} />
      <DeckFormatIssues issues={xmageDeckIssues} validator={formatIssues?.validator} />

      {phone ? (pilesView && (
        <DeckEditorPhoneControls
          zone={phoneZone}
          onZoneChange={setPhoneZone}
          group={group}
          onGroupChange={(next) => setSetting('deckStacksGroup', next)}
        />
      )) : (
        <DeckEditorToolbar
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setSetting('deckEditorDrawer', !drawerOpen)}
          view={view}
          onViewChange={(next) => setSetting('deckEditorView', next)}
          group={group}
          onGroupChange={(next) => setSetting('deckStacksGroup', next)}
          copies={copies}
          onCopiesChange={(next) => setSetting('deckStacksCopies', next)}
          sort={sort}
          onSortChange={(next) => setSetting('deckStacksSort', next)}
          separateCreatures={separateCreatures}
          onSeparateCreaturesChange={(next) => setSetting('deckStacksSeparateCreatures', next)}
          scale={scale}
          onScaleChange={(next) => setSetting('deckStacksScale', normalizeDeckStacksScale(next))}
          layout={layout}
          onToggleLayout={() => setLayout((l) => (l === 'vertical' ? 'horizontal' : 'vertical'))}
        />
      )}

      {phone ? mainEl : (
        <div className={`deck-builder-body${drawerOpen ? ' has-drawer' : ''}`}>
          {drawerOpen && catalogue}
          {mainEl}
          <aside className="deck-editor-panel">
            {focusPanel}
            {numbersPanel}
          </aside>
        </div>
      )}

      {phone && (
        <DeckEditorPhoneBottomBar
          onAddCards={() => setPhoneSheet('catalogue')}
          onCurve={() => setPhoneSheet('curve')}
          creditsClearance={creditsClearance}
        />
      )}

      {showImportModal && deck && (
        <DeckImportModal
          deckName={deck.name}
          onImport={mutations.handleApplyImport}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {showSampleHand && deck && (
        <SampleHandModal
          deckName={deck.name}
          cards={deck.cards}
          metaMap={metaMap}
          onClose={() => setShowSampleHand(false)}
        />
      )}

      {printingTargetCard && (
        <CardPrintingsModal
          cardName={printingTargetCard.cardName}
          currentSet={cardArtPreference(printingTargetCard.cardName)?.setCode ?? printingTargetCard.setCode}
          currentNumber={cardArtPreference(printingTargetCard.cardName)?.cardNumber ?? printingTargetCard.cardNumber}
          onSelectPrinting={mutations.handleApplyPrinting}
          onClose={() => setPrintingTargetCard(null)}
        />
      )}

      <HoverPreviewLayer store={previewStore} hidden={isDragging} />

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

      {phone && phoneSheet === 'catalogue' && (
        <DeckEditorSheet variant="full" title={t('decks', 'editor_add_cards')} testId="deck-phone-catalogue" onClose={closePhoneSheet}>
          {catalogue}
        </DeckEditorSheet>
      )}
      {phone && phoneSheet === 'curve' && (
        <DeckEditorSheet variant="bottom" title={t('decks', 'phone_curve')} testId="deck-phone-curve" onClose={closePhoneSheet}>
          {numbersPanel}
        </DeckEditorSheet>
      )}
      {phone && phoneSheet === 'card' && focus && (
        <DeckEditorSheet variant="bottom" title={t('decks', 'card')} testId="deck-phone-card" onClose={closePhoneSheet}>
          {focusPanel}
        </DeckEditorSheet>
      )}
    </div>
  )
}
