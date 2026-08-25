import type { DeckFormat, DeckV2 } from './types'
import type { CardStripMeta } from './ArenaCardStrip'

export interface FormatRuleConfig {
  name: DeckFormat
  displayName: string
  minMain: number
  maxMain?: number
  maxSideboard: number
  maxCopies: number
  isSingleton: boolean
  hasCommander: boolean
  scryfallKey: string
  description: string
}

export const ALL_FORMATS: DeckFormat[] = [
  'Standard',
  'Pioneer',
  'Modern',
  'Legacy',
  'Vintage',
  'Pauper',
  'Commander',
  'Brawl',
  'Historic',
  'Timeless',
  'Freeform',
]

export const FORMAT_CONFIGS: Record<DeckFormat, FormatRuleConfig> = {
  Standard: {
    name: 'Standard',
    displayName: 'Standard',
    minMain: 60,
    maxSideboard: 15,
    maxCopies: 4,
    isSingleton: false,
    hasCommander: false,
    scryfallKey: 'standard',
    description: 'Últimos ~3 años de colecciones principales (rotativo)',
  },
  Pioneer: {
    name: 'Pioneer',
    displayName: 'Pioneer',
    minMain: 60,
    maxSideboard: 15,
    maxCopies: 4,
    isSingleton: false,
    hasCommander: false,
    scryfallKey: 'pioneer',
    description: 'Desde Return to Ravnica (2012) hasta la actualidad',
  },
  Modern: {
    name: 'Modern',
    displayName: 'Modern',
    minMain: 60,
    maxSideboard: 15,
    maxCopies: 4,
    isSingleton: false,
    hasCommander: false,
    scryfallKey: 'modern',
    description: 'Desde 8ª Edición (2003) y Modern Horizons',
  },
  Legacy: {
    name: 'Legacy',
    displayName: 'Legacy',
    minMain: 60,
    maxSideboard: 15,
    maxCopies: 4,
    isSingleton: false,
    hasCommander: false,
    scryfallKey: 'legacy',
    description: 'Toda la historia de MTG con lista de prohibidas',
  },
  Vintage: {
    name: 'Vintage',
    displayName: 'Vintage',
    minMain: 60,
    maxSideboard: 15,
    maxCopies: 4,
    isSingleton: false,
    hasCommander: false,
    scryfallKey: 'vintage',
    description: 'Toda la historia de MTG con Power Nine y restringidas',
  },
  Pauper: {
    name: 'Pauper',
    displayName: 'Pauper',
    minMain: 60,
    maxSideboard: 15,
    maxCopies: 4,
    isSingleton: false,
    hasCommander: false,
    scryfallKey: 'pauper',
    description: 'Solo cartas impresas en rareza común',
  },
  Commander: {
    name: 'Commander',
    displayName: 'Commander (EDH)',
    minMain: 100,
    maxMain: 100,
    maxSideboard: 0,
    maxCopies: 1,
    isSingleton: true,
    hasCommander: true,
    scryfallKey: 'commander',
    description: '100 cartas singleton con Comandante e identidad de color',
  },
  Brawl: {
    name: 'Brawl',
    displayName: 'Brawl',
    minMain: 100,
    maxMain: 100,
    maxSideboard: 0,
    maxCopies: 1,
    isSingleton: true,
    hasCommander: true,
    scryfallKey: 'brawl',
    description: 'Formato singleton de MTG Arena con Comandante',
  },
  Historic: {
    name: 'Historic',
    displayName: 'Historic',
    minMain: 60,
    maxSideboard: 15,
    maxCopies: 4,
    isSingleton: false,
    hasCommander: false,
    scryfallKey: 'historic',
    description: 'Todas las cartas de MTG Arena con rebalanceos',
  },
  Timeless: {
    name: 'Timeless',
    displayName: 'Timeless',
    minMain: 60,
    maxSideboard: 15,
    maxCopies: 4,
    isSingleton: false,
    hasCommander: false,
    scryfallKey: 'timeless',
    description: 'Formato eterno de MTG Arena con cartas restringidas',
  },
  Freeform: {
    name: 'Freeform',
    displayName: 'Freeform (Sin Restricciones)',
    minMain: 1,
    maxSideboard: 99,
    maxCopies: 99,
    isSingleton: false,
    hasCommander: false,
    scryfallKey: '',
    description: 'Modo libre para testeo sin restricciones',
  },
}

const BASIC_LANDS = new Set([
  'plains',
  'island',
  'swamp',
  'mountain',
  'forest',
  'wastes',
  'snow-covered plains',
  'snow-covered island',
  'snow-covered swamp',
  'snow-covered mountain',
  'snow-covered forest',
  'snow-covered wastes',
])

const ANY_NUMBER_CARDS = new Set([
  'relentless rats',
  'shadowborn apostle',
  'persistent petitioners',
  'dragon\'s approach',
  'rat colony',
  'slime against humanity',
  'templar knight',
  'hare apparent',
])

export function isBasicOrUnlimited(name: string): boolean {
  const n = name.trim().toLowerCase()
  return BASIC_LANDS.has(n) || ANY_NUMBER_CARDS.has(n)
}

export interface ValidationIssue {
  type: 'deck_size' | 'sideboard_size' | 'copy_limit' | 'banned' | 'not_legal' | 'restricted' | 'color_identity' | 'commander'
  message: string
  cardName?: string
  severity: 'error' | 'warning'
}

export interface DeckValidationReport {
  isValid: boolean
  issues: ValidationIssue[]
  cardIssues: Map<string, ValidationIssue> // key: cardName or cardKey -> issue
}

export function validateDeckForFormat(
  deck: DeckV2,
  metaMap: Map<string, CardStripMeta>
): DeckValidationReport {
  const config = FORMAT_CONFIGS[deck.format] ?? FORMAT_CONFIGS.Freeform
  const issues: ValidationIssue[] = []
  const cardIssues = new Map<string, ValidationIssue>()

  if (deck.format === 'Freeform') {
    return { isValid: true, issues: [], cardIssues: new Map() }
  }

  const mainTotal = deck.cards.reduce((s, c) => s + c.amount, 0)
  const sideTotal = deck.sideboard.reduce((s, c) => s + c.amount, 0)

  // 1. Deck Size Checks
  if (config.hasCommander) {
    if (mainTotal < config.minMain) {
      issues.push({
        type: 'deck_size',
        message: `El mazo debe tener exactamente ${config.minMain} cartas (actualmente: ${mainTotal}).`,
        severity: 'warning',
      })
    } else if (config.maxMain && mainTotal > config.maxMain) {
      issues.push({
        type: 'deck_size',
        message: `El mazo excede el límite de ${config.maxMain} cartas (actualmente: ${mainTotal}).`,
        severity: 'error',
      })
    }
    if (sideTotal > config.maxSideboard) {
      issues.push({
        type: 'sideboard_size',
        message: `En ${config.displayName} no se permite banquillo (${sideTotal} cartas).`,
        severity: 'error',
      })
    }
  } else {
    if (mainTotal < config.minMain) {
      issues.push({
        type: 'deck_size',
        message: `El mazo principal debe tener al menos ${config.minMain} cartas (actualmente: ${mainTotal}).`,
        severity: 'warning',
      })
    }
    if (sideTotal > config.maxSideboard) {
      issues.push({
        type: 'sideboard_size',
        message: `El banquillo excede el límite de ${config.maxSideboard} cartas (actualmente: ${sideTotal}).`,
        severity: 'error',
      })
    }
  }

  // 2. Count combined copies per card name
  const combinedCounts = new Map<string, number>()
  for (const c of deck.cards) {
    const name = c.cardName
    combinedCounts.set(name, (combinedCounts.get(name) ?? 0) + c.amount)
  }
  for (const c of deck.sideboard) {
    const name = c.cardName
    combinedCounts.set(name, (combinedCounts.get(name) ?? 0) + c.amount)
  }

  // 3. Commander identification and color identity
  let commanderColors: Set<string> | null = null
  if (config.hasCommander) {
    const commander = deck.coverCard ?? deck.cards[0]
    if (commander) {
      const meta = metaMap.get(`${commander.setCode}/${commander.cardNumber}`) ?? metaMap.get(commander.cardName.toLowerCase())
      if (meta?.colors) {
        commanderColors = new Set(meta.colors.map((c) => c.toUpperCase()))
      }
    } else {
      issues.push({
        type: 'commander',
        message: 'No se ha seleccionado ningún Comandante para el mazo.',
        severity: 'error',
      })
    }
  }

  // 4. Per-card validation (Copy limits, Legality, Color Identity)
  const allCards = [...deck.cards, ...deck.sideboard]
  for (const c of allCards) {
    const name = c.cardName
    const count = combinedCounts.get(name) ?? 0
    const meta = metaMap.get(`${c.setCode}/${c.cardNumber}`) ?? metaMap.get(name.toLowerCase())
    const cardKey = `${c.setCode}:${c.cardNumber}:${name}`

    // Copy limit check
    if (!isBasicOrUnlimited(name)) {
      if (name.toLowerCase() === 'seven dwarves' && count > 7) {
        const issue: ValidationIssue = {
          type: 'copy_limit',
          message: `Máximo 7 copias de ${name} (tienes ${count}).`,
          cardName: name,
          severity: 'error',
        }
        issues.push(issue)
        cardIssues.set(cardKey, issue)
        cardIssues.set(name, issue)
      } else if (name.toLowerCase() !== 'seven dwarves' && count > config.maxCopies) {
        const issue: ValidationIssue = {
          type: 'copy_limit',
          message: config.isSingleton
            ? `Formato Singleton: solo se permite 1 copia de ${name} (tienes ${count}).`
            : `Máximo ${config.maxCopies} copias de ${name} (tienes ${count}).`,
          cardName: name,
          severity: 'error',
        }
        issues.push(issue)
        cardIssues.set(cardKey, issue)
        cardIssues.set(name, issue)
      }
    }

    // Scryfall legality check
    if (meta?.legalities && config.scryfallKey) {
      const status = meta.legalities[config.scryfallKey]
      if (status === 'banned') {
        const issue: ValidationIssue = {
          type: 'banned',
          message: `${name} está prohibida (banned) en ${config.displayName}.`,
          cardName: name,
          severity: 'error',
        }
        issues.push(issue)
        cardIssues.set(cardKey, issue)
        cardIssues.set(name, issue)
      } else if (status === 'not_legal') {
        const issue: ValidationIssue = {
          type: 'not_legal',
          message: `${name} no es legal en ${config.displayName}.`,
          cardName: name,
          severity: 'error',
        }
        issues.push(issue)
        cardIssues.set(cardKey, issue)
        cardIssues.set(name, issue)
      } else if (status === 'restricted' && count > 1) {
        const issue: ValidationIssue = {
          type: 'restricted',
          message: `${name} está restringida a 1 sola copia en ${config.displayName}.`,
          cardName: name,
          severity: 'error',
        }
        issues.push(issue)
        cardIssues.set(cardKey, issue)
        cardIssues.set(name, issue)
      }
    }

    // Color identity check for Commander / Brawl
    if (config.hasCommander && commanderColors && meta?.colors) {
      const cardColors = meta.colors.map((col) => col.toUpperCase())
      const invalidColors = cardColors.filter((col) => !commanderColors!.has(col))
      if (invalidColors.length > 0) {
        const issue: ValidationIssue = {
          type: 'color_identity',
          message: `${name} contiene colores (${invalidColors.join(', ')}) fuera de la identidad del Comandante.`,
          cardName: name,
          severity: 'error',
        }
        issues.push(issue)
        cardIssues.set(cardKey, issue)
        cardIssues.set(name, issue)
      }
    }
  }

  const hasErrors = issues.some((i) => i.severity === 'error')
  return {
    isValid: !hasErrors && mainTotal >= config.minMain,
    issues,
    cardIssues,
  }
}
