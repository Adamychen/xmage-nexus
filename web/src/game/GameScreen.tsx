import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import GameBoard from '../board/GameBoard'
import PodBoard from '../board/PodBoard'
import OpponentSwitcherBar from '../board/OpponentSwitcherBar'
import TurnOrderRing from '../board/TurnOrderRing'
import * as cmds from '../net/commands'
import { returnToLobby, concedeGame, maybeAutoPass, setSetting, setStoreError, useGame, useSettings, useStore, getState } from '../state/store'
import FeedbackDialog from './FeedbackDialog'
import UserRequestDialog from './UserRequestDialog'
import LimitedDeckDialog from './LimitedDeckDialog'
import SideboardScreen from './SideboardScreen'
import DraftScreen from './DraftScreen'
import ConstructScreen from './ConstructScreen'
import Sidebar from './Sidebar'
import GameChat from './GameChat'
import PhaseBar from './PhaseBar'
import ActionButton from './ActionButton'
import ActionFeed from './ActionFeed'
import StackZone from '../board/StackZone'
import CombatArrowsOverlay from '../board/CombatArrowsOverlay'
import MechanicsTray from './MechanicsTray'
import CommanderDamageMatrix from './CommanderDamageMatrix'
import TournamentPanel from './TournamentPanel'
import { resolveTargetSourceId } from './resolveTargetSourceId'
import { crossZonePlayables } from '../board/crossZone'
import { setState } from '../state/state'
import './GameScreen.css'
import './TournamentPanel.css'

export default function GameScreen() {
  const game = useGame()
  const settings = useSettings()
  const gameId = useStore((s) => s.gameId)
  const feedback = useStore((s) => s.feedback)
  const playableIds = useStore((s) => s.playableIds)
  const combat = useStore((s) => s.combat)
  const gameBodyRef = useRef<HTMLDivElement>(null)
  const [rightTab, setRightTab] = useState<'stack' | 'log' | 'commander' | 'mechanics' | 'chat'>('log')
  const [busy, setBusy] = useState(false)
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

  const me = game?.players?.find((p) => p.controlled)
  const canPass = !!gameId && (!!me?.hasPriority || (!!me?.isActive && (!feedback || feedback.mode === 'combat')))
  const targetIds = feedback?.method === 'GAME_TARGET' ? feedback.options.map((option) => option.id) : []
  const chosenTargetIds = feedback?.method === 'GAME_TARGET' ? (feedback.chosenTargets ?? []) : []
  const targetSourceId = game && feedback?.method === 'GAME_TARGET' ? resolveTargetSourceId(game, feedback.sourceName) : undefined

  const onTargetClick = async (id: string) => {
    if (!gameId) return
    const result = await cmds.sendPlayerUUID(id, gameId)
    if (!result.ok) setStoreError(result.error ?? 'No se pudo enviar el objetivo')
  }

  const onPlayableClick = async (id: string, e?: React.MouseEvent) => {
    if (!gameId) return
    if (e?.ctrlKey || e?.metaKey || e?.shiftKey) {
      await cmds.sendPlayerAction('HOLD_PRIORITY', gameId)
    }
    const result = await cmds.sendPlayerUUID(id, gameId)
    if (!result.ok) setStoreError(result.error ?? 'No se pudo jugar la carta')
  }

  const crossZone = crossZonePlayables(game, feedback ?? undefined)

  const onCombatClick = async (id: string) => {
    if (!gameId) return
    const result = await cmds.sendPlayerUUID(id, gameId)
    if (!result.ok) setStoreError(result.error ?? 'No se pudo declarar la criatura en combate')
  }

  const onResolveClick = useCallback(async () => {
    if (!gameId || busy) return
    setBusy(true)
    try {
      const result = await cmds.sendPlayerBoolean(false, gameId)
      if (!result.ok) setStoreError(result.error ?? 'No se pudo pasar prioridad')
    } finally {
      setBusy(false)
    }
  }, [gameId, busy])

  // Espacio activa la acción principal / pasar prioridad
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

  // F4 / F9 alternan el "stop" de fin de turno (tu turno / turno del oponente)
  useEffect(() => {
    const handleStopKeys = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.key !== 'F4' && e.key !== 'F9') return
      e.preventDefault()
      const turn: 'yourTurn' | 'opponentTurn' = e.key === 'F4' ? 'yourTurn' : 'opponentTurn'
      const stops = getState().phaseStops
      const key = 'endStep'
      const next = { ...stops, [turn]: { ...stops[turn], [key]: !stops[turn][key] } }
      setState({ phaseStops: next })
      void cmds.updatePreferences(next)
    }
    window.addEventListener('keydown', handleStopKeys)
    return () => window.removeEventListener('keydown', handleStopKeys)
  }, [])

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

  const hasCommanders = useMemo(() => {
    if (!game?.players) return false
    return game.players.some((p) => {
      const items = Array.isArray(p.commandList) ? p.commandList : Object.values(p.commandList ?? {})
      return items.some((c: any) => c?.mageObjectType === 'COMMANDER' || c?.isCommander)
    })
  }, [game?.players])

  const isMultiplayer = opps.length >= 2
  const isPodLayout = settings.boardLayout === 'pod' || (isMultiplayer && settings.boardLayout !== 'standard')

  return (
    <div className="game">
      <header className="game-top">
        <div className="game-top-left">
          {game && (
            <div className="game-state" data-testid="game-status">
              <span className="game-turn">Turn {game.turn}</span>
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
                opponents={topOpps}
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
          <label className={`toggle hold-priority-toggle ${settings.holdPriority ? 'is-active' : ''}`} title="Retener prioridad al lanzar hechizos o activar habilidades (o mantén Ctrl/Cmd al hacer clic)">
            <input
              type="checkbox"
              checked={settings.holdPriority}
              onChange={(e) => {
                const val = e.target.checked
                setSetting('holdPriority', val)
                if (gameId) void cmds.sendPlayerAction(val ? 'HOLD_PRIORITY' : 'UNHOLD_PRIORITY', gameId)
              }}
            />
            ⚡ Retener prioridad
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.autoKeepMulligan}
              onChange={(e) => setSetting('autoKeepMulligan', e.target.checked)}
            />
            Auto-mulligan
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.autoPass}
              onChange={(e) => setSetting('autoPass', e.target.checked)}
            />
            Auto-pass
          </label>
          {opps.length >= 1 && (
            <button
              type="button"
              className={`layout-toggle-btn ${isPodLayout ? 'is-active' : ''}`}
              title={isPodLayout ? 'Cambiar a layout estándar (un oponente a la vez)' : `Ver todos los tableros en cuadrícula (${opps.length + 1} jugadores)`}
              onClick={() => setSetting('boardLayout', isPodLayout ? 'standard' : 'pod')}
            >
              {isPodLayout ? '⊞ Pod ✓' : '⊞ Pod'}
            </button>
          )}
          <button
            type="button"
            className="leave-game-btn"
            onClick={async () => {
              const isPlayer = !!me
              const msg = isPlayer
                ? '¿Seguro que quieres conceder la partida y volver al lobby?'
                : '¿Dejar de espectar y volver al lobby?'
              if (confirm(msg)) {
                if (isPlayer && gameId) {
                  await concedeGame(gameId)
                } else {
                  returnToLobby()
                }
              }
            }}
            title={me ? 'Conceder la partida y volver al lobby' : 'Volver al lobby'}
          >
            {me ? '🏳️ Conceder' : '🚪 Salir'}
          </button>
        </div>
      </header>
      <div className="game-body" ref={gameBodyRef}>
        <Sidebar />
        <div className="board-wrap">
          {isPodLayout ? (
            <PodBoard
              game={game}
              targetIds={targetIds}
              chosenTargetIds={chosenTargetIds}
              onTargetClick={onTargetClick}
              targetSourceId={targetSourceId}
              playableIds={playableIds}
              onPlayableClick={onPlayableClick}
              combatSelectable={combat?.selectable ?? []}
              combatMode={combat?.mode ?? null}
              combatChosen={combat?.chosen ?? []}
              onCombatClick={onCombatClick}
              crossZonePlayables={crossZone}
              onPlayCrossZone={onPlayableClick}
            />
          ) : (
            <GameBoard
              game={game}
              targetIds={targetIds}
              chosenTargetIds={chosenTargetIds}
              onTargetClick={onTargetClick}
              targetSourceId={targetSourceId}
              playableIds={playableIds}
              onPlayableClick={onPlayableClick}
              combatSelectable={combat?.selectable ?? []}
              combatMode={combat?.mode ?? null}
              combatChosen={combat?.chosen ?? []}
              onCombatClick={onCombatClick}
              crossZonePlayables={crossZone}
              onPlayCrossZone={onPlayableClick}
              focusedOpponentId={currentOpp?.playerId}
            />
          )}
        </div>
        <div className="game-right-panel">
          <div className="right-panel-tabs">
            <button
              type="button"
              className={`right-tab-btn ${rightTab === 'stack' ? 'active' : ''}`}
              onClick={() => setRightTab('stack')}
            >
              Stack
              {stackCount > 0 && <span className="right-tab-badge active-stack">{stackCount}</span>}
            </button>
            <button
              type="button"
              className={`right-tab-btn ${rightTab === 'log' ? 'active' : ''}`}
              onClick={() => setRightTab('log')}
            >
              Log
            </button>
            {hasCommanders && (
              <button
                type="button"
                className={`right-tab-btn ${rightTab === 'commander' ? 'active' : ''}`}
                onClick={() => setRightTab('commander')}
                title="Matriz de daño de comandante"
              >
                👑 CMD
              </button>
            )}
            <button
              type="button"
              className={`right-tab-btn ${rightTab === 'mechanics' ? 'active' : ''}`}
              onClick={() => setRightTab('mechanics')}
            >
              Mecánicas
              {hasActiveMechanics && <span className="right-tab-badge active-mechanics">★</span>}
            </button>
            <button
              type="button"
              className={`right-tab-btn ${rightTab === 'chat' ? 'active' : ''}`}
              onClick={() => setRightTab('chat')}
            >
              Chat
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
      <UserRequestDialog />
      <LimitedDeckDialog />
      <DraftScreen />
      <ConstructScreen />
      <SideboardScreen />
      <TournamentPanel />
    </div>
  )
}
