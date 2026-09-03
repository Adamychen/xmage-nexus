import { getState, setState } from './state'
import * as cmds from '../net/commands'
import type { ChatMessageEvent, DeckJson, GameView } from '../net/types'
import { BASIC_LANDS } from './gameUtils'
import { clearActiveGame, saveFxSettings, saveAudioSettings } from './persistence'
import { soundManager } from '../audio/soundManager'
import type { AppState } from './state'

export function clearError() {
  setState({ error: null })
}

export function setStoreError(error: string) {
  setState({ error })
}

export function clearFeedback() {
  setState({ feedback: null })
}

export function setMyDeck(deck: DeckJson | null) {
  setState({ myDeck: deck, sideboard: deck?.sideboard ?? [] })
}

export function clearGameEnd() {
  setState({ gameEnd: null })
}

export function setWatchingTable(table: import('../net/types').TableView | null) {
  if (table) {
    setState({ phase: 'spectating_pending', watchingTable: table, error: null })
  } else {
    setState({ phase: 'lobby', watchingTable: null, error: null })
  }
}

/** Abre la sala de espera de la partida (paridad con el TableWaitingDialog de desktop). */
export function openStagingTable(tableId: string) {
  setState({ phase: 'staging', stagingTableId: tableId, error: null })
}

/** Vuelve al lobby sin abandonar el asiento (se puede regresar con "Ir a la mesa"). */
export function hideStaging() {
  setState({ phase: 'lobby', error: null })
}

async function exitStagingVia(action: (tableId: string) => Promise<unknown>) {
  const s = getState()
  const tableId = s.stagingTableId
  setState({ phase: 'lobby', stagingTableId: null, error: null })
  if (tableId) {
    try {
      await action(tableId)
    } catch {
      // el servidor puede rechazar el leave si la partida ya arrancó; el lobby queda igualmente
    }
  }
}

export function leaveStagingTable() {
  return exitStagingVia((tableId) => cmds.leaveTable(tableId))
}

export function removeStagingTable() {
  return exitStagingVia((tableId) => cmds.removeTable(tableId))
}

/** Arranca la partida de la mesa en staging (solo dueño, la UI lo gatea). */
export async function startStagedMatch() {
  const s = getState()
  if (!s.stagingTableId) return
  await cmds.startMatch(s.stagingTableId)
}

/**
 * Concede únicamente la partida individual en curso. No abandona el match:
 * si es Bo3 o Bo5 y el match continúa, el servidor enviará END_GAME_INFO y
 * luego SIDEBOARD para preparar la siguiente partida.
 */
export async function concedeGame(gameId: string) {
  await cmds.sendPlayerAction('CONCEDE', gameId)
}

/**
 * Concede y abandona el match por completo, saliendo de la mesa y volviendo al lobby.
 */
export async function concedeMatch(gameId?: string | null) {
  const s = getState()
  const gid = gameId ?? s.gameId
  if (gid) {
    const me = s.game?.players?.find((p) => p.controlled)
    if (me) {
      void cmds.sendPlayerAction('CONCEDE', gid)
      void cmds.quitMatch(gid)
    }
  }
  returnToLobby()
}

export function openRollbackDialog() {
  setState({ rollbackDialogOpen: true })
}

export function closeRollbackDialog() {
  setState({ rollbackDialogOpen: false })
}

export async function requestRollback(gameId: string, turnsToRollback = 0) {
  const res = await cmds.sendPlayerAction('ROLLBACK_TURNS', gameId, turnsToRollback)
  if (!res.ok) {
    setState({ error: res.error ?? 'Error requesting rollback' })
  }
  return res
}

export async function requestUndo(gameId: string) {
  const res = await cmds.sendPlayerAction('UNDO', gameId)
  if (!res.ok) {
    setState({ error: res.error ?? 'Error requesting undo' })
  }
  return res
}

export function returnToLobby() {
  const s = getState()
  const gameId = s.gameId
  clearActiveGame()
  if (gameId) {
    const me = s.game?.players?.find((p) => p.controlled)
    if (!me) {
      void cmds.stopWatching(gameId)
    } else {
      void cmds.quitMatch(gameId)
    }
  }
  if (s.gameChatId) {
    void cmds.leaveChat(s.gameChatId)
  }
  if (s.watchingTable) {
    void cmds.leaveTable(s.watchingTable.tableId)
  }
  if (s.stagingTableId) {
    void cmds.leaveTable(s.stagingTableId)
  }
  // Filter out match-specific chat messages, preserving only lobby room chat
  const preservedChat = s.roomChatId
    ? s.chatMessages.filter((m) => !m.chatId || m.chatId === s.roomChatId)
    : s.chatMessages
  setState({
    phase: 'lobby',
    watchingTable: null,
    stagingTableId: null,
    game: null,
    gameId: null,
    gameChatId: null,
    chatMessages: preservedChat,
    playableIds: [],
    playableWindow: null,
    combat: null,
    feedback: null,
    gameEnd: null,
    sideboardScreen: null,
    error: null,
  })
}

export function setSetting<K extends keyof AppState['settings']>(key: K, value: AppState['settings'][K]) {
  setState({ settings: { ...getState().settings, [key]: value } })
  const { effects, animationSpeed, soundEnabled, masterVolume, sfxVolume, uiVolume } = getState().settings
  saveFxSettings({ effects, animationSpeed })
  saveAudioSettings({ soundEnabled, masterVolume, sfxVolume, uiVolume })
  soundManager.setSettings({ soundEnabled, masterVolume, sfxVolume, uiVolume })
}

export function maybeAutoPass(game: GameView) {
  const s = getState()
  const me = game.players?.find((p) => p.controlled)
  if (!s.settings.autoPass || s.feedback || !me?.hasPriority || !s.gameId) return
  if (s.combat) return
  const myHand = game.myHand ?? {}
  if (Object.keys(myHand).length === 0) return
  if (game.phase === 'PRECOMBAT_MAIN') {
    const playable = s.playableIds.length > 0
    const fallback = game.canPlayObjects?.objects ? Object.keys(game.canPlayObjects.objects).length > 0 : false
    const myTurn = me.isActive === true
    const landInHand = Object.values(myHand).some(
      (c) => BASIC_LANDS.includes(c.name ?? '') || BASIC_LANDS.includes(c.displayName ?? ''),
    )
    if (playable || fallback || (myTurn && landInHand)) return
  }
  void cmds.sendPlayerBoolean(false, s.gameId)
}

export function appendLocalChatMessage(message: string, chatId?: string | null): void {
  const s = getState()
  const localMsg: ChatMessageEvent = {
    chatId: chatId ?? s.roomChatId ?? '',
    username: '',
    message,
    messageType: 'SYSTEM',
  }
  setState({ chatMessages: [...s.chatMessages, localMsg].slice(-300) })
}
