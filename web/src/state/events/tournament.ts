import { getState, setState, addLog } from '../state'
import { exitTournamentChat } from '../actions'
import * as cmds from '../../net/commands'
import { translateError } from '../../i18n'
import type { TournamentView } from '../../net/types.generated'

export function handleStartTournament(objectId: string | null, data: unknown): void {
  setState({ draftOverAt: null, lastDraftEventAt: null, lastDraftMethod: null })
  const d = data as { currentTableId?: string } | null
  addLog('torneo', `Torneo iniciado${d?.currentTableId ? ` (mesa ${String(d.currentTableId).slice(0, 8)})` : ''}`)
  const tournamentId = objectId
  if (!tournamentId) return
  const s = getState()
  const username = s.conn?.username?.toLowerCase()
  if (!username) return
  const tables = s.lobby?.tables ?? []
  const seated = tables.some(
    (tb) =>
      (!d?.currentTableId || tb.tableId === d.currentTableId) &&
      (tb.seats ?? []).some(
        (seat) => (seat.playerName ?? '').toLowerCase() === username && (!seat.playerType || seat.playerType === 'HUMAN'),
      ),
  )
  if (!seated) return
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
