import { describe, expect, it } from 'vitest'
import { extractLobbyUsers, formatSeatHistory } from './LobbyScreen'
import type { RoomUsersView, UsersView } from '../net/types'

describe('formatSeatHistory', () => {
  it('formats XMage seat history with quit counts cleanly without truncating', () => {
    expect(formatSeatHistory('720 (I:15 T:8 Q:3)')).toEqual({
      short: '720 (Q:3)',
      full: '720 partidas jugadas (3 abandonos, 15 inactivos, 8 timeouts)',
    })
    expect(formatSeatHistory('1817 (I:4 T:12 Q:0)')).toEqual({
      short: '1817',
      full: '1817 partidas jugadas (4 inactivos, 12 timeouts)',
    })
    expect(formatSeatHistory('239 (I:3 T:9 Q:1)')).toEqual({
      short: '239 (Q:1)',
      full: '239 partidas jugadas (1 abandonos, 3 inactivos, 9 timeouts)',
    })
    expect(formatSeatHistory('8 (Q:1)')).toEqual({
      short: '8 (Q:1)',
      full: '8 partidas jugadas (1 abandonos)',
    })
    expect(formatSeatHistory('2')).toEqual({
      short: '2',
      full: '2 partidas jugadas',
    })
  })

  it('formats Win-Loss and raw tournament records', () => {
    expect(formatSeatHistory('10-2')).toEqual({
      short: '10-2',
      full: '10-2 (Victorias - Derrotas)',
    })
    expect(formatSeatHistory('5-5-1')).toEqual({
      short: '5-5-1',
      full: '5-5-1 (Victorias - Derrotas)',
    })
  })

  it('formats user profile history strings with percentages', () => {
    expect(
      formatSeatHistory(undefined, 'Matches: 265 (I:3 T:1 Q:13) (6%), Tourneys: 0 (0%), Constructed Rating: 1500')
    ).toEqual({
      short: '265 (6%)',
      full: 'Matches: 265 (I:3 T:1 Q:13) (6%), Tourneys: 0 (0%), Constructed Rating: 1500',
    })
  })

  it('handles null and undefined', () => {
    expect(formatSeatHistory(undefined, undefined)).toEqual({ short: null, full: '' })
    expect(formatSeatHistory('', '')).toEqual({ short: null, full: '' })
  })
})

describe('extractLobbyUsers', () => {
  it('extracts users when proxy sends Array of RoomUsersView (actual XMage Java proxy format)', () => {
    const raw: RoomUsersView[] = [
      {
        numberActiveGames: 2,
        numberGameThreads: 4,
        numberMaxGames: 100,
        usersView: [
          {
            userName: 'player1',
            flagName: 'US',
            infoGames: 'Modern Duel',
            infoPing: '45ms',
            matchHistory: '10-2',
            matchQuitRatio: 0,
            tourneyHistory: '1-0',
            tourneyQuitRatio: 0,
            generalRating: 1650,
            constructedRating: 1720,
            limitedRating: 1580,
          },
          {
            userName: 'player2',
            flagName: 'ES',
            infoGames: '',
            infoPing: '20ms',
            matchHistory: '5-5',
            matchQuitRatio: 0,
            tourneyHistory: '',
            tourneyQuitRatio: 0,
            generalRating: 1500,
            constructedRating: 1500,
            limitedRating: 1500,
          },
        ],
      },
    ]

    const users = extractLobbyUsers(raw)
    expect(users.length).toBe(2)
    expect(users[0].userName).toBe('player1')
    expect(users[0].flagName).toBe('US')
    expect(users[0].constructedRating).toBe(1720)
    expect(users[1].userName).toBe('player2')
  })

  it('extracts users when proxy sends single RoomUsersView object', () => {
    const raw: RoomUsersView = {
      numberActiveGames: 0,
      numberGameThreads: 0,
      numberMaxGames: 50,
      usersView: [
        {
          userName: 'mage_master',
          flagName: 'DE',
          infoGames: '',
          infoPing: '30ms',
          matchHistory: '20-1',
          matchQuitRatio: 0,
          tourneyHistory: '',
          tourneyQuitRatio: 0,
          generalRating: 1800,
          constructedRating: 1850,
          limitedRating: 1750,
        },
      ],
    }

    const users = extractLobbyUsers(raw)
    expect(users.length).toBe(1)
    expect(users[0].userName).toBe('mage_master')
  })

  it('extracts users when array contains direct UsersView items', () => {
    const raw: Partial<UsersView>[] = [
      { userName: 'direct_user_1', flagName: 'FR' },
      { userName: 'direct_user_2', flagName: 'JP' },
    ]

    const users = extractLobbyUsers(raw)
    expect(users.length).toBe(2)
    expect(users[0].userName).toBe('direct_user_1')
    expect(users[1].userName).toBe('direct_user_2')
  })

  it('returns empty array when raw is null, undefined, or empty', () => {
    expect(extractLobbyUsers(null)).toEqual([])
    expect(extractLobbyUsers(undefined)).toEqual([])
    expect(extractLobbyUsers([])).toEqual([])
    expect(extractLobbyUsers({})).toEqual([])
  })
})
