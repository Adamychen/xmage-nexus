import type { Deck, DeckCard } from '../lobby/decks'
import { t } from '../i18n'
import { normalizeBasicLandName } from './deckUtils'
import { normalizeDeckCard } from './deckNormalize'

const DCK_LINE = /^(SB:\s*)?(\d+)\s*\[([^:\]]+):([^\]]+)\]\s*(.+?)\s*$/
const NAME_RE = /^NAME:\s*(.*)\s*$/
const AUTHOR_RE = /^AUTHOR:\s*(.*)\s*$/
const LAYOUT_RE = /^LAYOUT\s+(MAIN|SIDEBOARD):/

export function parseDck(text: string, fallbackName = t('decks', 'import_placeholder')): Deck | null {
  const lines = text.split(/\r?\n/)
  let name: string | null = null
  const cards: DeckCard[] = []
  const sideboard: DeckCard[] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('#')) continue
    if (LAYOUT_RE.test(line)) continue
    const nameMatch = line.match(NAME_RE)
    if (nameMatch) {
      name = nameMatch[1].trim() || null
      continue
    }
    if (AUTHOR_RE.test(line)) continue
    if (/^\[(COMMANDER|COMPANION|MAIN|SIDEBOARD)\]/i.test(line)) continue
    if (/^\[.*\]$/.test(line)) continue

    const m = line.match(DCK_LINE)
    if (m) {
      const isSideboard = !!m[1]
      const amount = parseInt(m[2], 10) || 1
      const setCode = m[3].trim()
      const cardNumber = m[4].trim()
      const rawName = m[5].trim()
      if (!rawName) continue
      const cardName = normalizeBasicLandName(rawName) || rawName
      const entry = normalizeDeckCard({ cardName, setCode, cardNumber, amount })
      if (isSideboard) sideboard.push(entry)
      else cards.push(entry)
      continue
    }
  }

  if (cards.length === 0 && sideboard.length === 0) return null
  return {
    name: name || fallbackName,
    cards,
    sideboard,
  }
}

export function parseAnyDeck(text: string, fallbackName = t('decks', 'import_placeholder')): Deck | null {
  if (/(^|\n)\s*------\s*\S+\s*------/.test(text) && /-->\s*.+/.test(text)) {
    const draft = parseDraftLog(text, fallbackName)
    if (draft) return draft
  }
  if (/^\s*\{/.test(text) && /"mainBoard"/.test(text)) {
    const json = parseMtgjson(text, fallbackName)
    if (json) return json
  }
  if (/<Cards\s[^>]*Name="/i.test(text)) {
    const dek = parseDekXml(text, fallbackName)
    if (dek) return dek
  }
  if (/<cockatrice_deck[\s>]/i.test(text)) {
    const cod = parseCodXml(text, fallbackName)
    if (cod) return cod
  }
  if (/<deck[\s>]/i.test(text) && /<section[^>]*name="/i.test(text)) {
    const o8d = parseO8dXml(text, fallbackName)
    if (o8d) return o8d
  }
  if (/^\s*NAME:/m.test(text) || /\[.*:.*\].*\n/.test(text) && /SB:/.test(text)) {
    const dck = parseDck(text, fallbackName)
    if (dck) return dck
  }
  if (/\[.*:.*\]/.test(text)) {
    const dck = parseDck(text, fallbackName)
    if (dck) return dck
  }
  return parseArenaLike(text, fallbackName)
}

/**
 * Import MTGO .dek (XML de una línea por carta, paridad con DekDeckImporter):
 * `<Cards CatID="..." Quantity="N" Sideboard="true|false" Name="..." />`.
 * Sin impresión conocida: setCode/vacío y el meta se resuelve por nombre.
 */
export function parseDekXml(text: string, fallbackName = t('decks', 'import_placeholder')): Deck | null {
  const cards: DeckCard[] = []
  const sideboard: DeckCard[] = []
  const attr = (line: string, name: string): string | null => {
    const m = line.match(new RegExp(`${name}="([^"]*)"`, 'i'))
    return m ? m[1] : null
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line.includes('<Cards ')) continue
    const qty = parseInt(attr(line, 'Quantity') ?? '1', 10)
    let name = attr(line, 'Name') ?? ''
    if (!name) continue
    if (!name.includes('//') && name.includes('/')) name = name.replace('/', ' // ')
    const cardName = normalizeBasicLandName(name) || name
    const entry = normalizeDeckCard({ cardName, setCode: '', cardNumber: '', amount: Math.min(100, Math.max(1, qty || 1)) })
    if ((attr(line, 'Sideboard') ?? '').toLowerCase() === 'true') sideboard.push(entry)
    else cards.push(entry)
  }
  if (cards.length === 0 && sideboard.length === 0) return null
  return { name: fallbackName, cards, sideboard }
}

function parseXmlDoc(text: string): Document | null {
  try {
    const doc = new DOMParser().parseFromString(text, 'text/xml')
    if (doc.getElementsByTagName('parsererror').length > 0) return null
    return doc
  } catch {
    return null
  }
}

/**
 * Import Cockatrice .cod (paridad con CodDeckImporter): zonas main/side con
 * `<card number="N" name="..." />` + `<deckname>`.
 */
export function parseCodXml(text: string, fallbackName = t('decks', 'import_placeholder')): Deck | null {
  const doc = parseXmlDoc(text)
  if (!doc) return null
  const readZone = (zoneName: string): DeckCard[] => {
    const out: DeckCard[] = []
    doc.querySelectorAll('cockatrice_deck > zone').forEach((zone) => {
      if ((zone.getAttribute('name') ?? '').toLowerCase() !== zoneName) return
      zone.querySelectorAll(':scope > card').forEach((node) => {
        const name = node.getAttribute('name')?.trim() ?? ''
        if (!name) return
        const qty = Math.min(100, Math.max(1, parseInt(node.getAttribute('number') ?? '1', 10) || 1))
        const cardName = normalizeBasicLandName(name) || name
        out.push(normalizeDeckCard({ cardName, setCode: '', cardNumber: '', amount: qty }))
      })
    })
    return out
  }
  const cards = readZone('main')
  const sideboard = readZone('side')
  if (cards.length === 0 && sideboard.length === 0) return null
  const deckName = doc.querySelector('cockatrice_deck > deckname')?.textContent?.trim()
  return { name: deckName || fallbackName, cards, sideboard }
}

/**
 * Import OCTGN .o8d (paridad con O8dDeckImporter): secciones Main/Sideboard
 * con `<card qty="N">Nombre</card>`.
 */
export function parseO8dXml(text: string, fallbackName = t('decks', 'import_placeholder')): Deck | null {
  const doc = parseXmlDoc(text)
  if (!doc) return null
  const readSection = (sectionName: string): DeckCard[] => {
    const out: DeckCard[] = []
    doc.querySelectorAll('deck > section').forEach((section) => {
      if ((section.getAttribute('name') ?? '').toLowerCase() !== sectionName) return
      section.querySelectorAll(':scope > card').forEach((node) => {
        const name = node.textContent?.trim() ?? ''
        if (!name) return
        const qty = Math.min(100, Math.max(1, parseInt(node.getAttribute('qty') ?? '1', 10) || 1))
        const cardName = normalizeBasicLandName(name) || name
        out.push(normalizeDeckCard({ cardName, setCode: '', cardNumber: '', amount: qty }))
      })
    })
    return out
  }
  const cards = readSection('main')
  const sideboard = readSection('sideboard')
  if (cards.length === 0 && sideboard.length === 0) return null
  return { name: fallbackName, cards, sideboard }
}

/**
 * Marcas explícitas de banquillo (paridad con DeckImporter.haveSideboardSection:
 * `SB:` y `//sideboard`). Si no hay ninguna, la primera línea vacía tras cartas
 * divide principal/banquillo (paridad con TxtDeckImporter.switchSideboardByEmptyLine,
 * formato MTGO). Se pre-escanea todo el texto, como el desktop.
 */
function hasExplicitSideboardMark(text: string): boolean {
  return /^SB:|^\/\/\s*sideboard|^\s*sideboard(\s*\(\d+\))?\s*$/im.test(text)
}

const BRACKET_SET_LINE = /^(\d+)x?\s+\[([^\]]+)\]\s*(.+?)\s*$/

/**
 * Import log de draft XMage (.draft, paridad con DraftLogImporter):
 * secciones `------ SET ------` + picks `--> Nombre` → principal.
 * Sin nombre en el log: se usa el fallback.
 */
export function parseDraftLog(text: string, fallbackName = t('decks', 'import_placeholder')): Deck | null {
  const SET_RE = /^------\s*(\S+)\s*------$/
  const PICK_RE = /^-->\s*(.+?)\s*$/
  let currentSet = ''
  const grouped = new Map<string, DeckCard>()
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const setMatch = line.match(SET_RE)
    if (setMatch) {
      currentSet = setMatch[1]
      continue
    }
    const pickMatch = line.match(PICK_RE)
    if (!pickMatch) continue
    const name = pickMatch[1]
    if (!name) continue
    const cardName = normalizeBasicLandName(name) || name
    const key = `${cardName}@@${currentSet}`
    const prev = grouped.get(key)
    if (prev) prev.amount += 1
    else grouped.set(key, normalizeDeckCard({ cardName, setCode: currentSet, cardNumber: '', amount: 1 }))
  }
  const cards = [...grouped.values()]
  if (cards.length === 0) return null
  return { name: fallbackName, cards, sideboard: [] }
}

interface MtgjsonBoardEntry {
  name?: string
  setCode?: string
  count?: number
}

/**
 * Import mtgjson (.json, paridad con MtgjsonDeckImporter):
 * `{data:{name,code,mainBoard,sideBoard,commander}}` con entradas
 * `{name,setCode,count}`. Commander → principal en cabeza (U7-6).
 */
export function parseMtgjson(text: string, fallbackName = t('decks', 'import_placeholder')): Deck | null {
  let json: any
  try {
    json = JSON.parse(text)
  } catch {
    return null
  }
  const data = json?.data
  if (!data || typeof data !== 'object') return null
  const defaultSet = typeof data.code === 'string' ? data.code : ''
  const readBoard = (board: unknown): DeckCard[] => {
    if (!Array.isArray(board)) return []
    const out: DeckCard[] = []
    for (const entry of board as MtgjsonBoardEntry[]) {
      if (!entry || typeof entry.name !== 'string' || !entry.name.trim()) continue
      const cardName = normalizeBasicLandName(entry.name.trim()) || entry.name.trim()
      const amount = Math.min(100, Math.max(1, Math.floor(entry.count ?? 1) || 1))
      out.push(normalizeDeckCard({ cardName, setCode: entry.setCode || defaultSet, cardNumber: '', amount }))
    }
    return out
  }
  const commander = readBoard(data.commander)
  const cards = [...commander, ...readBoard(data.mainBoard)]
  const sideboard = readBoard(data.sideBoard)
  if (cards.length === 0 && sideboard.length === 0) return null
  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : fallbackName
  return { name, cards, sideboard }
}

function parseArenaLike(text: string, fallbackName: string): Deck | null {
  const rawLines = text.split('\n')
  const cards: DeckCard[] = []
  const commanders: DeckCard[] = []
  const sideboard: DeckCard[] = []
  let isSideboard = false
  let inCommander = false
  let blankSwitchArmed = !hasExplicitSideboardMark(text)
  let cardsSeen = false

  const pushCard = (target: DeckCard[], amount: number, rawName: string, setCode: string, cardNumber: string) => {
    const cleaned = rawName
      .trim()
      .replace(/\s+#.*$/, '')
      .replace(/\s*\/\/.*$/, '')
      .trim()
    if (!cleaned || /^(creatures?|instants?|sorcer|enchant|artifacts?|lands?|planeswalkers?)$/i.test(cleaned)) return
    const cardName = normalizeBasicLandName(cleaned) || cleaned
    target.push(normalizeDeckCard({ cardName, setCode, cardNumber, amount }))
    cardsSeen = true
  }

  const pushBracketOrArena = (target: DeckCard[], rest: string, defaultSet: string, defaultNumber: string) => {
    const b = rest.match(BRACKET_SET_LINE)
    if (b) {
      pushCard(target, parseInt(b[1], 10) || 1, b[3], b[2].trim() || defaultSet, defaultNumber)
      return
    }
    const m = rest.match(/^(\d+)x?\s+([^(\n\r]+?)(?:\s+\(([A-Za-z0-9_]+)\)\s+(\S+))?\s*$/)
    if (m) {
      pushCard(target, parseInt(m[1], 10) || 1, m[2], m[3] || defaultSet, m[4] || defaultNumber)
      return
    }
    const dck = rest.match(/^(\d+)\s*\[([^:]+):([^\]]+)\]\s*(.+)$/)
    if (dck) {
      pushCard(target, parseInt(dck[1], 10) || 1, dck[4], dck[2].trim(), dck[3].trim())
    }
  }

  for (const raw of rawLines) {
    const line = raw.replace(/\t/g, ' ').trim()
    if (!line) {
      if (blankSwitchArmed && cardsSeen && !isSideboard) {
        isSideboard = true
        inCommander = false
      }
      continue
    }
    const low = line.toLowerCase()
    const headerWithCount = low.match(/^(deck|main|mainboard|sideboard|commander|maybeboard|companion)\s*\(\d+\)$/)
    const header = headerWithCount ? headerWithCount[1] : low
    if (/^[a-z ]+\(\d+\)$/.test(low) && !headerWithCount) continue
    if (
      header === 'deck' || header === 'main' || header === 'mainboard' || header === '[main]' || header === 'maindeck' ||
      low === '[main]' ||
      low === 'mazo' || low === 'mazzo' || low === 'колода' || low === 'デッキ' || low === '套牌'
    ) {
      isSideboard = false
      inCommander = false
      continue
    }
    if (
      header === 'sideboard' || low === '[sideboard]' || header === 'companion' || low === '[companion]' ||
      header === 'maybeboard' || low === '[maybeboard]' ||
      low === 'banquillo' || low === 'réserve' || low === 'reserve' || low === 'reserva' ||
      low === 'compagnon' || low === 'compagno' || low === 'companheiro' || low === 'compañero' ||
      low === 'сайдборд' || low === 'спутник' || low === 'サイドボード' || low === '相棒' ||
      low === '备牌' || low === '行侣' || low === 'gefährte'
    ) {
      isSideboard = true
      inCommander = false
      continue
    }
    if (
      header === 'commander' || low === 'commandant' || low === 'kommandeur' || low === 'comandante' ||
      low === 'командир' || low === '統率者' || low === '指挥官'
    ) {
      isSideboard = false
      inCommander = true
      continue
    }
    if (low.startsWith('//')) {
      if (low.includes('sideboard') || low.includes('banquillo') || low.includes('reserva') || low.includes('réserve')) {
        isSideboard = true
      }
      continue
    }
    if (line.startsWith('SB:')) {
      const before = sideboard.length
      pushBracketOrArena(sideboard, line.slice(3).trim(), 'M10', '1')
      if (sideboard.length === before) {
        const m2 = line.slice(3).trim().match(/^(.+)$/)
        if (m2) pushCard(sideboard, 1, m2[1], 'M10', '1')
      }
      continue
    }

    const target = inCommander ? commanders : isSideboard ? sideboard : cards
    pushBracketOrArena(target, line, 'M10', '1')
  }

  const allCards = [...commanders, ...cards]
  if (allCards.length === 0 && sideboard.length === 0) return null
  return { name: fallbackName, cards: allCards, sideboard }
}

export function exportDck(deck: Deck): string {
  const out: string[] = []
  out.push(`NAME:${deck.name}`)
  const printEntry = (prefix: string, c: DeckCard) => {
    const printing = c.setCode && c.cardNumber ? ` [${c.setCode}:${c.cardNumber}]` : ''
    out.push(`${prefix}${c.amount}${printing} ${c.cardName}`)
  }
  const grouped = new Map<string, DeckCard>()
  for (const c of deck.cards) {
    const k = `M@${c.setCode}:${c.cardNumber}:${c.cardName}`
    const prev = grouped.get(k)
    if (prev) prev.amount += c.amount
    else grouped.set(k, { ...c })
  }
  for (const c of grouped.values()) {
    printEntry('', c)
  }
  const groupedSb = new Map<string, DeckCard>()
  for (const c of deck.sideboard) {
    const k = `S@${c.setCode}:${c.cardNumber}:${c.cardName}`
    const prev = groupedSb.get(k)
    if (prev) prev.amount += c.amount
    else groupedSb.set(k, { ...c })
  }
  for (const c of groupedSb.values()) {
    printEntry('SB: ', c)
  }
  return out.join('\n') + '\n'
}

export function exportArena(deck: Deck): string {
  const out: string[] = []
  out.push('Deck')
  for (const c of deck.cards) {
    out.push(`${c.amount} ${c.cardName} (${c.setCode}) ${c.cardNumber}`)
  }
  if (deck.sideboard.length > 0) {
    out.push('')
    out.push('Sideboard')
    for (const c of deck.sideboard) {
      out.push(`${c.amount} ${c.cardName} (${c.setCode}) ${c.cardNumber}`)
    }
  }
  return out.join('\n') + '\n'
}

export function exportTxt(deck: Deck): string {
  const out: string[] = []
  for (const c of deck.cards) out.push(`${c.amount} ${c.cardName}`)
  if (deck.sideboard.length > 0) {
    out.push('')
    for (const c of deck.sideboard) out.push(`SB: ${c.amount} ${c.cardName}`)
  }
  return out.join('\n') + '\n'
}

/**
 * Export MTGO .dek (paridad con MtgOnlineDeckExporter): `N Nombre` por línea,
 * banquillo tras línea en blanco SIN prefijo SB:.
 */
export function exportDek(deck: Deck): string {
  const out: string[] = []
  for (const c of deck.cards) out.push(`${c.amount} ${c.cardName}`)
  if (deck.sideboard.length > 0) {
    out.push('')
    for (const c of deck.sideboard) out.push(`${c.amount} ${c.cardName}`)
  }
  return out.join('\n') + '\n'
}
