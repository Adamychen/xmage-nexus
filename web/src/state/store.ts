// ── Re-exports ──────────────────────────────────────────────────────
export type { ConnectionInfo } from './persistence'
export { loadConn, saveActiveGame, clearActiveGame } from './persistence'
export type { LogEntry, CombatState, AppState } from './state'
export { getState, setState } from './state'
export { useStore, usePhase, useLobby, useGame, useSettings, isBlockingModal } from './selectors'
export { attachGateway, detachGateway, doConnect, reset } from './gateway'
export { handleMessage } from './eventHandler'
export { clearError, setStoreError, clearFeedback, setMyDeck, clearGameEnd, returnToLobby, concedeGame, setSetting, maybeAutoPass, setWatchingTable, openStagingTable, hideStaging, leaveStagingTable, removeStagingTable, startStagedMatch, appendLocalChatMessage } from './actions'

// gancho de depuración para E2E (estado del store en vivo)
import { getState as _getState, setState as _setState } from './state'
import { setSetting as _setSetting } from './actions'
;(globalThis as unknown as { __mageStore?: unknown }).__mageStore = {
  getState: _getState,
  setState: _setState,
  setSetting: _setSetting,
}
