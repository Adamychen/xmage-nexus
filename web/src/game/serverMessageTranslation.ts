type TranslationFn = (
  ns: 'game' | 'dialogs' | 'common' | 'errors' | 'mana',
  key: string,
  params?: Record<string, string | number>
) => string

export function localizeServerMessage(
  raw: string | null | undefined,
  t: TranslationFn
): string {
  if (!raw) return ''
  const trimmed = raw.trim()

  const payManaMatch = trimmed.match(/^Pay\s+(\{[^{}]+\}(?:\s*\{[^{}]+\})*)(?:\s+(.+?))?[.!]?$/i)
  if (payManaMatch) {
    const rest = payManaMatch[2]?.trim()
    const base = `${t('game', 'pay_mana')} ${payManaMatch[1]}`
    return rest ? `${base} · ${rest}` : base
  }

  const payLifeMatch = trimmed.match(/^Pay\s+(\d+)\s+life\??$/i)
  if (payLifeMatch) {
    return t('game', 'pay_life_prompt', { count: payLifeMatch[1] })
  }

  if (/^(?:Select|Choose)\s+(?:a\s+|any\s+)?target$/i.test(trimmed)) {
    return t('game', 'choose_target')
  }

  const targetForMatch = trimmed.match(/^(?:Select|Choose)\s+target\s+for\s+(.+)$/i)
  if (targetForMatch) {
    return `${t('game', 'choose_target')}: ${targetForMatch[1]}`
  }

  const selectTargetMatch = trimmed.match(/^Select\s+target\s+(.+)$/i)
  if (selectTargetMatch) {
    return `${t('game', 'choose_target')} (${selectTargetMatch[1]})`
  }

  if (/who (?:goes|will go) first\??|choose.*start|starting player/i.test(trimmed)) {
    return t('game', 'starting_player_board_hint')
  }

  const bottomMatch = trimmed.match(
    /^(?:Select|Choose)\s+(?:a|(\d+))\s+cards?\s+to\s+put\s+on\s+the\s+bottom\s+of\s+(?:your|the)\s+library$/i
  )
  if (bottomMatch) {
    const count = bottomMatch[1] ? Number(bottomMatch[1]) : 1
    return count === 1
      ? t('dialogs', 'mulligan_london_hint')
      : `${t('dialogs', 'mulligan_london_hint')} (${count})`
  }

  if (/^Take\s+a\s+mulligan\??$/i.test(trimmed)) {
    return `${t('dialogs', 'mulligan_take')}?`
  }

  const mulliganDownMatch = trimmed.match(/^Mulligan\s+down\s+to\s+(\d+)\s+cards?\??$/i)
  if (mulliganDownMatch) {
    return `${t('dialogs', 'mulligan_take')} (${mulliganDownMatch[1]})`
  }

  if (/^Choose\s+a\s+card\s+(?:for\s+them\s+)?to\s+discard$/i.test(trimmed)) {
    return t('game', 'choose_discard')
  }

  const discardDownMatch = trimmed.match(/^Discard\s+down\s+to\s+(\d+)\s+cards?$/i)
  if (discardDownMatch) {
    return `${t('game', 'choose_discard')} (${discardDownMatch[1]})`
  }

  if (/^Announce\s+the\s+value\s+for\s+\{?X\}?$/i.test(trimmed)) {
    return `${t('game', 'amount_title')} {X}`
  }

  if (/^Order\s+cards\s+on\s+top\s+of\s+library$/i.test(trimmed)) {
    return t('game', 'choose_order')
  }

  if (/^Order\s+(?:damage|blockers)$/i.test(trimmed)) {
    return t('dialogs', 'library_title_blocker')
  }

  if (/^(?:Choose|Select)\s+(?:a\s+)?mode$/i.test(trimmed)) {
    return t('game', 'choose_mode')
  }
  if (/^Choose\s+one$/i.test(trimmed)) {
    return `${t('game', 'choose_mode')} (1)`
  }
  if (/^Choose\s+two$/i.test(trimmed)) {
    return `${t('game', 'choose_mode')} (2)`
  }

  if (/^(?:Choose|Select)\s+a\s+color$/i.test(trimmed)) {
    return t('game', 'choose_color')
  }

  if (/^(?:Choose|Select)\s+a\s+player$/i.test(trimmed)) {
    return t('game', 'choose_player_title')
  }

  if (/^(?:Choose|Select)\s+an\s+option$/i.test(trimmed)) {
    return t('game', 'choose_option')
  }

  if (/^(?:Choose|Select)\s+a\s+pile$/i.test(trimmed)) {
    return t('game', 'choose_pile')
  }

  if (/^Search\s+your\s+library\s+for\s+a\s+card$/i.test(trimmed)) {
    return t('game', 'choose_cards')
  }

  const searchMatch = trimmed.match(/^Search\s+your\s+library\s+for\s+up\s+to\s+(\d+)\s+cards?$/i)
  if (searchMatch) {
    return `${t('game', 'choose_cards')} (max ${searchMatch[1]})`
  }

  if (/^Declare\s+attackers$/i.test(trimmed)) {
    return t('game', 'combat_attackers_title')
  }
  if (/^Declare\s+blockers$/i.test(trimmed)) {
    return t('game', 'combat_blockers_title')
  }

  if (/^Click\s+a\s+target\s+on\s+the\s+board$/i.test(trimmed)) {
    return t('game', 'targeting_hint')
  }
  if (/^Click\s+your\s+creatures\s+on\s+the\s+board\s+to\s+declare\s+them$/i.test(trimmed)) {
    return t('game', 'combat_hint')
  }
  if (/^Click\s+your\s+mana\s+sources/i.test(trimmed)) {
    return t('game', 'mana_hint')
  }

  return raw
}

/**
 * Localiza los mensajes de fin de partida que envía el servidor en inglés
 * (`You won the game on turn 3.`, `<name> won the match!`). El pronombre "You"
 * se sustituye por la forma local (`Tú`).
 */
export function localizeGameEndMessage(
  raw: string | null | undefined,
  t: TranslationFn
): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  const you = t('game', 'you')

  const gameResult = trimmed.match(/^(.+?)\s+(?:has\s+)?(won|lost)\s+the\s+game(?:,?\s+on\s+turn\s+(\d+))?[.!]?$/i)
  if (gameResult) {
    const rawPlayer = gameResult[1].trim()
    const player = /^you$/i.test(rawPlayer) ? you : rawPlayer
    const won = gameResult[2].toLowerCase() === 'won'
    const turn = gameResult[3]
    if (turn) {
      return t('game', won ? 'end_won_game_turn' : 'end_lost_game_turn', { player, turn })
    }
    return trimmed
  }

  const matchResult = trimmed.match(/^(.+?)\s+won\s+the\s+match[.!]?$/i)
  if (matchResult) {
    const rawPlayer = matchResult[1].trim()
    return t('game', 'feed_won_match', { player: /^you$/i.test(rawPlayer) ? you : rawPlayer })
  }

  return trimmed
}

export function localizeOptionLabel(
  label: string,
  t: TranslationFn
): string {
  const lower = label.trim().toLowerCase()
  if (lower === 'yes') return t('common', 'yes')
  if (lower === 'no') return t('common', 'no')
  if (lower === 'keep' || lower === 'keep hand') return t('dialogs', 'mulligan_keep')
  if (lower === 'mulligan') return t('dialogs', 'mulligan_take')
  if (lower === 'cancel') return t('common', 'cancel')
  if (lower === 'done' || lower === 'ok') return t('common', 'confirm')
  if (lower === 'white') return t('game', 'color_white')
  if (lower === 'blue') return t('game', 'color_blue')
  if (lower === 'black') return t('game', 'color_black')
  if (lower === 'red') return t('game', 'color_red')
  if (lower === 'green') return t('game', 'color_green')
  if (lower === 'colorless') return t('game', 'color_colorless')
  return label
}
