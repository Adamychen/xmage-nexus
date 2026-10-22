import { useEffect, useState } from 'react'
import { getState, useStore } from '../state/store'
import * as cmds from '../net/commands'
import type { TableView, TournamentView } from '../net/types'
import { isMyTable, withTimeout } from './lobbyUtils'

/** Watches a tournament match by its tableId (the bracket's eye button, as in the desktop client). */
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
  const username = useStore((s) => s.conn?.username)
  const [bracketTable, setBracketTable] = useState<TableView | null>(null)
  const [bracketView, setBracketView] = useState<TournamentView | null>(null)
  const [bracketLoading, setBracketLoading] = useState(false)
  const [bracketError, setBracketError] = useState<string | null>(null)
  const [watchingMatchId, setWatchingMatchId] = useState<string | null>(null)
  const [bracketTournamentId, setBracketTournamentId] = useState<string | null>(null)

  /** A table is ours if it is a match of our tournament (its tableId is in the
   *  rounds) or the tournament table we are seated at. Never by name: two
   *  tournaments can share a name. For other people's tables the cached tournament
   *  is NOT a fallback: drawing our own tournament in someone else's bracket is a
   *  bug (seen live 2026-09-14). */
  const isOwnTournament = (t: TableView): boolean => {
    if (!tournamentState || !t.isTournament) return false
    const playedHere = (tournamentState.view?.rounds ?? []).some((r) => r.games?.some((g) => g.tableId === t.tableId))
    return playedHere || isMyTable(t, username)
  }

  /**
   * Opens the table's bracket. An explicit `tournamentId` is the tableId→tournamentId
   * resolution already known (SHOW_TOURNAMENT callback). If it is someone else's
   * tournament and still unresolved, the watch is triggered and the lobby reopens
   * with the id when the callback arrives (the server does not resolve table ids).
   */
  const openBracket = async (t: TableView, tournamentId?: string) => {
    setBracketTable(t)
    setBracketError(null)
    const own = isOwnTournament(t)
    const tid = tournamentId ?? (own ? (tournamentState?.tournamentId ?? t.tableId) : null)
    setBracketTournamentId(tid)
    setBracketView(own ? (tournamentState?.view ?? null) : null)
    if (!tid) {
      setBracketLoading(false)
      void cmds.watchTournamentTable(t.tableId)
      return
    }
    setBracketLoading(true)
    try {
      void cmds.watchTournamentTable(t.tableId)
      const data = await withTimeout(cmds.getTournament(tid) as Promise<unknown>, 8000, 'getTournament')
      if (data && typeof data === 'object' && 'tournamentName' in (data as Record<string, unknown>)) {
        setBracketView(data as TournamentView)
      } else if (own && tournamentState?.view) {
        setBracketView(tournamentState.view)
      } else {
        setBracketError(`getTournament: ${tid}`)
      }
    } catch (e) {
      if (own && tournamentState?.view) {
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
    setBracketTournamentId(null)
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

  const cachedOwnView = (tid: string): TournamentView | null => {
    const cached = getState().tournament
    return cached && cached.tournamentId === tid ? cached.view : null
  }

  const refreshBracket = async () => {
    if (!bracketTable || !bracketTournamentId) return
    setBracketLoading(true)
    setBracketError(null)
    try {
      const data = await withTimeout(cmds.getTournament(bracketTournamentId) as Promise<unknown>, 8000, 'getTournament')
      if (data && typeof data === 'object' && 'tournamentName' in (data as Record<string, unknown>)) {
        setBracketView(data as TournamentView)
      } else {
        const cached = cachedOwnView(bracketTournamentId)
        if (cached) setBracketView(cached)
      }
    } catch (e) {
      const cached = cachedOwnView(bracketTournamentId)
      if (cached) {
        setBracketView(cached)
      } else {
        setBracketError((e as Error).message)
      }
    } finally {
      setBracketLoading(false)
    }
  }

  useEffect(() => {
    if (!bracketTable) return
    // Only our cached tournament belongs to this table; someone else's does not.
    if (tournamentState?.view && bracketTournamentId === tournamentState.tournamentId) {
      setBracketView(tournamentState.view)
    }
  }, [tournamentState, bracketTable, bracketTournamentId])

  useEffect(() => {
    if (!bracketTable) return
    const id = setInterval(() => {
      void refreshBracket()
    }, 8000)
    return () => clearInterval(id)
  }, [bracketTable?.tableId, bracketTournamentId])

  return {
    bracketTable, bracketView, bracketLoading, bracketError, bracketTournamentId,
    canQuit: !!bracketTable && !!bracketTournamentId && bracketTournamentId === tournamentState?.tournamentId,
    openBracket, closeBracket, refreshBracket, watchMatch, watchingMatchId,
  }
}
