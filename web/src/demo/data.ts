import type { TableView, UsersView } from '../net/types'
import { makeTable } from '../../fixtures/fakeCore'

export const DEMO_USERNAME = 'Planeswalker'

interface RosterRow {
  name: string
  flag: string
  rating: number
  matches: number
  ping: string
  playing?: boolean
  avatarId: number
}

const ROSTER: RosterRow[] = [
  { name: DEMO_USERNAME, flag: 'ar', rating: 1688, matches: 41, ping: '34ms', avatarId: 12 },
  { name: 'Ajani_Fan', flag: 'es', rating: 2184, matches: 412, ping: '58ms', avatarId: 4 },
  { name: 'JaceMind', flag: 'us', rating: 2031, matches: 355, ping: '71ms', playing: true, avatarId: 7 },
  { name: 'Liliana_B', flag: 'de', rating: 1650, matches: 288, ping: '49ms', avatarId: 21 },
  { name: 'GoblinKing', flag: 'mx', rating: 1766, matches: 190, ping: '63ms', playing: true, avatarId: 9 },
  { name: 'Nissa_Roots', flag: 'br', rating: 1604, matches: 97, ping: '88ms', avatarId: 15 },
  { name: 'ChandraFire', flag: 'fr', rating: 1533, matches: 74, ping: '42ms', avatarId: 3 },
  { name: 'Teferi_Time', flag: 'gb', rating: 1471, matches: 63, ping: '55ms', avatarId: 18 },
  { name: 'SamwiseMTG', flag: 'ca', rating: 1250, matches: 31, ping: '120ms', avatarId: 26 },
  { name: 'NewPlayer42', flag: 'cl', rating: 1050, matches: 8, ping: '97ms', avatarId: 30 },
]

export function demoRoster(): UsersView[] {
  return ROSTER.map((r) => ({
    flagName: r.flag,
    userName: r.name,
    matchHistory: String(r.matches),
    matchQuitRatio: 0,
    tourneyHistory: '0',
    tourneyQuitRatio: 0,
    infoGames: r.playing ? 'Match: Modern League' : 'not active',
    infoPing: r.ping,
    generalRating: r.rating,
    constructedRating: r.rating,
    limitedRating: Math.max(1100, r.rating - 60),
    avatarId: r.avatarId,
  }))
}

export function demoExtraTables(): TableView[] {
  const waiting = makeTable({
    tableId: 'demo-table-pod',
    tableName: 'Friday Commander pod',
    gameId: 'demo-game-pod',
    gameType: 'Commander Free For All',
    deckType: 'Variant Magic - Commander',
    controllerName: 'Liliana_B',
    seats: [
      { playerName: 'Liliana_B', seatIndex: 0, playerType: 'HUMAN' },
      { playerName: 'Nissa_Roots', seatIndex: 1, playerType: 'HUMAN' },
      { playerName: '', seatIndex: 2, playerType: 'HUMAN' },
      { playerName: '', seatIndex: 3, playerType: 'HUMAN' },
    ],
  })
  waiting.tableState = 'WAITING'
  waiting.tableStateText = 'Waiting for players'
  waiting.seatsInfo = '2/4'
  waiting.additionalInfoShort = '2/4'
  waiting.spectatorsAllowed = true

  const live = makeTable({
    tableId: 'demo-table-live',
    tableName: 'Modern League',
    gameId: 'demo-game-live',
    controllerName: 'JaceMind',
    seats: [
      { playerName: 'JaceMind', seatIndex: 0, playerType: 'HUMAN' },
      { playerName: 'GoblinKing', seatIndex: 1, playerType: 'HUMAN' },
    ],
  })
  live.tableState = 'DUELING'
  live.tableStateText = 'Dueling'
  live.spectatorsAllowed = true
  live.rated = true

  return [waiting, live]
}

function cards(names: Array<[string, number, number]>, potential: number) {
  return names.map(([name, synergy, numDecks]) => ({ name, synergy, num_decks: numDecks, potential_decks: potential }))
}

export function demoEdhrecPage(slug: string): unknown {
  if (slug !== 'krenko-mob-boss') return null
  const potential = 24100
  return {
    container: {
      json_dict: {
        card: { name: 'Krenko, Mob Boss', num_decks: potential },
        cardlists: [
          {
            tag: 'highsynergycards',
            header: 'High Synergy Cards',
            cardviews: cards(
              [
                ['Goblin Chieftain', 0.52, 9120],
                ['Goblin Warchief', 0.49, 8314],
                ['Impact Tremors', 0.46, 9871],
                ['Purphoros, God of the Forge', 0.44, 7466],
                ['Skullclamp', 0.31, 9430],
              ],
              potential,
            ),
          },
          {
            tag: 'topcards',
            header: 'Top Cards',
            cardviews: cards(
              [
                ['Sol Ring', 0.02, 21033],
                ['Lightning Bolt', 0.05, 11764],
                ['Arcane Signet', 0.01, 19802],
                ['Blasphemous Act', 0.11, 8895],
                ['Mountain', 0, 24100],
              ],
              potential,
            ),
          },
          {
            tag: 'creatures',
            header: 'Creatures',
            cardviews: cards(
              [
                ['Goblin Matron', 0.28, 6012],
                ['Siege-Gang Commander', 0.22, 7245],
                ['Hordeling Outburst', 0.35, 6830],
              ],
              potential,
            ),
          },
        ],
      },
    },
  }
}

const VALUE_SWAPS: Array<[string, string]> = [
  ['e2e', DEMO_USERNAME],
  ['host', DEMO_USERNAME],
  ['sim', 'Oracle Bot'],
  ['alice', 'Ajani_Fan'],
  ['bob', 'JaceMind'],
  ['charlie', 'Liliana_B'],
  ['dave', 'GoblinKing'],
  ['eve', 'Nissa_Roots'],
  ['frank', 'ChandraFire'],
  ['grace', 'Teferi_Time'],
  ['heidi', 'SamwiseMTG'],
]

const TEXT_SWAPS: Array<[string, string]> = [
  ['Mage Web', DEMO_USERNAME],
  ['sim-000001-244', 'Oracle Bot'],
  ['sim-kraum', 'Kraum Bot'],
  ['sim-krenko', 'Krenko Bot'],
  ['sim-edgar', 'Edgar Bot'],
]

const VALUE_RULES = VALUE_SWAPS.map(
  ([from, to]) => [new RegExp(`(?<=[:,\\[])"${from}"(?=[,\\]}])`, 'g'), JSON.stringify(to)] as const,
)

export function presentFrame(frame: string): string {
  let out = frame
  for (const [from, to] of TEXT_SWAPS) {
    if (out.includes(from)) out = out.split(from).join(to)
  }
  for (const [rule, to] of VALUE_RULES) out = out.replace(rule, to)
  return out
}
