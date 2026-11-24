import type { PlayerView } from '../net/types'
import { useTranslation } from '../i18n'
import { isPlayerOut } from './boardShared'
import { useRingFit } from './useLaneFit'
import Icon from '../ui/Icon'
import { setSeatPeek, useStore } from '../state/store'
import './TurnOrderRing.css'

export interface TurnOrderRingProps {
  players: PlayerView[]
  activePlayerId: string
  onSeatClick?: (playerId: string) => void
  /** Lets the own pill take `onSeatClick` too (the main board mode, BRD-7). */
  selfClickable?: boolean
  focusedId?: string | null
}

export function turnOrderSeats(players: PlayerView[] | undefined): PlayerView[] {
  const clamped = players ?? []
  // The server lists players in map order (table added order) but turns advance
  // in reverse: PlayerList is built with CircularList.add(), which inserts at
  // the head and inverts the list. Show the real turn order (the reverse).
  return [...clamped].reverse()
}

export default function TurnOrderRing({ players, activePlayerId, onSeatClick, selfClickable = false, focusedId = null }: TurnOrderRingProps) {
  const { t } = useTranslation()
  const peekId = useStore((s) => s.seatPeek)
  const ordered = turnOrderSeats(players)
  const count = ordered.length
  const fitKey = `${ordered.map((p) => `${p.playerId}:${p.name}`).join('|')}|${activePlayerId}`
  const ringOn = count > 1
  const { ref: ringRef, fit: ringFit } = useRingFit(ringOn, fitKey)
  if (count === 0) return null

  const seatBody = (p: PlayerView, isActive: boolean, withName: boolean, withBadgeId = true) => (
    <>
      <span className="tor-seat-dot" aria-hidden>
        {isActive ? <Icon name="play" size={9} /> : <Icon name="circle" size={7} />}
      </span>
      {withName && <span className="tor-seat-name">{p.name}</span>}
      {isActive && (
        <span className="tor-active-badge" data-testid={withBadgeId ? 'tor-active-badge' : undefined}>
          {p.controlled ? t('game', 'your_turn') : t('board', 'turn_active_badge')}
        </span>
      )}
    </>
  )

  /**
   * One row of seat groups, rendered twice: once visible, once as the hidden
   * ruler `useLaneFit` measures. Same JSX on purpose — a ruler that left the
   * arrows out, or dropped the active seat's highlight, would measure a
   * narrower thing than the row actually needs. `measure` only strips the
   * test ids, so the ruler cannot be clicked and does not shadow the real
   * elements in tests.
   */
  const seatGroups = (measure: boolean) =>
    ordered.map((p, idx) => {
      const isActive = p.playerId === activePlayerId
      const isPriority = !!p.hasPriority
      const isDefeated = isPlayerOut(p)
      const nextPlayer = ordered[(idx + 1) % count]
      // The hidden ruler keeps the icon (it is part of the width it measures)
      // but takes no handlers, so it can neither be clicked nor light a board.
      const actionable = !!onSeatClick && (!p.controlled || selfClickable) && !isDefeated
      const clickable = actionable && !measure
      const focused = focusedId === p.playerId
      const peek = !measure && peekId === p.playerId

      return (
        <div key={p.playerId} className="tor-seat-group" data-active-group={isActive || undefined}>
          <div
            className={`tor-seat ${isActive ? 'is-active' : ''} ${isPriority ? 'has-priority' : ''} ${isDefeated ? 'is-defeated' : ''} ${p.controlled ? 'is-controlled' : ''}${clickable ? ' is-clickable' : ''}${focused ? ' is-focused' : ''}${peek ? ' is-peek' : ''}`}
            data-testid={measure ? undefined : `tor-seat-${p.playerId}`}
            data-active={isActive ? 'true' : undefined}
            data-priority={isPriority ? 'true' : undefined}
            title={`${p.name}${isActive ? t('board', 'turn_active_suffix') : ''}${isPriority ? t('board', 'turn_priority_suffix') : ''} · ${t('board', 'turn_life_label')}: ${p.life}${actionable ? ` · ${t('board', focused ? 'seat_focus_all' : 'seat_focus')}` : ''}`}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-pressed={clickable ? focused : undefined}
            onClick={clickable ? () => onSeatClick?.(p.playerId) : undefined}
            onMouseEnter={clickable ? () => setSeatPeek(p.playerId) : undefined}
            onMouseLeave={clickable ? () => setSeatPeek(null) : undefined}
            onFocus={clickable ? () => setSeatPeek(p.playerId) : undefined}
            onBlur={clickable ? () => setSeatPeek(null) : undefined}
            onKeyDown={clickable ? (e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              onSeatClick?.(p.playerId)
            } : undefined}
          >
            {seatBody(p, isActive, true, !measure)}
            {/* BRD-37: the pill carries the board icon itself, so the click is
                offered before anyone hovers it and no board needs a button. */}
            {actionable && (
              <span className="tor-seat-focus" data-testid={measure ? undefined : `tor-focus-${p.playerId}`} aria-hidden>
                <Icon name={focused ? 'minimize' : 'maximize'} size={11} />
              </span>
            )}
          </div>
          {count > 1 && (
            <span
              className={`tor-arrow ${isActive ? 'is-active-edge' : ''}`}
              data-testid={measure ? undefined : `tor-arrow-${p.playerId}-${nextPlayer.playerId}`}
              aria-hidden
            >
              →
            </span>
          )}
        </div>
      )
    })

  return (
    <div
      ref={ringRef}
      className={`turn-order-ring count-${count}`}
      data-testid="turn-order-ring"
      data-active-player={activePlayerId || undefined}
      data-ring-fit={ringOn ? ringFit : undefined}
      role="navigation"
      aria-label={t('board', 'turn_order_label')}
    >
      <div className="tor-track" />
      <div className="tor-seats-flow">{seatGroups(false)}</div>
      {ringOn && (
        /* The ring's own ruler: the row as it is drawn, and the same row with its spacing
           tightened. There is no clone for the last rung — dropping the names is the narrowest
           thing the ring can do, so nothing is compared against it. */
        <div className="tor-measure-layer" data-measure="true" aria-hidden="true">
          <div className="tor-measure" data-lane-measure="full">
            {seatGroups(true)}
          </div>
          <div className="tor-measure is-tight" data-lane-measure="tight">
            {seatGroups(true)}
          </div>
        </div>
      )}
    </div>
  )
}
