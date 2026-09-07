import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import * as cmds from '../net/commands'
import type { TableView, TournamentView } from '../net/types'
import { withTimeout } from './lobbyUtils'

/** Ve una partida del torneo por su tableId (botón ojo del bracket, como el desktop). */
export async function watchTournamentMatch(tableId: string): Promise<boolean> {
  try {
    const res = await withTimeout(cmds.watchTournamentTable(tableId), 15000, 'watchTournamentTable')
    return !!res.ok
  } catch {
    return false
  }
}

export function useTournamentBracket() {
  const tournamentState = useStore((s) => s.tournament)
  const [bracketTable, setBracketTable] = useState<TableView | null>(null)
  const [bracketView, setBracketView] = useState<TournamentView | null>(null)
  const [bracketLoading, setBracketLoading] = useState(false)
  const [bracketError, setBracketError] = useState<string | null>(null)
  const [watchingMatchId, setWatchingMatchId] = useState<string | null>(null)

  const openBracket = async (t: TableView) => {
    setBracketTable(t)
    setBracketError(null)
    if (tournamentState) {
      setBracketView(tournamentState.view)
    }
    setBracketLoading(true)
    try {
      void cmds.watchTournamentTable(t.tableId)
      const data = await withTimeout(cmds.getTournament(t.tableId) as Promise<unknown>, 8000, 'getTournament')
      if (data && typeof data === 'object' && 'tournamentName' in (data as Record<string, unknown>)) {
        setBracketView(data as TournamentView)
      } else if (tournamentState?.view) {
        setBracketView(tournamentState.view)
      }
    } catch (e) {
      if (tournamentState?.view) {
        setBracketView(tournamentState.view)
      } else {
        setBracketError((e as Error).message)
      }
    } finally {
      setBracketLoading(false)
    }
  }

  const closeBracket = () => {
    setBracketTable(null)
    setBracketView(null)
    setBracketError(null)
  }

  const watchMatch = async (tableId: string) => {
    if (watchingMatchId) return
    setWatchingMatchId(tableId)
    setBracketError(null)
    try {
      const ok = await watchTournamentMatch(tableId)
      if (!ok) setBracketError(`watchTournamentTable: ${tableId}`)
    } finally {
      setWatchingMatchId(null)
    }
  }

  const refreshBracket = async () => {
    if (!bracketTable) return
    setBracketLoading(true)
    setBracketError(null)
    try {
      void cmds.watchTournamentTable(bracketTable.tableId)
      const data = await withTimeout(cmds.getTournament(bracketTable.tableId) as Promise<unknown>, 8000, 'getTournament')
      if (data && typeof data === 'object' && 'tournamentName' in (data as Record<string, unknown>)) {
        setBracketView(data as TournamentView)
      } else if (tournamentState?.view) {
        setBracketView(tournamentState.view)
      }
    } catch (e) {
      if (tournamentState?.view) {
        setBracketView(tournamentState.view)
      } else {
        setBracketError((e as Error).message)
      }
    } finally {
      setBracketLoading(false)
    }
  }

  useEffect(() => {
    if (!bracketTable) return
    if (tournamentState?.view) {
      setBracketView(tournamentState.view)
    }
  }, [tournamentState, bracketTable])

  useEffect(() => {
    if (!bracketTable) return
    const id = setInterval(() => {
      void refreshBracket()
    }, 8000)
    return () => clearInterval(id)
  }, [bracketTable?.tableId])

  return {
    bracketTable, bracketView, bracketLoading, bracketError,
    openBracket, closeBracket, refreshBracket, watchMatch, watchingMatchId,
  }
}
