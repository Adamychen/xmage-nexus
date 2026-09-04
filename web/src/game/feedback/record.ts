import type { FeedbackCard, FeedbackItem, FeedbackOption, JsonRecord } from './types'
import { METADATA_OPTION_KEYS } from './types'

export function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : value == null ? undefined : String(value)
}

export function secondMessageOf(data: JsonRecord): string | undefined {
  const value = asRecord(data.options).secondMessage
  const raw = stringValue(value)
  return raw ? stripHtml(raw) : undefined
}

/** Elimina tags HTML de un string (el servidor envía secondMessage con <FONT> etc.). */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '')
}

export function chosenTargetsOf(data: JsonRecord): string[] | undefined {
  const targets = stringList(asRecord(data.options).chosenTargets)
  return targets.length ? targets : undefined
}

export function controlledPlayerId(value: unknown): string | undefined {
  const game = asRecord(value)
  const players = Array.isArray(game.players) ? game.players : []
  const player = players.find((item) => asRecord(item).controlled === true)
  return stringValue(asRecord(player).playerId)
}

export function boundsFrom(data: JsonRecord): { min: number; max: number } {
  const min = numberValue(data.min, 0)
  const max = numberValue(data.max, 1)
  return { min, max: max < min ? min : max }
}

export function numberValue(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

export function optionEntries(value: unknown): FeedbackOption[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const record = asRecord(item)
      const id = stringValue(record.id) ?? String(index)
      const label = stringValue(record.label) ?? stringValue(record.name) ?? stringValue(item) ?? id
      return { id, label, value: stringValue(record.value) ?? id }
    })
  }
  return Object.entries(asRecord(value)).map(([id, item]) => {
    const itemRecord = asRecord(item)
    const label = stringValue(itemRecord.label) ?? stringValue(itemRecord.name) ?? stringValue(item) ?? id
    return { id, label, value: stringValue(itemRecord.value) ?? id }
  })
}

export function cardOptions(value: unknown): FeedbackOption[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      const card = asRecord(item)
      const id = stringValue(card.id) ?? stringValue(card.parentId) ?? String(index)
      return { id, label: stringValue(card.displayName) ?? stringValue(card.name) ?? stringValue(item) ?? id, value: id }
    })
  }
  return Object.entries(asRecord(value)).map(([id, item]) => {
    const card = asRecord(item)
    const actualId = stringValue(card.id) ?? id
    return { id: actualId, label: stringValue(card.displayName) ?? stringValue(card.name) ?? stringValue(item) ?? actualId, value: actualId }
  })
}

export function cleanChoices(val: unknown): JsonRecord {
  const rec = asRecord(val)
  const out: JsonRecord = {}
  for (const [k, v] of Object.entries(rec)) {
    if (!METADATA_OPTION_KEYS.has(k)) out[k] = v
  }
  return out
}

export function registerCardLabels(zone: unknown, labels: Map<string, string>) {
  if (!zone || typeof zone !== 'object') return
  const values = Array.isArray(zone) ? zone : Object.values(zone)
  for (const item of values) {
    const record = asRecord(item)
    const id = stringValue(record.id) ?? stringValue(record.parentId)
    if (id) {
      const name = stringValue(record.displayName) ?? stringValue(record.name)
      if (name) labels.set(id, name)
    }
  }
}

export function targetOptions(data: JsonRecord, fallbackLabel: (index: number, id: string) => string): FeedbackOption[] {
  const labels = new Map(cardOptions(data.cardsView1).map((option) => [option.id, option.label]))
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
  const targets = stringList(data.targets)
  const possibleTargets = stringList(asRecord(data.options).possibleTargets)
  const candidateIds = targets.length
    ? targets
    : possibleTargets.length
      ? possibleTargets
      : cardOptions(data.cardsView1).map((option) => option.id)
  return candidateIds.map((id, index) => {
    return { id, label: labels.get(id) ?? fallbackLabel(index, id), value: id }
  })
}

export function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => typeof item === 'string' ? item : stringValue(asRecord(item).id))
      .filter((item): item is string => Boolean(item))
  }
  if (value && typeof value === 'object') return Object.keys(value)
  return []
}

export function multiAmountItems(value: unknown, fallbackLabel: (index: number) => string): FeedbackItem[] {
  if (!Array.isArray(value)) return []
  return value.map((item, index) => {
    const record = asRecord(item)
    return {
      id: stringValue(record.id) ?? String(index),
      label: stringValue(record.message) ?? fallbackLabel(index),
      min: numberValue(record.min, 0),
      max: numberValue(record.max, 999),
      defaultValue: numberValue(record.defaultValue, numberValue(record.min, 0)),
    }
  })
}

export function cardSummary(value: unknown, fallback: string, summarize: (fallback: string, count: number) => string): string {
  const cards = cardOptions(value)
  return cards.length ? summarize(fallback, cards.length) : fallback
}

/** Card data from the server for visual card grid rendering. */
export function feedbackCards(data: JsonRecord): FeedbackCard[] | undefined {
  const raw = data.cardsView1
  if (!raw || typeof raw !== 'object') return undefined
  const entries = Object.entries(asRecord(raw))
  if (entries.length === 0) return undefined
  return entries.map(([id, item]) => {
    const c = asRecord(item)
    const color = asRecord(c.color)
    return {
      id: stringValue(c.id) ?? id,
      name: stringValue(c.name) ?? id,
      displayName: stringValue(c.displayName),
      expansionSetCode: stringValue(c.expansionSetCode),
      cardNumber: stringValue(c.cardNumber),
      manaCost: stringList(c.manaCostLeftStr),
      cardTypes: stringList(c.cardTypes),
      power: stringValue(c.power),
      toughness: stringValue(c.toughness),
      color: (color.white || color.blue || color.black || color.red || color.green)
        ? { white: !!color.white, blue: !!color.blue, black: !!color.black, red: !!color.red, green: !!color.green }
        : null,
      rules: Array.isArray(c.rules) ? c.rules.map((r) => String(r)) : undefined,
      faceDown: c.faceDown === true,
    }
  })
}
