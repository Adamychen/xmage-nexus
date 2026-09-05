import type {
  FeedbackCard,
  FeedbackItem,
  FeedbackMode,
  FeedbackOption,
  FeedbackPrompt,
  FeedbackTextFn,
} from './types'
import { METADATA_OPTION_KEYS } from './types'
import {
  booleanValueOf,
  detectPlaneswalkerChoice,
  isDiscardMessage,
  isLondonBottoming,
  isMulliganAsk,
  isStartingPlayerMessage,
  isTriggerOrderPick,
  isVotingAsk,
} from './detect'
import {
  asRecord,
  boundsFrom,
  cardOptions,
  cardSummary,
  chosenTargetsOf,
  cleanChoices,
  controlledPlayerId,
  feedbackCards,
  multiAmountItems,
  optionEntries,
  secondMessageOf,
  stringList,
  stringValue,
  targetOptions,
} from './record'
import { defaultText } from './text'

export function parseFeedback(
  method: string,
  objectId: string | null,
  raw: unknown,
  t: FeedbackTextFn = defaultText,
): FeedbackPrompt | null {
  const data = asRecord(raw)
  const gameId = objectId ?? stringValue(data.gameId)
  if (!gameId) return null

  const message = stringValue(data.message) ?? stringValue(data.question) ?? t('game', 'choose_option')
  const bounds = boundsFrom(data)

  switch (method) {
    case 'GAME_SELECT': {
      // XMage usa GAME_SELECT para la prioridad (el tablero sigue interactivo y
      // pasar se hace con un booleano), PERO la declaración de atacantes y
      // bloqueadores también llega como GAME_SELECT con options.possibleAttackers
      // o options.possibleBlockers: aquí las criaturas se clican en el tablero y
      // "Confirmar" (o "Atacar con todos") responde el paso de combate.
      const options = asRecord(data.options)
      const attackers = stringList(options.possibleAttackers)
      const blockers = stringList(options.possibleBlockers)
      if (attackers.length > 0 || blockers.length > 0) {
        const attacking = attackers.length > 0
        return prompt(
          method,
          gameId,
          attacking ? t('game', 'declare_attackers') : t('game', 'declare_blockers'),
          message,
          'combat',
          [],
          bounds,
          undefined,
          undefined,
          true,
          undefined,
          undefined,
          attacking && typeof options.specialButton === 'string',
        )
      }
      // GAME_SELECT de prioridad: sin diálogo (el tablero queda interactivo)
      return null
    }
    case 'GAME_ASK': {
      const isMulligan = isMulliganAsk(message)
      const isStartingPlayer = isStartingPlayerMessage(message)
      const isVoting = isVotingAsk(message, stringValue(data.question))
      const sourceName = secondMessageOf(data)

      const rawOpts = asRecord(data.options)
      let choices: FeedbackOption[]

      if (typeof rawOpts['UI.left.btn.text'] === 'string' || typeof rawOpts['UI.right.btn.text'] === 'string') {
        const leftLabel = stringValue(rawOpts['UI.left.btn.text']) ?? (isMulligan ? t('dialogs', 'mulligan_btn') : t('common', 'yes'))
        const rightLabel = stringValue(rawOpts['UI.right.btn.text']) ?? (isMulligan ? t('dialogs', 'mulligan_keep') : t('common', 'no'))
        choices = [
          { id: 'left', label: leftLabel, value: 'true' },
          { id: 'right', label: rightLabel, value: 'false' },
        ]
      } else {
        const options = optionEntries(data.options).filter((opt) => !METADATA_OPTION_KEYS.has(opt.id))
        choices = options.length
          ? options.map((option, index) => ({ ...option, value: booleanValueOf(option.label, index) || option.value }))
          : isMulligan
            ? [
                { id: 'keep', label: t('dialogs', 'mulligan_keep'), value: 'false' },
                { id: 'mulligan', label: t('dialogs', 'mulligan_btn'), value: 'true' },
              ]
            : [
                { id: 'yes', label: t('common', 'yes'), value: 'true' },
                { id: 'no', label: t('common', 'no'), value: 'false' },
              ]
      }

      return prompt(
        method,
        gameId,
        isVoting ? t('dialogs', 'voting_title') : isMulligan ? t('dialogs', 'mulligan_title') : isStartingPlayer ? t('game', 'who_starts') : t('game', 'confirmation'),
        message,
        'boolean',
        choices,
        bounds,
        undefined,
        undefined,
        true,
        sourceName,
        undefined,
        undefined,
        undefined,
        isMulligan,
        undefined,
        isStartingPlayer,
        isVoting,
      )
    }
    case 'GAME_TARGET': {
      const cards = feedbackCards(data)
      const isMulliganLondon = isLondonBottoming(message)
      const isStartingPlayer = isStartingPlayerMessage(message)
      const isDiscard = isDiscardMessage(message)
      const queryType = stringValue(asRecord(data.options).queryType)
      const isTriggerOrder = !isStartingPlayer && isTriggerOrderPick(message, queryType)
      const title = isStartingPlayer
        ? t('game', 'who_starts')
        : isDiscard
          ? t('game', 'choose_discard')
          : isTriggerOrder
            ? t('game', 'trigger_title')
            : t('game', 'choose_target')
      return prompt(method, gameId, title, message, 'uuid', targetOptions(data, (index, id) => t('game', 'target_fallback', { index: String(index + 1), id: id.slice(0, 8) })), bounds, undefined, undefined, data.flag !== false && data.flag !== 'false', secondMessageOf(data), chosenTargetsOf(data), undefined, cards, undefined, isMulliganLondon, isStartingPlayer, undefined, undefined, undefined, isTriggerOrder)
    }
    case 'GAME_SELECT_CARDS':
    case 'GAME_SELECT_TARGETS':
    case 'GAME_CHOOSE_CARDS': {
      const cards = feedbackCards(data)
      const isDiscard = isDiscardMessage(message)
      const title = isDiscard ? t('game', 'choose_discard') : t('game', 'choose_cards')
      return prompt(method, gameId, title, message, 'uuid', cardOptions(data.cardsView1 ?? cleanChoices(data.options)), bounds, undefined, undefined, true, undefined, undefined, undefined, cards)
    }
    case 'GAME_CHOOSE_ABILITY': {
      const abilities = asRecord(raw)
      const opts = optionEntries(abilities.choices)
      const { isPW, deltas } = detectPlaneswalkerChoice(opts, message)
      return prompt(method, gameId, isPW ? t('dialogs', 'planeswalker_title') : t('game', 'choose_ability'), stringValue(abilities.message) ?? message, 'uuid', opts, bounds, undefined, undefined, true, undefined, undefined, undefined, undefined, undefined, undefined, undefined, isPW ? undefined : undefined, deltas, isPW ? true : undefined)
    }
    case 'GAME_CHOOSE_CHOICE': {
      const choice = asRecord(data.choice)
      const keyChoices = asRecord(choice.keyChoices)
      const listChoices = Array.isArray(choice.choices) ? choice.choices : []
      let choices: FeedbackOption[] = []
      if (Object.keys(keyChoices).length > 0) {
        choices = optionEntries(keyChoices)
      } else if (listChoices.length > 0) {
        choices = listChoices.map((c, i) => ({ id: String(i), label: String(c), value: String(c) }))
      }
      return prompt(method, gameId, t('game', 'choose_option'), stringValue(choice.message) ?? message, 'string', choices, bounds)
    }
    case 'GAME_CHOOSE_PILE': {
      const pile1 = cardSummary(data.cardsView1, t('game', 'pile_1'), (fallback, count) => t('game', 'pile_summary', { fallback, count: String(count) }))
      const pile2 = cardSummary(data.cardsView2, t('game', 'pile_2'), (fallback, count) => t('game', 'pile_summary', { fallback, count: String(count) }))
      return prompt(method, gameId, t('game', 'choose_pile'), message, 'boolean', [
        { id: 'pile1', label: pile1, value: 'true' },
        { id: 'pile2', label: pile2, value: 'false' },
      ], bounds)
    }
    case 'GAME_PLAY_MANA':
      // El servidor NO manda los colores de maná: options solo trae {queryType: "PLAY_MANA"}.
      // El pago real se hace clicando las fuentes de maná en el tablero
      // (canPlayObjects del gameView incrustado), igual que el cliente oficial.
      return prompt(method, gameId, t('game', 'pay_mana'), message, 'mana', [], bounds, undefined, controlledPlayerId(data.gameView))
    case 'GAME_PLAY_XMANA':
      return prompt(method, gameId, t('game', 'pay_mana'), message, 'boolean', [
        { id: 'yes', label: t('common', 'confirm'), value: 'true' },
        { id: 'no', label: t('common', 'cancel'), value: 'false' },
      ], bounds)
    case 'GAME_GET_AMOUNT':
    case 'GAME_SELECT_AMOUNT':
      return prompt(method, gameId, t('game', 'amount_title'), message, 'integer', [], bounds)
    case 'GAME_GET_MULTI_AMOUNT': {
      const items = multiAmountItems(data.messages, (index) => t('game', 'amount_fallback', { index: String(index + 1) }))
      const minSum = typeof data.min === 'number' ? data.min : items.reduce((acc, it) => acc + it.min, 0)
      const maxSum = typeof data.max === 'number' ? data.max : items.reduce((acc, it) => acc + it.max, 999999)
      return prompt(method, gameId, t('game', 'multi_amount_title'), message, 'multiString', [], { min: minSum, max: maxSum }, items)
    }
    case 'GAME_CHOOSE_MODE': {
      const abilities = asRecord(raw)
      const rawChoices = abilities.choices ?? (Array.isArray(abilities.options) ? abilities.options : cleanChoices(abilities.options))
      return prompt(method, gameId, t('game', 'choose_mode'), stringValue(abilities.message) ?? message, 'uuid', optionEntries(rawChoices), bounds)
    }
    case 'GAME_CHOOSE_ONE': {
      const choices = optionEntries(data.choices ?? (Array.isArray(data.options) ? data.options : cleanChoices(data.options)))
      return prompt(method, gameId, t('game', 'choose_option'), message, 'string', choices, bounds)
    }
    case 'GAME_CHOOSE_COLOR': {
      const colors = optionEntries(data.choices ?? (Array.isArray(data.options) ? data.options : { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }))
      return prompt(method, gameId, t('game', 'choose_color'), message, 'string', colors, bounds)
    }
    case 'GAME_CHOOSE_NUMBER': {
      return prompt(method, gameId, t('game', 'choose_number'), message, 'integer', [], bounds)
    }
    case 'GAME_CHOOSE_STRING': {
      const choices = Array.isArray(data.options)
        ? data.options.map((v: unknown, i: number) => ({ id: String(i), label: String(v), value: String(v) }))
        : Array.isArray(data.choices)
          ? data.choices.map((v: unknown, i: number) => ({ id: String(i), label: String(v), value: String(v) }))
          : optionEntries(cleanChoices(data.choices ?? data.options))
      return prompt(method, gameId, t('game', 'choose_name'), message, 'string', choices, bounds)
    }
    case 'GAME_CHOOSE_BETWEEN': {
      const choices = optionEntries(data.choices ?? (Array.isArray(data.options) ? data.options : cleanChoices(data.options)))
      return prompt(method, gameId, t('game', 'choose_between'), message, 'string', choices, bounds)
    }
    case 'GAME_CHOOSE_CARDS_ORDER': {
      const cards = cardOptions(data.cardsView1 ?? cleanChoices(data.options))
      return prompt(method, gameId, t('game', 'choose_order'), message, 'order', cards, bounds, undefined, undefined, true, undefined, undefined, undefined, feedbackCards(data))
    }
    case 'GAME_TARGET_AMOUNT': {
      return prompt(method, gameId, t('game', 'choose_target_amount'), message, 'integer', [], bounds)
    }
    case 'GAME_SELECT_PLAYER':
    case 'GAME_TARGET_PLAYER': {
      const players = targetOptions(data, (index, id) => t('game', 'target_fallback', { index: String(index + 1), id: id.slice(0, 8) }))
      const isStartingPlayer = isStartingPlayerMessage(message)
      return prompt(method, gameId, isStartingPlayer ? t('game', 'who_starts') : t('game', 'choose_player_title'), message, 'uuid', players, bounds, undefined, undefined, true, undefined, undefined, undefined, undefined, undefined, undefined, isStartingPlayer)
    }
    default:
      return null
  }
}

function prompt(
  method: string,
  gameId: string,
  title: string,
  message: string,
  mode: FeedbackMode,
  options: FeedbackOption[],
  bounds: { min: number; max: number },
  items?: FeedbackItem[],
  playerId?: string,
  required = true,
  sourceName?: string,
  chosenTargets?: string[],
  special?: boolean,
  cards?: FeedbackCard[],
  isMulligan?: boolean,
  isMulliganLondon?: boolean,
  isStartingPlayer?: boolean,
  isVoting?: boolean,
  loyaltyDeltas?: (number | null)[],
  isPlaneswalkerAbility?: boolean,
  isTriggerOrder?: boolean,
): FeedbackPrompt {
  const fp: FeedbackPrompt = { method, gameId, title, message, mode, options, min: bounds.min, max: bounds.max, items, playerId, required, sourceName, chosenTargets, special, cards, isMulligan, isMulliganLondon, isStartingPlayer }
  if (isVoting) fp.isVoting = true
  if (isPlaneswalkerAbility) fp.isPlaneswalkerAbility = true
  if (loyaltyDeltas) fp.loyaltyDeltas = loyaltyDeltas
  if (isPlaneswalkerAbility && loyaltyDeltas) fp.isPlaneswalkerAbility = true
  if (isTriggerOrder) fp.isTriggerOrder = true
  return fp
}
