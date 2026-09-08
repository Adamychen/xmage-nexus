import { getState, setState } from './state'
import * as cmds from '../net/commands'
import type { ChatMessageEvent, DeckJson, GameView } from '../net/types'
import { BASIC_LANDS } from './gameUtils'
import { advanceProgress, dungeonProgressKey, findDungeonGraph, parseDungeonEntry } from '../game/dungeons'
import { clearActiveGame, saveActiveDeck, saveFxSettings, saveAudioSettings, saveAppearanceSettings, saveAutoAnswers, saveChoiceMemory, saveManaPayment, savePhaseStops, applyAppearanceToDocument } from './persistence'
import { getLanguage } from '../i18n'
import { soundManager } from '../audio/soundManager'
import { resetPromptSound } from '../audio/promptSound'
import type { AppState } from './state'

export function clearError() {
  setState({ error: null })
}

export function setStoreError(error: string) {
  setState({ error })
}

export function clearFeedback() {
  resetPromptSound()
  setState({ feedback: null })
}

/** Record a resolved venture-into-the-dungeon branch choice (client-side tracking). */
export function recordDungeonRoom(gameId: string, player: string, dungeon: string, room: string) {
  const graph = findDungeonGraph(dungeon)
  const key = dungeonProgressKey(gameId, player, graph ? graph.id : dungeon)
  const prev = getState().dungeonProgress[key] ?? []
  setState({ dungeonProgress: { ...getState().dungeonProgress, [key]: advanceProgress(prev, room) } })
}

/** Sniff server dungeon-entry broadcasts (all players, including opponents). */
export function sniffDungeonEntry(message: string, gameId: string | null) {
  if (!gameId) return
  const entry = parseDungeonEntry(message)
  if (!entry) return
  recordDungeonRoom(gameId, entry.player, entry.dungeon, entry.room)
}

export function setMyDeck(deck: DeckJson | null) {
  saveActiveDeck(deck)
  setState({ myDeck: deck, sideboard: deck?.sideboard ?? [] })
}

export function clearGameEnd() {
  setState({ gameEnd: null })
}

export function setWatchingTable(table: import('../net/types').TableView | null) {
  if (table) {
    setState({ phase: 'spectating_pending', watchingTable: table, error: null })
    void enterTableChat(table.tableId)
  } else {
    setState({ phase: 'lobby', watchingTable: null, error: null })
    exitTableChat()
  }
}

/** Une al chat propio de la mesa (U4-11, paridad con el chatPanel del TableWaitingDialog). */
export async function enterTableChat(tableId: string) {
  const s = getState()
  if (s.tableChatTableId === tableId && s.tableChatId) return
  exitTableChat()
  try {
    const cid = await cmds.getTableChatId(tableId)
    if (!cid) return
    if (getState().tableChatTableId) return
    setState({ tableChatId: cid, tableChatTableId: tableId })
    void cmds.joinChat(cid)
  } catch {
    // sin chat de mesa (torneo u otra causa): la sala degrada al chat global
  }
}

/** Abandona el chat de la mesa y limpia el estado. */
export function exitTableChat() {
  const s = getState()
  if (s.tableChatId) void Promise.resolve(cmds.leaveChat(s.tableChatId)).catch(() => {})
  if (s.tableChatId || s.tableChatTableId) setState({ tableChatId: null, tableChatTableId: null })
}

/** Une al chat propio del torneo (T4, paridad con el chatPanel del TournamentPanel). */
export async function enterTournamentChat(tournamentId: string) {
  const s = getState()
  if (s.tournamentChatTournamentId === tournamentId && s.tournamentChatId) return
  exitTournamentChat()
  try {
    const cid = await cmds.getTournamentChatId(tournamentId)
    if (!cid) return
    if (getState().tournamentChatTournamentId) return
    setState({ tournamentChatId: cid, tournamentChatTournamentId: tournamentId })
    void cmds.joinChat(cid)
  } catch {
    // sin chat de torneo: el panel degrada a solo bracket
  }
}

/** Abandona el chat del torneo y limpia el estado. */
export function exitTournamentChat() {
  const s = getState()
  if (s.tournamentChatId) void Promise.resolve(cmds.leaveChat(s.tournamentChatId)).catch(() => {})
  if (s.tournamentChatId || s.tournamentChatTournamentId) setState({ tournamentChatId: null, tournamentChatTournamentId: null })
}

/** Abre la sala de espera de la partida (paridad con el TableWaitingDialog de desktop). */
export function openStagingTable(tableId: string) {
  const t = getState().lobby?.tables.find((tb) => tb.tableId === tableId)
  setState({ phase: 'staging', stagingTableId: tableId, stagingIsTournament: t?.isTournament ?? false, error: null })
  void enterTableChat(tableId)
}

/** Vuelve al lobby sin abandonar el asiento (se puede regresar con "Ir a la mesa"). */
export function hideStaging() {
  setState({ phase: 'lobby', error: null })
}

async function exitStagingVia(action: (tableId: string) => Promise<unknown>) {
  const s = getState()
  const tableId = s.stagingTableId
  exitTableChat()
  setState({ phase: 'lobby', stagingTableId: null, stagingIsTournament: false, error: null })
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
  const staged = s.lobby?.tables.find((tb) => tb.tableId === s.stagingTableId)
  if (staged?.isTournament ?? s.stagingIsTournament) {
    await cmds.startTournament(s.stagingTableId)
  } else {
    await cmds.startMatch(s.stagingTableId)
  }
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
  exitTableChat()
  exitTournamentChat()
  // Filter out match-specific chat messages, preserving only lobby room chat
  const preservedChat = s.roomChatId
    ? s.chatMessages.filter((m) => !m.chatId || m.chatId === s.roomChatId)
    : s.chatMessages
  setState({
    phase: 'lobby',
    watchingTable: null,
    stagingTableId: null,
    stagingIsTournament: false,
    tableChatId: null,
    tableChatTableId: null,
    tournamentChatId: null,
    tournamentChatTournamentId: null,
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
  const { effects, animationSpeed, soundEnabled, masterVolume, sfxVolume, uiVolume, sleeveId, boardLayout, uiScale, cjkBoost, autoAnswers, choiceMemory, manaPayment, phaseStops } = getState().settings
  saveFxSettings({ effects, animationSpeed })
  saveAudioSettings({ soundEnabled, masterVolume, sfxVolume, uiVolume })
  saveAppearanceSettings({ sleeveId, boardLayout, uiScale, cjkBoost })
  saveAutoAnswers(autoAnswers.map(({ pattern, answer }) => ({ pattern, answer })))
  saveChoiceMemory(choiceMemory.map(({ pattern, value }) => ({ pattern, value })))
  saveManaPayment({ ...manaPayment })
  savePhaseStops({ ...phaseStops })
  try { applyAppearanceToDocument({ sleeveId, boardLayout, uiScale, cjkBoost }, getLanguage()) } catch {}
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
