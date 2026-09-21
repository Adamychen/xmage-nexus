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
  /** Select a card" secuencial de reordenar biblioteca (Ponder/Brainstorm-like; GAME_CHOOSE_CARDS_ORDER
   *  no existe en el servidor real, ver docs/history/qa/p4-frames-log.md tanda 8). Solo se marca cuando el
   *  mensaje trae el sufijo inequívoco "(last one chosen will be topmost)" o equivalente — el mensaje
   *  genérico "Select a card" (visto en Brainstorm) no se puede distinguir con seguridad de cualquier
   *  otro GAME_TARGET de una carta, así que se queda sin marcar a propósito. */
  isLibraryOrderPick?: boolean
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
