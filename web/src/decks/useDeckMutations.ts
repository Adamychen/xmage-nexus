import type { DeckV2 } from './types'
import type { DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import type { ScryfallSearchCard } from './scryfallSearch'
import type { BasicLandPreset } from './deckUtils'
import type { ImportResult } from './DeckImportModal'
import { parseAnyDeck } from './parseDck'
import { getEffectiveCardLang, setCachedCardName } from '../cards/cardLocalization'
import {
  deckCardKey, moveOneBetween, incrementInList, decrementInList, removeFromList,
  mergeIntoList, insertOrIncrement, addSearchResult, applyPrinting, replaceBasicLands,
  dropOnCommander, stripMetaFromSearch, type SuggestedLand,
} from './deckCardOps'
import { canPairCommanders, isCommanderEligible } from './deckUtils'
import { setStoreError } from '../state/store'
import { t as tStatic } from '../i18n'

interface Deps {
  deck: DeckV2 | null
  schedulePersist: (next: DeckV2) => void
  metaMap: Map<string, CardStripMeta>
  setMetaMap: React.Dispatch<React.SetStateAction<Map<string, CardStripMeta>>>
  updateMetaForDeck: (cards: DeckCard[]) => void
  serverFlaggedKeys: Set<string>
  printingTargetCard: DeckCard | null
  setPrintingTargetCard: (c: DeckCard | null) => void
}

/** Todos los handlers de mutación del mazo (añadir/mover/inc/dec/borrar/importar/imprenta/tierras). */
export function useDeckMutations(deps: Deps) {
  const {
    deck, schedulePersist, metaMap, setMetaMap, updateMetaForDeck,
    serverFlaggedKeys, printingTargetCard, setPrintingTargetCard,
  } = deps

  const handleAddFromSearch = (card: ScryfallSearchCard) => {
    if (!deck) return
    if (card.printed_name) {
      setCachedCardName(card.name, card.printed_name, card.lang || getEffectiveCardLang())
    }
    const { cards: nextCards, card: added } = addSearchResult(deck.cards, card)
    const m = new Map(metaMap)
    const meta = stripMetaFromSearch(card)
    m.set(`${added.setCode}/${added.cardNumber}`, meta)
    m.set(card.name.toLowerCase(), meta)
    setMetaMap(m)
    schedulePersist({
      ...deck,
      cards: nextCards,
      coverCard: deck.coverCard ?? nextCards[0],
    })
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

  const cacheMetaFromPayload = (cardData: any, setCode: string, cardNumber: string, cardName: string) => {
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
        oracleText: cardData.oracleText ?? '',
        legalities: cardData.legalities,
      }
      nxt.set(`${setCode}/${cardNumber}`, meta)
      nxt.set(cardName.toLowerCase(), meta)
      return nxt
    })
  }

  const metaOf = (cardName: string, setCode: string, cardNumber: string, payload?: any) => {
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

  const handleDropCardOnDeck = (cardData: any, target: 'main' | 'sideboard' | 'commander'): boolean | void => {
    if (!deck || !cardData?.cardName) return
    const setCode = (cardData.setCode || '').toUpperCase()
    const cardNumber = cardData.cardNumber || '0'
    const cardName = cardData.cardName
    const key = `${setCode}:${cardNumber}:${cardName}`
    const source: string = cardData.source ?? 'search'

    if (target === 'commander') {
      const droppedMeta = metaOf(cardName, setCode, cardNumber, cardData)
      const droppedEligible = !droppedMeta || isCommanderEligible(droppedMeta)
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
      const [nextSide, nextCards] = moveOneBetween(deck.sideboard, deck.cards, key)
      schedulePersist({ ...deck, cards: nextCards, sideboard: nextSide })
      return
    }
    if (source === 'main' && target === 'sideboard') {
      const [nextCards, nextSide] = moveOneBetween(deck.cards, deck.sideboard, key)
      schedulePersist({ ...deck, cards: nextCards, sideboard: nextSide })
      return
    }

    const dropped = { cardName, setCode, cardNumber }
    if (target === 'main') {
      const { list: nextCards, replacedOldKey } = insertOrIncrement(deck.cards, dropped, serverFlaggedKeys)
      let nextCover = deck.coverCard
      if (replacedOldKey && nextCover && deckCardKey(nextCover) === replacedOldKey) {
        nextCover = { ...nextCover, cardName, setCode, cardNumber }
      }
      schedulePersist({ ...deck, cards: nextCards, coverCard: nextCover ?? nextCards[0] })
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

  const handleInc = (k: string) => {
    if (!deck) return
    const { isSide, key } = splitKey(k)
    if (isSide) {
      schedulePersist({ ...deck, sideboard: incrementInList(deck.sideboard, key) })
    } else {
      schedulePersist({ ...deck, cards: incrementInList(deck.cards, key) })
    }
  }

  const handleDec = (k: string) => {
    if (!deck) return
    const { isSide, key } = splitKey(k)
    if (isSide) {
      schedulePersist({ ...deck, sideboard: decrementInList(deck.sideboard, key) })
    } else {
      schedulePersist({ ...deck, cards: decrementInList(deck.cards, key) })
    }
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
    if (!deck || !printingTargetCard) return
    const { cards: nextCards, sideboard: nextSide, printing } = applyPrinting(
      deck.cards, deck.sideboard, printingTargetCard, setCode, cardNumber,
    )
    schedulePersist({ ...deck, cards: nextCards, sideboard: nextSide })
    updateMetaForDeck([{ ...printingTargetCard, ...printing }])
    setPrintingTargetCard(null)
  }

  const handleApplyImport = (result: ImportResult) => {
    if (!deck) return
    const adoptedCommander = result.commanders?.[0]
    const adoptedPartner = result.commanders?.[1]
    const distinctPartner = adoptedCommander && adoptedPartner
      && deckCardKey(adoptedCommander) !== deckCardKey(adoptedPartner)
      ? adoptedPartner
      : undefined
    if (result.mode === 'replace') {
      const nextCards = result.cards
      const nextSide = result.sideboard
      const stillPresent = (c?: DeckCard) =>
        c !== undefined && nextCards.some((n) =>
          n.cardName === c.cardName && n.setCode === c.setCode && n.cardNumber === c.cardNumber)
        ? c
        : undefined
      schedulePersist({
        ...deck,
        cards: nextCards,
        sideboard: nextSide,
        coverCard: nextCards[0] ?? null,
        commanderCard: adoptedCommander ?? stillPresent(deck.commanderCard),
        partnerCard: distinctPartner ?? stillPresent(deck.partnerCard),
      })
      updateMetaForDeck([...nextCards, ...nextSide])
    } else {
      const mergedCards = mergeIntoList(deck.cards, result.cards)
      const mergedSide = mergeIntoList(deck.sideboard, result.sideboard)
      schedulePersist({
        ...deck,
        cards: mergedCards,
        sideboard: mergedSide,
        coverCard: deck.coverCard ?? mergedCards[0] ?? null,
        commanderCard: deck.commanderCard ?? adoptedCommander,
        partnerCard: deck.partnerCard ?? distinctPartner,
      })
      updateMetaForDeck([...result.cards, ...result.sideboard])
    }
  }

  const handleDropFile = async (f: File) => {
    if (!deck) return
    const text = await f.text()
    const parsed = parseAnyDeck(text, deck.name)
    if (!parsed) {
      setStoreError(tStatic('errors', 'deck_parse_failed'))
      return
    }
    const merged = mergeIntoList(deck.cards, parsed.cards)
    const mergedSide = mergeIntoList(deck.sideboard, parsed.sideboard)
    schedulePersist({ ...deck, cards: merged, sideboard: mergedSide })
  }

  return {
    handleAddFromSearch, handleSwap, handleDropCardOnDeck,
    handleInc, handleDec, handleRemove, handleSetCover, handleSetCommander, handleSetPartner,
    handleAddBasicLand, handleRemoveBasicLand, handleApplySuggestedLands,
    handleChangePrinting, handleApplyPrinting, handleApplyImport, handleDropFile,
  }
}
