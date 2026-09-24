import { describe, expect, it } from 'vitest'
import { findFollowGameId } from './spectatorFollow'
import type { TableView } from '../net/types'

function table(tableId: string, games: string[]): TableView {
  return { tableId, games } as unknown as TableView
}

describe('findFollowGameId', () => {
  it('returns the newer game when the table already has another one', () => {
    const tables = [table('t-1', ['g-1', 'g-2'])]
    expect(findFollowGameId(tables, 'g-1')).toBe('g-2')
  })

  it('returns null when the watched game is the only one', () => {
    expect(findFollowGameId([table('t-1', ['g-1'])], 'g-1')).toBeNull()
  })

  it('returns null when no table contains the watched game', () => {
    expect(findFollowGameId([table('t-1', ['g-9'])], 'g-1')).toBeNull()
  })

  it('returns null without a watched game id', () => {
    expect(findFollowGameId([table('t-1', ['g-1'])], null)).toBeNull()
    expect(findFollowGameId(undefined, 'g-1')).toBeNull()
  })

  it('picks the last of several newer games', () => {
    expect(findFollowGameId([table('t-1', ['g-1', 'g-2', 'g-3'])], 'g-1')).toBe('g-3')
  })
  it('never follows an older, finished game of the same table', () => {
    expect(findFollowGameId([table('t-1', ['g-1', 'g-2'])], 'g-2')).toBeNull()
    expect(findFollowGameId([table('t-1', ['g-1', 'g-2', 'g-3'])], 'g-2')).toBe('g-3')
  })
})
