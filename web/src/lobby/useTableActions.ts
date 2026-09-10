import { useState } from 'react'
import { setWatchingTable } from '../state/store'
import { setState } from '../state/state'
import type { ConnectionInfo } from '../state/persistence'
import * as cmds from '../net/commands'
import type { TableView } from '../net/types'
import { t as tStatic, translateError } from '../i18n'
import { AI_OPPONENT_DECK, type Deck } from './decks'
import { normalizeSeatType } from './CreateTable/constants'
import { tournamentJoinNeedsDeck } from './CreateTable/tableKind'
import { isUserIgnored } from './ignoreList'
import { tableOwnerName } from './TableFilterBar'
import { prepareDeckForXMage } from '../decks/deckNormalize'
import { isDirectTournamentJoin, withTimeout } from './lobbyUtils'

export function useTableActions(conn: ConnectionInfo | null) {
  const [joiningTable, setJoiningTable] = useState<TableView | null>(null)
  const [joinPassword, setJoinPassword] = useState<string | undefined>(undefined)
  const [busyTable, setBusyTable] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const ignoredOwnerNotice = (t: TableView): string | null => {
    const owner = tableOwnerName(t)
    return owner && isUserIgnored(owner)
      ? tStatic('lobby', 'join_ignored_owner', { name: owner })
      : null
  }

  const joinHuman = (t: TableView, presetPassword?: string) => {
    setState({ error: null })
    setNotice(ignoredOwnerNotice(t))
    setJoinPassword(presetPassword)
    const seat = t.seats.find((s) => !s.playerName)
    if (!seat) {
      setState({ error: translateError(tStatic('errors','table_no_seats')) })
      return
    }
    if (isDirectTournamentJoin(t)) {
      void joinTournamentDirect(t)
      return
    }
    setJoiningTable(t)
  }

  /** Bypass del diálogo para torneos limitados sin password (desktop: joinTournamentTable con deck null). */
  const joinTournamentDirect = async (t: TableView) => {
    setBusyTable(t.tableId)
    try {
      const res = await withTimeout(
        cmds.joinTournamentTable({
          tableId: t.tableId,
          playerName: conn?.username ?? 'player',
          playerType: 'HUMAN',
          skill: 1,
        }),
        15000,
        'joinTournamentTable',
      )
      if (res.ok) {
        setNotice(tStatic('lobby','waiting_players'))
      } else {
        const code = (res as { errorCode?: string }).errorCode
        const raw = res.error || code || tStatic('errors','join_table_failed')
        setState({ error: translateError(raw, 'joinTournamentTable', code) })
      }
    } catch (e) {
      const err = e as Error & { errorCode?: string }
      setState({ error: translateError(err.message, 'joinTournamentTable', (err as { errorCode?: string }).errorCode) })
    } finally {
      setBusyTable(null)
    }
  }

  const handleJoinWithDeck = async (t: TableView, deck: Deck, password?: string) => {
    setBusyTable(t.tableId)
    setState({ error: null })
    setNotice(null)
    const xmageDeck = prepareDeckForXMage(deck, t.deckType, t.gameType)
    try {
      const res = await withTimeout(
        cmds.joinTable({
          tableId: t.tableId,
          playerName: conn?.username ?? 'player',
          playerType: 'HUMAN',
          skill: 1,
          deck: xmageDeck,
          deckType: t.deckType,
          gameType: t.gameType,
          password,
        }),
        15000,
        'joinTable',
      )
      if (res.ok) {
        setNotice(tStatic('lobby','waiting_players'))
        setJoiningTable(null)
        setJoinPassword(undefined)
      } else {
        const code = (res as { errorCode?: string }).errorCode
        const raw = res.error || code || tStatic('errors','join_table_failed')
        setState({ error: translateError(raw, 'joinTable', code) })
        return
      }
    } catch (e) {
      const err = e as Error & { errorCode?: string }
      setState({ error: translateError(err.message, 'joinTable', (err as { errorCode?: string }).errorCode) })
    } finally {
      setBusyTable(null)
    }
  }

  const joinAi = async (t: TableView) => {
    setBusyTable(t.tableId)
    setState({ error: null })
    setNotice(ignoredOwnerNotice(t))
    const seat = t.seats.find((s) => !s.playerName && s.playerType && /COMPUTER|AI/i.test(s.playerType))
    if (!seat?.playerType) {
      setState({ error: translateError(tStatic('errors','table_no_seats')) })
      setBusyTable(null)
      return
    }
    const aiSeats = t.seats.filter((s) => s.playerType && /COMPUTER|AI/i.test(s.playerType))
    const aiIndex = aiSeats.indexOf(seat)
    const playerName = aiIndex <= 0 ? 'Computer' : `Computer ${aiIndex + 1}`
    const playerType = normalizeSeatType(seat.playerType)
    const isTourney = !!t.isTournament
    const action = isTourney ? 'joinTournamentTable' : 'joinTable'
    const needsDeck = !isTourney || tournamentJoinNeedsDeck(t.gameType)
    try {
      const res = await withTimeout(
        isTourney
          ? cmds.joinTournamentTable({
              tableId: t.tableId,
              playerName,
              playerType,
              skill: 1,
              ...(needsDeck ? { deck: AI_OPPONENT_DECK, deckType: t.deckType, gameType: t.gameType } : {}),
            })
          : cmds.joinTable({
              tableId: t.tableId,
              playerName,
              playerType,
              skill: 1,
              deck: AI_OPPONENT_DECK,
            }),
        15000,
        'joinTable IA',
      )
      if (res.ok) {
        setNotice(tStatic('lobby','join_ai_btn'))
      } else {
        const code = (res as { errorCode?: string }).errorCode
        const raw = res.error || code || tStatic('errors','join_table_failed')
        setState({ error: translateError(raw, action, code) })
        return
      }
    } catch (e) {
      const err = e as Error & { errorCode?: string }
      setState({ error: translateError(err.message, action, (err as { errorCode?: string }).errorCode) })
    } finally {
      setBusyTable(null)
    }
  }

  const startTable = async (t: TableView) => {
    setBusyTable(t.tableId)
    setState({ error: null })
    setNotice(null)
    const isTourney = !!t.isTournament
    const action = isTourney ? 'startTournament' : 'startMatch'
    try {
      const res = await withTimeout(
        isTourney ? cmds.startTournament(t.tableId) : cmds.startMatch(t.tableId),
        20000,
        action,
      )
      if (res.ok) {
        setNotice(tStatic('lobby','start_match_btn'))
      } else {
        const code = (res as { errorCode?: string }).errorCode
        const raw = res.error || code || tStatic('errors','start_game_failed')
        setState({ error: translateError(raw, action, code) })
      }
    } catch (e) {
      const err = e as Error & { errorCode?: string }
      setState({ error: translateError(err.message, action, (err as { errorCode?: string }).errorCode) })
    } finally {
      setBusyTable(null)
    }
  }

  const watchTable = async (t: TableView) => {
    setBusyTable(t.tableId)
    setState({ error: null })
    setNotice(ignoredOwnerNotice(t))
    try {
      const res = await withTimeout(cmds.watchTable(t.tableId), 15000, 'watchTable')
      if (res.ok) {
        setWatchingTable(t)
        setNotice(tStatic('lobby','watch_btn'))
      } else {
        const code = (res as { errorCode?: string }).errorCode
        const raw = res.error || code || tStatic('errors','generic_error')
        setState({ error: translateError(raw, 'watchTable', code) })
      }
    } catch (e) {
      const err = e as Error & { errorCode?: string }
      setState({ error: translateError(err.message, 'watchTable', (err as { errorCode?: string }).errorCode) })
    } finally {
      setBusyTable(null)
    }
  }

  return {
    joiningTable, setJoiningTable, joinPassword, setJoinPassword,
    busyTable, notice, setNotice,
    joinHuman, handleJoinWithDeck, joinAi, startTable, watchTable,
  }
}
