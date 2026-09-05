import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import GameBoard from '../board/GameBoard'
import PodBoard from '../board/PodBoard'
import ArenaBoard from '../board/ArenaBoard'
import OpponentSwitcherBar from '../board/OpponentSwitcherBar'
import TurnOrderRing from '../board/TurnOrderRing'
import * as cmds from '../net/commands'
import { maybeAutoPass, setStoreError, useGame, useSettings, useStore } from '../state/store'
import FeedbackDialog from './FeedbackDialog'
import UserRequestDialog from './UserRequestDialog'
import RollbackDialog from './RollbackDialog'
import LimitedDeckDialog from './LimitedDeckDialog'
import SideboardScreen from './SideboardScreen'
import DraftScreen from './DraftScreen'
import ConstructScreen from './ConstructScreen'
import GameMenu from './GameMenu'
import GameChat from './GameChat'
import PhaseBar from './PhaseBar'
import ActionButton from './ActionButton'
import PriorityOrb from './PriorityOrb'
import ActionFeed from './ActionFeed'
import StackZone from '../board/StackZone'
import CombatArrowsOverlay from '../board/CombatArrowsOverlay'
import FeedbackOverlay from '../board/FeedbackOverlay'
import { applyFxRoot } from '../board/fx'
import { hasCommanders as hasCommandersInGame } from '../board/commanders'
import MechanicsTray from './MechanicsTray'
import CommanderDamageMatrix from './CommanderDamageMatrix'
import TournamentPanel from './TournamentPanel'
import { resolveTargetSourceId } from './resolveTargetSourceId'
import { crossZonePlayables } from '../board/crossZone'
import { combatActorsFrom } from '../state/gameUtils'
import { useTranslation } from '../i18n'
import { soundManager } from '../audio/soundManager'
import { CANCEL_SKIP_ACTION, CANCEL_SKIP_SHORTCUT, skipForShortcut } from './skips'
import ManaPoolConfirmDialog from './ManaPoolConfirmDialog'
import { poolTotal, shouldConfirmEmptyPool } from './manaPayment'
import './GameScreen.css'
import './TournamentPanel.css'
import './ManaPoolConfirmDialog.css'

export default function GameScreen() {
  const { t } = useTranslation()
  const game = useGame()
  const settings = useSettings()
  const gameId = useStore((s) => s.gameId)
  const feedback = useStore((s) => s.feedback)
  const playableIds = useStore((s) => s.playableIds)
  const combat = useStore((s) => s.combat)
  const gameBodyRef = useRef<HTMLDivElement>(null)
  const [rightTab, setRightTab] = useState<'stack' | 'log' | 'commander' | 'mechanics' | 'chat'>('log')
  const [busy, setBusy] = useState(false)
  const [pendingPass, setPendingPass] = useState<{ kind: 'resolve' } | { kind: 'skip', action: string } | null>(null)
  const stackCount = Object.keys(game?.stack ?? {}).length
  const prevStackCountRef = useRef(0)

  useEffect(() => {
    if (stackCount > 0 && prevStackCountRef.current === 0) {
      setRightTab('stack')
    }
    prevStackCountRef.current = stackCount
  }, [stackCount])

  useEffect(() => {
    if (game) maybeAutoPass(game)
  }, [game])

  useEffect(() => {
    applyFxRoot()
  }, [settings.effects, settings.animationSpeed])

  const me = game?.players?.find((p) => p.controlled)
  const priorityPlayer = game?.players?.find((p) => p.hasPriority) ?? game?.players?.find((p) => p.isActive)
  const timerSecs = priorityPlayer?.priorityTimeLeftSecs ?? 0
  const isTimerTicking = !!priorityPlayer?.hasPriority

  useEffect(() => {
    if (isTimerTicking && timerSecs <= 10 && timerSecs > 0) {
      soundManager.play('timer_tick', 'game')
    }
  }, [timerSecs, isTimerTicking])
  const canPass = !!gameId && (!!me?.hasPriority || (!!me?.isActive && (!feedback || feedback.mode === 'combat')))
  const targetIds = feedback?.method === 'GAME_TARGET' ? feedback.options.map((option) => option.id) : []
  const chosenTargetIds = feedback?.method === 'GAME_TARGET' ? (feedback.chosenTargets ?? []) : []
  const targetSourceId = game && feedback?.method === 'GAME_TARGET' ? resolveTargetSourceId(game, feedback.sourceName) : undefined
  const combatActors = useMemo(() => combatActorsFrom(game), [game])

  const onTargetClick = async (id: string) => {
    if (!gameId) return
    const result = await cmds.sendPlayerUUID(id, gameId)
    if (!result.ok) setStoreError(result.error ?? t('errors', 'send_failed_target'))
  }

  const onPlayableClick = async (id: string, e?: React.MouseEvent) => {
    if (!gameId) return
    if (e?.ctrlKey || e?.metaKey || e?.shiftKey) {
      await cmds.sendPlayerAction('HOLD_PRIORITY', gameId)
    }
    const result = await cmds.sendPlayerUUID(id, gameId)
    if (!result.ok) setStoreError(result.error ?? t('errors', 'send_failed'))
  }

  const crossZone = crossZonePlayables(game, feedback ?? undefined)

  const onCombatClick = async (id: string) => {
    if (!gameId) return
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
    if (shouldConfirmEmptyPool(me?.manaPool, settings.manaPayment)) {
      setPendingPass({ kind: 'resolve' })
      return
    }
    setBusy(true)
    try {
      const result = await cmds.sendPlayerBoolean(false, gameId)
      if (!result.ok) setStoreError(result.error ?? t('errors', 'send_failed'))
    } finally {
      setBusy(false)
    }
  }, [gameId, busy, t, me?.manaPool, settings.manaPayment])

  // Space activates main action / pass priority
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
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
    if (action !== CANCEL_SKIP_ACTION && shouldConfirmEmptyPool(me?.manaPool, settings.manaPayment)) {
      setPendingPass({ kind: 'skip', action })
      return
    }
    setBusy(true)
    try {
      const result = await cmds.sendPlayerAction(action, gameId)
      if (!result.ok) setStoreError(result.error ?? t('errors', 'send_failed'))
    } finally {
      setBusy(false)
    }
  }, [gameId, busy, t, me?.manaPool, settings.manaPayment])

  const confirmPendingPass = useCallback(async () => {
    const pending = pendingPass
    setPendingPass(null)
    if (!pending || !gameId || busy) return
    setBusy(true)
    try {
      const result =
        pending.kind === 'resolve'
          ? await cmds.sendPlayerBoolean(false, gameId)
          : await cmds.sendPlayerAction(pending.action, gameId)
      if (!result.ok) setStoreError(result.error ?? t('errors', 'send_failed'))
    } finally {
      setBusy(false)
    }
  }, [pendingPass, gameId, busy, t])

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
    if (!game?.players) return false
    return game.players.some((p) => {
      const items = Array.isArray(p.commandList)
        ? p.commandList
        : Object.values(p.commandList ?? {})
      const hasRing = items.some((c: any) => String(c?.name ?? '').toLowerCase().includes('the ring'))
      const hasDungeon = items.some(
        (c: any) => Array.isArray(c?.cardTypes) && c.cardTypes.map((t: string) => String(t).toLowerCase()).includes('dungeon')
      )
      const hasDayNight = p.designationNames?.some((d) => d.toLowerCase().includes('day') || d.toLowerCase().includes('night'))
      const hasMonarch = !!p.monarch
      const hasInitiative = !!p.initiative
      const hasBlessing = p.designationNames?.some((d) => d.toLowerCase().includes('blessing'))
      const hasSpeed = p.designationNames?.some((d) => d.toLowerCase().includes('speed'))
      return hasRing || hasDungeon || hasDayNight || hasMonarch || hasInitiative || hasBlessing || hasSpeed
    })
  }, [game?.players])

  const hasCommanders = useMemo(() => hasCommandersInGame(game), [game])

  const isMultiplayer = opps.length >= 2
  const isArenaLayout = settings.boardLayout === 'arena' && isMultiplayer
  const isPodLayout = !isArenaLayout && (settings.boardLayout === 'pod' || (isMultiplayer && settings.boardLayout !== 'standard' && settings.boardLayout !== 'arena'))

  return (
    <div className="game">
      <header className="game-top">
        <div className="game-top-left">
          {game && (
            <div className="game-state" data-testid="game-status">
              <span className="game-turn">{t('game', 'turn')} {game.turn}</span>
              <PhaseBar step={game.step} />
            </div>
          )}
        </div>
        <div className="game-top-center">
          {isPodLayout ? (
            <TurnOrderRing players={game?.players ?? []} activePlayerId={game?.activePlayerId ?? ''} />
          ) : (
            topOpps.length > 1 && (
              <OpponentSwitcherBar
                players={game?.players ?? []}
                controlledId={me?.playerId}
                selectedOppId={currentOpp?.playerId || ''}
                onSelectOpponent={(id) => setSelectedOppId(id)}
                activePlayerId={game?.activePlayerId}
                targetIds={new Set(targetIds)}
                onTargetClick={onTargetClick}
                combat={game?.combat ?? []}
              />
            )
          )}
        </div>
        <div className="game-controls">
          <GameMenu />
        </div>
      </header>
      <div className="game-body" ref={gameBodyRef}>
        <div className="board-wrap">
          {isArenaLayout ? (
            <ArenaBoard {...boardProps} />
          ) : isPodLayout ? (
            <PodBoard {...boardProps} />
          ) : (
            <GameBoard {...boardProps} focusedOpponentId={currentOpp?.playerId} />
          )}
          <PriorityOrb
            game={game}
            feedback={feedback}
            canPass={canPass}
            onPass={onResolveClick}
            busy={busy}
          />
          <FeedbackOverlay />
        </div>
        <div className="game-right-panel">
          <div className="right-panel-tabs">
            <button
              type="button"
              className={`right-tab-btn ${rightTab === 'stack' ? 'active' : ''}`}
              onClick={() => setRightTab('stack')}
            >
              {t('game', 'tab_stack')}
              {stackCount > 0 && <span className="right-tab-badge active-stack">{stackCount}</span>}
            </button>
            <button
              type="button"
              className={`right-tab-btn ${rightTab === 'log' ? 'active' : ''}`}
              onClick={() => setRightTab('log')}
            >
              {t('game', 'tab_log')}
            </button>
            {hasCommanders && (
              <button
                type="button"
                className={`right-tab-btn ${rightTab === 'commander' ? 'active' : ''}`}
                onClick={() => setRightTab('commander')}
                title={t('game', 'commander_damage')}
              >
                👑 {t('game', 'tab_commander')}
              </button>
            )}
            <button
              type="button"
              className={`right-tab-btn ${rightTab === 'mechanics' ? 'active' : ''}`}
              onClick={() => setRightTab('mechanics')}
            >
              {t('game', 'tab_mechanics')}
              {hasActiveMechanics && <span className="right-tab-badge active-mechanics">★</span>}
            </button>
            <button
              type="button"
              className={`right-tab-btn ${rightTab === 'chat' ? 'active' : ''}`}
              onClick={() => setRightTab('chat')}
            >
              {t('game', 'tab_chat')}
            </button>
          </div>

          <div className="right-panel-content">
            {rightTab === 'stack' ? (
              <StackZone
                stack={game?.stack ?? null}
                onCardClick={onTargetClick}
                targetIds={new Set(targetIds)}
                onResolveClick={onResolveClick}
                canResolve={canPass}
                players={game?.players}
                myPlayerId={me?.playerId}
              />
            ) : rightTab === 'log' ? (
              <ActionFeed />
            ) : rightTab === 'commander' ? (
              <div className="sidebar-commander-tab">
                <CommanderDamageMatrix game={game} />
              </div>
            ) : rightTab === 'mechanics' ? (
              <MechanicsTray />
            ) : (
              <GameChat />
            )}
          </div>

          <ActionButton
            game={game}
            feedback={feedback}
            gameId={gameId}
            canPass={canPass}
            onPass={onResolveClick}
            onSkip={sendSkip}
            busy={busy}
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
      {pendingPass && (
        <ManaPoolConfirmDialog
          count={poolTotal(me?.manaPool)}
          onConfirm={() => void confirmPendingPass()}
          onCancel={() => setPendingPass(null)}
        />
      )}
      <UserRequestDialog />
      <RollbackDialog />
      <LimitedDeckDialog />
      <DraftScreen />
      <ConstructScreen />
      <SideboardScreen />
      <TournamentPanel />
    </div>
  )
}
