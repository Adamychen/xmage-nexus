import { setState, addLog } from '../state'
import { exitTournamentChat } from '../actions'
import type { TournamentView } from '../../net/types.generated'

export function handleStartTournament(data: unknown): void {
  const d = data as { currentTableId?: string } | null
  addLog('torneo', `Torneo iniciado${d?.currentTableId ? ` (mesa ${String(d.currentTableId).slice(0, 8)})` : ''}`)
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
  addLog('torneo', text)
}

export function handleShowTournament(data: unknown): void {
  const d = data as { currentTableId?: string } | null
  addLog('torneo', `Viendo torneo ${d?.currentTableId?.slice(0, 8) ?? ''}`)
}
