import type { TranslationSchema } from '../i18n/types'

export type ActionFeedType =
  | 'turn'
  | 'phase'
  | 'cast'
  | 'land'
  | 'attack'
  | 'block'
  | 'damage'
  | 'life'
  | 'draw'
  | 'discard'
  | 'ability'
  | 'chat'
  | 'system'

export interface ActionFeedItem {
  id: string
  timestamp: number
  type: ActionFeedType
  playerName?: string
  isMe?: boolean
  cardName?: string
  targetName?: string
  amount?: number
  description: string
  rawText: string
}

/** Clave i18n (sección `game`) para el texto visible de un evento del feed. */
export type GameFeedKey = keyof TranslationSchema['game']

export interface FeedI18nText {
  kind: 'i18n'
  key: GameFeedKey
  params: Record<string, string | number>
}

export interface FeedVerbatimText {
  kind: 'verbatim'
  text: string
}

/**
 * Evento parseado pero SIN localizar: el texto visible se resuelve con
 * `formatFeedText` / `toFeedItem` en el idioma activo de la UI. Los nombres
 * de jugadores y cartas viajan en `params` y jamás se traducen.
 */
export interface ParsedGameEvent {
  id: string
  timestamp: number
  type: ActionFeedType
  playerName?: string
  isMe?: boolean
  cardName?: string
  targetName?: string
  amount?: number
  rawText: string
  text: FeedI18nText | FeedVerbatimText
}

/** Función `t` mínima que necesita el formateo del feed. */
export type FeedT = (category: 'game', key: GameFeedKey, params?: Record<string, string | number>) => string

/**
 * Convención de sub-claves: un param cuyo valor empieza por `@` se traduce
 * primero como clave de la sección `game` (p. ej. nombres de fase/paso o de
 * zona destino, que también están localizados).
 */
export function formatFeedText(parsed: ParsedGameEvent, t: FeedT): string {
  const { text } = parsed
  if (text.kind === 'verbatim') return text.text
  const params: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(text.params)) {
    params[k] = typeof v === 'string' && v.startsWith('@') ? t('game', v.slice(1) as GameFeedKey) : v
  }
  return t('game', text.key, params)
}

/** Convierte un evento parseado en item renderizable con `description` localizada. */
export function toFeedItem(parsed: ParsedGameEvent, t: FeedT): ActionFeedItem {
  return {
    id: parsed.id,
    timestamp: parsed.timestamp,
    type: parsed.type,
    playerName: parsed.playerName,
    isMe: parsed.isMe,
    cardName: parsed.cardName,
    targetName: parsed.targetName,
    amount: parsed.amount,
    rawText: parsed.rawText,
    description: formatFeedText(parsed, t),
  }
}

/** Strip XML/HTML tags, object ID suffixes [abc], and normalize spaces */
export function cleanMageText(text: string): string {
  return text
    .replace(/<[^>]*>/g, '') // remove HTML tags (<font...>)
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s*\[[0-9a-fA-F]{2,8}\]/g, '') // remove XMage object IDs like [dcf], [a1b], [373], [9b4]
    .replace(/\s+/g, ' ')
    .trim()
}

/** Noise patterns that should not appear as visual action cards */
const NOISE_PATTERNS = [
  /^evento\s+/i,
  /^sorteo:/i,
  /^mulligan:/i,
  /^Te has unido/i,
  /^Espectador:/i,
  /^Sideboard:/i,
  /^\?[^?]+\?$/,
  /^¿[^?]+(?:\?)?$/,
  /watching the game/i,
  /has joined the game/i,
  /has left the game/i,
]

/** Números en palabra que envía el servidor ("draws seven cards") → dígito. */
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
}

/** Fase/paso del servidor ("… - Waiting for X") → clave `step_*` existente. */
const WAITING_PHASE_STEP: Record<string, GameFeedKey> = {  upkeep: 'step_upkeep',
  draw: 'step_draw',
  'precombat main': 'step_main1',
  'begin combat': 'step_begin_combat',
  'declare attackers': 'step_attackers',
  'declare blockers': 'step_blockers',
  'combat damage': 'step_end_combat',
  'end combat': 'step_end_combat',
  'postcombat main': 'step_main2',
  'end turn': 'step_end_step',
  cleanup: 'step_cleanup',
}

/** Destino en inglés ("… into their graveyard") → sub-clave de zona. */
function putsDestKey(dest: string): GameFeedKey | null {
  const d = dest.toLowerCase().replace(/^the\s+/, '').trim()
  if (d.includes('graveyard')) return 'feed_dest_graveyard'
  if (d.includes('exile')) return 'feed_dest_exile'
  if (d.includes('battlefield')) return 'feed_enters_battlefield'
  if (d.includes('top of') && d.includes('library')) return 'feed_dest_top'
  if (d.includes('bottom of') && d.includes('library')) return 'feed_dest_bottom'
  if (d === 'hand' || d.endsWith(' hand')) return 'feed_dest_hand'
  if (d === 'library' || d.endsWith(' library')) return 'feed_dest_top'
  return null
}

/**
 * Parses raw XMage chat / game log lines into structured ParsedGameEvents.
 * Returns null for internal engine noise or unparseable debug lines.
 */
export function parseGameEvent(
  raw: string,
  myPlayerName?: string,
  idPrefix = 'act'
): ParsedGameEvent | null {
  const text = cleanMageText(raw)
  if (!text) return null

  // Ignore internal technical debug noise
  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(text)) return null
  }

  const isMe = (name?: string) => {
    if (!name || !myPlayerName) return false
    const n = name.trim().toLowerCase()
    const m = myPlayerName.trim().toLowerCase()
    return n === m || n === 'you' || n === 'tú'
  }

  const base = {
    id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    rawText: text,
  }

  const i18n = (
    type: ActionFeedType,
    key: GameFeedKey,
    params: Record<string, string | number>,
    extra: Partial<ParsedGameEvent> = {}
  ): ParsedGameEvent => ({ ...base, type, text: { kind: 'i18n', key, params }, ...extra })

  // 1. Turn announcements: "Turn 1 Player (0 - 20)" or "Turn 2 (Alice)" or "Turn 3 Bob"
  const turnMatch = text.match(/^Turn\s+(\d+)\s*([^:(]+?)(?:\s*\([^)]*\))?$/i)
  if (turnMatch) {
    const turnNum = Number(turnMatch[1])
    const pName = turnMatch[2].trim()
    return pName
      ? i18n('turn', 'feed_turn_player', { turn: turnNum, player: pName }, { playerName: pName, isMe: isMe(pName), amount: turnNum })
      : i18n('turn', 'feed_turn', { turn: turnNum }, { amount: turnNum })
  }

  // 2. Cast spells: "Player casts CardName [target: TargetName] from Zone" or "Player casts CardName from Zone"
  const castMatch = text.match(
    /^([^:]+?)\s+(?:casts|plays\s+spell)\s+(?:a\s+copied\s+)?(.+?)(?:\s*\[target:\s*([^\]]+)\])?(?:\s+from\s+[A-Za-z ]+)?$/i
  )
  if (castMatch) {
    const pName = castMatch[1].trim()
    const card = castMatch[2].trim()
    const target = castMatch[3]?.trim()
    return target
      ? i18n('cast', 'feed_cast_target', { player: pName, card, target }, { playerName: pName, isMe: isMe(pName), cardName: card, targetName: target })
      : i18n('cast', 'feed_cast', { player: pName, card }, { playerName: pName, isMe: isMe(pName), cardName: card })
  }

  // 3. Play Lands: "Player plays LandName from Hand" or "Player plays LandName"
  const landMatch = text.match(/^([^:]+?)\s+plays\s+(.+?)(?:\s+from\s+[A-Za-z ]+)?$/i)
  if (landMatch && !landMatch[2].toLowerCase().includes('spell') && !landMatch[2].toLowerCase().includes('ability')) {
    const pName = landMatch[1].trim()
    const land = landMatch[2].trim()
    return i18n('land', 'feed_land', { player: pName, land }, { playerName: pName, isMe: isMe(pName), cardName: land })
  }

  // 4. Attacks: "Player attacks with Creatures", "Player attacks Defender with N creatures",
  //    "Player attacks" or "… targeting Target"
  const attackMatch = text.match(
    /^([^:]+?)\s+attacks(?:\s+(?:with\s+(.+?)|(.+?)\s+with\s+(.+?)))?(?:\s+targeting\s+(.+))?$/i
  )
  if (attackMatch) {
    const pName = attackMatch[1].trim()
    const creatures = (attackMatch[2] ?? attackMatch[4])?.trim()
    const defender = attackMatch[3]?.trim()
    const target = attackMatch[5]?.trim()
    const countMatch = creatures?.match(/^(\d+)\s+creatures?$/i)
    const count = countMatch ? Number(countMatch[1]) : null
    const extra = { playerName: pName, isMe: isMe(pName), cardName: creatures, targetName: target ?? defender }
    if (count !== null) {
      if (defender) {
        return count === 1
          ? i18n('attack', 'feed_attack_vs_one', { player: pName, defender }, extra)
          : i18n('attack', 'feed_attack_vs_n', { player: pName, defender, count }, { ...extra, amount: count })
      }
      return count === 1
        ? i18n('attack', 'feed_attack_one', { player: pName }, extra)
        : i18n('attack', 'feed_attack_n', { player: pName, count }, { ...extra, amount: count })
    }
    if (!creatures) return i18n('attack', 'feed_attack_alone', { player: pName }, extra)
    if (defender) return i18n('attack', 'feed_attack_vs', { player: pName, defender, creatures }, extra)
    if (target) return i18n('attack', 'feed_attack_target', { player: pName, creatures, target }, extra)
    return i18n('attack', 'feed_attack', { player: pName, creatures }, extra)
  }

  // 5. Blocks: "Player blocks Attacker with Blocker"
  const blockMatch = text.match(/^([^:]+?)\s+blocks\s+(.+?)\s+with\s+(.+)$/i)
  if (blockMatch) {
    const pName = blockMatch[1].trim()
    const attacker = blockMatch[2].trim()
    const blocker = blockMatch[3].trim()
    return i18n('block', 'feed_block', { player: pName, attacker, blocker }, { playerName: pName, isMe: isMe(pName), cardName: blocker, targetName: attacker })
  }

  // 6. Damage: "Source deals N damage to Target" or "Target takes N damage from Source"
  const dmgMatch = text.match(/^(.+?)\s+deals?\s+(\d+)\s+damage\s+to\s+(.+)$/i)
  if (dmgMatch) {
    const src = dmgMatch[1].trim()
    const dmg = Number(dmgMatch[2])
    const tgt = dmgMatch[3].trim()
    return i18n('damage', 'feed_damage', { source: src, amount: dmg, target: tgt }, { cardName: src, targetName: tgt, amount: dmg, isMe: isMe(tgt) })
  }

  // 7. Life Changes: "Player loses N life" / "Player gains N life"
  const lifeLossMatch = text.match(/^([^:]+?)\s+loses\s+(\d+)\s+life/i)
  if (lifeLossMatch) {
    const pName = lifeLossMatch[1].trim()
    const amt = Number(lifeLossMatch[2])
    return i18n('life', 'feed_lose_life', { player: pName, amount: amt }, { playerName: pName, isMe: isMe(pName), amount: -amt })
  }
  const lifeGainMatch = text.match(/^([^:]+?)\s+gains\s+(\d+)\s+life/i)
  if (lifeGainMatch) {
    const pName = lifeGainMatch[1].trim()
    const amt = Number(lifeGainMatch[2])
    return i18n('life', 'feed_gain_life', { player: pName, amount: amt }, { playerName: pName, isMe: isMe(pName), amount: amt })
  }

  // 8. Abilities: "[Player - ]Ability triggers: CardName [- desc] [- targeting Target]"
  //    or "Player activates ability of CardName"
  const abilityTriggerMatch = text.match(/^(?:(.+?)\s+-\s+)?Ability\s+triggers:\s*([^-]+?)(?:\s*-\s*(.+))?$/i)
  if (abilityTriggerMatch) {
    const card = abilityTriggerMatch[2].trim()
    const rest = abilityTriggerMatch[3]?.trim() ?? ''
    const targetingMatch = rest.match(/^(.*?)(?:\s+-\s+targeting\s+(.+))?$/i)
    const desc = targetingMatch?.[1]?.trim() ?? ''
    const target = targetingMatch?.[2]?.trim()
    if (target) {
      return i18n('ability', 'feed_ability_trigger_target', { card, target }, { cardName: card, targetName: target })
    }
    return desc
      ? i18n('ability', 'feed_ability_trigger_desc', { card, desc }, { cardName: card })
      : i18n('ability', 'feed_ability_trigger', { card }, { cardName: card })
  }
  const abilityActMatch = text.match(/^([^:]+?)\s+activates\s+(?:an\s+ability\s+of|the\s+ability\s+of|ability\s+of)\s+([^-]+)/i)
  if (abilityActMatch) {
    const pName = abilityActMatch[1].trim()
    const card = abilityActMatch[2].trim()
    return i18n('ability', 'feed_activate', { player: pName, card }, { playerName: pName, isMe: isMe(pName), cardName: card })
  }

  // 9. Draws / Discards: "Player draws a card" / "Player draws seven cards" / "Player discards CardName"
  const drawMatch = text.match(/^([^:]+?)\s+draws?\s+(?:an?\s+card|(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+cards?)/i)
  if (drawMatch) {
    const pName = drawMatch[1].trim()
    const rawCount = drawMatch[2]?.toLowerCase()
    const count = rawCount ? (NUMBER_WORDS[rawCount] ?? Number(rawCount)) : 1
    return count > 1
      ? i18n('draw', 'feed_draw_n', { player: pName, count }, { playerName: pName, isMe: isMe(pName), amount: count })
      : i18n('draw', 'feed_draw', { player: pName }, { playerName: pName, isMe: isMe(pName), amount: count })
  }
  // 9b. Mulligan keep: "Player keeps hand"
  const keepMatch = text.match(/^([^:]+?)\s+keeps?(?:\s+hand)?$/i)
  if (keepMatch) {
    const pName = keepMatch[1].trim()
    return i18n('draw', 'feed_keep_hand', { player: pName }, { playerName: pName, isMe: isMe(pName) })
  }
  const discardMatch = text.match(/^([^:]+?)\s+discards?\s+(.+)$/i)
  if (discardMatch) {
    const pName = discardMatch[1].trim()
    const card = discardMatch[2].trim()
    return i18n('discard', 'feed_discard', { player: pName, card }, { playerName: pName, isMe: isMe(pName), cardName: card })
  }

  // 10. Token creations: "Player creates a Wizard Token token" or "Player creates 2 Goblin tokens"
  const tokenMatch = text.match(/^([^:]+?)\s+creates?\s+(?:a\s+|an\s+|(\d+)\s+)?(.+?)\s+tokens?$/i)
  if (tokenMatch) {
    const pName = tokenMatch[1].trim()
    const count = tokenMatch[2] ? Number(tokenMatch[2]) : 1
    const tokenName = tokenMatch[3].trim()
    return count > 1
      ? i18n('ability', 'feed_token_n', { player: pName, count, token: tokenName }, { playerName: pName, isMe: isMe(pName), cardName: tokenName, amount: count })
      : i18n('ability', 'feed_token_one', { player: pName, token: tokenName }, { playerName: pName, isMe: isMe(pName), cardName: tokenName })
  }

  // 11. Phase/step waiting: "Upkeep - Waiting for Alice", "Declare Attackers - Waiting for Bob"
  const waitingMatch = text.match(
    /^(Upkeep|Draw|Precombat Main|Begin Combat|Declare Attackers|Declare Blockers|Combat Damage|End Combat|Postcombat Main|End Turn|Cleanup)\s*-\s*Waiting for\s+(.+)$/i
  )
  if (waitingMatch) {
    const phaseKey = WAITING_PHASE_STEP[waitingMatch[1].trim().toLowerCase()]
    const pName = waitingMatch[2].trim()
    if (phaseKey) {
      return i18n('phase', 'feed_waiting_for', { phase: `@${phaseKey}`, player: pName }, { playerName: pName, isMe: isMe(pName) })
    }
  }

  // 11b. Skipped steps: "Player skips Draw step" / "Player skips the Draw step"
  const skipMatch = text.match(/^([^:]+?)\s+skips?\s+(?:the\s+)?(.+?)\s+steps?$/i)
  if (skipMatch) {
    const pName = skipMatch[1].trim()
    const stepKey = WAITING_PHASE_STEP[skipMatch[2].trim().toLowerCase()]
    if (stepKey) {
      return i18n('phase', 'feed_skip_step', { player: pName, phase: `@${stepKey}` }, { playerName: pName, isMe: isMe(pName) })
    }
    return { ...base, type: 'phase', text: { kind: 'verbatim', text }, playerName: pName, isMe: isMe(pName) }
  }

  // 11c. Bare waiting: "Waiting for Alice" (sin prefijo de fase)
  const bareWaitMatch = text.match(/^waiting\s+for\s+(.+)$/i)
  if (bareWaitMatch) {
    const pName = bareWaitMatch[1].trim()
    return i18n('phase', 'feed_waiting_player', { player: pName }, { playerName: pName, isMe: isMe(pName) })
  }

  // 11d. First turn choice: "Sim chooses that Alice take the first turn"
  const firstTurnMatch = text.match(/^([^:]+?)\s+chooses?\s+that\s+(.+?)\s+takes?\s+the\s+first\s+turn$/i)
  if (firstTurnMatch) {
    const pName = firstTurnMatch[1].trim()
    const chosen = firstTurnMatch[2].trim()
    return i18n('system', 'feed_first_turn', { player: pName, chosen }, { playerName: pName, isMe: isMe(pName) })
  }

  // 12. Combat status: "Attacker: Grizzly Bears (2/2) unblocked", "Attacked player: Bob"
  const attackerMatch = text.match(/^Attacker:\s*(.+?)\s+(unblocked|blocked(?:\s+by\s+(.+?))?)\.?$/i)
  if (attackerMatch) {
    const attacker = attackerMatch[1].trim()
    const how = attackerMatch[2].trim().toLowerCase()
    const blocker = attackerMatch[3]?.trim()
    if (how === 'unblocked') {
      return i18n('attack', 'feed_attacker_unblocked', { attacker }, { cardName: attacker })
    }
    return blocker
      ? i18n('attack', 'feed_attacker_blocked_by', { attacker, blocker }, { cardName: attacker, targetName: blocker })
      : i18n('attack', 'feed_attacker_blocked', { attacker }, { cardName: attacker })
  }
  const attackedMatch = text.match(/^Attacked player:\s*(.+?)\.?$/i)
  if (attackedMatch) {
    const pName = attackedMatch[1].trim()
    return i18n('attack', 'feed_attacked_player', { player: pName }, { playerName: pName, isMe: isMe(pName) })
  }

  // 13. Reveals: "Player reveals CardA, CardB, CardC"
  const revealMatch = text.match(/^([^:]+?)\s+reveals?\s+(.+)$/i)
  if (revealMatch) {
    const pName = revealMatch[1].trim()
    const cards = revealMatch[2].trim()
    return i18n('ability', 'feed_reveals', { player: pName, cards }, { playerName: pName, isMe: isMe(pName), cardName: cards })
  }

  // 14. Zone moves: "Player puts Card from library into their graveyard (source: X)",
  //     "Player puts a card from hand to the top of their library", "… onto the Battlefield"
  // Nota: sin `in` suelto como preposición (rompería cartas con "in" en el
  // nombre); `on` cubre "on the bottom/top of their library".
  const putsMatch = text.match(
    /^([^:]+?)\s+puts?\s+(.+?)(?:\s+from\s+(.+?))?\s+(into|onto|on to|on|to)\s+(.+?)(?:\s*\(source:\s*([^)]+)\))?$/i
  )
  if (putsMatch) {
    const pName = putsMatch[1].trim()
    const card = putsMatch[2].trim()
    const destRaw = putsMatch[5].trim()
    const source = putsMatch[6]?.trim()
    const destKey = putsDestKey(destRaw)
    if (destKey) {
      if (destKey === 'feed_enters_battlefield') {
        return i18n('land', 'feed_enters_battlefield', { card }, { playerName: pName, isMe: isMe(pName), cardName: card })
      }
      const hidden = /^(a\s+card|a\s+cards?|\d+\s+cards?|cards?)$/i.test(card)
      const params: Record<string, string | number> = source
        ? { player: pName, ...(hidden ? {} : { card }), dest: `@${destKey}`, source }
        : { player: pName, ...(hidden ? {} : { card }), dest: `@${destKey}` }
      const key: GameFeedKey = hidden
        ? (source ? 'feed_puts_hidden_source' : 'feed_puts_hidden')
        : (source ? 'feed_puts_source' : 'feed_puts')
      return i18n('ability', key, params, { playerName: pName, isMe: isMe(pName), cardName: hidden ? undefined : card })
    }
  }

  // 15. Meaningful game announcements: game start, game over, concession, win
  if (
    text.startsWith('¡Partida') ||
    text.toLowerCase().includes('ha ganado') ||
    text.toLowerCase().includes('won the match') ||
    text.toLowerCase().includes('won the game') ||
    text.toLowerCase().includes('has conceded') ||
    text.toLowerCase().includes('fin de partida')
  ) {
    const wonMatch = text.match(/^(.*?)\s+won the (game|match)\b/i)
    if (wonMatch) {
      const pName = wonMatch[1].trim()
      const isMatch = wonMatch[2].toLowerCase() === 'match'
      return i18n('system', isMatch ? 'feed_won_match' : 'feed_won_game', { player: pName }, { playerName: pName, isMe: isMe(pName) })
    }
    const concededMatch = text.match(/^(.*?)\s+has conceded\b/i)
    if (concededMatch) {
      const pName = concededMatch[1].trim()
      return i18n('system', 'feed_conceded', { player: pName }, { playerName: pName, isMe: isMe(pName) })
    }
    return { ...base, type: 'system', text: { kind: 'verbatim', text } }
  }

  return null
}
