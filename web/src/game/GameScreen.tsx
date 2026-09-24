import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import GameBoard from '../board/GameBoard'
import PodBoard from '../board/PodBoard'
import ArenaBoard from '../board/ArenaBoard'
import OpponentSwitcherBar from '../board/OpponentSwitcherBar'
import { DividerSlotContext } from '../board/BoardShell'
import TurnOrderRing from '../board/TurnOrderRing'
import * as cmds from '../net/commands'
import { maybeAutoPass, setStoreError, useGame, useSettings, useStore } from '../state/store'
import FeedbackDialog from './FeedbackDialog'
import UserRequestDialog from './UserRequestDialog'
import RollbackDialog from './RollbackDialog'
import LimitedDeckDialog from './LimitedDeckDialog'
import PlayerContextMenu from './PlayerContextMenu'
import InfoWindows from './InfoWindows'
import SideboardScreen from './SideboardScreen'
import GameMenu from './GameMenu'
import PhaseBar, { PhaseName } from './PhaseBar'
import ActionButton from './ActionButton'
import GameDock, { PromptSlotProvider, useDockOffset } from './GameDock'
import GameStrip from './GameStrip'
import GameDrawer, { DrawerToggles, type DrawerTab } from './GameDrawer'
import StackZone from '../board/StackZone'
import { targetsStackObject } from './stackTargeting'
import CombatArrowsOverlay from '../board/CombatArrowsOverlay'
import FeedbackOverlay from '../board/FeedbackOverlay'
import ImpactOverlay from '../board/ImpactOverlay'
import LowLifeVignette from '../board/LowLifeVignette'
import TurnRecapStrip from './TurnRecapStrip'
import { useAttentionAlerts } from './attentionAlerts'
import { identityColors, playmatVars } from '../appearance/playmatIdentity'
import type { ManaColor } from '../board/impactFx'
import '../appearance/playmats.css'
import { musicEngine } from '../audio/musicEngine'
import { musicIntensity } from '../audio/musicIntensity'
import { applyFxRoot } from '../board/fx'
import { hasCommanders as hasCommandersInGame } from '../board/commanders'
import { dayNightStateOf } from '../board/dayNight'
import TournamentPanel from './TournamentPanel'
import { resolveTargetSourceId } from './resolveTargetSourceId'
import { SPACE_PASS_REGION_SELECTOR, SPACE_SHORTCUT_OFF_SELECTOR } from '../ui/clickable'
import { crossZonePlayables } from '../board/crossZone'
import { combatActorsFrom } from '../state/gameUtils'
import { effectiveBoardLayout } from '../board/boardLayout'
import { useTranslation } from '../i18n'
import { soundManager } from '../audio/soundManager'
import { inverseZoom } from '../appearance/zoom'
import { CANCEL_SKIP_ACTION, CANCEL_SKIP_SHORTCUT, skipForShortcut } from './skips'
import { isControllingPriority } from '../state/control'
import { perfMark } from '../system/perfProbe'
import './GameScreen.css'
import './TournamentPanel.css'

/** El atajo global Space no debe disparar cuando el foco está en un control
 *  nativo (doble acción: el control + el pass). Cubre el caso en que el
 *  target es un descendiente del control (p. ej. un span dentro de un button).
 *  Dentro de la región de juego Space es SIEMPRE el atajo (pasar/confirmar),
 *  aunque el foco esté en una carta role=button: esas se activan con Enter. */
export function isSpaceShortcutTargetIgnored(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el || typeof (el as HTMLElement).closest !== 'function') return false
  if ((el as HTMLInputElement).isContentEditable) return true
  if (el.closest('input, textarea, select, button, a, [contenteditable]')) return true
  const roleControl = el.closest('[role="button"], [role="menuitem"], [role="option"]')
  if (!roleControl) return false
  return !roleControl.closest(SPACE_PASS_REGION_SELECTOR)
}

/** El atajo Space también queda bloqueado mientras haya un overlay de visor
 *  abierto (`data-space-shortcut-off`), aunque el foco esté en `body` tras
 *  clicar su fondo: dentro del overlay Space vuelve a ser activación normal. */
export function isSpaceShortcutBlocked(target: EventTarget | null): boolean {
  return isSpaceShortcutTargetIgnored(target) || Boolean(document.querySelector(SPACE_SHORTCUT_OFF_SELECTOR))
}

export default function GameScreen() {
  const { t } = useTranslation()
  const game = useGame()
  const settings = useSettings()
  const gameId = useStore((s) => s.gameId)
  const feedback = useStore((s) => s.feedback)
  const playableIds = useStore((s) => s.playableIds)
  const combat = useStore((s) => s.combat)
  const gameBodyRef = useRef<HTMLDivElement>(null)
  const boardWrapRef = useRef<HTMLDivElement>(null)
  const [drawerTab, setDrawerTab] = useState<DrawerTab | null>(null)
  const [promptSlot, setPromptSlot] = useState<HTMLElement | null>(null)
  const [dividerSlot, setDividerSlot] = useState<HTMLElement | null>(null)
  const [busy, setBusy] = useState(false)
  const stackCount = Object.keys(game?.stack ?? {}).length
  const prevStackCountRef = useRef(0)

  useEffect(() => {
    const prev = prevStackCountRef.current
    prevStackCountRef.current = stackCount
    if (stackCount > 0 && prev === 0) setDrawerTab((cur) => cur ?? 'stack')
    if (stackCount === 0 && prev > 0) setDrawerTab((cur) => (cur === 'stack' ? null : cur))
  }, [stackCount])

  useEffect(() => {
    if (game) maybeAutoPass(game)
  }, [game])

  useEffect(() => {
    applyFxRoot()
  }, [settings.effects, settings.animationSpeed])

  const gameOver = useStore((s) => s.gameEnd != null)
  const hasGame = !!game
  useEffect(() => {
    if (!hasGame || gameOver) {
      musicEngine.stop()
      return
    }
    musicEngine.start()
  }, [hasGame, gameOver])
  useEffect(() => () => musicEngine.stop(), [])
  const intensity = musicIntensity(game)
  useEffect(() => {
    musicEngine.setIntensity(intensity)
  }, [intensity])

  const playmatId = settings.playmatId ?? 'classic'
  const matKey = playmatId === 'identity' ? identityColors(game).join('') : ''
  const matStyle = useMemo(
    () => (matKey ? (playmatVars(matKey.split('') as ManaColor[]) as React.CSSProperties) : undefined),
    [matKey],
  )

  const me = game?.players?.find((p) => p.controlled)
  const priorityPlayer = game?.players?.find((p) => p.hasPriority) ?? game?.players?.find((p) => p.isActive)
  const timerSecs = priorityPlayer?.priorityTimeLeftSecs ?? 0
  const isTimerTicking = !!priorityPlayer?.hasPriority

  useEffect(() => {
    if (isTimerTicking && timerSecs <= 10 && timerSecs > 0) {
      soundManager.play('timer_tick', 'game')
    }
  }, [timerSecs, isTimerTicking])
  const controllingPriority = isControllingPriority(game)
  const canPass =
    !!gameId &&
    (!!me?.hasPriority ||
      ((controllingPriority || !!me?.isActive) && (!feedback || feedback.mode === 'combat')))
  const targetIds = feedback?.method === 'GAME_TARGET' ? feedback.options.map((option) => option.id) : []
  const chosenTargetIds = feedback?.method === 'GAME_TARGET' ? (feedback.chosenTargets ?? []) : []
  const targetSourceId = game && feedback?.method === 'GAME_TARGET' ? resolveTargetSourceId(game, feedback.sourceName) : undefined
  const combatActors = useMemo(() => combatActorsFrom(game), [game])
  useAttentionAlerts(game, gameId, feedback, combat, settings.browserNotifications)

  // Anti doble-envío del mismo objetivo mientras no llega el eco: el CardSlot
  // cubre las cartas; este ref cubre el resto de superficies (headers, pila...).
  const pendingTargetsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    pendingTargetsRef.current.clear()
  }, [game, feedback])

  const stackTargeted = targetsStackObject(game?.stack, targetIds)
  useEffect(() => {
    if (stackTargeted) setDrawerTab('stack')
  }, [stackTargeted])

  const onTargetClick = async (id: string) => {
    if (!gameId) return
    if (pendingTargetsRef.current.has(id)) return
    pendingTargetsRef.current.add(id)
    perfMark('click', 'target', undefined, { id })
    const result = await cmds.sendPlayerUUID(id, gameId)
    if (!result.ok) {
      pendingTargetsRef.current.delete(id)
      setStoreError(result.error ?? t('errors', 'send_failed_target'))
    }
  }

  const onPlayableClick = async (id: string, e?: React.MouseEvent) => {
    if (!gameId) return
    perfMark('click', feedback?.mode === 'mana' ? 'mana' : 'playable', undefined, { id })
    if (e?.ctrlKey || e?.metaKey || e?.shiftKey) {
      await cmds.sendPlayerAction('HOLD_PRIORITY', gameId)
    }
    const result = await cmds.sendPlayerUUID(id, gameId)
    if (!result.ok) setStoreError(result.error ?? t('errors', 'send_failed'))
  }

  const crossZone = crossZonePlayables(game, feedback ?? undefined)

  const onCombatClick = async (id: string) => {
    if (!gameId) return
    perfMark('click', 'combat', undefined, { id })
    const result = await cmds.sendPlayerUUID(id, gameId)
    if (!result.ok) setStoreError(result.error ?? t('errors', 'send_failed_combat'))
  }

  const boardProps = {
    game,
    targetIds,
    chosenTargetIds,
    onTargetClick,
    playableIds,
    onPlayableClick,
    combatSelectable: combat?.selectable ?? [],
    combatMode: combat?.mode ?? null,
    combatChosen: combat?.chosen ?? [],
    onCombatClick,
    attackingIds: combatActors.attackingIds,
    blockingIds: combatActors.blockingIds,
    crossZonePlayables: crossZone,
    onPlayCrossZone: onPlayableClick,
  }

  const onResolveClick = useCallback(async () => {
    if (!gameId || busy) return
    perfMark('click', 'pass')
    setBusy(true)
    perfMark('ack', 'pass')
    try {
      const result = await cmds.sendPlayerBoolean(false, gameId)
      if (!result.ok) setStoreError(result.error ?? t('errors', 'send_failed'))
    } finally {
      setBusy(false)
    }
  }, [gameId, busy, t])

  // Space activates main action / pass priority
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isSpaceShortcutBlocked(e.target)) {
        e.preventDefault()
        // No enviar pass a ciegas si hay un diálogo de maná o target abierto
        if (feedback && feedback.mode !== 'combat') return
        if (canPass) void onResolveClick()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canPass, feedback, onResolveClick])

  // Skips one-shot estilo desktop (F4/F5/F7/F9/F10/F11) + F3 cancela.
  // Sin F6: el propio desktop lo tiene desactivado ("Skip action don't used").
  const sendSkip = useCallback(async (action: string) => {
    if (!gameId || busy) return
    perfMark('click', 'skip', undefined, { action })
    setBusy(true)
    perfMark('ack', 'skip', undefined, { action })
    try {
      const result = await cmds.sendPlayerAction(action, gameId)
      if (!result.ok) setStoreError(result.error ?? t('errors', 'send_failed'))
    } finally {
      setBusy(false)
    }
  }, [gameId, busy, t])

  useEffect(() => {
    const handleSkipKeys = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.key !== CANCEL_SKIP_SHORTCUT && !skipForShortcut(e.key)) return
      e.preventDefault()
      // Sin diálogos modales abiertos (misma guarda que Space)
      if (feedback && feedback.mode !== 'combat') return
      const skip = skipForShortcut(e.key)
      void sendSkip(skip ? skip.action : CANCEL_SKIP_ACTION)
    }
    window.addEventListener('keydown', handleSkipKeys)
    return () => window.removeEventListener('keydown', handleSkipKeys)
  }, [feedback, sendSkip])

  const opps = game?.players?.filter((p) => !p.controlled) ?? []
  const isSpectator = !me
  const topOpps = isSpectator ? (opps.length >= 2 ? opps.slice(0, opps.length - 1) : []) : opps

  const [selectedOppId, setSelectedOppId] = useState<string | null>(null)

  const currentOpp = useMemo(() => {
    if (topOpps.length <= 1) return topOpps[0]
    if (selectedOppId) {
      const found = topOpps.find((p) => p.playerId === selectedOppId)
      if (found) return found
    }
    const activeOpp = topOpps.find((p) => p.playerId === game?.activePlayerId)
    if (activeOpp) return activeOpp
    return topOpps[0]
  }, [topOpps, selectedOppId, game?.activePlayerId])

  const hasActiveMechanics = useMemo(() => {
    if (!game) return false
    if (dayNightStateOf(game)) return true
    if (!game.players) return false
    return game.players.some((p) => {
      const items = Array.isArray(p.commandList)
        ? p.commandList
        : Object.values(p.commandList ?? {})
      const hasRing = items.some((c: any) => String(c?.name ?? '').toLowerCase().includes('the ring'))
      const hasDungeon = items.some(
        (c: any) => Array.isArray(c?.cardTypes) && c.cardTypes.map((t: string) => String(t).toLowerCase()).includes('dungeon')
      )
      const hasMonarch = !!p.monarch
      const hasInitiative = !!p.initiative
      const hasBlessing = p.designationNames?.some((d) => d.toLowerCase().includes('blessing'))
      const hasSpeed = p.designationNames?.some((d) => d.toLowerCase().includes('speed'))
      return hasRing || hasDungeon || hasMonarch || hasInitiative || hasBlessing || hasSpeed
    })
  }, [game])

  const hasCommanders = useMemo(() => hasCommandersInGame(game), [game])

  const totalPlayers = game?.players?.length ?? opps.length + (isSpectator ? 0 : 1)
  const effectiveLayout = effectiveBoardLayout(settings.boardLayout, settings.boardLayoutManual ?? false, opps.length, totalPlayers)
  const isArenaLayout = effectiveLayout === 'arena'
  const isPodLayout = effectiveLayout === 'pod'

  useDockOffset(boardWrapRef, [effectiveLayout, isSpectator, !!game, game?.turn])

  const toggleDrawer = useCallback((tab: DrawerTab) => setDrawerTab((cur) => (cur === tab ? null : tab)), [])
  const activeDrawerTab = drawerTab === 'commander' && !hasCommanders ? null : drawerTab

  const strip = (
    <GameStrip
      left={
        game && (
          <div className="game-state" data-testid="game-status">
            <span className="game-turn">{t('game', 'turn')} {game.turn}</span>
            <PhaseName step={game.step ?? ''} />
            <PhaseBar step={game.step ?? ''} />
          </div>
        )
      }
      center={
        isPodLayout ? (
          <TurnOrderRing players={game?.players ?? []} activePlayerId={game?.activePlayerId ?? ''} />
        ) : (
          topOpps.length > 1 && (
            <OpponentSwitcherBar
              players={game?.players ?? []}
              controlledId={me?.playerId}
              selectedOppId={currentOpp?.playerId || ''}
              onSelectOpponent={(id) => setSelectedOppId(id)}
              activePlayerId={game?.activePlayerId ?? undefined}
              targetIds={new Set(targetIds)}
              onTargetClick={onTargetClick}
              combat={game?.combat ?? []}
            />
          )
        )
      }
      right={
        <>
          <DrawerToggles
            active={activeDrawerTab}
            stackCount={stackCount}
            onToggle={toggleDrawer}
            hasCommanders={hasCommanders}
            hasActiveMechanics={hasActiveMechanics}
          />
          <GameMenu />
        </>
      }
      dropdown={
        activeDrawerTab && (
          <GameDrawer
            tab={activeDrawerTab}
            stackCount={stackCount}
            onClose={() => setDrawerTab(null)}
            stack={
              <StackZone
                stack={game?.stack ?? null}
                onCardClick={onTargetClick}
                targetIds={new Set(targetIds)}
                onResolveClick={onResolveClick}
                canResolve={canPass}
                players={game?.players}
                myPlayerId={me?.playerId}
              />
            }
          />
        )
      }
    />
  )

  return (
    <PromptSlotProvider value={promptSlot}>
      <DividerSlotContext.Provider value={setDividerSlot}>
        <div className="game" style={{ zoom: inverseZoom(settings.uiScale) }}>
          {!dividerSlot && <header className="game-top">{strip}</header>}
          {dividerSlot && createPortal(strip, dividerSlot)}
          <div className="game-body" ref={gameBodyRef} data-space-passes-priority="true">
            <div className="board-wrap" ref={boardWrapRef} data-playmat={playmatId}>
              {playmatId !== 'classic' && (
                <div className="playmat-layer" data-playmat={playmatId} data-testid="playmat-layer" style={matStyle} aria-hidden="true" />
              )}
              {isArenaLayout ? (
                <ArenaBoard {...boardProps} />
              ) : isPodLayout ? (
                <PodBoard {...boardProps} />
              ) : (
                <GameBoard {...boardProps} focusedOpponentId={currentOpp?.playerId} />
              )}
              <LowLifeVignette game={game} />
              <TurnRecapStrip />
              <FeedbackOverlay />
              <ImpactOverlay />
              <GameDock
                onPromptSlot={setPromptSlot}
                action={
                  <ActionButton
                    game={game}
                    feedback={feedback}
                    gameId={gameId}
                    canPass={canPass}
                    onPass={onResolveClick}
                    onSkip={sendSkip}
                    busy={busy}
                  />
                }
              />
            </div>
            <CombatArrowsOverlay
              game={game}
              boardRef={gameBodyRef}
              targetSourceId={targetSourceId}
              chosenTargetIds={chosenTargetIds}
              combatChosen={combat?.chosen ?? []}
              combatMode={combat?.mode ?? null}
            />
          </div>
          <FeedbackDialog />
          <UserRequestDialog />
          <RollbackDialog />
          <LimitedDeckDialog />
          <PlayerContextMenu />
          <InfoWindows />
          <SideboardScreen />
          <TournamentPanel />
        </div>
      </DividerSlotContext.Provider>
    </PromptSlotProvider>
  )
}
