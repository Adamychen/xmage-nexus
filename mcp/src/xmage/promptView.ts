export type PromptMode = 'select' | 'boolean' | 'uuid' | 'string' | 'integer' | 'multiString' | 'mana' | 'combat' | 'order'

export interface PromptOption {
  id: string
  label: string
  value: string
}

export interface PromptItemView {
  id: string
  label: string
  min: number
  max: number
  defaultValue: number
}

export interface PromptCardView {
  id: string
  name: string
  manaCost?: string
  types?: string
  power?: string
  toughness?: string
  rules?: string[]
  faceDown?: boolean
}

export interface PromptView {
  method: string
  gameId: string
  title: string
  message: string
  mode: PromptMode
  options: PromptOption[]
  min: number
  max: number
  items?: PromptItemView[]
  playerId?: string
  required: boolean
  sourceName?: string
  flags?: string[]
  cards?: PromptCardView[]
  special?: boolean
  specialLabel?: string
  queryType?: string
  canPass?: boolean
}

export const PROMPT_METHODS = new Set([
  'GAME_SELECT',
  'GAME_ASK',
  'GAME_TARGET',
  'GAME_TARGET_PLAYER',
  'GAME_TARGET_AMOUNT',
  'GAME_SELECT_PLAYER',
  'GAME_SELECT_CARDS',
  'GAME_SELECT_TARGETS',
  'GAME_CHOOSE_CARDS',
  'GAME_CHOOSE_CARDS_ORDER',
  'GAME_CHOOSE_ABILITY',
  'GAME_CHOOSE_CHOICE',
  'GAME_CHOOSE_PILE',
  'GAME_CHOOSE_MODE',
  'GAME_CHOOSE_ONE',
  'GAME_CHOOSE_COLOR',
  'GAME_CHOOSE_NUMBER',
  'GAME_CHOOSE_STRING',
  'GAME_CHOOSE_BETWEEN',
  'GAME_PLAY_MANA',
  'GAME_PLAY_XMANA',
  'GAME_GET_AMOUNT',
  'GAME_SELECT_AMOUNT',
  'GAME_GET_MULTI_AMOUNT',
])

type Rec = Record<string, unknown>

const METADATA_OPTION_KEYS = new Set([
  'queryType',
  'autoAnswerMessage',
  'secondMessage',
  'hintText',
  'originalId',
  'dialog',
  'specialButton',
  'canCancel',
  'targetZone',
  'possibleTargets',
  'possibleAttackers',
  'possibleBlockers',
  'chosen',
  'chosenTargets',
  'attackers',
])

function asRecord(value: unknown): Rec {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : {}
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : value == null ? undefined : String(value)
}

function numberValue(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

export function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : stringValue(asRecord(item).id)))
      .filter((item): item is string => Boolean(item))
  }
  if (value && typeof value === 'object') return Object.keys(value)
  return []
}

function optionEntries(value: unknown): PromptOption[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const record = asRecord(item)
      const id = stringValue(record.id) ?? String(index)
      const label = stringValue(record.label) ?? stringValue(record.name) ?? stringValue(item) ?? id
      return { id, label, value: stringValue(record.value) ?? id }
    })
  }
  return Object.entries(asRecord(value))
    .filter(([id]) => !METADATA_OPTION_KEYS.has(id))
    .map(([id, item]) => {
      const record = asRecord(item)
      const label = stringValue(record.label) ?? stringValue(record.name) ?? stringValue(item) ?? id
      return { id, label, value: stringValue(record.value) ?? id }
    })
}

function cardOptions(value: unknown): PromptOption[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const card = asRecord(item)
      const id = stringValue(card.id) ?? stringValue(card.parentId) ?? String(index)
      return { id, label: stringValue(card.displayName) ?? stringValue(card.name) ?? id, value: id }
    })
  }
  return Object.entries(asRecord(value)).map(([id, item]) => {
    const card = asRecord(item)
    const actualId = stringValue(card.id) ?? id
    return {
      id: actualId,
      label: stringValue(card.displayName) ?? stringValue(card.name) ?? actualId,
      value: actualId,
    }
  })
}

function registerCardLabels(zone: unknown, labels: Map<string, string>): void {
  if (!zone || typeof zone !== 'object') return
  if (Array.isArray(zone)) {
    zone.forEach((item, index) => {
      const record = asRecord(item)
      const id = stringValue(record.id) ?? stringValue(record.parentId) ?? String(index)
      const name = stringValue(record.displayName) ?? stringValue(record.name)
      if (name) labels.set(id, name)
    })
    return
  }
  for (const [key, item] of Object.entries(asRecord(zone))) {
    const record = asRecord(item)
    const id = stringValue(record.id) ?? key
    const name = stringValue(record.displayName) ?? stringValue(record.name)
    if (name) labels.set(id, name)
  }
}

function promptLabels(data: Rec): Map<string, string> {
  const labels = new Map<string, string>()
  for (const option of cardOptions(data.cardsView1)) labels.set(option.id, option.label)
  const game = asRecord(data.gameView)
  registerCardLabels(game.myHand, labels)
  registerCardLabels(game.stack, labels)
  registerCardLabels(game.myHelperEmblems, labels)
  const players = Array.isArray(game.players) ? game.players : []
  for (const player of players) {
    const record = asRecord(player)
    const id = stringValue(record.playerId)
    if (id) labels.set(id, stringValue(record.name) ?? id)
    registerCardLabels(record.battlefield, labels)
    registerCardLabels(record.graveyard, labels)
    registerCardLabels(record.exile, labels)
    registerCardLabels(record.commandList, labels)
  }
  return labels
}

function targetOptions(data: Rec, labels: Map<string, string>): PromptOption[] {
  const targets = stringList(data.targets)
  const possibleTargets = stringList(asRecord(data.options).possibleTargets)
  const candidateIds = targets.length
    ? targets
    : possibleTargets.length
      ? possibleTargets
      : cardOptions(data.cardsView1).map((option) => option.id)
  return candidateIds.map((id, index) => ({
    id,
    label: labels.get(id) ?? `target ${index + 1} (${id.slice(0, 8)})`,
    value: id,
  }))
}

function playableOptions(gameView: unknown): PromptOption[] {
  const game = asRecord(gameView)
  const objects = asRecord(asRecord(game.canPlayObjects).objects)
  const labels = promptLabels({ gameView })
  return Object.keys(objects).map((id) => ({ id, label: labels.get(id) ?? id, value: id }))
}

function feedbackCards(view: unknown): PromptCardView[] | undefined {
  if (!view || typeof view !== 'object') return undefined
  const entries = Object.entries(asRecord(view))
  if (entries.length === 0) return undefined
  return entries.map(([id, item]) => {
    const card = asRecord(item)
    return {
      id: stringValue(card.id) ?? id,
      name: stringValue(card.name) ?? id,
      manaCost: stringList(card.manaCostLeftStr).join('') || undefined,
      types: stringList(card.cardTypes).join(' ') || undefined,
      power: stringValue(card.power),
      toughness: stringValue(card.toughness),
      rules: Array.isArray(card.rules) ? card.rules.map((rule) => String(rule)) : undefined,
      faceDown: card.faceDown === true,
    }
  })
}

function controlledPlayerId(gameView: unknown): string | undefined {
  const game = asRecord(gameView)
  const players = Array.isArray(game.players) ? game.players : []
  const player = players.find((item) => asRecord(item).controlled === true)
  return stringValue(asRecord(player).playerId)
}

function booleanValueOf(label: string, index: number): string {
  if (/mulligan/i.test(label)) return 'true'
  if (/keep/i.test(label)) return 'false'
  if (/no|cancel/i.test(label)) return 'false'
  if (/yes|confirm|ok/i.test(label)) return 'true'
  return index === 0 ? 'true' : 'false'
}

function isMulliganAsk(message: string): boolean {
  return /mulligan|keep your hand|keep hand/i.test(message)
}

function isStartingPlayerMessage(message: string): boolean {
  return /who goes first|choose.*start|starting player|who will go first|empieza primero|quién empieza|lanzamiento|primer turno/i.test(message)
}

function isVotingAsk(message: string, question?: string): boolean {
  return /vote|voting|voted|votar|votación|council|will of the council/i.test(message) || /vote/i.test(question ?? '')
}

function isDiscardMessage(message: string): boolean {
  return /descart|discard/i.test(message)
}

function isLondonBottoming(message: string): boolean {
  return /^select a card to put on the bottom of (your|the) library/i.test(message)
}

function isTriggerOrderPick(message: string, queryType?: string): boolean {
  if (queryType === 'PICK_ABILITY') return true
  return /pick triggered ability|triggered ability \(goes to the stack first\)|elige.*trigger|orden.*trigger/i.test(message)
}

function multiAmountItems(value: unknown): PromptItemView[] {
  if (!Array.isArray(value)) return []
  return value.map((item, index) => {
    const record = asRecord(item)
    return {
      id: stringValue(record.id) ?? String(index),
      label: stringValue(record.message) ?? `amount ${index + 1}`,
      min: numberValue(record.min, 0),
      max: numberValue(record.max, 999),
      defaultValue: numberValue(record.defaultValue, numberValue(record.min, 0)),
    }
  })
}

export function normalizePrompt(method: string, raw: unknown, gameId: string | null): PromptView | null {
  if (!PROMPT_METHODS.has(method)) return null
  if (!gameId) return null
  const data = asRecord(raw)
  const message = stringValue(data.message) ?? stringValue(data.question) ?? method
  const optionsRecord = asRecord(data.options)
  const bounds = {
    min: numberValue(data.min, 0),
    max: numberValue(data.max, Math.max(1, numberValue(data.min, 0))),
  }
  const base = { method, gameId, options: [] as PromptOption[], min: bounds.min, max: bounds.max, required: true }

  switch (method) {
    case 'GAME_SELECT': {
      const attackers = stringList(optionsRecord.possibleAttackers)
      const blockers = stringList(optionsRecord.possibleBlockers)
      const queryType = stringValue(optionsRecord.queryType)
      if (attackers.length > 0 || blockers.length > 0) {
        const attacking = attackers.length > 0
        const labels = promptLabels(data)
        const ids = attacking ? attackers : blockers
        const specialLabel = stringValue(optionsRecord.specialButton)
        return {
          ...base,
          title: attacking ? 'declare attackers' : 'declare blockers',
          message,
          mode: 'combat',
          options: ids.map((id) => ({ id, label: labels.get(id) ?? id, value: id })),
          flags: ['combat'],
          special: attacking && typeof optionsRecord.specialButton === 'string',
          specialLabel,
          queryType,
          canPass: true,
        }
      }
      return {
        ...base,
        title: 'priority',
        message,
        mode: 'select',
        options: playableOptions(data.gameView),
        queryType,
        canPass: true,
      }
    }
    case 'GAME_ASK': {
      const flags: string[] = []
      if (isMulliganAsk(message)) flags.push('mulligan')
      if (isStartingPlayerMessage(message)) flags.push('starting-player')
      if (isVotingAsk(message, stringValue(data.question))) flags.push('voting')
      const sourceName = stripHtml(stringValue(optionsRecord.secondMessage) ?? '') || undefined
      let options: PromptOption[]
      if (typeof optionsRecord['UI.left.btn.text'] === 'string' || typeof optionsRecord['UI.right.btn.text'] === 'string') {
        options = [
          { id: 'left', label: stringValue(optionsRecord['UI.left.btn.text']) ?? 'yes', value: 'true' },
          { id: 'right', label: stringValue(optionsRecord['UI.right.btn.text']) ?? 'no', value: 'false' },
        ]
      } else {
        const entries = optionEntries(optionsRecord)
        options = entries.length
          ? entries.map((option, index) => ({ ...option, value: booleanValueOf(option.label, index) || option.value }))
          : isMulliganAsk(message)
            ? [
                { id: 'keep', label: 'keep', value: 'false' },
                { id: 'mulligan', label: 'mulligan', value: 'true' },
              ]
            : [
                { id: 'yes', label: 'yes', value: 'true' },
                { id: 'no', label: 'no', value: 'false' },
              ]
      }
      return { ...base, title: 'confirmation', message, mode: 'boolean', options, flags: flags.length ? flags : undefined, sourceName }
    }
    case 'GAME_TARGET':
    case 'GAME_TARGET_PLAYER':
    case 'GAME_SELECT_PLAYER':
    case 'GAME_SELECT_TARGETS': {
      const labels = promptLabels(data)
      const flags: string[] = []
      if (isDiscardMessage(message)) flags.push('discard')
      if (isStartingPlayerMessage(message)) flags.push('starting-player')
      if (isLondonBottoming(message)) flags.push('mulligan-london')
      if (isTriggerOrderPick(message, stringValue(optionsRecord.queryType))) flags.push('trigger-order')
      return {
        ...base,
        title: isStartingPlayerMessage(message) ? 'choose starting player' : 'choose target',
        message,
        mode: 'uuid',
        options: targetOptions(data, labels),
        flags: flags.length ? flags : undefined,
        cards: feedbackCards(data.cardsView1),
        sourceName: stripHtml(stringValue(optionsRecord.secondMessage) ?? '') || undefined,
      }
    }
    case 'GAME_SELECT_CARDS':
    case 'GAME_CHOOSE_CARDS': {
      const cards = feedbackCards(data.cardsView1 ?? data.options)
      return {
        ...base,
        title: 'choose cards',
        message,
        mode: 'uuid',
        options: cardOptions(data.cardsView1 ?? data.options),
        flags: isDiscardMessage(message) ? ['discard'] : undefined,
        cards,
      }
    }
    case 'GAME_CHOOSE_CARDS_ORDER': {
      const cards = feedbackCards(data.cardsView1 ?? data.options)
      return {
        ...base,
        title: 'order cards',
        message,
        mode: 'order',
        options: cardOptions(data.cardsView1 ?? data.options),
        cards,
      }
    }
    case 'GAME_CHOOSE_ABILITY': {
      const options = optionEntries(data.choices)
      const flags = options.some((option) => /^([+-]?\d+)\s*:/.test(option.label)) ? ['planeswalker'] : undefined
      return { ...base, title: 'choose ability', message, mode: 'uuid', options, flags }
    }
    case 'GAME_CHOOSE_CHOICE': {
      const choice = asRecord(data.choice)
      const keyChoices = asRecord(choice.keyChoices)
      const listChoices = Array.isArray(choice.choices) ? choice.choices : []
      const options = Object.keys(keyChoices).length
        ? optionEntries(keyChoices)
        : listChoices.map((value: unknown, index: number) => ({
            id: String(index),
            label: String(value),
            value: String(value),
          }))
      return {
        ...base,
        title: 'choose option',
        message: stringValue(choice.message) ?? message,
        mode: 'string',
        options,
      }
    }
    case 'GAME_CHOOSE_PILE': {
      const pile1 = stringList(data.cardsView1).length
      const pile2 = stringList(data.cardsView2).length
      return {
        ...base,
        title: 'choose pile',
        message,
        mode: 'boolean',
        options: [
          { id: 'pile1', label: `pile 1 (${pile1} cards)`, value: 'true' },
          { id: 'pile2', label: `pile 2 (${pile2} cards)`, value: 'false' },
        ],
      }
    }
    case 'GAME_PLAY_MANA': {
      return {
        ...base,
        title: 'pay mana',
        message,
        mode: 'mana',
        options: playableOptions(data.gameView),
        playerId: controlledPlayerId(data.gameView),
        special: true,
        specialLabel: 'special (auto-pay)',
        queryType: stringValue(optionsRecord.queryType),
      }
    }
    case 'GAME_PLAY_XMANA': {
      return {
        ...base,
        title: 'pay X mana',
        message,
        mode: 'boolean',
        options: [
          { id: 'yes', label: 'confirm', value: 'true' },
          { id: 'no', label: 'cancel', value: 'false' },
        ],
      }
    }
    case 'GAME_GET_AMOUNT':
    case 'GAME_SELECT_AMOUNT':
    case 'GAME_TARGET_AMOUNT':
    case 'GAME_CHOOSE_NUMBER': {
      return { ...base, title: 'choose number', message, mode: 'integer' }
    }
    case 'GAME_GET_MULTI_AMOUNT': {
      const items = multiAmountItems(data.messages)
      const min = typeof data.min === 'number' ? data.min : items.reduce((acc, item) => acc + item.min, 0)
      const max = typeof data.max === 'number' ? data.max : items.reduce((acc, item) => acc + item.max, 0)
      return { ...base, title: 'choose multiple amounts', message, mode: 'multiString', min, max, items }
    }
    case 'GAME_CHOOSE_MODE': {
      const choices = data.choices ?? (Array.isArray(data.options) ? data.options : asRecord(data.options))
      return { ...base, title: 'choose mode', message, mode: 'uuid', options: optionEntries(choices) }
    }
    case 'GAME_CHOOSE_ONE':
    case 'GAME_CHOOSE_BETWEEN': {
      const choices = data.choices ?? (Array.isArray(data.options) ? data.options : asRecord(data.options))
      return { ...base, title: 'choose option', message, mode: 'string', options: optionEntries(choices) }
    }
    case 'GAME_CHOOSE_COLOR': {
      const choices = data.choices ?? (Array.isArray(data.options) ? data.options : { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' })
      return { ...base, title: 'choose color', message, mode: 'string', options: optionEntries(choices) }
    }
    case 'GAME_CHOOSE_STRING': {
      const rawOptions = Array.isArray(data.options) ? data.options : Array.isArray(data.choices) ? data.choices : asRecord(data.choices ?? data.options)
      const options = Array.isArray(rawOptions)
        ? rawOptions.map((value: unknown, index: number) => ({ id: String(index), label: String(value), value: String(value) }))
        : optionEntries(rawOptions)
      return { ...base, title: 'choose name', message, mode: 'string', options }
    }
    default:
      return null
  }
}
