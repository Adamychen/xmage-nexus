import type { Deck, DeckCard } from '../lobby/decks'
import type { CardStripMeta } from './ArenaCardStrip'
import { fetchCardJson, hasPrinting, type ScryfallCardJson } from '../cards/scryfallCards'
import { scryfallJson } from '../cards/scryfallClient'
import { stripMetaFromJson } from './deckCardOps'
import { normalizeDeckCard } from './deckNormalize'
import { FORMAT_CONFIGS } from './formatRules'
import type { DeckFormat } from './types'

export type PrintingStrategy = 'default' | 'oldest' | 'set' | 'keep'

export interface ResolveOptions {
  strategy: PrintingStrategy
  setCode?: string
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

export interface ResolveResult {
  cards: DeckCard[]
  sideboard: DeckCard[]
  commanders?: DeckCard[]
  metaByName: Map<string, CardStripMeta>
  printingsByName: Map<string, { setCode: string; cardNumber: string }>
  resolved: number
  fellBack: string[]
  unresolved: string[]
}

type DeckLike = Pick<Deck, 'cards' | 'sideboard' | 'commanders'>

const COMMANDER_FORMATS: DeckFormat[] = ['Commander', 'Brawl', 'Oathbreaker', 'PennyDreadfulCommander']

export function suggestFormat(deck: DeckLike): DeckFormat {
  const main = deck.cards.reduce((s, c) => s + c.amount, 0)
  const side = deck.sideboard.reduce((s, c) => s + c.amount, 0)
  if ((deck.commanders?.length ?? 0) > 0) return 'Commander'
  if (main >= 99) return 'Commander'
  if (main + side === 100) return 'Commander'
  if (main >= 60 && side <= 15) return 'Standard'
  return 'Freeform'
}

export function isCommanderDeckFormat(format: DeckFormat): boolean {
  return COMMANDER_FORMATS.includes(format) || !!FORMAT_CONFIGS[format]?.hasCommander
}

function needsPrinting(c: DeckCard): boolean {
  return !hasPrinting(c)
}

export function countUnresolved(deck: DeckLike): number {
  const names = new Set<string>()
  for (const c of [...deck.cards, ...deck.sideboard, ...(deck.commanders ?? [])]) {
    if (needsPrinting(c)) names.add(c.cardName.toLowerCase())
  }
  return names.size
}

const NAMED = 'https://api.scryfall.com/cards/named'

async function lookupPrinting(
  name: string,
  strategy: PrintingStrategy,
  setCode: string | undefined,
): Promise<{ json: ScryfallCardJson | null; fellBack: boolean }> {
  const opts = { persist: true }
  if (strategy === 'oldest') {
    const q = encodeURIComponent(`!"${name}" game:paper`)
    const res = await scryfallJson<{ data?: ScryfallCardJson[] }>(
      `https://api.scryfall.com/cards/search?q=${q}&unique=prints&order=released&dir=asc`,
    )
    const first = res?.data?.[0]
    if (first) return { json: first, fellBack: false }
  } else if (strategy === 'set' && setCode) {
    const json = await scryfallJson<ScryfallCardJson>(
      `${NAMED}?exact=${encodeURIComponent(name)}&set=${encodeURIComponent(setCode.toLowerCase())}`,
      opts,
    )
    if (json) return { json, fellBack: false }
    const dflt = await fetchCardJson({ cardName: name })
    return { json: dflt, fellBack: !!dflt }
  }
  const exact = await fetchCardJson({ cardName: name })
  if (exact) return { json: exact, fellBack: strategy !== 'default' }
  const fuzzy = await scryfallJson<ScryfallCardJson>(`${NAMED}?fuzzy=${encodeURIComponent(name)}`, opts)
  return { json: fuzzy, fellBack: !!fuzzy && strategy !== 'default' }
}

function mergeDuplicates(cards: DeckCard[]): DeckCard[] {
  const out: DeckCard[] = []
  const index = new Map<string, number>()
  for (const c of cards) {
    const key = `${c.setCode}:${c.cardNumber}:${c.cardName}`
    const at = index.get(key)
    if (at === undefined) {
      index.set(key, out.length)
      out.push({ ...c })
    } else {
      out[at] = { ...out[at], amount: out[at].amount + c.amount }
    }
  }
  return out
}

export function applyPrintingsByName(
  deck: DeckLike,
  printings: Map<string, { setCode: string; cardNumber: string }>,
): { cards: DeckCard[]; sideboard: DeckCard[]; commanders?: DeckCard[] } {
  const apply = (c: DeckCard): DeckCard => {
    if (!needsPrinting(c)) return c
    const p = printings.get(c.cardName.toLowerCase())
    return p ? { ...c, ...p } : c
  }
  return {
    cards: mergeDuplicates(deck.cards.map(apply)),
    sideboard: mergeDuplicates(deck.sideboard.map(apply)),
    commanders: deck.commanders?.map(apply),
  }
}

export async function resolveDeckPrintings(deck: DeckLike, opts: ResolveOptions): Promise<ResolveResult> {
  const reps = new Map<string, DeckCard>()
  for (const c of [...deck.cards, ...deck.sideboard, ...(deck.commanders ?? [])]) {
    const key = c.cardName.toLowerCase()
    const prev = reps.get(key)
    if (!prev || (needsPrinting(prev) && !needsPrinting(c))) reps.set(key, c)
  }
  const total = reps.size
  let done = 0
  opts.onProgress?.(0, total)

  const printings = new Map<string, { setCode: string; cardNumber: string }>()
  const metaByName = new Map<string, CardStripMeta>()
  const fellBack: string[] = []
  const unresolved: string[] = []

  await Promise.all(
    [...reps].map(async ([key, rep]) => {
      const name = rep.cardName
      try {
        if (opts.signal?.aborted) return
        if (!needsPrinting(rep) || opts.strategy === 'keep') {
          const json = await fetchCardJson(rep, { fallbackToName: true })
          if (json) metaByName.set(key, stripMetaFromJson(json))
          return
        }
        const { json, fellBack: fb } = await lookupPrinting(name, opts.strategy, opts.setCode)
        if (json?.set && json.collector_number) {
          const norm = normalizeDeckCard({
            cardName: name,
            setCode: json.set.toUpperCase(),
            cardNumber: json.collector_number,
            amount: 1,
          })
          printings.set(key, { setCode: norm.setCode, cardNumber: norm.cardNumber })
          metaByName.set(key, stripMetaFromJson(json))
          if (fb) fellBack.push(name)
        } else {
          unresolved.push(name)
        }
      } catch {
        if (needsPrinting(rep)) unresolved.push(name)
      } finally {
        done += 1
        opts.onProgress?.(done, total)
      }
    }),
  )

  return {
    ...applyPrintingsByName(deck, printings),
    metaByName,
    printingsByName: printings,
    resolved: printings.size,
    fellBack: fellBack.sort(),
    unresolved: unresolved.sort(),
  }
}
