import { Gateway } from '../net/Gateway'
import * as cmds from '../net/commands'
import { getState, setState, addLog, initialState } from './state'
import { handleMessage } from './eventHandler'
import { clonePhaseStops } from '../game/phaseStops'
import { saveConn, loadActiveGame, clearActiveGame, loadActiveDraft, clearActiveDraft, saveResumeToken, loadResumeToken, clearResumeToken, type ConnectionInfo } from './persistence'
import { resetGameEventOrder } from './gameUtils'
import { t } from '../i18n'
import type { ProxyMessage, ServerLinkEnvelope } from '../net/types'

let gateway: Gateway | null = null
let activeAttempt = 0
let inFlight: { key: string; promise: Promise<void> } | null = null

/** "Already connected" retries: the server may still hold the account's previous session
 *  (a dropped connection, an IP change, a restarted proxy) and hands it over on its own or
 *  when the restore id matches, but when the account is logged in elsewhere it never clears,
 *  so the retries are capped instead of looping forever. The wait doubles each time
 *  (2+4+8+16 ≈ 30 s in total) and the connecting splash shows it counting down. */
export const ALREADY_CONNECTED_RETRIES = 4
const ALREADY_CONNECTED_BASE_DELAY_MS = 2000

/** The game we tried to rejoin is gone (ended while we were away): leave its
 *  board instead of showing a frozen table. */
function abandonResume(gameId: string): void {
  clearActiveGame()
  const s = getState()
  if (s.gameId === gameId && s.phase === 'game') {
    setState({
      phase: 'lobby', game: null, gameId: null, gameChatId: null, playableIds: [], playableWindow: null,
      combat: null, feedback: null, turnRecap: null, enteredThisTurn: {}, resumingGameId: null,
    })
  } else {
    setState({ resumingGameId: null })
  }
}

/** `connect` re-attached to a live proxy session; otherwise a new XMage session
 *  started and its callback ids restart at 1. */
function isAttached(data: unknown): boolean {
  return typeof data === 'object' && data !== null && (data as { attached?: unknown }).attached === true
}

/** The proxy replayed every frame missed while away: nothing to rejoin. */
function isResumed(data: unknown): boolean {
  return typeof data === 'object' && data !== null && (data as { resumed?: unknown }).resumed === true
}

/** Automatic re-login attempts after the socket to the proxy came back. */
export const RELOGIN_RETRIES = 6
const RELOGIN_BASE_DELAY_MS = 1500

/** Restores the session over a socket that came back: resumes the proxy
 *  stream (or rejoins the game), retrying visibly when the proxy refuses the
 *  login (`already connected` while the old session is still closing,
 *  `WARMING_UP` after a restart) instead of leaving an open socket where every
 *  command answers NOT_AUTHORIZED. */
async function relogin(g: Gateway, conn: ConnectionInfo, attempt: number): Promise<void> {
  const res = await cmds.connect(
    conn.serverHost,
    conn.port,
    conn.username,
    conn.password,
    conn.flagName,
    conn.avatarId,
    g.resumeToken(),
  )
  if (gateway !== g) return
  if (res.ok) {
    setState({ link: 'ok', linkAttempt: 0 })
    if (!isAttached(res.data)) resetGameEventOrder()
    if (isResumed(res.data)) {
      addLog('conexión', 'sesión reanudada sin pérdida de eventos')
      return
    }
    restoreLimited()
    resumeActiveGame()
    return
  }
  // the socket dropped again: its next onOpen starts over
  if (!g.isOpen) return
  if (attempt + 1 >= RELOGIN_RETRIES) {
    setState({
      link: 'ok', linkAttempt: 0, phase: 'idle', connecting: false,
      error: `${t('common', 'relogin_failed')}${res.error ? ` (${res.error})` : ''}`,
    })
    return
  }
  setState({ link: 'relogin-retry', linkAttempt: attempt + 1 })
  addLog('conexión', `re-login fallido (${res.error ?? res.errorCode ?? '?'}): reintento ${attempt + 1}`)
  await new Promise((r) => setTimeout(r, Math.min(RELOGIN_BASE_DELAY_MS * 2 ** attempt, 15000)))
  if (gateway !== g || !g.isOpen) return
  const s = getState()
  if (!s.conn || s.phase === 'idle' || s.phase === 'connecting') return
  await relogin(g, s.conn, attempt + 1)
}

/** The proxy lost the XMage server and logs the session in again by itself:
 *  keep the board, show the progress, and rejoin once the server is back. */
export function handleServerLink(msg: ServerLinkEnvelope): void {
  switch (msg.state) {
    case 'lost':
    case 'retrying':
      // the new server session numbers its callbacks from 1 again
      resetGameEventOrder()
      setState({ link: 'server-lost', linkAttempt: msg.attempt ?? 0 })
      break
    case 'restored':
      addLog('conexión', 'enlace con el servidor restaurado')
      setState({ link: 'ok', linkAttempt: 0, error: null })
      restoreLimited()
      resumeActiveGame()
      break
    case 'failed':
      setState({
        link: 'ok', linkAttempt: 0,
        error: t('common', msg.reason === 'superseded' ? 'session_taken_over' : 'server_link_failed'),
      })
      break
  }
}

function dispatch(msg: ProxyMessage): void {
  if (msg.type === 'serverLink') handleServerLink(msg)
  else handleMessage(msg)
}

function resumeActiveGame(): void {
  const active = loadActiveGame()
  if (!active?.gameId) return
  const gameId = active.gameId
  if (active.role === 'watcher') {
    addLog('conexión', 'Restaurando modo espectador…')
    void cmds.watchGame(gameId).then((r) => {
      if (!r?.ok) abandonResume(gameId)
    })
  } else {
    addLog('conexión', 'Restaurando partida en curso…')
    setState({ resumingGameId: gameId })
    void cmds.joinGame(gameId).then((r) => {
      if (!r?.ok) abandonResume(gameId)
    })
  }
  void cmds.getGameChatId(gameId).then((cid) => setState({ gameChatId: cid ?? null }))
}

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
  g.events.onMessage = dispatch
  g.events.onOpen = async () => {
    const s = getState()
    setState({ connecting: false, wsAlive: true, error: null })
    if (s.conn && s.phase !== 'connecting') {
      addLog('conexión', 'reconectado: re-logueando…')
      setState({ link: 'relogging', linkAttempt: 0 })
      await relogin(g, s.conn, 0)
    }
  }
  g.events.onPageHide = () => {
    const s = getState()
    const token = g.resumeToken()
    if (gateway !== g || !token || !s.conn || s.phase === 'idle' || s.phase === 'connecting') return
    saveResumeToken(token, s.conn)
  }
  g.events.onClose = (reason) => {
    const s = getState()
    const inSession = !!s.conn && s.phase !== 'idle' && s.phase !== 'connecting'
    setState({ connecting: false, wsAlive: false, ...(inSession ? { link: 'ws-down' as const, linkAttempt: 0 } : null) })
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

export function proxyUrl(wsHost: string, proxyPort: number): string {
  return wsHost.includes('://') ? wsHost : `ws://${wsHost}:${proxyPort}`
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
  const promise = runConnect(attempt, wsHost, proxyPort, serverHost, port, username, password, flagName, avatarId, 0)
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
  alreadyConnectedRetries = 0,
): Promise<void> {
  // Un intento anterior (p.ej. auto-connect lento) no puede volver a 'idle' ni
  // escribir un error encima del intento vigente que ya logueó.
  const stale = () => attempt !== activeAttempt
  const conn: ConnectionInfo = { wsHost, proxyPort, serverHost, port, username, password, flagName, avatarId }
  setState({ phase: 'connecting', conn, connecting: true, error: null, link: 'ok', linkAttempt: 0, loginRetry: null })
  detachGateway()
  const g = new Gateway()
  attachGateway(g)
  cmds.setGateway(g)
  const url = proxyUrl(wsHost, proxyPort)
  setState({ wsUrl: url })
  try {
    await g.connect(url)
  } catch (e) {
    if (stale()) return
    setState({ phase: 'idle', connecting: false, error: `no se pudo conectar al proxy en ${url}: ${(e as Error).message}` })
    return
  }
  if (stale()) return
  // a reload continues the stream of the page it replaced: the proxy replays the gap
  const resume = loadResumeToken(conn)
  clearResumeToken()
  if (resume) g.seedResume(resume)
  const res = await cmds.connect(serverHost, port, username, password, flagName, avatarId, resume)
  if (stale()) return
  if (!res.ok && /already connected|already logged in/i.test(res.error ?? '') && alreadyConnectedRetries < ALREADY_CONNECTED_RETRIES) {
    const waitMs = ALREADY_CONNECTED_BASE_DELAY_MS * 2 ** alreadyConnectedRetries
    addLog('conexión', `la sesión anterior sigue viva en el servidor: reintento ${alreadyConnectedRetries + 1}/${ALREADY_CONNECTED_RETRIES} en ${Math.round(waitMs / 1000)} s`)
    setState({ loginRetry: { attempt: alreadyConnectedRetries + 1, max: ALREADY_CONNECTED_RETRIES, until: Date.now() + waitMs } })
    await cmds.disconnect()
    await new Promise((r) => setTimeout(r, waitMs))
    if (stale()) return
    return runConnect(attempt, wsHost, proxyPort, serverHost, port, username, password, flagName, avatarId, alreadyConnectedRetries + 1)
  }
  if (res.ok) {
    if (!isAttached(res.data)) resetGameEventOrder()
    setState({ phase: 'lobby', connecting: false, error: null, conn })
    saveConn(conn)
    if (isResumed(res.data)) addLog('conexión', 'recarga: eventos perdidos reproducidos desde el proxy')
    // the replay carries what happened meanwhile, but this page has no board: rejoin for the state + prompt
    restoreLimited()
    resumeActiveGame()
    const chatId = await cmds.getRoomChatId()
    if (stale()) return
    setState({ roomChatId: chatId ?? null })
    void cmds.updatePreferences(clonePhaseStops(getState().settings.phaseStops))
  } else {
    // final failure: the retries ran out with the server still holding the old session, which
    // no amount of waiting-here fixes — the user needs to know what to do (wait it out, close
    // the other tab/device). The raw server detail stays in the log for bug reports.
    const sessionInUse = /already connected|already logged in/i.test(res.error ?? '')
    if (sessionInUse && res.error) addLog('conexión', `login rechazado: ${res.error}`)
    setState({
      phase: 'idle', connecting: false, loginRetry: null,
      error: sessionInUse ? t('errors', 'session_in_use') : (res.error ?? 'login fallido'),
    })
  }
}

export function reset() {
  activeAttempt++
  inFlight = null
  gateway?.close()
  saveConn(null)
  clearResumeToken()
  clearActiveGame()
  clearActiveDraft()
  resetGameEventOrder()
  setState(initialState)
}
