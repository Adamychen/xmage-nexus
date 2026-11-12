import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { useTranslation } from '../i18n'
import type { PlayerView } from '../net/types'
import OpponentZone from './OpponentZone'
import PlayerZone from './PlayerZone'
import BoardShell, { BoardDivider } from './BoardShell'
import { useBoardPresenter, useBoardPlayers } from './useBoardPresenter'
import { opponentRevealedCards } from './revealedCards'
import { isPlayerDefeated, isPlayerOut, useSeatStates, useSpectatorBottomHand, useSwitchedHand, type BoardProps } from './boardShared'
import { useBattlefieldPulse } from './seatFocus'
import { panelSeatIds } from './spotlight'
import { pileCornerLift } from './pileCorner'
import { turnOrderSeats } from './TurnOrderRing'
import { EMPTY_TARGET_ZONES } from './targetZones'
import DefeatedSeat from './DefeatedSeat'
import ScaledCopy, { useLayoutBox } from './ScaledCopy'
import { seatColorVar, seatIndexOf } from './seatColor'
import Icon from '../ui/Icon'
import { normalizeBoardSpotlightPanel, SPOTLIGHT_PANEL_MAX, SPOTLIGHT_PANEL_MIN } from './cardOverlays'
import { setSetting, useSettings, useStore } from '../state/store'
import { outReasonKey, type OutReason } from './outReason'
import './SpotlightBoard.css'

export interface SpotlightBoardProps extends BoardProps {
  homeId: string
  mainId: string
  onSelectSeat: (playerId: string) => void
}

const PICK_OUT_OF_BOARD = 'button, .pile-card, .resource-chip, .hand-zone, .player-avatar'

function pickedInside(target: EventTarget | null, pickable: ReadonlySet<string>, targetable: ReadonlySet<string>): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest(PICK_OUT_OF_BOARD)) return true
  const card = target.closest<HTMLElement>('[data-card-id]')
  if (card && pickable.has(card.dataset.cardId ?? '')) return true
  const bar = target.closest('.player-info-bar, [data-player-anchor]')
  const owner = bar?.getAttribute('data-player-anchor') ?? bar?.closest('[data-player-id]')?.getAttribute('data-player-id')
  return !!owner && targetable.has(owner)
}

interface CornerAnchor {
  lift: number
  right: number
  bottom: number
}

function useMainCornerAnchor(ref: RefObject<HTMLElement | null>, key: string): CornerAnchor | null {
  const [anchor, setAnchor] = useState<CornerAnchor | null>(null)
  useEffect(() => {
    const main = ref.current
    const zone = main?.querySelector<HTMLElement>('.board-zone')
    const corner = zone?.querySelector<HTMLElement>(':scope > .bz-pile-corner')
    const shell = main?.closest<HTMLElement>('.board-shell')
    if (!main || !zone || !corner || !shell || typeof ResizeObserver === 'undefined') {
      setAnchor(null)
      return
    }
    const hand = shell.querySelector<HTMLElement>('[data-testid="hand-bar"]')
    const ro = new ResizeObserver(() => {
      const box = shell.getBoundingClientRect()
      const scale = shell.offsetWidth > 0 ? box.width / shell.offsetWidth : 1
      if (!(scale > 0)) return
      const zoneBottom = zone.getBoundingClientRect().bottom
      const cornerBox = corner.getBoundingClientRect()
      const cards = Array.from(shell.querySelectorAll<HTMLElement>('[data-testid="hand-bar"] .hand-card-slot'))
        .map((el) => el.getBoundingClientRect())
      const lift = pileCornerLift(zoneBottom, cornerBox, cards)
      const next = {
        lift: Math.round(lift / scale),
        right: Math.round((box.right - cornerBox.left) / scale + 12),
        bottom: Math.round((box.bottom - (zoneBottom - lift)) / scale),
      }
      setAnchor((prev) => (prev && prev.lift === next.lift && prev.right === next.right && prev.bottom === next.bottom ? prev : next))
    })
    ro.observe(shell)
    ro.observe(main)
    ro.observe(zone)
    ro.observe(corner)
    if (hand) ro.observe(hand)
    return () => ro.disconnect()
  }, [ref, key])
  return anchor
}

/** A copy pulses once when a permanent enters or leaves its battlefield (BRD-8). */
function CopyPulse({ player }: { player: PlayerView | undefined }) {
  const tick = useBattlefieldPulse(player, true)
  return tick > 0 ? <span key={tick} className="spotlight-copy-pulse" aria-hidden="true" /> : null
}

/** Left edge of the panel: drag it, or press the arrow keys, to resize the panel (BRD-13). */
const OUT_STATUS = { died: 'player_died', conceded: 'player_conceded', left: 'player_left' } as const
const OUT_ICON = { died: 'skull', conceded: 'flag', left: 'door' } as const

/** A copy's name and life at full size above it (BRD-31): a scaled copy is too small to tell whose it is. */
function CopyHead({ player, players, active, onSelect }: { player: PlayerView; players: PlayerView[]; active: boolean; onSelect: () => void }) {
  const { t } = useTranslation()
  const lifeLabel = t('board', 'turn_life_label')
  const loggedReason = useStore((s) => (s.gameId ? s.outReasons[outReasonKey(s.gameId, player.name)] : undefined))
  const seat = { '--seat': seatColorVar(seatIndexOf(players, player.playerId)) } as CSSProperties
  if (isPlayerOut(player) && !player.controlled) {
    // BRD-30: an opponent out of the game folds to its head; there is no board left to show. Why they
    // left comes from the log; without it, 0 life reads as a death and anything else as leaving.
    const reason: OutReason = loggedReason ?? (isPlayerDefeated(player) ? 'died' : 'left')
    const status = t('game', OUT_STATUS[reason])
    return (
      <div
        className="spotlight-copy-head is-out"
        data-testid={`spotlight-head-${player.playerId}`}
        data-out={reason}
        style={seat}
        aria-label={`${player.name} ${status}`}
      >
        <Icon name={OUT_ICON[reason]} size={12} />
        <span className="spotlight-copy-head-name">{player.name}</span>
        <span className="spotlight-copy-head-status">{status}</span>
      </div>
    )
  }
  return (
    <button
      type="button"
      className={`spotlight-copy-head${active ? ' is-active' : ''}`}
      data-testid={`spotlight-head-${player.playerId}`}
      style={seat}
      aria-label={`${player.name} · ${lifeLabel}: ${player.life}`}
      onClick={onSelect}
    >
      {active && <span className="spotlight-copy-head-turn">{t('board', 'turn_active_badge')}</span>}
      <span className="spotlight-copy-head-name">{player.name}</span>
      <span className="spotlight-copy-head-life" title={lifeLabel}>
        <Icon name="heart" size={12} />
        {player.life}
      </span>
    </button>
  )
}

function PanelHandle({ percent }: { percent: number }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const scheduled = useRef(false)
  const pending = useRef<number | null>(null)

  const apply = (value: number) => setSetting('boardSpotlightPanel', normalizeBoardSpotlightPanel(value))
  const flush = () => {
    scheduled.current = false
    if (pending.current === null) return
    apply(pending.current)
    pending.current = null
  }
  const schedule = (value: number) => {
    pending.current = value
    if (scheduled.current) return
    scheduled.current = true
    requestAnimationFrame(flush)
  }
  const percentAt = (clientX: number): number | null => {
    const body = ref.current?.closest('.spotlight-body')
    const rect = body?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return null
    return ((rect.right - clientX) / rect.width) * 100
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    dragging.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    const value = percentAt(e.clientX)
    if (value !== null) schedule(value)
  }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    dragging.current = false
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    const value = percentAt(e.clientX)
    if (value !== null) pending.current = value
    flush()
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    e.stopPropagation()
    apply(percent + (e.key === 'ArrowLeft' ? 1 : -1))
  }

  return (
    <div
      ref={ref}
      className="spotlight-panel-handle"
      data-testid="spotlight-panel-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label={t('board', 'spotlight_panel_resize')}
      aria-valuemin={SPOTLIGHT_PANEL_MIN}
      aria-valuemax={SPOTLIGHT_PANEL_MAX}
      aria-valuenow={percent}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    />
  )
}

/** Layout "main board" (BRD-6): one board at full size, every other seat as a
 *  scaled copy of the whole board in a side panel. */
export default function SpotlightBoard({
  game,
  homeId,
  mainId,
  onSelectSeat,
  targetIds = [],
  chosenTargetIds = [],
  onTargetClick,
  targetZone = null,
  targetZones = EMPTY_TARGET_ZONES,
  playableIds = [],
  onPlayableClick,
  onCardHover,
  combatSelectable = [],
  combatMode = null,
  combatChosen = [],
  onCombatClick,
  attackingIds = [],
  blockingIds = [],
  crossZonePlayables = [],
  onPlayCrossZone,
}: SpotlightBoardProps) {
  const { isSpectator } = useBoardPlayers(game, true)
  const presenter = useBoardPresenter({
    game,
    targetIds,
    chosenTargetIds,
    targetZone,
    playableIds,
    combatSelectable,
    combatMode,
    combatChosen,
    crossZonePlayables,
    onTargetClick,
    onPlayableClick,
    onCombatClick,
    onCardHover,
  })
  const { handleCardHover, handleCardClick, targetIdSet, playableIdSet } = presenter
  const switchedHand = useSwitchedHand(game)
  const { seatState, toggleSeat } = useSeatStates()
  const { boardSpotlightPanel: panelPercent, gameUi } = useSettings()
  const stripInDivider = gameUi !== 'v2'

  const players = useMemo(() => game?.players ?? [], [game?.players])
  const playerById = useMemo(() => new Map(players.map((p) => [p.playerId, p])), [players])
  const order = useMemo(
    () => panelSeatIds(turnOrderSeats(players).map((p) => p.playerId), homeId, mainId),
    [players, homeId, mainId],
  )
  const pickable = useMemo(
    () => new Set([...targetIdSet, ...playableIdSet, ...combatSelectable, ...combatChosen]),
    [targetIdSet, playableIdSet, combatSelectable, combatChosen],
  )

  const mainRef = useRef<HTMLDivElement>(null)
  const mainBox = useLayoutBox(mainRef)
  const mainPlayer = playerById.get(mainId)
  const mainIsOwn = mainPlayer?.controlled === true
  const mainHand = useSpectatorBottomHand(game, isSpectator, mainPlayer)
  const cornerAnchor = useMainCornerAnchor(mainRef, `${mainId}:${mainIsOwn}`)
  // A copy spans the panel's width at the main area's proportions (BRD-6); the panel scrolls when they do not fit.
  const copyRatio = mainBox.w > 0 && mainBox.h > 0 ? (mainBox.w / mainBox.h).toFixed(4) : null

  const copyTargeted = (id: string): boolean => {
    const player = playerById.get(id)
    if (!player) return false
    return targetIdSet.has(id) || Object.keys(player.battlefield ?? {}).some((cardId) => targetIdSet.has(cardId))
  }

  const seatBoard = (id: string) => {
    const player: PlayerView | undefined = playerById.get(id)
    if (!player) return null
    if (player.controlled) {
      return (
        <div className="spotlight-seat">
          <PlayerZone
            player={player}
            pileCards
            hand={game?.myHand ?? {}}
            onCardClick={handleCardClick}
            onHandCardClick={onPlayableClick}
            onCardHover={handleCardHover}
            targetIds={targetIdSet}
            targetZone={targetZone}
            targetZones={targetZones}
            playableIds={playableIdSet}
            combatSelectable={combatSelectable}
            combatMode={combatMode}
            combatChosen={combatChosen}
            attackingIds={attackingIds}
            blockingIds={blockingIds}
            crossZonePlayables={crossZonePlayables}
            onPlayCrossZone={onPlayCrossZone}
            helperEmblems={game?.myHelperEmblems}
            showHand={false}
            kindColumns
          />
        </div>
      )
    }
    const state = seatState(player)
    if (isSpectator && id === mainId) {
      return (
        <div className="spotlight-seat">
          {state !== 'alive' && (
            <DefeatedSeat player={player} open={state === 'open'} onToggle={() => toggleSeat(player.playerId)} />
          )}
          <PlayerZone
            player={player}
            pileCards
            hand={mainHand}
            onCardClick={handleCardClick}
            onCardHover={handleCardHover}
            targetIds={targetIdSet}
            targetZone={targetZone}
            targetZones={targetZones}
            playableIds={playableIdSet}
            combatSelectable={combatSelectable}
            combatMode={combatMode}
            combatChosen={combatChosen}
            attackingIds={attackingIds}
            blockingIds={blockingIds}
            kindColumns
          />
        </div>
      )
    }
    return (
      <div className="spotlight-seat">
        {state !== 'alive' && (
          <DefeatedSeat player={player} open={state === 'open'} onToggle={() => toggleSeat(player.playerId)} />
        )}
        {state !== 'collapsed' && (
          <OpponentZone
            player={player}
            pileCards
            onCardClick={handleCardClick}
            onCardHover={handleCardHover}
            targetIds={targetIdSet}
            targetZone={targetZone}
            targetZones={targetZones}
            revealedCards={opponentRevealedCards(game, player)}
            stackHand
            playableIds={playableIdSet}
            combatSelectable={combatSelectable}
            combatMode={combatMode}
            combatChosen={combatChosen}
            attackingIds={attackingIds}
            blockingIds={blockingIds}
            mirrored
            kindColumns
          />
        )}
      </div>
    )
  }

  return (
    <BoardShell
      className="arena-board spotlight-board"
      testId="spotlight-board"
      layout="spotlight"
      style={{
        '--main-inset-right': `${panelPercent}%`,
        ...(cornerAnchor ? {
          '--spot-corner-lift': `${cornerAnchor.lift}px`,
          '--spot-switch-right': `${cornerAnchor.right}px`,
          '--spot-switch-bottom': `${cornerAnchor.bottom}px`,
        } : null),
      } as CSSProperties}
      presenter={presenter}
      handBar={!isSpectator ? {
        cards: switchedHand ?? game?.myHand ?? {},
        onCardClick: onPlayableClick,
        onHover: (card, rect) => handleCardHover(card, rect, { fromHand: true }),
        playableIds: playableIdSet,
        targetIds: targetIdSet,
      } : null}
    >
      {stripInDivider && <BoardDivider />}
      <div className="spotlight-body">
        <div className="spotlight-main" data-testid="spotlight-main" data-main-seat={mainId} ref={mainRef}>
          {seatBoard(mainId)}
        </div>
        <div
          className={`spotlight-panel${copyRatio ? ' has-copy-ratio' : ''}`}
          data-testid="spotlight-panel"
          style={{ '--spotlight-panel-w': `${panelPercent}%`, ...(copyRatio ? { '--copy-ratio': copyRatio } : null) } as CSSProperties}
        >
          <PanelHandle percent={panelPercent} />
          <div className="spotlight-panel-list" data-testid="spotlight-panel-list">
            {order.map((id) => {
              const player = playerById.get(id)
              if (player && !player.controlled && isPlayerOut(player)) {
                return (
                  <div key={id} className="spotlight-copy-item is-out">
                    <CopyHead player={player} players={players} active={false} onSelect={() => {}} />
                  </div>
                )
              }
              return (
                <div key={id} className="spotlight-copy-item">
                  {player && (
                    <CopyHead player={player} players={players} active={game?.activePlayerId === id} onSelect={() => onSelectSeat(id)} />
                  )}
                  <ScaledCopy
                    className={`spotlight-copy-slot${copyTargeted(id) ? ' target-zone' : ''}`}
                    testId={`spotlight-copy-${id}`}
                    playerId={id}
                    refWidth={mainBox.w}
                    refHeight={mainBox.h}
                    onClick={(e) => {
                      if (!pickedInside(e.target, pickable, targetIdSet)) onSelectSeat(id)
                    }}
                    overlay={<CopyPulse player={player} />}
                  >
                    {seatBoard(id)}
                  </ScaledCopy>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </BoardShell>
  )
}

