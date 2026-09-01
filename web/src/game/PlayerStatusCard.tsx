import type { PlayerView } from '../net/types'
import { useTranslation } from '../i18n'
import './PlayerStatusCard.css'

interface BadgeSlot {
  icon: string
  title: string
}

export default function PlayerStatusCard({ player, side }: { player: PlayerView; side: 'opp' | 'my' }) {
  const { t } = useTranslation()

  function badgeSlots(p: PlayerView): (BadgeSlot | null)[] {
    const slots: (BadgeSlot | null)[] = [null, null, null]
    if (p.monarch) slots[0] = { icon: '♛', title: t('game', 'mechanics_monarch') }
    if (p.initiative) slots[1] = { icon: '⚔', title: t('game', 'mechanics_initiative') }
    const designation = p.designationNames?.[0]
    if (designation) slots[2] = { icon: '★', title: designation }
    return slots
  }

  function secondaryCounter(p: PlayerView): { label: string; value: number } {
    const poison = p.counters?.find((c) => c.name.toLowerCase() === 'poison')
    if (poison) return { label: t('game', 'poison'), value: poison.count }
    const other = p.counters?.[0]
    if (other) return { label: other.name, value: other.count }
    return { label: t('game', 'poison'), value: 0 }
  }

  const secondary = secondaryCounter(player)
  const slots = badgeSlots(player)

  return (
    <div className={`player-status-card ${side}-status`}>
      <div className="player-status-badges">
        {slots.map((slot, i) =>
          slot ? (
            <span key={i} className="player-status-badge filled" title={slot.title}>{slot.icon}</span>
          ) : (
            <span key={i} className="player-status-badge" />
          ),
        )}
      </div>
      <div className="player-status-body">
        <div className="player-status-name" data-priority={player.hasPriority || undefined}>
          {player.name}
        </div>
        <div className="player-status-counters">
          <div className="player-status-counter life">{player.life}</div>
          <div className="player-status-counter" title={secondary.label}>{secondary.value}</div>
        </div>
      </div>
    </div>
  )
}
