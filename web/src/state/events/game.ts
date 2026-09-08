import * as cmds from '../../net/commands'
import type { GameEndInfo } from '../../net/types'
import { parseFeedback } from '../../game/feedback'
import { manaPaymentActions } from '../../game/manaPayment'
import { clonePhaseStops } from '../../game/phaseStops'
import { getState, setState, addLog } from '../state'
import { sniffDungeonEntry, enterTableChat, exitTableChat } from '../actions'
import { t as tStatic } from '../../i18n'
import { saveActiveGame, clearActiveGame } from '../persistence'
import {
  consolidatePlayables, combatFromSelect,
  isCombatStep, combatChosenFrom, emptyCombat,
} from '../gameUtils'
import { soundManager } from '../../audio/soundManager'
import { notifyFeedbackOpened } from '../../audio/promptSound'
import { gameLogStore, toSavedEntries } from '../../system/gameLogs'
import type { Snapshot, EmbeddedGame } from './context'

export function handleJoinedTable(data: unknown, s: Snapshot): void {
  const d = data as { roomId?: string; tableId?: string; currentTableId?: string; parentTableId?: string; tableName?: string; flag?: boolean } | null
  const tableId = d?.currentTableId ?? d?.tableId ?? null
  const name = d?.tableName ?? tableId ?? ''
  addLog('mesa', `${tStatic('lobby','join_human_btn')} "${name}"`)
  if (tableId && (s.phase === 'lobby' || s.phase === 'staging')) {
    setState({ phase: 'staging', stagingTableId: tableId, stagingIsTournament: d?.flag === true, error: null })
    void enterTableChat(tableId)
  }
}

export function handleStartGame(data: unknown, s: Snapshot): void {
  soundManager.play('game_start', 'ui')
  const d = data as { gameId?: string; tableName?: string } | null
  const isNewGame = !!d?.gameId && d.gameId !== s.gameId
  if (d?.gameId) saveActiveGame(d.gameId)
  exitTableChat()
  setState({ phase: 'game', watchingTable: null, stagingTableId: null, stagingIsTournament: false, gameId: d?.gameId ?? null, gameChatId: null, gameEnd: null, sideboardScreen: null })
  addLog('partida', `${tStatic('lobby','start_match_btn')}${d?.tableName ? ` (${d.tableName})` : ''}`)
  if (isNewGame) {
    void cmds.joinGame(d!.gameId!)
    void cmds.getGameChatId(d!.gameId!).then((cid) => {
      setState({ gameChatId: cid ?? null })
      if (cid) void cmds.joinChat(cid)
    })
  }
}

export function handleGameUpdate(method: string, objectId: string | null, data: unknown, embeddedGame: EmbeddedGame | null, s: Snapshot): void {
  if (objectId) saveActiveGame(objectId)
  if (method === 'GAME_UPDATE_AND_INFORM' && (data as any)?.message) {
    addLog('partida', (data as any).message, objectId ?? undefined)
    sniffDungeonEntry((data as any).message, objectId ?? s.gameId)
  }
  if (embeddedGame) {
    const fresh = getState()
    const { ids, window: playableWindow } = consolidatePlayables(
      embeddedGame, method, fresh.feedback, fresh.playableIds, fresh.playableWindow,
    )
    const patch: Partial<typeof s> = { playableIds: ids, playableWindow }
    if (method === 'GAME_INIT') {
      patch.gameEnd = null
      patch.feedback = null
      if (objectId && !fresh.gameChatId) {
        void cmds.getGameChatId(objectId).then((cid) => {
          setState({ gameChatId: cid ?? null })
          if (cid) void cmds.joinChat(cid)
        })
      }
      if (objectId && (embeddedGame.players ?? []).some((p) => p.controlled)) {
        for (const action of manaPaymentActions(getState().settings.manaPayment)) {
          void cmds.sendManaPaymentMode(action, objectId)
        }
        void cmds.updateManaConfirmPreference(getState().settings.manaPayment.confirmEmptyPool)
        const sessionStops = clonePhaseStops(getState().settings.phaseStops)
        patch.phaseStops = sessionStops
        void cmds.updatePreferences(sessionStops)
      }
    }
    if (method === 'GAME_SELECT') {
      const selectFeedback = parseFeedback(method, objectId ?? s.gameId, data)
      if (selectFeedback) notifyFeedbackOpened(selectFeedback)
      patch.feedback = selectFeedback ?? null
    } else if ((method === 'GAME_UPDATE' || method === 'GAME_UPDATE_AND_INFORM') && fresh.feedback?.method === 'GAME_PLAY_MANA') {
      if (Object.keys(embeddedGame.stack ?? {}).length > 0) {
        patch.feedback = null
      }
    }
    const combat = method === 'GAME_SELECT' ? combatFromSelect(data, embeddedGame) : null
    patch.combat = combat
    if (!combat && embeddedGame && isCombatStep(embeddedGame)) {
      const mode: 'attack' | 'block' = embeddedGame.step === 'DECLARE_BLOCKERS' ? 'block' : 'attack'
      patch.combat = { ...(s.combat ?? emptyCombat()), mode, chosen: combatChosenFrom(embeddedGame, mode) }
    }
    setState(patch)
  }
}

export function handleWatchGame(objectId: string | null): void {
  if (objectId) {
    saveActiveGame(objectId, undefined, 'watcher')
    void cmds.watchGame(objectId)
    setState({ phase: 'spectating_pending', gameId: objectId, watchingTable: null })
  }
  addLog('partida', `Espectador: mirando la partida ${objectId?.slice(0, 8) ?? ''}…`)
}

export function handleGameInform(data: unknown, objectId: string | null): void {
  const d = data as { message?: string } | string | null
  const msg = typeof d === 'string' ? d : d?.message
  if (msg) {
    sniffDungeonEntry(msg, objectId ?? getState().gameId)
    addLog('partida', msg, objectId ?? undefined)
  }
}

export function handleGameOver(data: unknown, objectId: string | null): void {
  const d = data as { gameId?: string; winnerName?: string; message?: string } | string | null
  const msg = typeof d === 'string' ? d : (d?.message ?? 'Fin de la partida')
  clearActiveGame()
  addLog('partida', msg, objectId ?? undefined)
  autosaveGameLog(objectId ?? getState().gameId, msg)

  const fresh = getState()
  const me = fresh.game?.players?.find((p) => p.controlled)
  const won = (typeof d === 'object' && !!d?.winnerName && d.winnerName === me?.name) || false
  soundManager.play(won ? 'victory' : 'defeat', 'game')
  if (!me || !fresh.gameEnd) {
    const syntheticEnd: GameEndInfo = {
      gameInfo: msg,
      matchInfo: msg,
      won: false,
      matchView: {
        endTime: new Date().toISOString(),
        result: msg,
      },
    }
    setState({ gameEnd: syntheticEnd })
  }
}

export function handleEndGameInfo(data: unknown): void {
  const end = (data ?? {}) as GameEndInfo
  const matchOver = end.matchView?.endTime != null || /won the match/i.test(end.matchInfo ?? '')
  addLog('partida', matchOver ? (end.matchInfo ?? 'Fin del match') : (end.matchInfo ?? 'Fin de la partida'))
  if (matchOver) {
    autosaveGameLog(getState().gameId, end.matchInfo ?? end.gameInfo ?? 'Fin del match')
    clearActiveGame()
    setState({
      game: null,
      gameId: null,
      gameChatId: null,
      playableIds: [],
      playableWindow: null,
      combat: null,
      feedback: null,
      phase: 'lobby',
      gameEnd: end,
    })
  } else {
    setState({ gameEnd: end })
  }
}

export function handleGameError(data: unknown, objectId: string | null): void {
  const d = data as { message?: string } | string | null
  const text = typeof d === 'string' ? d : (d?.message ?? JSON.stringify(d))
  if (text) {
    setState({ error: text })
    addLog('error', text, objectId ?? undefined)
  }
}

export function handleRedrawGui(): void {
  addLog('partida', 'Redibujar GUI')
}

function autosaveGameLog(gameId: string | null, title: string): void {
  try {
    const s = getState()
    if (!s.settings.gameLogAutoSave) return
    const entries = toSavedEntries(
      s.log.filter((e) => !gameId || !e.gameId || e.gameId === gameId),
    )
    if (entries.length === 0) return
    void gameLogStore.save({ gameId, title, entries }).catch(() => {})
  } catch {}
}
