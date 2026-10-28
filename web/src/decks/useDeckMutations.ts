import { useRef } from 'react'
import type { DeckV2 } from './types'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta, DroppedCardData } from './ArenaCardStrip'
import type { ScryfallSearchCard } from './scryfallSearch'
import type { BasicLandPreset } from './deckUtils'
import type { ImportResult } from './DeckImportModal'
import { parseAnyDeck } from './parseDck'
import { getEffectiveCardLang, setCachedCardName } from '../cards/cardLocalization'
import {
  deckCardKey, copiesOf, moveOneBetween, incrementInList, decrementInList, removeFromList,
  mergeIntoList, insertOrIncrement, addSearchResult, replaceBasicLands,
  dropOnCommander, stripMetaFromSearch, type SuggestedLand,
} from './deckCardOps'
import { applyPrintingsByName, countUnresolved, resolveDeckPrintings, type PrintingStrategy } from './importResolve'
import { normalizeDeckCard } from './deckNormalize'
import { setCardArtPreference } from '../cards/artPreferences'
import { canPairCommanders, isCommanderEligible } from './deckUtils'
import { commanderEligibilityKey } from './useCommanderEligibility'
import { setStoreError } from '../state/store'
import { t as tStatic } from '../i18n'
import {
  addCopies, addPile, assignAllCopies, largestPile, moveCopies, reconcileStackPiles, removePile, renamePile,
  takeCopies, UNSORTED, type DeckStackPiles,
} from './stackPiles'

interface Deps {
  deck: DeckV2 | null
  schedulePersist: (next: DeckV2) => void
  metaMap: Map<string, CardStripMeta>
  setMetaMap: React.Dispatch<React.SetStateAction<Map<string, CardStripMeta>>>
  updateMetaForDeck: (cards: DeckCard[]) => void
  serverFlaggedKeys: Set<string>
  printingTargetCard: DeckCard | null
  setPrintingTargetCard: (c: DeckCard | null) => void
  commanderEligibilityMap?: Map<string, boolean> | null
}

export type PileTarget = { kind: 'pile'; pileId: string } | { kind: 'new'; label: string }

export type StackDropPayload = DroppedCardData & { key?: string; pileId?: string }

const NO_PILES: DeckStackPiles = { piles: [], assign: {} }

function resolvePileTarget(sp: DeckStackPiles, target: PileTarget): { sp: DeckStackPiles; pileId: string } {
  if (target.kind === 'new') {
    const added = addPile(sp, target.label)
    return { sp: added.next, pileId: added.id }
  }
  return { sp, pileId: target.pileId }
}

function placeCopy(sp: DeckStackPiles, cardKey: string, target: PileTarget): DeckStackPiles {
  const placed = resolvePileTarget(sp, target)
  return addCopies(placed.sp, cardKey, placed.pileId, 1)
}

function editPiles(before: DeckV2, after: DeckV2, edit: (sp: DeckStackPiles) => DeckStackPiles): DeckV2 {
  const edited = edit(reconcileStackPiles(before.stackPiles ?? NO_PILES, before.cards))
  if (!before.stackPiles && edited.piles.length === 0) return after
  return { ...after, stackPiles: reconcileStackPiles(edited, after.cards) }
}

function adoptedCommandersOf(commanders?: DeckCard[]) {
  const commander = commanders?.[0]
  const partner = commanders?.[1]
  return {
    commander,
    partner: commander && partner && deckCardKey(commander) !== deckCardKey(partner) ? partner : undefined,
  }
}

/** Todos los handlers de mutación del mazo (añadir/mover/inc/dec/borrar/importar/imprenta/tierras). */
export function useDeckMutations(deps: Deps) {
  const {
    deck, schedulePersist, metaMap, setMetaMap, updateMetaForDeck,
    serverFlaggedKeys, printingTargetCard, setPrintingTargetCard,
    commanderEligibilityMap,
  } = deps

  const deckRef = useRef(deck)
  deckRef.current = deck

  const resolvePrintingsOf = async (start: DeckV2, strategy: PrintingStrategy) => {
    if (countUnresolved(start) === 0) return
    const res = await resolveDeckPrintings(start, { strategy })
    const latest = deckRef.current
    if (!latest || latest.id !== start.id || res.printingsByName.size === 0) return
    const next = applyPrintingsByName(latest, res.printingsByName)
    schedulePersist({ ...latest, ...next })
    updateMetaForDeck([...next.cards, ...next.sideboard])
  }

  const handleResolvePrintings = async () => {
    const start = deckRef.current
    if (start) await resolvePrintingsOf(start, 'default')
  }

  const handleAddFromSearch = (card: ScryfallSearchCard) => {
    if (!deck) return
    if (card.printed_name) {
      setCachedCardName(card.name, card.printed_name, card.lang || getEffectiveCardLang())
    }
    const { cards: nextCards, card: added } = addSearchResult(deck.cards, card)
    const meta = stripMetaFromSearch(card)
    setMetaMap((prev) => {
      const m = new Map(prev)
      m.set(`${added.setCode}/${added.cardNumber}`, meta)
      m.set(card.name.toLowerCase(), meta)
      return m
    })
    schedulePersist({
      ...deck,
      cards: nextCards,
      coverCard: deck.coverCard ?? nextCards[0],
    })
  }

  const handleSwap = (k: string, from?: string, to?: PileTarget) => {
    if (!deck) return
    if (k.startsWith('sb:')) {
      const cardKey = k.slice(3)
      const [nextSide, nextCards] = moveOneBetween(deck.sideboard, deck.cards, cardKey)
      if (nextCards === deck.cards) return
      const after = { ...deck, cards: nextCards, sideboard: nextSide }
      schedulePersist(to ? editPiles(deck, after, (sp) => placeCopy(sp, cardKey, to)) : after)
    } else {
      const [nextCards, nextSide] = moveOneBetween(deck.cards, deck.sideboard, k)
      if (nextCards === deck.cards) return
      const after = { ...deck, cards: nextCards, sideboard: nextSide }
      schedulePersist(editPiles(deck, after, (sp) => takeCopies(sp, k, from ?? largestPile(sp, k) ?? UNSORTED, 1)))
    }
  }

  const cacheMetaFromPayload = (cardData: DroppedCardData, setCode: string, cardNumber: string, cardName: string) => {
    if (cardData.manaCost === undefined && !cardData.typeLine) return
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
        colorIdentity: cardData.colorIdentity,
        oracleText: cardData.oracleText ?? '',
        legalities: cardData.legalities,
      }
      nxt.set(`${setCode}/${cardNumber}`, meta)
      nxt.set(cardName.toLowerCase(), meta)
      return nxt
    })
  }

  const metaOf = (cardName: string, setCode: string, cardNumber: string, payload?: DroppedCardData) => {
    if (payload?.typeLine) {
      return { typeLine: payload.typeLine, oracleText: payload.oracleText ?? '', keywords: payload.keywords }
    }
    return metaMap.get(`${setCode.toUpperCase()}/${cardNumber}`)
      ?? metaMap.get(`${setCode}/${cardNumber}`)
      ?? metaMap.get(cardName.toLowerCase())
      ?? null
  }

  const pairBetween = (
    a: { cardName: string; setCode: string; cardNumber: string } | null | undefined,
    b: { cardName: string; setCode: string; cardNumber: string } | null | undefined,
  ): boolean => {
    if (!a || !b) return false
    const aMeta = metaOf(a.cardName, a.setCode, a.cardNumber)
    const bMeta = metaOf(b.cardName, b.setCode, b.cardNumber)
    if (!aMeta || !bMeta) return false
    return canPairCommanders(aMeta, bMeta, a.cardName, b.cardName)
  }

  const sameCard = (a: { cardName: string; setCode: string; cardNumber: string }, cardName: string, setCode: string, cardNumber: string) =>
    a.cardName === cardName
    && a.setCode.toUpperCase() === setCode.toUpperCase()
    && a.cardNumber === cardNumber

  const handleDropCardOnDeck = (
    cardData: DroppedCardData,
    target: 'main' | 'sideboard' | 'commander',
    pile?: PileTarget,
  ): boolean | void => {
    if (!deck || !cardData?.cardName) return
    const setCode = (cardData.setCode || '').toUpperCase()
    const cardNumber = cardData.cardNumber || '0'
    const cardName = cardData.cardName
    const key = `${setCode}:${cardNumber}:${cardName}`
    const source: string = cardData.source ?? 'search'

    if (target === 'commander') {
      const droppedMeta = metaOf(cardName, setCode, cardNumber, cardData)
      // Proxy primero (clases reales de xmage, p.ej. Grist); fallback: la
      // heurística del oráculo, permitiendo soltar si no hay meta que validar.
      const fromProxy = commanderEligibilityMap?.get(commanderEligibilityKey(cardName))
      const droppedEligible = fromProxy ?? (!droppedMeta || isCommanderEligible(droppedMeta))
      const commander = deck.commanderCard ?? null
      const partner = deck.partnerCard ?? null

      let nextCommander = commander
      let nextPartner = partner
      const droppedCard = { cardName, setCode, cardNumber, amount: 1 }
      if (commander && sameCard(commander, cardName, setCode, cardNumber)) {
        nextCommander = commander
        nextPartner = partner
      } else if (partner && sameCard(partner, cardName, setCode, cardNumber)) {
        nextCommander = commander
        nextPartner = partner
      } else if (partner && pairBetween(partner, droppedCard)) {
        nextCommander = droppedCard
        nextPartner = partner
      } else if (commander && pairBetween(commander, droppedCard)) {
        nextCommander = commander
        nextPartner = droppedCard
      } else if (droppedEligible) {
        nextCommander = droppedCard
        nextPartner = null
      } else {
        return false
      }

      const res = dropOnCommander(deck.cards, deck.sideboard, { cardName, setCode, cardNumber, source }, serverFlaggedKeys)
      let nextCover = deck.coverCard
      if (res.replacedOldKey && nextCover && deckCardKey(nextCover) === res.replacedOldKey) {
        nextCover = { ...nextCover, cardName, setCode, cardNumber }
      }
      schedulePersist({
        ...deck,
        cards: res.cards,
        sideboard: res.sideboard,
        commanderCard: nextCommander ?? undefined,
        partnerCard: nextPartner ?? undefined,
        coverCard: nextCover ?? res.cards[0],
      })
      cacheMetaFromPayload(cardData, setCode, cardNumber, cardName)
      return true
    }

    if (source === 'sideboard' && target === 'main') {
      handleSwap(`sb:${key}`, undefined, pile)
      return
    }
    if (source === 'main' && target === 'sideboard') {
      handleSwap(key)
      return
    }

    const dropped = { cardName, setCode, cardNumber }
    if (target === 'main') {
      const { list: nextCards, replacedOldKey } = insertOrIncrement(deck.cards, dropped, serverFlaggedKeys)
      let nextCover = deck.coverCard
      if (replacedOldKey && nextCover && deckCardKey(nextCover) === replacedOldKey) {
        nextCover = { ...nextCover, cardName, setCode, cardNumber }
      }
      const after = { ...deck, cards: nextCards, coverCard: nextCover ?? nextCards[0] }
      schedulePersist(pile ? editPiles(deck, after, (sp) => placeCopy(sp, key, pile)) : after)
    } else {
      const { list: nextSide } = insertOrIncrement(deck.sideboard, dropped, serverFlaggedKeys)
      schedulePersist({ ...deck, sideboard: nextSide })
    }

    cacheMetaFromPayload(cardData, setCode, cardNumber, cardName)
  }

  const splitKey = (k: string) => {
    const isSide = k.startsWith('sb:')
    return { isSide, key: isSide ? k.slice(3) : k }
  }

  const handleInc = (k: string, pileId?: string) => {
    if (!deck) return
    const { isSide, key } = splitKey(k)
    if (isSide) {
      schedulePersist({ ...deck, sideboard: incrementInList(deck.sideboard, key) })
      return
    }
    const cards = incrementInList(deck.cards, key)
    if (cards === deck.cards) return
    const after = { ...deck, cards }
    schedulePersist(pileId ? editPiles(deck, after, (sp) => addCopies(sp, key, pileId, 1)) : after)
  }

  const handleDec = (k: string, pileId?: string) => {
    if (!deck) return
    const { isSide, key } = splitKey(k)
    if (isSide) {
      schedulePersist({ ...deck, sideboard: decrementInList(deck.sideboard, key) })
      return
    }
    const cards = decrementInList(deck.cards, key)
    if (cards === deck.cards) return
    const after = { ...deck, cards }
    schedulePersist(pileId ? editPiles(deck, after, (sp) => takeCopies(sp, key, pileId, 1)) : after)
  }

  const handleRemove = (k: string) => {
    if (!deck) return
    const { isSide, key } = splitKey(k)
    if (isSide) {
      schedulePersist({ ...deck, sideboard: removeFromList(deck.sideboard, key) })
    } else {
      schedulePersist({ ...deck, cards: removeFromList(deck.cards, key) })
    }
  }

  const handleSetCover = (c: DeckCard) => {
    if (!deck) return
    schedulePersist({ ...deck, coverCard: c })
  }

  const handleAssignPile = (cardKey: string, target: PileTarget) => {
    if (!deck) return
    const amount = copiesOf(deck.cards, cardKey)
    schedulePersist(editPiles(deck, deck, (sp) => {
      const placed = resolvePileTarget(sp, target)
      return assignAllCopies(placed.sp, cardKey, placed.pileId, amount)
    }))
  }

  const handleRenamePile = (id: string, label: string) => {
    if (!deck?.stackPiles) return
    schedulePersist({ ...deck, stackPiles: renamePile(deck.stackPiles, id, label) })
  }

  const handleRemovePile = (id: string) => {
    if (!deck?.stackPiles) return
    schedulePersist({ ...deck, stackPiles: removePile(deck.stackPiles, id) })
  }

  const moveWithin = (cardKey: string, fromPile: string | undefined, target: PileTarget) => {
    if (!deck) return
    schedulePersist(editPiles(deck, deck, (sp) => {
      const placed = resolvePileTarget(sp, target)
      return moveCopies(placed.sp, cardKey, fromPile ?? largestPile(sp, cardKey) ?? UNSORTED, placed.pileId, 1)
    }))
  }

  const handleStacksDrop = (zone: 'main' | 'side', payload: StackDropPayload, pile?: PileTarget) => {
    if (!deck) return
    if (payload.source === 'main' || payload.source === 'sideboard') {
      const cardKey = (payload.key ?? '').replace(/^sb:/, '')
      if (!cardKey) return
      const from = payload.source === 'sideboard' ? 'side' : 'main'
      if (from !== zone) {
        handleSwap(zone === 'main' ? `sb:${cardKey}` : cardKey, payload.pileId, pile)
      } else if (zone === 'main' && pile) {
        moveWithin(cardKey, payload.pileId, pile)
      }
      return
    }
    handleDropCardOnDeck(payload, zone === 'main' ? 'main' : 'sideboard', zone === 'main' ? pile : undefined)
  }

  /** Designa/quita el primer comandante (corona). Al quitarlo, el segundo asciende. */
  const handleSetCommander = (c: DeckCard) => {
    if (!deck) return
    const isSame = !!deck.commanderCard && deckCardKey(deck.commanderCard) === deckCardKey(c)
    if (isSame) {
      schedulePersist({ ...deck, commanderCard: deck.partnerCard, partnerCard: undefined })
      return
    }
    const keepPartner = deck.partnerCard && pairBetween(c, deck.partnerCard)
    schedulePersist({ ...deck, commanderCard: c, partnerCard: keepPartner ? deck.partnerCard : undefined })
  }

  /** Designa/quita el segundo comandante (Partner/Trasfondo) si es pareja legal. */
  const handleSetPartner = (c: DeckCard) => {
    if (!deck) return
    const isSame = !!deck.partnerCard && deckCardKey(deck.partnerCard) === deckCardKey(c)
    if (isSame) {
      schedulePersist({ ...deck, partnerCard: undefined })
      return
    }
    if (deck.commanderCard && pairBetween(deck.commanderCard, c)) {
      schedulePersist({ ...deck, partnerCard: c })
    }
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

  const handleApplySuggestedLands = (suggested: SuggestedLand[]) => {
    if (!deck) return
    const nextCards = replaceBasicLands(deck.cards, suggested)
    schedulePersist({ ...deck, cards: nextCards, coverCard: deck.coverCard ?? nextCards[0] })
  }

  const handleChangePrinting = (card: DeckCard) => {
    setPrintingTargetCard(card)
  }

  const handleApplyPrinting = (setCode: string, cardNumber: string) => {
    if (!printingTargetCard) return
    const printing = normalizeDeckCard({ cardName: printingTargetCard.cardName, setCode, cardNumber, amount: 1 })
    setCardArtPreference(printingTargetCard.cardName, printing.setCode, printing.cardNumber)
    updateMetaForDeck([printingTargetCard])
    setPrintingTargetCard(null)
  }

  const handleApplyImport = (result: ImportResult & { strategy?: PrintingStrategy }) => {
    if (!deck) return
    const adopted = adoptedCommandersOf(result.commanders)
    let next: DeckV2
    if (result.mode === 'replace') {
      const nextCards = result.cards
      const nextSide = result.sideboard
      const stillPresent = (c?: DeckCard) =>
        c !== undefined && nextCards.some((n) =>
          n.cardName === c.cardName && n.setCode === c.setCode && n.cardNumber === c.cardNumber)
        ? c
        : undefined
      next = {
        ...deck,
        cards: nextCards,
        sideboard: nextSide,
        stackPiles: result.stackPiles,
        coverCard: nextCards[0] ?? null,
        commanderCard: adopted.commander ?? stillPresent(deck.commanderCard),
        partnerCard: adopted.partner ?? stillPresent(deck.partnerCard),
      }
      updateMetaForDeck([...nextCards, ...nextSide])
    } else {
      const mergedCards = mergeIntoList(deck.cards, result.cards)
      const mergedSide = mergeIntoList(deck.sideboard, result.sideboard)
      next = {
        ...deck,
        cards: mergedCards,
        sideboard: mergedSide,
        stackPiles: deck.stackPiles ?? result.stackPiles,
        coverCard: deck.coverCard ?? mergedCards[0] ?? null,
        commanderCard: deck.commanderCard ?? adopted.commander,
        partnerCard: deck.partnerCard ?? adopted.partner,
      }
      updateMetaForDeck([...result.cards, ...result.sideboard])
    }
    schedulePersist(next)
    void resolvePrintingsOf(next, result.strategy ?? 'default').catch(() => {})
  }

  const handleDropFile = async (f: File) => {
    if (!deck) return
    const text = await f.text()
    const parsed = parseAnyDeck(text, deck.name)
    if (!parsed) {
      setStoreError(tStatic('errors', 'deck_parse_failed'))
      return
    }
    const adopted = adoptedCommandersOf(parsed.commanders)
    const next: DeckV2 = {
      ...deck,
      cards: mergeIntoList(deck.cards, parsed.cards),
      sideboard: mergeIntoList(deck.sideboard, parsed.sideboard),
      stackPiles: deck.stackPiles ?? parsed.stackPiles,
      commanderCard: deck.commanderCard ?? adopted.commander,
      partnerCard: deck.partnerCard ?? adopted.partner,
    }
    schedulePersist(next)
    updateMetaForDeck([...parsed.cards, ...parsed.sideboard])
    void resolvePrintingsOf(next, 'default').catch(() => {})
  }

  return {
    handleAddFromSearch, handleSwap, handleDropCardOnDeck,
    handleInc, handleDec, handleRemove, handleSetCover, handleSetCommander, handleSetPartner,
    handleAssignPile, handleRenamePile, handleRemovePile, handleStacksDrop,
    handleAddBasicLand, handleRemoveBasicLand, handleApplySuggestedLands,
    handleChangePrinting, handleApplyPrinting, handleApplyImport, handleDropFile, handleResolvePrintings,
  }
}
