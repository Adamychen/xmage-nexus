import { Gateway } from '../net/Gateway'
import * as cmds from '../net/commands'
import { getState, setState, addLog, initialState } from './state'
import { handleMessage } from './eventHandler'
import { clonePhaseStops } from '../game/phaseStops'
import { saveConn, loadActiveGame, clearActiveGame, loadActiveDraft, clearActiveDraft, type ConnectionInfo } from './persistence'

let gateway: Gateway | null = null
let activeAttempt = 0
let inFlight: { key: string; promise: Promise<void> } | null = null

/** Re-une draft/torneo activos: primero el estado en memoria; tras recargar la
 *  página se re-pinta la última instantánea persistida (el server NO reenvía
 *  DRAFT_INIT a un `joinDraft` tardío: solo llegarán los próximos picks) y se
 *  re-une la sesión del draft para que el flujo siga. Si `joinDraft` falla
 *  (draft ya terminado), se descarta la instantánea para no reintentarla. */
function restoreLimited(): void {
  const persisted = loadActiveDraft()
  if (!getState().draft && persisted?.draft) {
    addLog('conexión', 'Restaurando draft desde la última instantánea…')
    setState({
      draft: persisted.draft,
      lastDraftEventAt: Date.now(),
      lastDraftMethod: persisted.draft.message.draftPickView?.picking ? 'DRAFT_INIT' : null,
    })
  }
  const draftId = getState().draft?.draftId ?? persisted?.draft?.draftId
  const tournamentId = getState().tournament?.tournamentId ?? persisted?.tournamentId ?? null
  if (draftId && draftId !== 'draft') {
    addLog('conexión', 'Restaurando draft en curso…')
    void (cmds.joinDraft(draftId) as Promise<{ ok?: boolean }>).then((r) => {
      if (!r?.ok) {
        clearActiveDraft()
        if (getState().draft?.draftId === draftId) setState({ draft: null })
      }
    })
  }
  if (tournamentId) {
    addLog('conexión', 'Restaurando torneo en curso…')
    void cmds.joinTournament(tournamentId)
  }
}

export function attachGateway(g: Gateway) {
  gateway = g
  g.events.onMessage = handleMessage
  g.events.onOpen = async () => {
    const s = getState()
    setState({ connecting: false, wsAlive: true, error: null })
    if (s.conn && s.phase !== 'connecting') {
      addLog('conexión', 'reconectado: re-logueando…')
      const res = await cmds.connect(
        s.conn.serverHost,
        s.conn.port,
        s.conn.username,
        s.conn.password,
        s.conn.flagName,
        s.conn.avatarId,
      )
      if (res.ok) {
        restoreLimited()
        const active = loadActiveGame()
        if (active?.gameId) {
          if (active.role === 'watcher') {
            addLog('conexión', 'Restaurando modo espectador…')
            void cmds.watchGame(active.gameId).then((r) => {
              if (!r?.ok) clearActiveGame()
            })
          } else {
            addLog('conexión', 'Restaurando partida en curso…')
            setState({ resumingGameId: active.gameId })
            void cmds.joinGame(active.gameId).then((r) => {
              if (!r?.ok) {
                clearActiveGame()
                setState({ resumingGameId: null })
              }
            })
          }
          void cmds.getGameChatId(active.gameId).then((cid) => setState({ gameChatId: cid ?? null }))
        }
      }
    }
  }
  g.events.onClose = (reason) => {
    setState({ connecting: false, wsAlive: false })
    addLog('conexión', `desconectado: ${reason}`)
  }
}

export function detachGateway() {
  if (gateway) {
    gateway.close()
    gateway = null
  }
}

export function getGateway(): Gateway | null {
  return gateway
}

export function doConnect(
  wsHost: string,
  proxyPort: number,
  serverHost: string,
  port: number,
  username: string,
  password: string,
  flagName?: string,
  avatarId?: number,
): Promise<void> {
  // StrictMode monta App dos veces en dev: sin dedupe, el segundo intento
  // desconecta el WS del primero, que a los 5 s rechaza y pisa el estado del
  // login que sí funcionó (vuelta al login con "no se pudo conectar").
  const key = `${wsHost}|${proxyPort}|${serverHost}|${port}|${username}`
  if (inFlight?.key === key) return inFlight.promise
  const attempt = ++activeAttempt
  const promise = runConnect(attempt, wsHost, proxyPort, serverHost, port, username, password, flagName, avatarId)
  inFlight = { key, promise }
  void promise.finally(() => {
    if (inFlight?.promise === promise) inFlight = null
  })
  return promise
}

async function runConnect(
  attempt: number,
  wsHost: string,
  proxyPort: number,
  serverHost: string,
  port: number,
  username: string,
  password: string,
  flagName?: string,
  avatarId?: number,
): Promise<void> {
  // Un intento anterior (p.ej. auto-connect lento) no puede volver a 'idle' ni
  // escribir un error encima del intento vigente que ya logueó.
  const stale = () => attempt !== activeAttempt
  const conn: ConnectionInfo = { wsHost, proxyPort, serverHost, port, username, password, flagName, avatarId }
  setState({ phase: 'connecting', conn, connecting: true, error: null })
  detachGateway()
  const g = new Gateway()
  attachGateway(g)
  cmds.setGateway(g)
  const url = `ws://${wsHost}:${proxyPort}`
  setState({ wsUrl: url })
  try {
    await g.connect(url)
  } catch (e) {
    if (stale()) return
    setState({ phase: 'idle', connecting: false, error: `no se pudo conectar al proxy en ${url}: ${(e as Error).message}` })
    return
  }
  if (stale()) return
  const res = await cmds.connect(serverHost, port, username, password, flagName, avatarId)
  if (stale()) return
  if (!res.ok && /already connected|already logged in/i.test(res.error ?? '')) {
    await cmds.disconnect()
    await new Promise((r) => setTimeout(r, 500))
    if (stale()) return
    return runConnect(attempt, wsHost, proxyPort, serverHost, port, username, password, flagName, avatarId)
  }
  if (res.ok) {
    setState({ phase: 'lobby', connecting: false, error: null, conn })
    saveConn(conn)
    restoreLimited()
    const active = loadActiveGame()
    if (active?.gameId) {
      if (active.role === 'watcher') {
        addLog('conexión', 'Restaurando modo espectador…')
        void cmds.watchGame(active.gameId).then((r) => {
          if (!r?.ok) clearActiveGame()
        })
      } else {
        addLog('conexión', 'Restaurando partida en curso…')
        setState({ resumingGameId: active.gameId })
        void cmds.joinGame(active.gameId).then((r) => {
          if (!r?.ok) {
            clearActiveGame()
            setState({ resumingGameId: null })
          }
        })
      }
      void cmds.getGameChatId(active.gameId).then((cid) => setState({ gameChatId: cid ?? null }))
    }
    const chatId = await cmds.getRoomChatId()
    if (stale()) return
    setState({ roomChatId: chatId ?? null })
    void cmds.updatePreferences(clonePhaseStops(getState().settings.phaseStops))
  } else {
    setState({ phase: 'idle', connecting: false, error: res.error ?? 'login fallido' })
  }
}

export function reset() {
  activeAttempt++
  inFlight = null
  gateway?.close()
  saveConn(null)
  clearActiveGame()
  clearActiveDraft()
  setState(initialState)
}
