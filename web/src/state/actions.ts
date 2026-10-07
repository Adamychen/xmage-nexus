import { getState, setState } from './state'
import * as cmds from '../net/commands'
import type { ChatMessageEvent, DeckJson, GameView } from '../net/types'
import { advanceProgress, dungeonProgressKey, findDungeonGraph, parseDungeonEntry } from '../game/dungeons'
import { clonePhaseStops } from '../game/phaseStops'
import { meaningfulPlayables } from '../game/smartStops'
import { manaPaymentActions } from '../game/manaPayment'
import { serverAutoAnswerActions } from '../game/autoAnswers'
import { gameplayPreset, PRESET_OWNED_KEYS, type GameplayPresetId } from '../settings/gameplayPresets'
import { clearActiveGame, saveSmartStops, saveActiveDeck, saveFxSettings, saveAudioSettings, saveMusicSettings, saveAppearanceSettings, saveAutoAnswers, saveChoiceMemory, saveManaPayment, savePhaseStops, saveGameplayPreset, applyAppearanceToDocument, rememberEquippedDeckId } from './persistence'
import { getLanguage } from '../i18n'
import { translateError } from '../i18n'
import { isControllingPriority } from './control'
import { soundManager } from '../audio/soundManager'
import { resetPromptSound } from '../audio/promptSound'
import type { AppState } from './state'
import {
  ROLLBACK_ACCEPT_ACTION, ROLLBACK_DENY_ACTION, ROLLBACK_PENDING_TTL_MS, rollbackAcceptChatText,
  startOwnRollbackVote, markMyVote, isRollbackVoting, dismissRollbackVote,
} from './rollbackVote'

export function clearError() {
  setState({ error: null })
}

export function setStoreError(error: string) {
  setState({ error })
}

/** Cambia la mano visible de la barra propia (Switch Hands / Mindslaver). */
export function setSwitchedHandKey(key: string | null) {
  setState({ switchedHandKey: key })
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
  rememberEquippedDeckId((deck as { id?: string } | null)?.id ?? null)
  setState({ myDeck: deck, sideboard: deck?.sideboard ?? [] })
}

export function clearGameEnd() {
  const pending = getState().pendingSideboardScreen
  if (pending) {
    setState({ gameEnd: null, sideboardScreen: pending, pendingSideboardScreen: null })
  } else {
    setState({ gameEnd: null })
  }
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
  return exitStagingVia(async (tableId) => {
    const res = await cmds.removeTable(tableId)
    if (!res.ok) setState({ error: translateError(res.error || res.errorCode || 'FAILED', 'removeTable', res.errorCode) })
    return res
  })
}

/** Arranca la partida de la mesa en staging (solo dueño, la UI lo gatea). */
export async function startStagedMatch(): Promise<boolean> {
  const s = getState()
  if (!s.stagingTableId) return false
  const staged = s.lobby?.tables.find((tb) => tb.tableId === s.stagingTableId)
  const isTourney = staged?.isTournament ?? s.stagingIsTournament
  const action = isTourney ? 'startTournament' : 'startMatch'
  setState({ error: null })
  try {
    const res = (isTourney
      ? await cmds.startTournament(s.stagingTableId)
      : await cmds.startMatch(s.stagingTableId)) as { ok?: boolean; error?: string; errorCode?: string }
    if (res?.ok) return true
    setState({ error: translateError(res?.error || res?.errorCode || 'FAILED', action, res?.errorCode) })
    return false
  } catch (e) {
    const err = e as Error & { errorCode?: string }
    setState({ error: translateError(err.message, action, err.errorCode) })
    return false
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
  startOwnRollbackVote(gameId, turnsToRollback)
  const res = await cmds.sendPlayerAction('ROLLBACK_TURNS', gameId, turnsToRollback)
  if (!res.ok) {
    dismissRollbackVote()
    setState({ error: res.error ?? 'Error requesting rollback' })
  } else {
    // El ok del proxy solo confirma el envío: el servidor puede negar después.
    // Armar ya (sin carreras) para aceptar la vista restaurada cuando ejecute.
    armRollbackPending(gameId)
  }
  return res
}

export async function voteRollback(gameId: string, accept: boolean, requesterUserId?: string) {
  const action = accept ? ROLLBACK_ACCEPT_ACTION : ROLLBACK_DENY_ACTION
  const res = await cmds.sendPlayerAction(action, gameId, requesterUserId)
  if (!res.ok) {
    setState({ error: res.error ?? 'Error sending rollback vote' })
    return res
  }
  markMyVote(gameId, accept ? 'accepted' : 'denied')
  if (accept) {
    armRollbackPending(gameId)
    const chatId = getState().gameChatId
    if (chatId) void cmds.sendChatMessage(chatId, rollbackAcceptChatText(getState().game?.turn ?? 0))
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

/** Marca que hay un rollback en curso para gameId: la próxima vista con posición
 * vieja (turno/paso hacia atrás) se acepta como restaurada en vez de descartarse.
 * Se arma con la acción propia (pedir/aceptar) o el anuncio del servidor, y se
 * desarma al consumir, al denegarse o al cerrar la partida. */
export function armRollbackPending(gameId: string | null | undefined): void {
  if (gameId) setState({ rollbackPendingFor: gameId, rollbackPendingAt: Date.now() })
}

export function disarmRollbackPending(): void {
  if (getState().rollbackPendingFor != null) setState({ rollbackPendingFor: null, rollbackPendingAt: null })
}

/** Armed for gameId and still fresh: a vote still on screen keeps it alive;
 * otherwise it expires ROLLBACK_PENDING_TTL_MS after the last arm (request,
 * accept or server announce), so a vote that never resolves cannot later let
 * a stale, out-of-order view overwrite the board. */
export function isRollbackPending(s: Pick<AppState, 'rollbackPendingFor' | 'rollbackPendingAt' | 'rollbackVote'>, gameId: string | null | undefined, now = Date.now()): boolean {
  if (!gameId || s.rollbackPendingFor !== gameId) return false
  if (isRollbackVoting(s.rollbackVote, gameId) && !s.rollbackVote?.hidden) return true
  return s.rollbackPendingAt != null && now - s.rollbackPendingAt < ROLLBACK_PENDING_TTL_MS
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
    turnRecap: null,
    enteredThisTurn: {},
    sideboardScreen: null,
    pendingSideboardScreen: null,
    error: null,
  })
}

export function dismissTurnRecap(key?: string) {
  const current = getState().turnRecap
  if (!current || (key && current.key !== key)) return
  setState({ turnRecap: null })
}

function persistClientSettings(settings: AppState['settings']) {
  const { effects, animationSpeed, soundEnabled, masterVolume, sfxVolume, uiVolume, musicEnabled, musicVolume, sleeveId, playmatId, cardStyle, tapStyle, boardLayout, boardLayoutManual, uiScale, cjkBoost, transparentDialogs, autoAnswers, choiceMemory, manaPayment, phaseStops, smartStops } = settings
  saveFxSettings({ effects, animationSpeed })
  saveAudioSettings({ soundEnabled, masterVolume, sfxVolume, uiVolume })
  saveMusicSettings({ musicEnabled, musicVolume })
  saveAppearanceSettings({ sleeveId, boardLayout, boardLayoutManual, uiScale, cjkBoost, transparentDialogs, playmatId, cardStyle, tapStyle })
  saveAutoAnswers(autoAnswers.map(({ pattern, answer, key }) => (key ? { pattern, answer, key } : { pattern, answer })))
  saveChoiceMemory(choiceMemory.map(({ pattern, value }) => ({ pattern, value })))
  saveManaPayment({ ...manaPayment })
  savePhaseStops({ ...phaseStops })
  saveSmartStops(smartStops)
  try { applyAppearanceToDocument({ sleeveId, boardLayout, uiScale, cjkBoost, transparentDialogs }, getLanguage()) } catch {}
  soundManager.setSettings({ soundEnabled, masterVolume, sfxVolume, uiVolume })
  soundManager.setMusicVolume(musicEnabled ? musicVolume : 0)
}

export function setSetting<K extends keyof AppState['settings']>(key: K, value: AppState['settings'][K]) {
  const next = { ...getState().settings, [key]: value }
  if (key === 'boardLayout') next.boardLayoutManual = true
  if (PRESET_OWNED_KEYS.has(key) && next.gameplayPreset) {
    next.gameplayPreset = null
    saveGameplayPreset(null)
  }
  setState({ settings: next })
  persistClientSettings(next)
  if (key === 'autoAnswers') syncAutoAnswersToServer()
}

/**
 * Deja las respuestas automáticas del servidor (HumanPlayer de XMage) igual que
 * las reglas locales. Solo jugando: un espectador no tiene HumanPlayer.
 */
export function syncAutoAnswersToServer(gameId = getState().gameId) {
  const s = getState()
  if (!gameId || !(s.game?.players ?? []).some((p) => p.controlled)) return
  for (const { action, data } of serverAutoAnswerActions(s.settings.autoAnswers ?? [])) {
    void cmds.sendPlayerAction(action, gameId, data)
  }
}

/** Aplica un preset de automatización completo (maná, auto-pass, paradas) y lo empuja al servidor si hay partida. */
export function applyGameplayPreset(id: GameplayPresetId) {
  const s = getState()
  const preset = gameplayPreset(id)
  const next: AppState['settings'] = { ...s.settings, ...preset.bundle, gameplayPreset: id }
  setState({ settings: next })
  saveGameplayPreset(id)
  persistClientSettings(next)
  if (!s.gameId) return
  for (const action of manaPaymentActions(next.manaPayment)) void cmds.sendManaPaymentMode(action, s.gameId)
  void cmds.updateManaConfirmPreference(next.manaPayment.confirmEmptyPool)
  void cmds.updatePreferences(clonePhaseStops(next.phaseStops))
  void cmds.sendPlayerAction(next.holdPriority ? 'HOLD_PRIORITY' : 'UNHOLD_PRIORITY', s.gameId)
}

let lastSmartAnswer: GameView | null = null

export function maybeAutoPass(game: GameView) {
  const s = getState()
  if (!s.settings.smartStops || s.feedback || !s.gameId) return
  if (isRollbackVoting(s.rollbackVote, s.gameId)) return
  if (isControllingPriority(game)) return
  const me = game.players?.find((p) => p.controlled)
  if (!me?.hasPriority) return
  if (s.combat && s.combat.selectable.length > 0) return
  const request = s.priorityRequest
  if (!request || s.game !== request || request === lastSmartAnswer) return
  if (meaningfulPlayables(game, s.playableIds).length > 0) return
  lastSmartAnswer = request
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
