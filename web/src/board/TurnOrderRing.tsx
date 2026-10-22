import type { PlayerView } from '../net/types'
import { useTranslation } from '../i18n'
import { isPlayerOut, MAX_BOARD_PLAYERS } from './boardShared'
import { useLaneFit } from './useLaneFit'
import Icon from '../ui/Icon'
import { useSettings } from '../state/store'
import { seatColorVar, seatIndexOf } from './seatColor'
import './TurnOrderRing.css'

export interface TurnOrderRingProps {
  players: PlayerView[]
  activePlayerId: string
  /**
   * The 1v1 walkway (`lane`) keeps the slots in board position — top player
   * first, my side last — instead of turning them around the table, so the
   * marker alternates sides in sync with the two halves of the board and the
   * read survives peripheral vision. Life is left out: both player bars
   * already show it, and the strip band is 36px tall.
   */
  lane?: boolean
  onSeatClick?: (playerId: string) => void
  /** Lets the own pill take `onSeatClick` too (the main board mode, BRD-7). */
  selfClickable?: boolean
  focusedId?: string | null
}

export function turnOrderSeats(players: PlayerView[] | undefined, lane = false): PlayerView[] {
  const clamped = (players ?? []).slice(0, MAX_BOARD_PLAYERS)
  if (lane) return [...clamped.filter((p) => !p.controlled), ...clamped.filter((p) => p.controlled)]
  // The server lists players in map order (table added order) but turns advance
  // in reverse: PlayerList is built with CircularList.add(), which inserts at
  // the head and inverts the list. Show the real turn order (the reverse).
  return [...clamped].reverse()
}

export default function TurnOrderRing({ players, activePlayerId, lane = false, onSeatClick, selfClickable = false, focusedId = null }: TurnOrderRingProps) {
  const { t } = useTranslation()
  const portrait = useSettings().gameUi === 'v2' && !lane
  const ordered = turnOrderSeats(players, lane)
  const count = ordered.length
  const fitKey = `${ordered.map((p) => `${p.playerId}:${p.name}`).join('|')}|${activePlayerId}`
  const { ref, fit } = useLaneFit(lane && count > 0, fitKey)
  if (count === 0) return null

  const seatBody = (p: PlayerView, isActive: boolean, withName: boolean, withBadgeId = true) => portrait ? (
    <>
      <span className="tor-avatar" style={{ '--seat': seatColorVar(seatIndexOf(players, p.playerId)) } as React.CSSProperties}>
        <span className="pp-av" aria-hidden="true">{Array.from(p.name.trim())[0]?.toUpperCase() ?? '?'}</span>
        {isPlayerOut(p) && <Icon name="skull" size={11} />}
      </span>
      {withName && <span className="tor-seat-name">{p.name}</span>}
    </>
  ) : (
    <>
      <span className="tor-seat-dot" aria-hidden>
        {isActive ? <Icon name="play" size={9} /> : <Icon name="circle" size={7} />}
      </span>
      {withName && <span className="tor-seat-name">{p.name}</span>}
      {!lane && <span className="tor-seat-life">{isPlayerOut(p) ? <Icon name="skull" size={11} /> : p.life}</span>}
      {isActive && (
        <span className="tor-active-badge" data-testid={withBadgeId ? 'tor-active-badge' : undefined}>
          {p.controlled ? t('game', 'your_turn') : t('board', 'turn_active_badge')}
        </span>
      )}
    </>
  )
  const activeSeat = ordered.find((p) => p.playerId === activePlayerId) ?? ordered[0]

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
      const clickable = !!onSeatClick && !measure && (!p.controlled || selfClickable) && !isDefeated
      const focused = focusedId === p.playerId

      return (
        <div key={p.playerId} className="tor-seat-group" data-active-group={isActive || undefined}>
          <div
            className={`tor-seat ${isActive ? 'is-active' : ''} ${isPriority ? 'has-priority' : ''} ${isDefeated ? 'is-defeated' : ''} ${p.controlled ? 'is-controlled' : ''}${clickable ? ' is-clickable' : ''}${focused ? ' is-focused' : ''}`}
            data-testid={measure ? undefined : `tor-seat-${p.playerId}`}
            data-active={isActive ? 'true' : undefined}
            data-priority={isPriority ? 'true' : undefined}
            title={`${p.name}${isActive ? t('board', 'turn_active_suffix') : ''}${isPriority ? t('board', 'turn_priority_suffix') : ''} · ${t('board', 'turn_life_label')}: ${p.life}`}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            aria-pressed={clickable ? focused : undefined}
            onClick={clickable ? () => onSeatClick?.(p.playerId) : undefined}
            onKeyDown={clickable ? (e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              onSeatClick?.(p.playerId)
            } : undefined}
          >
            {seatBody(p, isActive, true, !measure)}
          </div>
          {/* In the walkway the chain stops at the last seat: a trailing
              arrow would point at nobody (it is the ring wrapping around). */}
          {count > 1 && (!lane || idx < count - 1) && (
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
      ref={ref}
      className={`turn-order-ring ${lane ? 'lane' : ''} ${portrait ? 'is-portrait' : ''} count-${count}`}
      data-testid={lane ? 'turn-lane' : 'turn-order-ring'}
      data-active-player={activePlayerId || undefined}
      data-lane-fit={lane ? fit : undefined}
      role="navigation"
      aria-label={t('board', 'turn_order_label')}
    >
      <div className="tor-track" />
      <div className="tor-seats-flow">{seatGroups(false)}</div>
      {lane && (
        /* Hidden rows at natural width: what the walkway would need to show
           every seat whole, what it needs for the active seat alone, and what
           it needs with the names dropped. The visible row is already capped by
           the band, so it cannot report its own natural width. */
        <div className="tor-measure-layer" data-measure="true" aria-hidden="true">
          <div className="tor-measure" data-lane-measure="full">
            {seatGroups(true)}
          </div>
          <div className="tor-measure" data-lane-measure="solo">
            <div className="tor-seat is-active">{seatBody(activeSeat, true, true, false)}</div>
          </div>
          <div className="tor-measure" data-lane-measure="solo-dots">
            <div className="tor-seat is-active">{seatBody(activeSeat, true, false, false)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
