import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ArenaBoard from '../board/ArenaBoard'
import SpotlightBoard from '../board/SpotlightBoard'
import { spotlightActive, useSpotlight } from '../board/spotlight'
import { DividerSlotContext } from '../board/BoardShell'
import TurnOrderRing from '../board/TurnOrderRing'
import { liveOpponentIds, useSeatFocus } from '../board/seatFocus'
import * as cmds from '../net/commands'
import RewindBar from './RewindBar'
import MobileSpectator from './MobileSpectator'
import { useNarrowScreen } from './useNarrowScreen'
import { useRewind, viewedSnapshot } from './rewind'
import { isRollbackVoteBlocking, maybeAutoPass, setStoreError, useGame, useSettings, useStore } from '../state/store'
import FeedbackDialog from './FeedbackDialog'
import UserRequestDialog from './UserRequestDialog'
import RollbackDialog from './RollbackDialog'
import RollbackVoteDialog from './RollbackVoteDialog'
import LimitedDeckDialog from './LimitedDeckDialog'
import PlayerContextMenu from './PlayerContextMenu'
import CardInspector from '../board/CardInspector'
import InfoWindows from './InfoWindows'
import SideboardScreen from './SideboardScreen'
import GameMenu from './GameMenu'
import PhaseLadder from './PhaseLadder'
import ActionButton from './ActionButton'
import GameDock, { OrderSlot, PromptSlotProvider, useDockOffset } from './GameDock'
import GameStrip from './GameStrip'
import { useChangeFlag } from './useChangeFlag'
import GameDrawer, { DrawerToggles, type DrawerTab } from './GameDrawer'
import ChatLogPanel, { ChatLogToggles, type ChatLogTab } from './ChatLogPanel'
import { ChromeActionsContext } from './chromeActions'
import StackZone from '../board/StackZone'
import CombatArrowsOverlay from '../board/CombatArrowsOverlay'
import FeedbackOverlay from '../board/FeedbackOverlay'
import ImpactOverlay from '../board/ImpactOverlay'
import CoinFlipOverlay from '../board/CoinFlipOverlay'
import ShuffleOverlay from '../board/ShuffleOverlay'
import LibraryPeekOverlay from '../board/LibraryPeekOverlay'
import DiceRollOverlay from '../board/DiceRollOverlay'
import DesignationOverlay from '../board/DesignationOverlay'
import ProjectileOverlay from '../board/ProjectileOverlay'
import HandRevealOverlay from '../board/HandRevealOverlay'
import { useDisplayedStack } from '../board/stackHold'
import { useDisplayedGame } from '../board/damageHold'
import { useGameTransitions } from '../board/gameTransitionEngine'
import LowLifeVignette from '../board/LowLifeVignette'
import TurnRecapStrip from './TurnRecapStrip'
import { useAttentionAlerts } from './attentionAlerts'
import { identityColors, playmatVars } from '../appearance/playmatIdentity'
import { CUSTOM_PLAYMAT_ID, effectivePlaymat } from '../appearance/playmats'
import { useCustomPlaymat } from '../appearance/customPlaymat'
import type { ManaColor } from '../board/impactFx'
import '../appearance/playmats.css'
import { musicEngine } from '../audio/musicEngine'
import { musicIntensity } from '../audio/musicIntensity'
import TournamentPanel from './TournamentPanel'
import { resolveTargetSourceId } from './resolveTargetSourceId'
import { SPACE_PASS_REGION_SELECTOR, SPACE_SHORTCUT_OFF_SELECTOR } from '../ui/clickable'
import { crossZonePlayables } from '../board/crossZone'
import { resolveTargetHits, targetZoneKindOf } from '../board/targetZones'
import { combatActorsFrom } from '../state/gameUtils'
import { isPlainBooleanAsk } from './handPick'
import { spectatorHomeSeat } from '../board/boardShared'
import { useTranslation } from '../i18n'
import { soundManager } from '../audio/soundManager'
import { inverseZoom } from '../appearance/zoom'
import { CANCEL_SKIP_ACTION, CANCEL_SKIP_SHORTCUT, skipForShortcut } from './skips'
import { isControllingPriority } from '../state/control'
import { perfMark } from '../system/perfProbe'
import { useTargetPick } from './useTargetPick'
import './GameScreen.css'
import './TournamentPanel.css'
import { activeMechanicsCount } from './mechanicsState'

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

const MOUSE_RELEASABLE_CONTROL =
  'button, a, summary, [role="button"], [role="tab"], [role="switch"], input[type="checkbox"], input[type="radio"]'
const MOUSE_RELEASE_EXCLUDED = '[role="dialog"], [aria-modal="true"], [role="menu"], [role="listbox"], [contenteditable]'

/** Game-screen control (button, tab, toggle…) still holding focus after a
 *  mouse click. Space releases it and keeps passing priority instead of being
 *  swallowed until the user clicks elsewhere. Text fields, dialogs and menus
 *  are excluded: Space keeps its native behavior there. */
export function mouseFocusedGameControl(target: EventTarget | null, root: HTMLElement | null): HTMLElement | null {
  const el = target as HTMLElement | null
  if (!el || !root || typeof el.closest !== 'function' || !root.contains(el)) return null
  const control = el.closest<HTMLElement>(MOUSE_RELEASABLE_CONTROL)
  if (!control || !root.contains(control)) return null
  if (control.closest(MOUSE_RELEASE_EXCLUDED)) return null
  return control
}

export default function GameScreen() {
  const { t } = useTranslation()
  const liveGame = useGame()
  const rewind = useRewind()
  const narrowScreen = useNarrowScreen()
  const [fullBoardOnNarrow, setFullBoardOnNarrow] = useState(false)
  const rewindView = viewedSnapshot(rewind)
  const game = rewindView?.game ?? liveGame
  const settings = useSettings()
  const gameId = useStore((s) => s.gameId)
  useGameTransitions(game, gameId)
  const displayGame = useDisplayedGame(game, gameId, rewindView != null)
  const feedback = useStore((s) => s.feedback)
  const playableIds = useStore((s) => s.playableIds)
  const combat = useStore((s) => s.combat)
  const rollbackBlocking = useStore((s) => isRollbackVoteBlocking(s.rollbackVote))
  const gameRootRef = useRef<HTMLDivElement>(null)
  const gameBodyRef = useRef<HTMLDivElement>(null)
  const boardWrapRef = useRef<HTMLDivElement>(null)
  const [drawerTab, setDrawerTab] = useState<DrawerTab | null>(null)
  const [chatLogTab, setChatLogTab] = useState<ChatLogTab | null>(null)
  const [stackFocus, setStackFocus] = useState<ReadonlySet<string> | null>(null)
  const [promptSlot, setPromptSlot] = useState<HTMLElement | null>(null)
  const [dividerSlot, setDividerSlot] = useState<HTMLElement | null>(null)
  const [handPromptSlot, setHandPromptSlot] = useState<HTMLElement | null>(null)
  const [orderSlot, setOrderSlot] = useState<HTMLElement | null>(null)
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null)
  const [busy, setBusy] = useState(false)
  const displayStack = useDisplayedStack(game, gameId)
  const stackCount = Object.keys(displayStack).length

  useEffect(() => {
    if (liveGame) maybeAutoPass(liveGame)
  }, [liveGame])

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

  const customPlaymat = useCustomPlaymat()
  const playmatId = effectivePlaymat(settings.playmatId, customPlaymat)
  const matKey = playmatId === 'identity' ? identityColors(game).join('') : ''
  const matStyle = useMemo(() => {
    if (playmatId === CUSTOM_PLAYMAT_ID && customPlaymat) return { '--mat-img': `url("${customPlaymat}")` } as React.CSSProperties
    return matKey ? (playmatVars(matKey.split('') as ManaColor[]) as React.CSSProperties) : undefined
  }, [matKey, playmatId, customPlaymat])

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
  const targetZone = feedback?.method === 'GAME_TARGET' ? targetZoneKindOf(feedback.targetZone) : null
  const targetZones = useMemo(() => resolveTargetHits(game, targetIds).zones, [game, targetIds])
  const playableIdSet = useMemo(() => new Set(playableIds), [playableIds])
  const targetIdSet = useMemo(() => new Set(targetIds), [targetIds])
  const targetSourceId = game && feedback?.method === 'GAME_TARGET' ? resolveTargetSourceId(game, feedback.sourceName) : undefined
  const combatActors = useMemo(() => combatActorsFrom(game), [game])
  useAttentionAlerts(liveGame, gameId, feedback, combat, settings.browserNotifications)

  const onTargetClick = useTargetPick(gameId, (error) => setStoreError(error ?? t('errors', 'send_failed_target')))

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
    game: displayGame,
    targetIds,
    chosenTargetIds,
    onTargetClick,
    targetZone,
    targetZones,
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

  const pointerFocusRef = useRef(false)
  useEffect(() => {
    const onPointerDown = () => {
      pointerFocusRef.current = true
    }
    const onTab = (e: KeyboardEvent) => {
      if (e.key === 'Tab') pointerFocusRef.current = false
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onTab, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onTab, true)
    }
  }, [])

  // Space activates main action / pass priority
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      const released =
        pointerFocusRef.current && !e.defaultPrevented && !document.querySelector(SPACE_SHORTCUT_OFF_SELECTOR)
          ? mouseFocusedGameControl(e.target, gameRootRef.current)
          : null
      if (released) released.blur()
      if (released || !isSpaceShortcutBlocked(e.target)) {
        e.preventDefault()
        if (e.repeat) return
        // No enviar pass a ciegas si hay un diálogo de maná o target abierto
        if (feedback && feedback.mode !== 'combat') return
        if (rollbackBlocking) return
        if (gameRootRef.current?.dataset.rewind) return
        if (canPass) void onResolveClick()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canPass, feedback, onResolveClick, rollbackBlocking])

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
      if (e.repeat) return
      // Sin diálogos modales abiertos (misma guarda que Space)
      if (feedback && feedback.mode !== 'combat') return
      if (rollbackBlocking) return
      if (gameRootRef.current?.dataset.rewind) return
      const skip = skipForShortcut(e.key)
      void sendSkip(skip ? skip.action : CANCEL_SKIP_ACTION)
    }
    window.addEventListener('keydown', handleSkipKeys)
    return () => window.removeEventListener('keydown', handleSkipKeys)
  }, [feedback, sendSkip, rollbackBlocking])

  const opps = game?.players?.filter((p) => !p.controlled) ?? []
  const isSpectator = !me

  const mechanicsCount = useMemo(() => activeMechanicsCount(game), [game])
  const hasActiveMechanics = mechanicsCount > 0


  const totalPlayers = game?.players?.length ?? opps.length + (isSpectator ? 0 : 1)
  const seatLiveIds = liveOpponentIds(game?.players)
  const seatFocus = useSeatFocus(seatLiveIds, game)
  const seatPillsClickable = !isSpectator && seatLiveIds.length >= 2
  const homeId = me?.playerId ?? spectatorHomeSeat(opps)?.playerId
  const spotlight = useSpotlight(game, homeId, seatLiveIds, isSpectator ? null : combat?.mode ?? null)
  const spotlightOn = spotlightActive({
    enabled: settings.boardSpotlight,
    isSpectator,
    liveOppCount: seatLiveIds.length,
    totalPlayers,
  }) && !!spotlight.mainId

  useDockOffset(boardWrapRef, [isSpectator, !!game, game?.turn])
  const [turnGlow, clearTurnGlow] = useChangeFlag(game?.turn)

  const toggleLegacyDrawer = useCallback((tab: DrawerTab) => setDrawerTab((cur) => (cur === tab ? null : tab)), [])
  const toggleChatLog = useCallback((tab: ChatLogTab) => setChatLogTab((cur) => (cur === tab ? null : tab)), [])
  const closeChatLog = useCallback(() => setChatLogTab(null), [])
  const chatLogOpen = chatLogTab !== null
  const chromeActions = useMemo(() => ({ sidePanelOpen: chatLogOpen }), [chatLogOpen])
  const activeDrawerTab = drawerTab

  const stripCenter = (
    <TurnOrderRing
      players={game?.players ?? []}
      activePlayerId={game?.activePlayerId ?? ''}
      onSeatClick={spotlightOn ? spotlight.select : seatPillsClickable ? seatFocus.select : undefined}
      selfClickable={spotlightOn}
      focusedId={spotlightOn ? spotlight.mainId : seatPillsClickable ? seatFocus.focusId : null}
    />
  )

  const strip = (
    <GameStrip
      left={
        game && (
          <>
            <div className="game-state" data-testid="game-status">
              <span
                className={`game-turn${turnGlow ? ' turn-glow' : ''}`}
                onAnimationEnd={turnGlow ? clearTurnGlow : undefined}
              >
                {t('game', 'turn')} {game.turn}
              </span>
            </div>
            <PhaseLadder game={game} />
          </>
        )
      }
      center={stripCenter}
      right={
        <>
          <ChatLogToggles active={chatLogTab} onToggle={toggleChatLog} />
          <DrawerToggles
            active={activeDrawerTab}
            onToggle={toggleLegacyDrawer}
            hasActiveMechanics={hasActiveMechanics}
            mechanicsCount={mechanicsCount}
          />
          <GameMenu />
        </>
      }
      dropdown={
        activeDrawerTab && (
          <GameDrawer
            tab={activeDrawerTab}
            onClose={() => setDrawerTab(null)}
          />
        )
      }
    />
  )

  const actionButton = (
    <ActionButton
      game={game}
      feedback={feedback}
      gameId={gameId}
      canPass={canPass}
      onPass={onResolveClick}
      onSkip={sendSkip}
      busy={busy}
    />
  )
  // PRM-19: a mana payment or a target pick leaves the big button with nothing to do ("Loading…"),
  // so the prompt's own action takes that place instead of opening a second box beside it.
  const promptOwnsAction = feedback != null
    && (feedback.mode === 'mana' || feedback.mode === 'combat' || feedback.method === 'GAME_TARGET'
      || isPlainBooleanAsk(feedback))
  const dockButton = promptOwnsAction
    ? <div className="game-dock-action-slot" data-testid="game-dock-action-slot" ref={setActionSlot} />
    : actionButton
  if (narrowScreen && isSpectator && !fullBoardOnNarrow) {
    return (
      <div className="game board-surface game--mobile-spectator" ref={gameRootRef} style={{ zoom: inverseZoom(settings.uiScale) }}>
        <MobileSpectator onFullBoard={() => setFullBoardOnNarrow(true)} />
      </div>
    )
  }

  return (
    <PromptSlotProvider value={promptSlot} hand={handPromptSlot} onHandSlot={setHandPromptSlot} order={orderSlot} actionSlot={actionSlot}>
      <ChromeActionsContext.Provider value={chromeActions}>
      <DividerSlotContext.Provider value={setDividerSlot}>
        <div
          className={`game board-surface${rewindView ? ' game--rewind' : ''}`}
          ref={gameRootRef}
          data-rewind={rewindView ? 'true' : undefined}
          style={{ zoom: inverseZoom(settings.uiScale) }}
        >
          {!dividerSlot && <header className="game-top">{strip}</header>}
          {dividerSlot && createPortal(strip, dividerSlot)}
          <div className="game-body" ref={gameBodyRef} data-space-passes-priority="true">
            <div
              className="board-wrap"
              ref={boardWrapRef}
              data-playmat={playmatId}
              style={{
                // PRM-18: the order is centred on the board being played on, so the side panel of
                // the main board mode (BRD-6) does not push it off to one side.
                '--order-inset-left': spotlightOn ? `${settings.boardSpotlightPanel}%` : '0px',
              } as React.CSSProperties}
            >
              {playmatId !== 'classic' && (
                <div className="playmat-layer" data-playmat={playmatId} data-testid="playmat-layer" style={matStyle} aria-hidden="true" />
              )}
              {spotlightOn ? (
                <SpotlightBoard {...boardProps} homeId={homeId ?? ''} mainId={spotlight.mainId!} onSelectSeat={spotlight.select} />
              ) : (
                <ArenaBoard {...boardProps} />
              )}
              {/* PRM-18: the order being given is read here, across the middle of the board. */}
              <OrderSlot onSlot={setOrderSlot} />
              <LowLifeVignette game={displayGame} />
              {settings.turnRecap && <TurnRecapStrip />}
              <FeedbackOverlay />
              <ImpactOverlay />
              <CoinFlipOverlay />
              <ShuffleOverlay />
              <LibraryPeekOverlay />
              <DiceRollOverlay />
              <DesignationOverlay />
              <ProjectileOverlay />
              <HandRevealOverlay />
              {/* STK-2: the stack is a layer over the board, never a panel in a menu, and it is the
                  same stack in every layout. */}
              {stackCount > 0 && (
                <StackZone
                  stack={displayStack}
                  onCardClick={onTargetClick}
                  targetIds={targetIdSet}
                  players={game?.players}
                  myPlayerId={me?.playerId}
                  onFocusIds={setStackFocus}
                />
              )}
              {chatLogTab && <ChatLogPanel tab={chatLogTab} onTabChange={setChatLogTab} onClose={closeChatLog} />}
              <GameDock
                onPromptSlot={setPromptSlot}
                rewind={(settings.boardRewind || rewind.replay) ? <RewindBar rewind={rewind} /> : null}
                action={dockButton}
              />
            </div>
            <CombatArrowsOverlay
              game={game}
              stackFocusIds={stackFocus}
              boardRef={gameBodyRef}
              targetSourceId={targetSourceId}
              chosenTargetIds={chosenTargetIds}
              combatChosen={combat?.chosen ?? []}
              combatMode={combat?.mode ?? null}
            />
            <TournamentPanel />
          </div>
          <FeedbackDialog />
          <UserRequestDialog />
          <RollbackDialog />
          <RollbackVoteDialog />
          <LimitedDeckDialog />
          <PlayerContextMenu />
          <CardInspector />
          <InfoWindows
            playableIds={playableIdSet}
            onPlayCard={onPlayableClick}
            targetIds={targetIdSet}
            onTargetClick={onTargetClick}
          />
          <SideboardScreen />
        </div>
      </DividerSlotContext.Provider>
      </ChromeActionsContext.Provider>
    </PromptSlotProvider>
  )
}
