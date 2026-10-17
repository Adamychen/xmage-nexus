import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DeckCard } from '../lobby/decks'
import type { DeckV2 } from './types'
import { deckMainCount, deckSideCount } from './types'
import { getDeckStorage } from './storage'
import { useDeckMetadata } from './useDeckMetadata'
import { useDeckMutations } from './useDeckMutations'
import { useCardArtUrl } from './useCardArtUrl'
import { ArenaCardStacks } from './ArenaCardStacks'
import { buildTypeColumns } from './stackColumns'
import { useTypeLabels } from './useTypeLabels'
import SearchPanel from './SearchPanel'
import Button from '../ui/Button'
import EmptyState from '../ui/EmptyState'
import { useEventCallback } from '../utils/useEventCallback'
import { useTranslation } from '../i18n'
import './DeckStacksEditor.css'

const NO_FLAGGED_KEYS: Set<string> = new Set()
const noop = () => {}

export function DeckStacksEditor({ deck: initialDeck, onClose, onEdit }: {
  deck: DeckV2
  onClose: () => void
  onEdit: () => void
}) {
  const { t } = useTranslation()
  const storage = useMemo(() => getDeckStorage(), [])
  const [deck, setDeck] = useState<DeckV2>(initialDeck)
  const pendingRef = useRef<DeckV2 | null>(null)
  const timerRef = useRef<number | null>(null)
  const writesRef = useRef<Promise<void>>(Promise.resolve())

  const persist = useCallback((next: DeckV2) => {
    writesRef.current = writesRef.current
      .then(() => storage.put({ ...next, updatedAt: Date.now() }))
      .catch(() => {})
    return writesRef.current
  }, [storage])

  const schedulePersist = useCallback((next: DeckV2) => {
    setDeck(next)
    pendingRef.current = next
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      pendingRef.current = null
      void persist(next)
    }, 800)
  }, [persist])

  const flush = async () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (pendingRef.current) {
      void persist(pendingRef.current)
      pendingRef.current = null
    }
    await writesRef.current
  }

  const handleClose = async () => {
    await flush()
    onClose()
  }

  const handleEdit = async () => {
    await flush()
    onEdit()
  }

  const { metaMap, setMetaMap, updateMetaForDeck } = useDeckMetadata()
  const updateMeta = useEventCallback(updateMetaForDeck)
  useEffect(() => {
    updateMeta([...deck.cards, ...deck.sideboard])
  }, [deck.cards, deck.sideboard, updateMeta])

  const mutations = useDeckMutations({
    deck,
    schedulePersist,
    metaMap,
    setMetaMap,
    updateMetaForDeck,
    serverFlaggedKeys: NO_FLAGGED_KEYS,
    printingTargetCard: null,
    setPrintingTargetCard: noop,
  })

  const labels = useTypeLabels()
  const metaOf = useCallback(
    (c: DeckCard) => metaMap.get(`${c.setCode}/${c.cardNumber}`) ?? metaMap.get(c.cardName.toLowerCase()),
    [metaMap],
  )
  const mainColumns = useMemo(() => buildTypeColumns(deck.cards, metaOf, labels), [deck.cards, metaOf, labels])
  const sideColumns = useMemo(() => buildTypeColumns(deck.sideboard, metaOf, labels, 'sb:'), [deck.sideboard, metaOf, labels])

  const countMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const c of [...deck.cards, ...deck.sideboard]) {
      const keySetNum = `${c.setCode.toUpperCase()}/${c.cardNumber}`
      const keyName = c.cardName.toLowerCase()
      m.set(keySetNum, (m.get(keySetNum) ?? 0) + c.amount)
      m.set(keyName, (m.get(keyName) ?? 0) + c.amount)
    }
    return m
  }, [deck.cards, deck.sideboard])

  const coverArt = useCardArtUrl(deck.coverCard ?? deck.cards[0] ?? null)
  const mainCount = deckMainCount(deck)
  const sideCount = deckSideCount(deck)

  return (
    <div className="stacks-editor" data-testid="stacks-editor">
      <header className="stacks-editor-head">
        <div
          className="stacks-editor-art"
          style={coverArt ? { backgroundImage: `url(${coverArt})` } : undefined}
          aria-hidden="true"
        />
        <div className="stacks-editor-title">
          <h2 className="stacks-editor-name">{deck.name}</h2>
          <div className="stacks-editor-meta">
            <span className="stacks-editor-format">{deck.format}</span>
            <span>{mainCount} {t('decks', 'total_cards')}</span>
            <span>{sideCount} {t('decks', 'sideboard')}</span>
          </div>
        </div>
        <p className="stacks-editor-hint">{t('decks', 'stacks_editor_hint')}</p>
      </header>

      <div className="stacks-editor-body">
        <aside className="stacks-editor-search">
          <SearchPanel onAdd={mutations.handleAddFromSearch} countMap={countMap} format={deck.format} />
        </aside>

        <section className="stacks-editor-main">
          {mainCount === 0
            ? <EmptyState boxed size="lg" icon="layers" iconSize={22} title={t('decks', 'deck_no_cards')} />
            : <ArenaCardStacks columns={mainColumns} onInc={mutations.handleInc} onDec={mutations.handleDec} onSwap={mutations.handleSwap} />}
        </section>

        <aside className="stacks-editor-side">
          <div className="stacks-editor-side-head">
            <span>{t('decks', 'sideboard')}</span>
            <span className="stacks-editor-side-count">{sideCount}</span>
          </div>
          {sideCount === 0
            ? <div className="stacks-editor-side-empty">{t('decks', 'builder_side_empty')}</div>
            : <ArenaCardStacks columns={sideColumns} onInc={mutations.handleInc} onDec={mutations.handleDec} onSwap={mutations.handleSwap} />}
        </aside>
      </div>

      <footer className="stacks-editor-foot">
        <Button variant="subtle" icon="pencil" onClick={() => void handleEdit()}>{t('decks', 'deck_builder')}</Button>
        <Button variant="primary" data-testid="stacks-editor-done" onClick={() => void handleClose()}>{t('common', 'done')}</Button>
      </footer>
    </div>
  )
}
