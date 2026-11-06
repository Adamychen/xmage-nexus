import { useMemo, useState } from 'react'
import EmptyState from '../ui/EmptyState'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta, DroppedCardData } from './ArenaCardStrip'
import type { ValidationIssue } from './formatRules'
import { FORMAT_CONFIGS } from './formatRules'
import type { DeckFormat } from './types'
import { commanderCardsFor } from './deckUtils'
import { commanderEligibleFor } from './useCommanderEligibility'
import { aggregateCards } from './deckCardOps'
import { buildStackColumns, listGroupOf, type StackGroup, type StackSort } from './stackColumns'
import type { StackItem } from './ArenaCardStacks'
import { useStackLabels } from './useStackLabels'
import { ArenaCardStrip } from './ArenaCardStrip'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import './DeckListPanel.css'

function getCardKey(c: DeckCard): string {
  return `${c.setCode}:${c.cardNumber}:${c.cardName}`
}

export default function DeckListPanel({
  cards,
  sideboard,
  coverKey,
  commanderCard,
  partnerCard,
  isCommanderFormat,
  format = 'Freeform',
  metaMap,
  commanderEligibilityMap,
  cardIssues,
  layout = 'vertical',
  group = 'type',
  sort = 'cmc',
  onInc,
  onDec,
  onRemove,
  onSetCover,
  onSetCommander,
  onSetPartner,
  onHover,
  onLeave,
  onChangePrinting,
  onDropCard,
  onSwap,
  onDropFile,
}: {
  cards: DeckCard[]
  sideboard: DeckCard[]
  coverKey: string | null
  commanderCard?: DeckCard | null
  partnerCard?: DeckCard | null
  isCommanderFormat?: boolean
  format?: DeckFormat
  metaMap: Map<string, CardStripMeta>
  commanderEligibilityMap?: Map<string, boolean> | null
  cardIssues?: Map<string, ValidationIssue>
  layout?: 'vertical' | 'horizontal'
  group?: StackGroup
  sort?: StackSort
  onInc: (key: string) => void
  onDec: (key: string) => void
  onRemove: (key: string) => void
  onSetCover: (c: DeckCard) => void
  onSetCommander?: (c: DeckCard) => void
  onSetPartner?: (c: DeckCard) => void
  onHover?: (card: DeckCard, meta?: CardStripMeta, rect?: DOMRect) => void
  onLeave?: () => void
  onChangePrinting?: (c: DeckCard) => void
  onDropCard?: (cardData: DroppedCardData, target: 'main' | 'sideboard' | 'commander') => boolean | void
  onSwap?: (key: string) => void
  onDropFile?: (f: File) => void
}) {
  const { t } = useTranslation()
  const labels = useStackLabels()
  const [isDragOver, setIsDragOver] = useState(false)
  const [isSideDragOver, setIsSideDragOver] = useState(false)
  const [isCommanderDragOver, setIsCommanderDragOver] = useState(false)
  const [commanderDropInvalid, setCommanderDropInvalid] = useState(false)

  const displayCards = useMemo(() => aggregateCards(cards), [cards])
  const displaySideboard = useMemo(() => aggregateCards(sideboard), [sideboard])

  // Chrome cancels the drop when dropEffect is not permitted by the drag source's
  // effectAllowed (search cards drag with 'copy', deck strips with 'move').
  const compatibleDropEffect = (e: React.DragEvent) => {
    e.dataTransfer.dropEffect = e.dataTransfer.effectAllowed === 'move' ? 'move' : 'copy'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    compatibleDropEffect(e)
    if (!isDragOver) setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    // Check if a file was dropped
    const file = e.dataTransfer.files?.[0]
    if (file && onDropFile) {
      onDropFile(file)
      return
    }

    // Check if card JSON was dropped
    const rawData = e.dataTransfer.getData('application/json')
    if (rawData && onDropCard) {
      try {
        const cardData = JSON.parse(rawData) as DroppedCardData
        onDropCard(cardData, 'main')
      } catch {}
    }
  }

  const handleSideDragOver = (e: React.DragEvent) => {
    if (!onDropCard) return
    e.preventDefault()
    e.stopPropagation()
    compatibleDropEffect(e)
    if (!isSideDragOver) setIsSideDragOver(true)
  }

  const handleSideDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsSideDragOver(false)
  }

  const handleSideDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsSideDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file && onDropFile) {
      onDropFile(file)
      return
    }
    const rawData = e.dataTransfer.getData('application/json')
    if (rawData && onDropCard) {
      try {
        const cardData = JSON.parse(rawData) as DroppedCardData
        if (cardData?.source !== 'sideboard') onDropCard(cardData, 'sideboard')
      } catch {}
    }
  }

  const handleCommanderDragOver = (e: React.DragEvent) => {
    if (!onDropCard) return
    e.preventDefault()
    e.stopPropagation()
    compatibleDropEffect(e)
    if (!isCommanderDragOver) setIsCommanderDragOver(true)
  }

  const handleCommanderDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsCommanderDragOver(false)
  }

  const handleCommanderDrop = (e: React.DragEvent) => {
    if (!onDropCard) return
    e.preventDefault()
    e.stopPropagation()
    setIsCommanderDragOver(false)
    const rawData = e.dataTransfer.getData('application/json')
    if (!rawData) return
    try {
      const cardData = JSON.parse(rawData) as DroppedCardData
      const accepted = onDropCard(cardData, 'commander')
      if (accepted === false) {
        setCommanderDropInvalid(true)
        window.setTimeout(() => setCommanderDropInvalid(false), 700)
      }
    } catch {}
  }

  // Commander cards (explicit designation + second Partner/Background, U7-7).
  // Sin comandante designado no se muestra nada: nada de portada/primera carta.
  const commanderCards = isCommanderFormat && displayCards.length > 0
    ? commanderCardsFor(displayCards, commanderCard ?? null, partnerCard ?? null, metaMap)
    : []
  const commanderKeys = new Set(commanderCards.map(getCardKey))
  const showCommanderEmpty = !!isCommanderFormat && commanderCards.length === 0

  const mainCardsWithoutCommander = commanderCards.length > 0
    ? displayCards.filter((c) => !commanderKeys.has(getCardKey(c)))
    : displayCards

  const metaOf = (c: DeckCard) => metaMap.get(`${c.setCode}/${c.cardNumber}`) ?? metaMap.get(c.cardName.toLowerCase())
  const listGroup = listGroupOf(group)
  const sections = buildStackColumns(mainCardsWithoutCommander, metaOf, { group: listGroup, sort, labels })
  const columns = layout === 'horizontal'
    ? buildStackColumns(displayCards, metaOf, { group: listGroup, sort, labels, commanderKeys })
    : []
  const countOf = (items: StackItem[]) => items.reduce((sum, item) => sum + item.card.amount, 0)
  const mainStrip = (card: DeckCard, commanderIndex = -1) => {
    const k = getCardKey(card)
    const meta = metaOf(card)
    const issue = cardIssues?.get(k)?.message ?? cardIssues?.get(card.cardName)?.message
    if (commanderIndex >= 0) {
      return (
        <ArenaCardStrip
          key={k}
          card={card}
          meta={meta}
          isCommander
          isCover={commanderIndex === 0}
          onInc={onInc}
          onDec={onDec}
          onRemove={onRemove}
          onSetCover={onSetCover}
          onSetCommander={commanderIndex === 0 ? onSetCommander : onSetPartner}
          onHover={onHover}
          onLeave={onLeave}
          onChangePrinting={onChangePrinting}
        />
      )
    }
    return (
      <ArenaCardStrip
        key={k}
        card={card}
        meta={meta}
        isCover={coverKey === k}
        issue={issue}
        onInc={onInc}
        onDec={onDec}
        onRemove={onRemove}
        onSetCover={onSetCover}
        onSetCommander={onSetCommander}
        commanderEligible={commanderEligibleFor(commanderEligibilityMap, card.cardName, meta)}
        onHover={onHover}
        onLeave={onLeave}
        onChangePrinting={onChangePrinting}
        onSwap={onSwap}
        swapLabel={t('decks', 'builder_swap_to_side')}
      />
    )
  }

  // Total counts
  const mainTotal = displayCards.reduce((s, c) => s + c.amount, 0)
  const sideTotal = displaySideboard.reduce((s, c) => s + c.amount, 0)
  const maxSideboard = (FORMAT_CONFIGS[format] ?? FORMAT_CONFIGS.Freeform).maxSideboard
  const sideCountLabel = maxSideboard > 0 && maxSideboard < 99 ? `${sideTotal}/${maxSideboard}` : `${sideTotal}`

  const sideboardSection = (
    <div
      className={`deck-category-section deck-sideboard-section ${isSideDragOver ? 'is-side-drag-over' : ''}`}
      onDragOver={handleSideDragOver}
      onDragLeave={handleSideDragLeave}
      onDrop={handleSideDrop}
    >
      <div className="deck-category-header">
        <span>{t('decks', 'sideboard')}</span>
        <span className={`deck-category-count ${maxSideboard > 0 && sideTotal > maxSideboard ? 'is-over' : ''}`}>{sideCountLabel}</span>
      </div>
      {sideboard.length === 0 && <div className="deck-sideboard-empty">{t('decks', 'builder_side_empty')}</div>}
      {displaySideboard.map((card) => {
        const k = `sb:${getCardKey(card)}`
        const meta = metaMap.get(`${card.setCode}/${card.cardNumber}`) ?? metaMap.get(card.cardName.toLowerCase())
        const issue = cardIssues?.get(k)?.message ?? cardIssues?.get(card.cardName)?.message
        return (
          <ArenaCardStrip
            key={k}
            card={card}
            meta={meta}
            sideboard
            issue={issue}
            onInc={onInc}
            onDec={onDec}
            onRemove={onRemove}
            onHover={onHover}
            onLeave={onLeave}
            onChangePrinting={onChangePrinting}
            onSwap={onSwap}
            swapLabel={t('decks', 'builder_swap_to_main')}
          />
        )
      })}
    </div>
  )

  const commanderSection = isCommanderFormat ? (
    <div
      className={`deck-category-section deck-commander-section ${isCommanderDragOver ? 'is-commander-drag-over' : ''} ${commanderDropInvalid ? 'is-commander-drop-invalid' : ''}`}
      onDragOver={handleCommanderDragOver}
      onDragLeave={handleCommanderDragLeave}
      onDrop={handleCommanderDrop}
    >
      <div className="deck-category-header">
        <span>{t('decks', 'commander')}</span>
        {commanderCards.length > 0 && <span className="deck-category-count">{commanderCards.length}</span>}
      </div>
      {showCommanderEmpty && (
        <div className="deck-sideboard-empty deck-commander-empty">
          {isCommanderDragOver ? t('decks', 'commander_drop_here') : t('decks', 'commander_hint')}
        </div>
      )}
      {isCommanderDragOver && commanderCards.length > 0 && (
        <div className="deck-commander-drop-hint">
          {commanderCards.length === 1 ? t('decks', 'commander_set_partner') : t('decks', 'commander_drop_here')}
        </div>
      )}
      {commanderCards.map((cmdCard, index) => (
        <ArenaCardStrip
          key={getCardKey(cmdCard)}
          card={cmdCard}
          meta={metaMap.get(`${cmdCard.setCode}/${cmdCard.cardNumber}`) ?? metaMap.get(cmdCard.cardName.toLowerCase())}
          isCommander
          isCover={index === 0}
          onInc={onInc}
          onDec={onDec}
          onRemove={onRemove}
          onSetCover={onSetCover}
          onSetCommander={index === 0 ? onSetCommander : onSetPartner}
          onHover={onHover}
          onLeave={onLeave}
          onChangePrinting={onChangePrinting}
        />
      ))}
    </div>
  ) : null

  return (
    <div
      className={`arena-deck-list-container deck-list-panel ${isDragOver ? 'is-drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {layout === 'vertical' ? (
        <div className="arena-deck-list-scroll">
          {/* Drop indicator prompt */}
          {isDragOver && (
            <div className="arena-drop-target-hint">
              <span><Icon name="sparkles" size={13} /></span> {t('decks', 'builder_drag_hint')}
            </div>
          )}

          {/* Commander Banner (1 card, or 2 with Partner — U7-7) */}
          {commanderSection}

          {sections.map((section) => (
            <div key={section.id} className="deck-category-section" data-group={section.id}>
              <div className="deck-category-header">
                <span>{section.label}</span>
                <span className="deck-category-count">{countOf(section.items)}</span>
              </div>
              {section.items.map((item) => mainStrip(item.card))}
            </div>
          ))}

          {/* Empty State */}
          {mainTotal === 0 && (
            <EmptyState boxed size="lg" icon="layers" iconSize={22} title={t('decks', 'deck_no_cards')}>
              {t('decks', 'builder_drag_hint')}
            </EmptyState>
          )}

          {/* Sideboard Section */}
          {sideboardSection}
        </div>
      ) : (
        <>
          <div className="arena-deck-cols-layout deck-cols">
            <div className="deck-cols-flow">
            {columns.map((column) => (
              <div key={column.id} className={`arena-deck-column deck-col${column.kind === 'commander' ? ' deck-col--commander' : ''}`} data-group={column.id}>
                <div className="arena-deck-col-head deck-col-head">
                  <span className="deck-col-title">{column.label}</span>
                  <span className="deck-col-count">{countOf(column.items)}</span>
                </div>
                <div className="deck-col-list">
                  {column.items.map((item) => mainStrip(item.card, column.kind === 'commander' ? commanderCards.findIndex((c) => getCardKey(c) === item.key) : -1))}
                </div>
              </div>
            ))}
            </div>
          </div>
          {sideboardSection}
        </>
      )}
    </div>
  )
}