import type { CardView, PlayerView } from '../net/types'
import { isAbilityCard } from '../cards/cardImages'
import { useTranslation } from '../i18n'
import type { CategoryT } from '../i18n/types'
import type { IconName } from '../ui/Icon'

export function isStackAbility(card: CardView): boolean {
  if (isAbilityCard(card)) return true
  const types = card.cardTypes ?? []
  return types.some((t) => typeof t === 'string' && /ability/i.test(t))
}

export function isCopyCard(card: CardView): boolean {
  // the server marks a copied spell with `originalIsCopy` (Spell.isCopy()); its name is the card's own
  return card.originalIsCopy === true
}

export function stackTypeLabel(card: CardView, t: CategoryT<'game'>): string {
  if (isStackAbility(card)) {
    const at = card.abilityType ?? ''
    if (at === 'Triggered' || at === 'Triggered Mana') return t('game', 'ability_triggered')
    if (at === 'Activated' || at === 'Mana') return t('game', 'ability_activated')
    if (at === 'Static') return t('game', 'ability_static')
    if (at === 'Loyalty') return t('game', 'ability_loyalty')
    return t('game', 'ability_general')
  }
  const types = card.cardTypes ?? []
  if (types.includes('INSTANT')) return t('game', 'type_instant')
  if (types.includes('SORCERY')) return t('game', 'type_sorcery')
  if (types.includes('CREATURE')) return t('game', 'type_creature')
  if (types.includes('ENCHANTMENT')) return t('game', 'type_enchantment')
  if (types.includes('ARTIFACT')) return t('game', 'type_artifact')
  if (types.includes('PLANESWALKER')) return t('game', 'type_planeswalker')
  if (types.includes('LAND')) return t('game', 'type_land')
  return t('game', 'type_spell')
}

export function stackAbilityIcon(card: CardView): IconName {
  const at = card.abilityType ?? ''
  return at === 'Triggered' || at === 'Triggered Mana' ? 'bell' : 'zap'
}

export function stackSubtype(card: CardView): string | null {
  if (isStackAbility(card)) return null
  const types = card.cardTypes ?? []
  const subs = Array.isArray(card.subTypes)
    ? card.subTypes.flatMap((v: unknown) => (typeof v === 'string' ? [v] : typeof v === 'object' && v ? Object.keys(v as Record<string, unknown>) : []))
    : []
  const isCreature = types.includes('CREATURE')
  if (isCreature && subs.length) return subs.join(' ')
  if (isCreature && card.power != null && card.toughness != null) return `${card.power}/${card.toughness}`
  return null
}

export function stackRulesText(card: CardView): string | null {
  const rules = card.rules ?? []
  if (rules.length) return rules.join('\n')
  return null
}

/** Ids objetivo de un hechizo/habilidad (mismo criterio que las flechas). */
export function stackTargetIds(card: CardView): string[] {
  const obj = card as unknown as Record<string, unknown>
  const raw = obj.targets ?? obj.targetIds ?? obj.chosenTargets ?? []
  if (Array.isArray(raw)) {
    return raw
      .map((t) => (typeof t === 'string' ? t : (t as { id?: unknown } | null)?.id))
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
  }
  if (raw && typeof raw === 'object') return Object.keys(raw)
  return []
}

export function findZoneCard(players: PlayerView[] | undefined, stack: Record<string, CardView>, id: string): CardView | null {
  for (const p of players ?? []) {
    for (const zone of [p.battlefield, p.graveyard, p.exile]) {
      const hit = (zone as Record<string, CardView> | undefined)?.[id]
      if (hit) return hit
    }
    const cmd = p.commandList as unknown
    if (Array.isArray(cmd)) {
      const hit = (cmd as CardView[]).find((c) => (c as { id?: string } | null)?.id === id)
      if (hit) return hit
    } else if (cmd && typeof cmd === 'object') {
      const hit = (cmd as Record<string, CardView>)[id]
      if (hit) return hit
    }
  }
  return stack[id] ?? null
}

/** Etiquetas legibles de los objetivos: nombre de jugador o de carta permanente. */
export function resolveStackTargetLabels(
  ids: string[],
  stack: Record<string, CardView>,
  players?: PlayerView[],
): string[] {
  return ids.map((tid) => {
    const pl = players?.find((p) => p.playerId === tid || p.name === tid)
    if (pl) return pl.name
    const hit = findZoneCard(players, stack, tid)
    return hit?.displayName ?? hit?.name ?? tid
  })
}

export interface ControllerInfo {
  id?: string
  name: string
  isMe: boolean
  isOpponent: boolean
  avatarIcon: IconName
}

export function getControllerInfo(
  card: CardView,
  id: string,
  players?: PlayerView[],
  myPlayerId?: string | null,
  t?: ReturnType<typeof useTranslation>['t'],
): ControllerInfo {
  const youLabel = t ? t('game', 'you') : 'Tú'
  const ctrlId = card.controllerId ?? card.sourceCard?.controllerId
  const ctrlName = card.controllerName ?? card.sourceCard?.controllerName
  const me = players?.find((p) => p.controlled || (myPlayerId != null && p.playerId === myPlayerId))

  // 1) Match by controller id (player uuid) — works for both your own game and watched games
  if (ctrlId && typeof ctrlId === 'string') {
    const matchedPlayer = players?.find((p) => p.playerId === ctrlId || p.name === ctrlId)
    if (matchedPlayer) {
      const isMe = !!me && (matchedPlayer.controlled || (myPlayerId != null && matchedPlayer.playerId === myPlayerId))
      return {
        id: ctrlId,
        name: isMe ? youLabel : matchedPlayer.name,
        isMe,
        isOpponent: !isMe,
        avatarIcon: isMe ? 'user' : (matchedPlayer.isHuman ? 'user' : 'bot'),
      }
    }
  }

  // 2) Match by controller name directly
  if (ctrlName && typeof ctrlName === 'string') {
    const matchedPlayer = players?.find((p) => p.name === ctrlName)
    if (matchedPlayer) {
      const isMe = !!me && (matchedPlayer.controlled || (myPlayerId != null && matchedPlayer.playerId === myPlayerId))
      return {
        name: isMe ? youLabel : matchedPlayer.name,
        isMe,
        isOpponent: !isMe,
        avatarIcon: isMe ? 'user' : (matchedPlayer.isHuman ? 'user' : 'bot'),
      }
    }
    // Controller name known but not in the player list (e.g. watcher without full roster) — show it
    return {
      name: ctrlName,
      isMe: false,
      isOpponent: true,
      avatarIcon: 'bot',
    }
  }

  // 3) Fallback: card/ability sitting in a player's zone
  if (players) {
    for (const p of players) {
      if (id in (p.battlefield ?? {}) || id in (p.graveyard ?? {})) {
        const isMe = !!me && (p.controlled || (myPlayerId != null && p.playerId === myPlayerId))
        return {
          name: isMe ? youLabel : p.name,
          isMe,
          isOpponent: !isMe,
          avatarIcon: isMe ? 'user' : (p.isHuman ? 'user' : 'bot'),
        }
      }
    }
  }

  // 4) Last resort — never label a spectator (no `me`) as "Tú".
  return {
    name: me ? youLabel : (t ? t('lobby', 'deck_unknown') : 'Unknown'),
    isMe: false,
    isOpponent: !me,
    avatarIcon: me ? 'user' : 'info',
  }
}

export function stackEntrySignature(
  id: string,
  card: CardView,
  targetIds: Set<string>,
  players: PlayerView[] | undefined,
  myPlayerId: string | null | undefined,
): string | null {
  if (targetIds.has(id)) return null
  const ctrl = getControllerInfo(card, id, players, myPlayerId)
  const source = card.sourceCard ?? card
  return [
    ctrl.isMe ? 'me' : ctrl.name,
    card.abilityType ?? '',
    source.name ?? '',
    source.expansionSetCode ?? '',
    source.cardNumber ?? '',
    stackRulesText(card) ?? '',
    stackTargetIds(card).join(','),
  ].join('|')
}
