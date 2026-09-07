export type FeedbackMode = 'boolean' | 'string' | 'uuid' | 'integer' | 'multiString' | 'mana' | 'combat' | 'order'

export interface FeedbackOption {
  id: string
  label: string
  value: string
}

export interface FeedbackItem {
  id: string
  label: string
  min: number
  max: number
  defaultValue?: number
}

export interface FeedbackCard {
  id: string
  name: string
  displayName?: string
  expansionSetCode?: string
  cardNumber?: string
  manaCost?: string[]
  cardTypes?: string[]
  power?: string
  toughness?: string
  color?: { white?: boolean; blue?: boolean; black?: boolean; red?: boolean; green?: boolean } | null
  rules?: string[]
  faceDown?: boolean
}

export interface FeedbackPrompt {
  method: string
  gameId: string
  title: string
  message: string
  mode: FeedbackMode
  options: FeedbackOption[]
  min: number
  max: number
  items?: FeedbackItem[]
  playerId?: string
  required?: boolean
  sourceName?: string
  chosenTargets?: string[]
  special?: boolean
  cards?: FeedbackCard[]
  isMulligan?: boolean
  isMulliganLondon?: boolean
  isStartingPlayer?: boolean
  isVoting?: boolean
  isPlaneswalkerAbility?: boolean
  loyaltyDeltas?: (number | null)[]
  isTriggerOrder?: boolean
  choiceHints?: Record<string, string>
  choiceSpecial?: boolean
  choiceSearch?: boolean
  pileCards?: { pile1: FeedbackCard[]; pile2: FeedbackCard[] }
}

export type JsonRecord = Record<string, unknown>

export const METADATA_OPTION_KEYS = new Set([
  'queryType',
  'autoAnswerMessage',
  'secondMessage',
  'hintText',
  'originalId',
  'dialog',
  'specialButton',
  'canCancel',
  'targetZone',
])

export type FeedbackTextFn = (
  ns: 'game' | 'dialogs' | 'common',
  key: string,
  params?: Record<string, string | number>,
) => string
