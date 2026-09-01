import { useMemo } from 'react'
import type { CardView, PlayerView } from '../net/types'
import CardSlot from './CardSlot'
import { useTranslation } from '../i18n'
import './CommandZone.css'

interface CommandZoneProps {
  player: PlayerView | undefined
  side: 'my' | 'opp'
  onCardClick?: (id: string) => void
  onHover?: (card: any, rect?: DOMRect) => void
  onCardHover?: (card: any, rect?: DOMRect) => void
  playableIds?: Set<string>
  targetIds?: Set<string>
  helperEmblems?: Record<string, CardView>
}

interface CommandObject {
  id: string
  card: CardView
  isEmblem: boolean
  isCommander: boolean
  isCompanion: boolean
  castCount: number
}

const REMINDER_TOKEN_NAMES = new Set([
  'radiation',
  'rad',
  'radiation counter',
  'poison',
  'poison counter',
  'energy',
  'energy reserve',
  'experience',
  'experience counter',
  'the monarch',
  'monarch',
  'the initiative',
  'initiative',
  "city's blessing",
  'blessing',
  'the ring',
  'the ring tempts you',
  'day',
  'night',
  'day // night',
  'day and night',
  'day or night',
  'helper emblem',
  'designation',
])

export function parseCommandList(
  commandList: unknown[] | Record<string, unknown> | undefined,
  helperCards?: Record<string, CardView>
): CommandObject[] {
  const items: CommandObject[] = []
  const seenIds = new Set<string>()

  const processCard = (card: any, defaultId?: string) => {
    if (!card || typeof card !== 'object') return
    const id = card.id || defaultId || `cmd-${Math.random().toString(36).slice(2, 7)}`
    if (seenIds.has(id)) return
    seenIds.add(id)

    const nameLower = String(card.name ?? '').trim().toLowerCase()
    const displayNameLower = String(card.displayName ?? '').trim().toLowerCase()

    if (
      REMINDER_TOKEN_NAMES.has(nameLower) ||
      REMINDER_TOKEN_NAMES.has(displayNameLower) ||
      nameLower.startsWith('helper emblem') ||
      displayNameLower.startsWith('helper emblem') ||
      card.mageObjectType === 'HELPER' ||
      card.mageObjectType === 'HELPER_EMBLEM' ||
      card.isHelperCard === true ||
      (Array.isArray(card.rules) && card.rules.some((r: string) => r.toLowerCase().includes('day or night') && r.toLowerCase().includes('neither day nor night')))
    ) {
      return
    }

    const isEmblem =
      card.mageObjectType === 'EMBLEM' ||
      nameLower.startsWith('emblem -') ||
      nameLower.startsWith('emblem:') ||
      nameLower.startsWith('emblem ') ||
      (Array.isArray(card.cardTypes) && card.cardTypes.some((t: string) => String(t).toLowerCase() === 'emblem'))

    const isCompanion =
      card.mageObjectType === 'COMPANION' ||
      card.isCompanion === true ||
      (Array.isArray(card.rules) && card.rules.some((r: string) => String(r).toLowerCase().includes('companion')))

    const isExplicitCommander = card.mageObjectType === 'COMMANDER' || card.isCommander === true
    const isAuthenticCard =
      (card.expansionSetCode && card.cardNumber) ||
      (Array.isArray(card.cardTypes) && card.cardTypes.some((t: string) => ['creature', 'planeswalker'].includes(String(t).toLowerCase()))) ||
      (Array.isArray(card.superTypes) && card.superTypes.some((t: string) => String(t).toLowerCase() === 'legendary'))

    const isCommander = !isEmblem && !isCompanion && (isExplicitCommander || isAuthenticCard)

    if (!isEmblem && !isCompanion && !isCommander) {
      return
    }

    const castCount = typeof card.castCount === 'number' ? card.castCount : 0

    items.push({
      id,
      card: card as CardView,
      isEmblem,
      isCommander,
      isCompanion,
      castCount,
    })
  }

  if (Array.isArray(commandList)) {
    commandList.forEach((c) => processCard(c))
  } else if (commandList && typeof commandList === 'object') {
    Object.entries(commandList).forEach(([id, c]) => processCard(c, id))
  }

  if (helperCards && typeof helperCards === 'object') {
    Object.entries(helperCards).forEach(([id, c]) => processCard(c, id))
  }

  return items
}

export function hasCommandObjects(
  player: PlayerView | undefined,
  helperEmblems?: Record<string, CardView>,
  side?: 'my' | 'opp'
): boolean {
  if (!player) return false
  const items = parseCommandList(player.commandList, {
    ...(player.helperCards ?? {}),
    ...(side === 'my' ? (helperEmblems ?? {}) : {}),
  })
  return items.length > 0
}

export default function CommandZone({
  player,
  side,
  onCardClick,
  onHover,
  onCardHover,
  playableIds = new Set(),
  targetIds = new Set(),
  helperEmblems,
}: CommandZoneProps) {
  const { t } = useTranslation()
  const hoverHandler = onHover ?? onCardHover

  const items = useMemo(() => {
    return parseCommandList(player?.commandList, {
      ...(player?.helperCards ?? {}),
      ...(side === 'my' ? (helperEmblems ?? {}) : {}),
    })
  }, [player?.commandList, player?.helperCards, helperEmblems, side])

  if (items.length === 0) {
    return null
  }

  const commanders = items.filter((item) => item.isCommander || item.isCompanion)
  const emblems = items.filter((item) => item.isEmblem)

  return (
    <div className={`command-zone ${side}`}>
      {commanders.map((item) => {
        const isPlayable = playableIds.has(item.id)
        const isTarget = targetIds.has(item.id)
        const tax = item.castCount > 0 ? item.castCount * 2 : 0

        return (
          <div key={item.id} className="commander-card-wrap">
            <CardSlot
              cardId={item.id}
              card={item.card}
              onClick={onCardClick ? () => onCardClick(item.id) : undefined}
              onHover={hoverHandler}
              isPlayable={isPlayable}
              isTarget={isTarget}
              className="commander-slot"
            />
            {item.isCompanion ? (
              <div className="companion-badge" title={t('board', 'zone_command')}>
                🦄
              </div>
            ) : (
              <div className="commander-badge" title={t('board', 'zone_command')}>
                👑
              </div>
            )}
            {tax > 0 && (
              <div className="commander-tax-badge" title={`${t('board', 'zone_command')}: +{${tax}}`}>
                +{tax}
              </div>
            )}
          </div>
        )
      })}

      {emblems.length > 0 && (
        <div className="emblems-wrap">
          {emblems.map((item, ei) => (
            <CardSlot
              key={item.id}
              cardId={item.id}
              card={item.card}
              onClick={onCardClick ? () => onCardClick(item.id) : undefined}
              onHover={hoverHandler}
              className="emblem-slot"
              style={{
                top: `${ei * 6}px`,
                left: `${ei * 6}px`,
                zIndex: ei + 1,
              }}
            />
          ))}
          <span className="emblems-count-badge" title={`${emblems.length} ${t('board', 'zone_command')}`}>
            {emblems.length}
          </span>
        </div>
      )}
    </div>
  )
}
