import { getState, setState, addLog } from '../state'
import { exitTournamentChat } from '../actions'
import * as cmds from '../../net/commands'
import { translateError } from '../../i18n'
import type { TournamentView } from '../../net/types.generated'

/** Backoff entre reintentos de panel-join (la mesa puede tardar en verse en el lobby). */
export const TOURNAMENT_JOIN_RETRY_DELAYS_MS = [500, 1500]

function isSeatedForTournament(username: string, tables: { tableId: string; seats?: Array<{ playerName?: string; playerType?: string }> }[], currentTableId?: string): boolean {
  return tables.some(
    (tb) =>
      (!currentTableId || tb.tableId === currentTableId) &&
      (tb.seats ?? []).some(
        (seat) => (seat.playerName ?? '').toLowerCase() === username && (!seat.playerType || seat.playerType === 'HUMAN'),
      ),
  )
}

function attemptPanelJoin(tournamentId: string, username: string, currentTableId: string | undefined, attempt: number): void {
  const tables = getState().lobby?.tables ?? []
  if (isSeatedForTournament(username, tables, currentTableId)) {
    addLog('torneo', 'Uniéndose al panel del torneo…')
    void (cmds.joinTournament(tournamentId) as Promise<{ ok?: boolean; error?: string; errorCode?: string }>).then(
      (res) => {
        if (res?.ok) {
          addLog('torneo', 'Unido al panel del torneo, esperando el draft…')
        } else {
          setState({ error: translateError(res?.error || res?.errorCode || 'FAILED', 'joinTournament', res?.errorCode) })
        }
      },
      () => {
        setState({ error: translateError('FAILED', 'joinTournament') })
      },
    )
    return
  }
  if (attempt >= TOURNAMENT_JOIN_RETRY_DELAYS_MS.length) {
    addLog('torneo', 'Mesa del torneo aún no visible tras reintentar: abre el torneo a mano desde el lobby.')
    return
  }
  addLog('torneo', `Mesa del torneo aún no visible, reintentando… (${attempt + 1}/${TOURNAMENT_JOIN_RETRY_DELAYS_MS.length + 1})`)
  window.setTimeout(
    () => attemptPanelJoin(tournamentId, username, currentTableId, attempt + 1),
    TOURNAMENT_JOIN_RETRY_DELAYS_MS[attempt],
  )
}

export function handleStartTournament(objectId: string | null, data: unknown): void {
  setState({ draftOverAt: null, lastDraftEventAt: null, lastDraftMethod: null })
  const d = data as { currentTableId?: string } | null
  addLog('torneo', `Torneo iniciado${d?.currentTableId ? ` (mesa ${String(d.currentTableId).slice(0, 8)})` : ''}`)
  const tournamentId = objectId
  if (!tournamentId) return
  const s = getState()
  const username = s.conn?.username?.toLowerCase()
  if (!username) return
  attemptPanelJoin(tournamentId, username, d?.currentTableId, 0)
}

export function handleTournamentUpdate(objectId: string | null, data: unknown): void {
  const view = data as TournamentView | null
  if (!view) return
  const tid = objectId ?? view.tournamentName ?? 'tournament'
  setState({ tournament: { tournamentId: tid, view } })
  addLog('torneo', `${view.tournamentName} — ${view.tournamentState} ${view.runningInfo ?? ''}`.trim())
}

export function handleTournamentOver(data: unknown): void {
  const text = typeof data === 'string' ? data : (data as { message?: string } | null)?.message ?? 'Torneo terminado'
  exitTournamentChat()
  setState({ draftOverAt: null, lastDraftEventAt: null, lastDraftMethod: null })
  addLog('torneo', text)
}

export function handleShowTournament(data: unknown): void {
  const d = data as { currentTableId?: string } | null
  addLog('torneo', `Viendo torneo ${d?.currentTableId?.slice(0, 8) ?? ''}`)
}
