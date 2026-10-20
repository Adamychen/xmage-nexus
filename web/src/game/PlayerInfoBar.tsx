import type { ReactNode } from 'react'
import type { CardView, GameView, PlayerView } from '../net/types'
import { seatColorVar, seatIndexOf, useSeatColor } from '../board/seatColor'
import { useSettings, useStore } from '../state/store'
import { formatTimer, isUnlimitedTime, useTickingTimer } from '../utils/timer'
import AvatarImage from '../lobby/AvatarImage'
import CountryFlag from '../lobby/CountryFlag'
import { useTweenNumber } from './useTweenNumber'
import { dayNightStateOfPlayer } from '../board/dayNight'
import { useCombatHeld } from '../board/useCombatHeld'
import { isPlayerDefeated, isPlayerOut } from '../board/boardShared'
import { useTranslation } from '../i18n'
import { t as tStatic } from '../i18n'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { clickableProps } from '../ui/clickable'
import { CountFlash, useCountFlash } from './useCountFlash'
import { commanderDamageChips } from './commanderChips'
import { formatSeatDamage } from './commanderSeats'
import { COMMANDER_LETHAL } from './CommanderDamageMatrix'
import { useChromeActions } from './chromeActions'
import { dungeonStateOf, hasCityBlessing, speedOf } from './mechanicsState'
import RankBadge from '../lobby/RankBadge'
import { playerRankRating } from '../lobby/ranking'
import { speedLevelKey } from './speed'
import { useChangeFlag } from './useChangeFlag'
import { DamageNumbers } from '../board/DamageNumber'
import { counterPulseClass } from '../board/useCounterPulse'
import { POISON_LETHAL } from '../board/gameTransitionEngine'
import { usePlayerCounters } from './usePlayerCounters'
import './PlayerInfoBar.css'
import type { CommandEntry } from './commandItems'

interface PlayerInfoBarProps {
  player: PlayerView
  side: 'opp' | 'my'
  compact?: boolean
  onClick?: () => void
  isTarget?: boolean
  onHover?: (card: CardView | null, rect?: DOMRect) => void
  onContextMenu?: (e: React.MouseEvent) => void
  stats?: ReactNode
  pool?: ReactNode
  /** Cards of this player's hand the viewer can see, and how to open them. */
  handView?: { known: number; onOpen: () => void }
}

function renderCounterIcon(name: string): React.ReactNode {
  const n = name.toLowerCase()
  if (n.includes('poison')) return <Icon name="skull" size={13} />
  if (n.includes('energy')) return <Icon name="bolt" size={13} />
  if (n.includes('commander')) return <Icon name="crown" size={13} />
  return <Icon name="sparkles" size={12} />
}

function getCounterTokenCard(name: string, count: number): CardView {
  const n = name.toLowerCase()
  if (n.includes('poison')) {
    return { name: 'Poison Counter', displayName: `Poison Counter (${count}/10)`, manaValue: 0 } as CardView
  }
  if (n.includes('energy')) {
    return { name: 'Energy Reserve', displayName: `Energy Reserve (${count})`, manaValue: 0 } as CardView
  }
  if (n.includes('rad')) {
    return { name: 'Rad Counter', displayName: `Rad Counter (${count})`, manaValue: 0 } as CardView
  }
  if (n.includes('experience')) {
    return { name: 'Experience Counter', displayName: `Experience Counter (${count})`, manaValue: 0 } as CardView
  }
  if (n.includes('ticket')) {
    return { name: 'Ticket Counter', displayName: `Ticket Counter (${count})`, manaValue: 0 } as CardView
  }
  if (n.includes('acorn')) {
    return { name: 'Acorn Counter', displayName: `Acorn Counter (${count})`, manaValue: 0 } as CardView
  }
  if (n.includes('speed')) {
    return { name: 'Speed', displayName: `Speed (${count})`, manaValue: 0 } as CardView
  }
  return { name: `${name} Counter`, displayName: `${name} (${count})`, manaValue: 0 } as CardView
}

interface RingInfo {
  level: number
  card: CardView
}

function getRingInfo(player: PlayerView): RingInfo | null {
  const checkCard = (raw: unknown): RingInfo | null => {
    if (!raw || typeof raw !== 'object') return null
    const c = raw as CommandEntry
    const name = String(c.name ?? '').trim().toLowerCase()
    const disp = String(c.displayName ?? '').trim().toLowerCase()
    if (name === 'the ring' || disp === 'the ring' || name.startsWith('the ring') || disp.startsWith('the ring')) {
      const rules = Array.isArray(c.rules) ? c.rules : []
      const level = Math.min(4, Math.max(1, rules.length))
      return {
        level,
        card: {
          name: 'The Ring',
          displayName: `The Ring (${tStatic('game', 'mechanics_ring_level', { level: String(level) })})`,
          rules: rules.length > 0 ? rules : undefined,
          manaValue: 0,
        } as CardView,
      }
    }
    return null
  }

  if (Array.isArray(player.commandList)) {
    for (const c of player.commandList) {
      const info = checkCard(c)
      if (info) return info
    }
  } else if (player.commandList && typeof player.commandList === 'object') {
    for (const c of Object.values(player.commandList)) {
      const info = checkCard(c)
      if (info) return info
    }
  }

  if (player.helperCards && typeof player.helperCards === 'object') {
    for (const c of Object.values(player.helperCards)) {
      const info = checkCard(c)
      if (info) return info
    }
  }

  return null
}

interface DungeonInfo {
  name: string
  card: CardView
}

function getDungeonInfo(player: PlayerView): DungeonInfo | null {
  const checkCard = (raw: unknown): DungeonInfo | null => {
    if (!raw || typeof raw !== 'object') return null
    const c = raw as CommandEntry
    const name = String(c.name ?? '').trim()
    const types = Array.isArray(c.cardTypes) ? c.cardTypes.map((t) => String(t).toLowerCase()) : []
    const isDungeon =
      types.includes('dungeon') ||
      ['dungeon of the mad mage', 'lost mine of phandelver', 'tomb of annihilation', 'undercity'].includes(name.toLowerCase())
    if (isDungeon) {
      return {
        name,
        card: {
          name,
          displayName: name,
          manaValue: 0,
        } as CardView,
      }
    }
    return null
  }

  if (Array.isArray(player.commandList)) {
    for (const c of player.commandList) {
      const info = checkCard(c)
      if (info) return info
    }
  } else if (player.commandList && typeof player.commandList === 'object') {
    for (const c of Object.values(player.commandList)) {
      const info = checkCard(c)
      if (info) return info
    }
  }

  return null
}

function getDayNightInfo(player: PlayerView, game: GameView | null): { isNight: boolean; card: CardView } | null {
  const state = dayNightStateOfPlayer(player, game)
  if (!state) return null
  return {
    isNight: state.isNight,
    card: {
      name: 'Day // Night',
      displayName: state.isNight ? 'Night' : 'Day',
      rules: [state.hint],
      manaValue: 0,
    } as CardView,
  }
}

function getCurseInfo(player: PlayerView, game: GameView | null): { count: number; firstCard: CardView } | null {
  if (!player.attachments || player.attachments.length === 0) return null
  const count = player.attachments.length

  let firstCard: CardView | null = null
  if (game?.players) {
    for (const p of game.players) {
      for (const [id, perm] of Object.entries(p.battlefield ?? {})) {
        if (player.attachments.includes(id)) {
          firstCard = perm as CardView
          break
        }
      }
      if (firstCard) break
    }
  }

  return {
    count,
    firstCard: firstCard ?? ({
      name: 'Curse',
      displayName: `${tStatic('game', 'curse')} (${count})`,
      manaValue: 0,
    } as CardView),
  }
}

function getDesignationDetails(d: string): { icon: import('../ui/Icon').IconName; title: string; card: CardView } {
  const dl = d.toLowerCase()
  if (dl.includes("city's blessing") || dl.includes("citys blessing") || dl.includes('blessing')) {
    return {
      icon: 'landmark',
      title: 'City\'s Blessing (Ascend)',
      card: { name: "City's Blessing", displayName: "City's Blessing", manaValue: 0 } as CardView,
    }
  }
  if (dl.includes('speed')) {
    return {
      icon: 'gauge',
      title: 'Speed',
      card: { name: 'Speed', displayName: 'Speed', manaValue: 0 } as CardView,
    }
  }
  if (dl.includes('enduring story') || dl.includes('story')) {
    return {
      icon: 'bookOpen',
      title: 'Enduring Story',
      card: { name: 'Enduring Story', displayName: 'Enduring Story', manaValue: 0 } as CardView,
    }
  }
  return {
    icon: 'star',
    title: `Designation: ${d}`,
    card: { name: d, displayName: d, manaValue: 0 } as CardView,
  }
}

export default function PlayerInfoBar({
  player,
  side,
  compact = false,
  onClick,
  isTarget = false,
  onHover,
  onContextMenu,
  stats,
  pool,
  handView,
}: PlayerInfoBarProps) {
  const myConn = useStore((s) => s.conn)
  const game = useStore((s) => s.game)
  const gameId = useStore((s) => s.gameId)
  const dungeonProgress = useStore((s) => s.dungeonProgress)
  const { t } = useTranslation()
  const portrait = useSettings().gameUi === 'v2'
  const handFlash = useCountFlash(player.handCount ?? 0)
  const seatColor = useSeatColor(player.playerId)
  const chrome = useChromeActions()
  const cmdChips = portrait ? commanderDamageChips(game, player) : []
  const openMechanics = portrait && chrome ? () => chrome.openPanel('mechanics') : undefined
  const rawUserData = player.userData as
    | { avatarId?: number; flagName?: string; constructedRating?: number; limitedRating?: number; generalRating?: number }
    | undefined
  const avatarId =
    rawUserData?.avatarId ??
    (player.isHuman ? (player.controlled ? (myConn?.avatarId ?? 10) : 10) : 13)
  const flagName = rawUserData?.flagName
  // Real per-player rating from the wire (userData travels with every PlayerView);
  // null when absent → no badge (never a fabricated default).
  const rankElo = player.isHuman ? playerRankRating(rawUserData) : null

  const hasPriority = !!player.hasPriority
  // Turno activo (quién juega ahora) ≠ prioridad (quién puede actuar).
  // Fuente: activePlayerId de la partida, con fallback al flag del jugador.
  const isTurnActive = game?.activePlayerId
    ? game.activePlayerId === player.playerId
    : !!player.isActive
  const timeLeft = useTickingTimer(player.priorityTimeLeftSecs, hasPriority)
  const unlimitedTime = isUnlimitedTime(player.priorityTimeLeftSecs)
  const hasTimer = !unlimitedTime && ((player.priorityTimeLeftSecs != null && player.priorityTimeLeftSecs > 0) || !!player.timerActive)
  const isTimeLow = hasTimer && timeLeft > 0 && timeLeft <= 30
  const timerTier = !isTimeLow ? '' : timeLeft <= 5 ? 'critical' : timeLeft <= 10 ? 'urgent' : 'warn'
  const [turnStarted, clearTurnStarted] = useChangeFlag(isTurnActive)
  const turnGlow = turnStarted && isTurnActive
  const bufferTimeLeft = player.bufferTimeLeft ?? 0
  const hasBuffer = bufferTimeLeft > 0

  const winsNeeded = player.winsNeeded ?? (player.wins ? player.wins : 0)
  const wins = player.wins ?? 0
  const showMatchWins = winsNeeded > 1 || wins > 0

  const shownLife = useCombatHeld(player.playerId, player.life ?? 0)
  const life = useTweenNumber(shownLife)

  const { counters: activeCounters, pulses: counterPulses } = usePlayerCounters(player)
  const speedPulse = Object.entries(counterPulses).find(([name]) => name.toLowerCase().includes('speed'))?.[1]
  const isDefeated = isPlayerOut(player)
  const wasDefeated = isPlayerDefeated(player)
  const showTurn = isTurnActive && !isDefeated

  const ringInfo = getRingInfo(player)
  const dungeonInfo = getDungeonInfo(player)
  const dungeonState = portrait && dungeonInfo ? dungeonStateOf(player, gameId, dungeonProgress) : null
  const dungeonChipLabel =
    dungeonState?.current && dungeonState.depth != null ? `${dungeonState.current} ${dungeonState.depth}/${dungeonState.depthCount}` : null
  const portraitSpeed = portrait ? speedOf(player) : null
  const dayNightInfo = getDayNightInfo(player, game)
  const [dayNightTurned] = useChangeFlag(dayNightInfo?.isNight ?? null, 1000)
  const curseInfo = getCurseInfo(player, game)
  const nonDayNightDesignations = (player.designationNames ?? []).filter(
    (d) => !d.toLowerCase().includes('day') && !d.toLowerCase().includes('night')
  )
  // Speed 1-4 never travels in the DTO; the level is sniffed from the server
  // chat broadcasts (`sniffSpeedLevel`) when the engine announces it.
  const gameIdForSpeed = useStore((s) => s.gameId)
  const speedLevels = useStore((s) => s.speedLevels)
  const speedLevel = gameIdForSpeed ? speedLevels[speedLevelKey(gameIdForSpeed, player.name)] : undefined

  const handleMouseEnter = (card: CardView, e: React.MouseEvent) => {
    if (onHover) {
      onHover(card, e.currentTarget.getBoundingClientRect())
    }
  }

  const handleMouseLeave = () => {
    if (onHover) {
      onHover(null)
    }
  }

  const hasAnyBadge =
    player.monarch ||
    player.initiative ||
    ringInfo != null ||
    dungeonInfo != null ||
    dayNightInfo != null ||
    curseInfo != null ||
    portraitSpeed != null ||
    nonDayNightDesignations.length > 0

  const badgesEl = hasAnyBadge && (
        <div className="player-badges">
          {ringInfo && (
            <span
              className="badge badge-ring interactive-badge"
              onClick={openMechanics}
              {...clickableProps(openMechanics)}
              title={t('game', 'ring_level_badge', { level: ringInfo.level })}
              onMouseEnter={(e) => handleMouseEnter(ringInfo.card, e)}
              onMouseLeave={handleMouseLeave}
            >
              <Icon name="target" size={13} />
              {portrait ? (
                <span className="badge-label">{t('game', 'chip_ring', { level: ringInfo.level })}</span>
              ) : (
                <span className="badge-sub-level">{ringInfo.level}</span>
              )}
            </span>
          )}

          {player.monarch && (
            <span
              className="badge badge-monarch interactive-badge"
              onClick={openMechanics}
              {...clickableProps(openMechanics)}
              title={t('game', 'monarch_hint')}
              onMouseEnter={(e) =>
                handleMouseEnter(
                  { name: 'The Monarch', displayName: 'The Monarch', isToken: true, manaValue: 0 } as CardView,
                  e
                )
              }
              onMouseLeave={handleMouseLeave}
            >
              <Icon name="crown" size={13} />
              {portrait && <span className="badge-label">{t('game', 'chip_monarch')}</span>}
            </span>
          )}

          {player.initiative && (
            <span
              className="badge badge-initiative interactive-badge"
              onClick={openMechanics}
              {...clickableProps(openMechanics)}
              title={t('game', 'initiative_hint')}
              onMouseEnter={(e) =>
                handleMouseEnter(
                  { name: 'The Initiative', displayName: 'The Initiative', isToken: true, manaValue: 0 } as CardView,
                  e
                )
              }
              onMouseLeave={handleMouseLeave}
            >
              <Icon name={portrait ? 'target' : 'swords'} size={13} />
              {portrait && <span className="badge-label">{t('game', 'chip_initiative')}</span>}
            </span>
          )}

          {dungeonInfo && (
            <span
              className="badge badge-dungeon interactive-badge"
              onClick={openMechanics}
              {...clickableProps(openMechanics)}
              title={`${t('game', 'dungeon_active')} ${dungeonInfo.name}`}
              onMouseEnter={(e) => handleMouseEnter(dungeonInfo.card, e)}
              onMouseLeave={handleMouseLeave}
            >
              <Icon name={portrait ? 'map' : 'book'} size={13} />
              {portrait && <span className="badge-label">{dungeonChipLabel ?? dungeonInfo.name}</span>}
            </span>
          )}

          {dayNightInfo && !portrait && (
            <span
              className={`badge badge-daynight interactive-badge ${dayNightInfo.isNight ? 'is-night' : 'is-day'}${dayNightTurned ? ' is-turning' : ''}`}
              title={dayNightInfo.isNight ? t('game', 'mechanics_night') : t('game', 'mechanics_day')}
              onMouseEnter={(e) => handleMouseEnter(dayNightInfo.card, e)}
              onMouseLeave={handleMouseLeave}
            >
              {dayNightInfo.isNight ? <Icon name="moon" size={13} /> : <Icon name="sun" size={13} />}
            </span>
          )}

          {curseInfo && (
            <span
              className="badge badge-curse interactive-badge"
              title={`${curseInfo.count} ${t('game', 'curse')}`}
              onMouseEnter={(e) => handleMouseEnter(curseInfo.firstCard, e)}
              onMouseLeave={handleMouseLeave}
            >
              <Icon name="skull" size={13} /><span className="badge-sub-level">{curseInfo.count}</span>
            </span>
          )}

          {portraitSpeed != null && (
            <span
              className={`badge badge-designation badge-speed interactive-badge${counterPulseClass(speedPulse)}`}
              data-counter="speed"
              onClick={openMechanics}
              {...clickableProps(openMechanics)}
              title={t('game', 'mechanics_speed_title')}
              onMouseEnter={(e) => handleMouseEnter(getCounterTokenCard('speed', portraitSpeed), e)}
              onMouseLeave={handleMouseLeave}
            >
              <Icon name="gauge" size={12} />
              <span className={`badge-label${speedPulse?.tick ? ` counter-tick is-${speedPulse.direction}` : ''}`}>{t('game', 'chip_speed', { speed: portraitSpeed })}</span>
              {speedPulse?.scale && <span key={`ring-${speedPulse.seq}`} className="counter-change-ring" aria-hidden="true" />}
            </span>
          )}

          {nonDayNightDesignations.filter((d) => !(portrait && d.toLowerCase().includes('speed'))).map((d) => {
            const details = getDesignationDetails(d)
            const level = d.toLowerCase().includes('speed') ? speedLevel : undefined
            return (
              <span
                key={d}
                className="badge badge-designation interactive-badge"
                onClick={openMechanics}
                {...clickableProps(openMechanics)}
                title={level != null ? `${details.title} ${level}` : details.title}
                onMouseEnter={(e) => handleMouseEnter(details.card, e)}
                onMouseLeave={handleMouseLeave}
              >
                <Icon name={details.icon} size={12} />
                {portrait && <span className="badge-label">{hasCityBlessing({ designationNames: [d] } as PlayerView) ? t('game', 'chip_blessing') : d}</span>}
                {!portrait && level != null && <span className="badge-sub-level">{level}</span>}
              </span>
            )
          })}
        </div>
      )

  const countersEl = (
    <>
      {activeCounters.filter((c) => !(portrait && c.name.toLowerCase().includes('speed'))).map((c) => {
            const tokenCard = getCounterTokenCard(c.name, c.count)
            const kind = c.name.toLowerCase()
            const pulse = counterPulses[c.name]
            const lethal = kind === 'poison' && c.count >= POISON_LETHAL
            return (
              <span
                key={c.name}
                className={`counter player-counter-badge counter-${kind} interactive-badge${counterPulseClass(pulse)}${lethal ? ' is-lethal' : ''}`}
                data-counter={kind}
                title={`${c.name}: ${c.count}${kind === 'poison' ? '/10' : ''}`}
                onMouseEnter={(e) => handleMouseEnter(tokenCard, e)}
                onMouseLeave={handleMouseLeave}
              >
                <span className="counter-emoji">{renderCounterIcon(c.name)}</span>
                <span className={`counter-val${pulse?.tick ? ` counter-tick is-${pulse.direction}` : ''}`}>{c.count}</span>
                {pulse?.scale && <span key={`ring-${pulse.seq}`} className="counter-change-ring" aria-hidden="true" />}
              </span>
            )
          })}

          {hasTimer && (
            <span
              className={`player-timer-badge ${isTimeLow ? 'timer-low' : ''} ${timerTier} ${hasPriority ? 'timer-active' : ''}`}
              title={t('game', 'priority_time_left')}
            >
              <span className="timer-icon"><Icon name="timer" size={12} /></span>
              <span key={timeLeft} className="timer-value">{formatTimer(timeLeft)}</span>
              {hasBuffer && (
                <span className="timer-buffer" title={t('game', 'buffer_time_left')}>
                  +{formatTimer(bufferTimeLeft)}
                </span>
              )}
            </span>
          )}
    </>
  )

  return (
    <div
      data-player-id={player.playerId}
      data-life={player.life != null ? String(player.life) : undefined}
      className={`player-info-bar ${side} ${compact ? 'compact' : ''} ${portrait ? 'is-portrait' : ''} ${isTarget ? 'targetable' : ''} ${hasPriority ? 'has-priority' : ''} ${showTurn ? 'is-turn' : ''} ${isDefeated ? 'player-defeated' : ''} ${turnGlow ? 'active-glow' : ''}`}
      style={portrait ? ({ '--seat': seatColor } as React.CSSProperties) : undefined}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onAnimationEnd={(e) => {
        if (turnStarted && e.target === e.currentTarget) clearTurnStarted()
      }}
      {...clickableProps(onClick)}
    >
      <DamageNumbers targetKey={`player:${player.playerId}`} />
      <div
        className={`player-avatar ${hasPriority ? 'avatar-active' : ''}`}
        data-player-anchor={player.playerId}
      >
        {portrait ? (
          <span className="pp-av" aria-hidden="true">{Array.from(player.name.trim())[0]?.toUpperCase() ?? '?'}</span>
        ) : (
          <AvatarImage
            avatarId={avatarId}
            username={player.name}
            size={compact ? 'small' : 'medium'}
          />
        )}
        {flagName && <CountryFlag flagName={flagName} className="player-avatar-flag" />}
        {hasPriority && <span className="avatar-priority-ring" />}
        {portrait && (
          handView ? (
            <Button
              variant="ghost"
              size="sm"
              className="pp-hand-badge is-viewable"
              data-testid="pp-hand-count"
              title={t('game', 'opp_hand_view', { known: handView.known, count: player.handCount ?? 0 })}
              aria-label={t('game', 'opp_hand_view', { known: handView.known, count: player.handCount ?? 0 })}
              onClick={(e) => {
                e.stopPropagation()
                handView.onOpen()
              }}
            >
              <Icon name="eye" size={11} />
              {handView.known}/{player.handCount ?? 0}
            </Button>
          ) : (
            <span className="pp-hand-badge" data-testid="pp-hand-count" title={t('game', 'hand')}>
              <Icon name="hand" size={11} />
              {player.handCount ?? 0}
            </span>
          )
        )}
        {portrait && <CountFlash flash={handFlash} className="count-flash--hand" />}
        {portrait && rankElo != null && (
          <RankBadge elo={rankElo} iconOnly className="pp-rank-icon pp-rank-icon-lg" />
        )}
      </div>

      <div className="player-details">
        <div className="player-name-row">
          <span className="player-name" data-priority={player.hasPriority || undefined}>
            {player.name}
          </span>
          {!portrait && rankElo != null && (
            <RankBadge elo={rankElo} compact={compact} showElo={!compact} className="player-rank-badge" />
          )}
          {isDefeated && (
            wasDefeated ? (
              <span className="player-status-badge status-defeated"><Icon name="skull" size={12} /> {t('game', 'status_defeated')}</span>
            ) : (
              <span className="player-status-badge status-left"><Icon name="door" size={12} /> {t('game', 'status_left')}</span>
            )
          )}
          {showMatchWins && (
            <span className="match-wins-dots" title={`${t('game', 'match_wins')}: ${wins}/${winsNeeded}`}>
              {Array.from({ length: Math.max(1, winsNeeded) }).map((_, i) => (
                <span key={i} className={`win-dot ${i < wins ? 'won' : 'pending'}`}>
                  {i < wins ? '●' : '○'}
                </span>
              ))}
            </span>
          )}
        </div>

        {!portrait && (
          <div className="player-counters">
            <span className={`counter life-counter ${shownLife <= 5 ? 'low-life' : ''} ${shownLife <= 2 ? 'critical' : ''}`} title={t('game', 'life')}>
              <span className="counter-icon"><Icon name="heart" size={12} /></span>
              <span className="life-value" key={shownLife}>{life}</span>
            </span>
            {countersEl}
          </div>
        )}

        {portrait && stats && <div className="pp-stats" data-testid="pp-stats" onClick={(e) => e.stopPropagation()}>{stats}</div>}
      </div>

      {portrait && (
        <span className={`pp-life ${shownLife <= 5 ? 'life-danger' : ''}`} title={t('game', 'life')}>
          <span className="life-value" key={shownLife}>{life}</span>
        </span>
      )}

      {portrait && (hasAnyBadge || cmdChips.length > 0 || activeCounters.length > 0 || hasTimer) && (
        <div className="player-chips" data-testid="player-chips">
          {!player.controlled && badgesEl}
          {cmdChips.map((chip) => (
            <span
              key={chip.commander.ownerId}
              className={`commander-chip tone-${chip.tone} interactive-badge`}
              data-testid="commander-chip"
              style={{ '--chip-seat': seatColorVar(seatIndexOf(game?.players, chip.commander.ownerId)) } as React.CSSProperties}
              title={chip.commanders.map((c, i) => `${c.name} (${c.ownerName}): ${chip.dmgs[i]}/${COMMANDER_LETHAL}`).join(' · ')}
              onMouseEnter={chip.commander.card ? (e) => handleMouseEnter(chip.commander.card as CardView, e) : undefined}
              onMouseLeave={handleMouseLeave}
            >
              <span className="commander-chip-dot" aria-hidden="true" />
              <span className="commander-chip-val">
                {chip.dmgs.length > 1 ? formatSeatDamage(chip.dmgs) : `${chip.dmg}/${COMMANDER_LETHAL}`}
              </span>
            </span>
          ))}
          {player.controlled && badgesEl}
          {countersEl}
        </div>
      )}

      {portrait && pool && <div className="pp-pool" data-testid="pp-pool" onClick={(e) => e.stopPropagation()}>{pool}</div>}

      {!portrait && badgesEl}
    </div>
  )
}
