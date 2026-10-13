import { describe, expect, it } from 'vitest'
import { DEMO_USERNAME, demoEdhrecPage, demoExtraTables, demoRoster, presentFrame } from './data'
import { parseEdhrecPage } from '../decks/edhrec'
import { getRankInfo } from '../lobby/ranking'

describe('presentFrame', () => {
  it('renames fixture players in values but never in keys', () => {
    const frame = JSON.stringify({ host: 'host', controllerName: 'e2e', seats: ['alice', 'bob'], who: 'Mage Web' })
    const out = JSON.parse(presentFrame(frame))
    expect(out.host).toBe(DEMO_USERNAME)
    expect(out.controllerName).toBe(DEMO_USERNAME)
    expect(out.seats).toEqual(['Ajani_Fan', 'JaceMind'])
    expect(out.who).toBe(DEMO_USERNAME)
  })

  it('leaves longer strings that merely contain a fixture name alone', () => {
    const frame = JSON.stringify({ tableId: 'table-e2e-1', note: 'ghost story', name: 'sim-board' })
    expect(presentFrame(frame)).toBe(frame)
  })
})

describe('demo roster', () => {
  it('keeps every username within the server limit and covers every tier', () => {
    const roster = demoRoster()
    for (const u of roster) expect(u.userName.length).toBeLessThanOrEqual(14)
    const tiers = new Set(roster.map((u) => getRankInfo(u.generalRating).tier))
    expect(tiers).toEqual(new Set(['MYTHIC', 'DIAMOND', 'PLATINUM', 'GOLD', 'SILVER', 'BRONZE']))
    expect(roster.some((u) => u.userName === DEMO_USERNAME)).toBe(true)
  })

  it('only reports match counts, as the real server does', () => {
    for (const u of demoRoster()) expect(u.matchHistory).toMatch(/^\d+$/)
  })

  it('adds a waiting pod and a live match with unique ids', () => {
    const tables = demoExtraTables()
    expect(tables.map((t) => t.tableState)).toEqual(['WAITING', 'DUELING'])
    expect(new Set(tables.map((t) => t.tableId)).size).toBe(tables.length)
  })
})

describe('demo EDHREC page', () => {
  it('parses with the production parser', () => {
    const data = parseEdhrecPage('krenko-mob-boss', demoEdhrecPage('krenko-mob-boss'))
    expect(data?.commanderName).toBe('Krenko, Mob Boss')
    expect(data?.lists.length).toBeGreaterThan(1)
  })

  it('has no page for other commanders', () => {
    expect(demoEdhrecPage('atraxa-praetors-voice')).toBeNull()
  })
})
