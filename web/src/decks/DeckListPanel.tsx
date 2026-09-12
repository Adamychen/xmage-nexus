import { useMemo, useState } from 'react'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import type { ValidationIssue } from './formatRules'
import { commanderCardsFor, isCommanderEligible } from './deckUtils'
import { aggregateCards } from './deckCardOps'
import { ArenaCardStrip } from './ArenaCardStrip'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import './DeckListPanel.css'

function getCardKey(c: DeckCard): string {
  return `${c.setCode}:${c.cardNumber}:${c.cardName}`
}

function categorizeCard(typeLine?: string): string {
  if (!typeLine) return 'other'
  const tl = typeLine.toLowerCase()
  if (tl.includes('creature') || tl.includes('criatura')) return 'creatures'
  if (tl.includes('planeswalker')) return 'planeswalkers'
  if (tl.includes('instant') || tl.includes('instantáneo')) return 'instants'
  if (tl.includes('sorcery') || tl.includes('conjuro')) return 'sorceries'
  if (tl.includes('enchantment') || tl.includes('encantamiento')) return 'enchantments'
  if (tl.includes('artifact') || tl.includes('artefacto')) return 'artifacts'
  if (tl.includes('land') || tl.includes('tierra')) return 'lands'
  return 'other'
}

export default function DeckListPanel({
  cards,
  sideboard,
  coverKey,
  commanderCard,
  partnerCard,
  isCommanderFormat,
  metaMap,
  cardIssues,
  layout = 'vertical',
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
  metaMap: Map<string, CardStripMeta>
  cardIssues?: Map<string, ValidationIssue>
  layout?: 'vertical' | 'horizontal'
  onInc: (key: string) => void
  onDec: (key: string) => void
  onRemove: (key: string) => void
  onSetCover: (c: DeckCard) => void
  onSetCommander?: (c: DeckCard) => void
  onSetPartner?: (c: DeckCard) => void
  onHover?: (card: DeckCard, meta?: CardStripMeta, rect?: DOMRect) => void
  onLeave?: () => void
  onChangePrinting?: (c: DeckCard) => void
  onDropCard?: (cardData: any, target: 'main' | 'sideboard' | 'commander') => boolean | void
  onSwap?: (key: string) => void
  onDropFile?: (f: File) => void
}) {
  const { t } = useTranslation()
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
        const cardData = JSON.parse(rawData)
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
        const cardData = JSON.parse(rawData)
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
      const cardData = JSON.parse(rawData)
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

  // Group main cards by category
  const categoriesOrder = ['creatures', 'planeswalkers', 'instants', 'sorceries', 'artifacts', 'enchantments', 'lands', 'other']
  const catDisplay: Record<string, string> = {
    creatures: t('decks', 'creatures'),
    planeswalkers: t('game', 'category_planeswalkers'),
    instants: t('game', 'category_instants'),
    sorceries: t('game', 'category_sorceries'),
    artifacts: t('game', 'category_artifacts'),
    enchantments: t('game', 'category_enchantments'),
    lands: t('game', 'category_lands'),
    other: t('game', 'category_other'),
  }
  const groupedCards = new Map<string, DeckCard[]>()
  for (const cat of categoriesOrder) groupedCards.set(cat, [])

  for (const card of mainCardsWithoutCommander) {
    const meta = metaMap.get(`${card.setCode}/${card.cardNumber}`) ?? metaMap.get(card.cardName.toLowerCase())
    const cat = categorizeCard(meta?.typeLine)
    const list = groupedCards.get(cat) ?? groupedCards.get('other')!
    list.push(card)
  }
  for (const cat of categoriesOrder) {
    const list = groupedCards.get(cat)
    if (list && list.length > 1) {
      list.sort((a, b) => {
        const ma = metaMap.get(`${a.setCode}/${a.cardNumber}`) ?? metaMap.get(a.cardName.toLowerCase())
        const mb = metaMap.get(`${b.setCode}/${b.cardNumber}`) ?? metaMap.get(b.cardName.toLowerCase())
        const ca = ma?.cmc ?? 0
        const cb = mb?.cmc ?? 0
        if (ca !== cb) return ca - cb
        return a.cardName.localeCompare(b.cardName)
      })
    }
  }

  // Total counts
  const mainTotal = displayCards.reduce((s, c) => s + c.amount, 0)
  const sideTotal = displaySideboard.reduce((s, c) => s + c.amount, 0)

  const sideboardSection = (
    <div
      className={`deck-category-section deck-sideboard-section ${isSideDragOver ? 'is-side-drag-over' : ''}`}
      onDragOver={handleSideDragOver}
      onDragLeave={handleSideDragLeave}
      onDrop={handleSideDrop}
    >
      <div className="deck-category-header">
        <span>{t('decks', 'sideboard')}</span>
        <span className="deck-category-count">{sideTotal}/15</span>
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

          {/* Grouped Categories */}
          {categoriesOrder.map((cat) => {
            const list = groupedCards.get(cat) ?? []
            if (list.length === 0) return null
            const count = list.reduce((s, c) => s + c.amount, 0)

            return (
              <div key={cat} className="deck-category-section">
                <div className="deck-category-header">
                  <span>{catDisplay[cat] ?? cat}</span>
                  <span className="deck-category-count">{count}</span>
                </div>
                {list.map((card) => {
                  const k = getCardKey(card)
                  const meta = metaMap.get(`${card.setCode}/${card.cardNumber}`) ?? metaMap.get(card.cardName.toLowerCase())
                  const issue = cardIssues?.get(k)?.message ?? cardIssues?.get(card.cardName)?.message
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
                      commanderEligible={meta ? isCommanderEligible(meta) : undefined}
                      onHover={onHover}
                      onLeave={onLeave}
                      onChangePrinting={onChangePrinting}
                      onSwap={onSwap}
                      swapLabel={t('decks', 'builder_swap_to_side')}
                    />
                  )
                })}
              </div>
            )
          })}

          {/* Empty State */}
          {mainTotal === 0 && (
            <div className="deck-list-empty-hint">
              <span className="empty-hint-icon"><Icon name="layers" size={22} /></span>
              <span>{t('decks', 'deck_no_cards')}</span>
              <small>{t('decks', 'builder_drag_hint')}</small>
            </div>
          )}

          {/* Sideboard Section */}
          {sideboardSection}
        </div>
      ) : (
        <>
          {/* Horizontal Mode (Columns by CMC) */}
          <div className="arena-deck-cols-layout deck-cols">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((cmc) => {
              const colCards = displayCards.filter((c) => {
                const meta = metaMap.get(`${c.setCode}/${c.cardNumber}`) ?? metaMap.get(c.cardName.toLowerCase())
                const cardCmc = meta?.cmc ?? 0
                return cmc === 7 ? cardCmc >= 7 : cardCmc === cmc
              })
              const totalInCol = colCards.reduce((s, c) => s + c.amount, 0)
              if (colCards.length === 0) return null

              return (
                <div key={cmc} className="arena-deck-column deck-col">
                  <div className="arena-deck-col-head deck-col-head">
                    <span className="deck-col-title">{cmc === 7 ? '7+' : `CMC ${cmc}`}</span>
                    <span className="deck-col-count">{totalInCol}</span>
                  </div>
                  <div className="deck-col-list">
                    {colCards.map((card) => {
                      const k = getCardKey(card)
                      const meta = metaMap.get(`${card.setCode}/${card.cardNumber}`) ?? metaMap.get(card.cardName.toLowerCase())
                      const issue = cardIssues?.get(k)?.message ?? cardIssues?.get(card.cardName)?.message
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
                          commanderEligible={meta ? isCommanderEligible(meta) : undefined}
                          onHover={onHover}
                          onLeave={onLeave}
                          onChangePrinting={onChangePrinting}
                          onSwap={onSwap}
                          swapLabel={t('decks', 'builder_swap_to_side')}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          {sideboardSection}
        </>
      )}
    </div>
  )
}