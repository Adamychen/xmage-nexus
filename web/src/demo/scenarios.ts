import type { FakeConn, Scenario } from '../../fixtures/fakeCore'
import { spellsScenario } from '../../fixtures/scenarios/spells'
import { combatHumanAttackScenario, combatHumanBlockScenario } from '../../fixtures/scenarios/combatHuman'
import { targetingScenario } from '../../fixtures/scenarios/targeting'
import { commanderPlaygroundScenario } from '../../fixtures/scenarios/commanderPlayground'
import { planeswalkerScenario } from '../../fixtures/scenarios/planeswalker'
import { tokensScenario } from '../../fixtures/scenarios/tokens'
import { thoughtseizeScenario } from '../../fixtures/scenarios/thoughtseize'
import { draftScenario } from '../../fixtures/scenarios/draft'
import { tournamentScenario } from '../../fixtures/scenarios/tournament'
import { demoEdhrecPage, demoExtraTables, demoRoster } from './data'

export interface DemoScenarioDef {
  id: string
  group: 'play' | 'format'
  title: string
  blurb: string
  autostart: boolean
  build: () => Scenario
}

export const DEMO_SCENARIOS: DemoScenarioDef[] = [
  {
    id: 'blaze',
    autostart: true,
    group: 'play',
    title: 'Cast a spell with X',
    blurb: 'Blaze: pick X, aim it at the opponent and pay with your lands.',
    build: () => spellsScenario('blaze'),
  },
  {
    id: 'modes',
    autostart: true,
    group: 'play',
    title: 'Modal spell',
    blurb: 'Boros Charm: choose a mode, then pay a two-colour cost.',
    build: () => spellsScenario('boros'),
  },
  {
    id: 'ballista',
    autostart: true,
    group: 'play',
    title: 'Counters and abilities',
    blurb: 'Walking Ballista: choose how to cast it and watch the counters land.',
    build: () => spellsScenario('ballista'),
  },
  {
    id: 'targeting',
    autostart: true,
    group: 'play',
    title: 'Targeting',
    blurb: 'Lightning Bolt with the live targeting line and highlighted legal targets.',
    build: () => targetingScenario(),
  },
  {
    id: 'attack',
    autostart: true,
    group: 'play',
    title: 'Attack',
    blurb: 'Declare attackers on your turn and see combat damage resolve.',
    build: () => combatHumanAttackScenario(),
  },
  {
    id: 'block',
    autostart: true,
    group: 'play',
    title: 'Block',
    blurb: 'The opponent attacks: assign a blocker to an incoming creature.',
    build: () => combatHumanBlockScenario(),
  },
  {
    id: 'planeswalker',
    autostart: true,
    group: 'play',
    title: 'Planeswalkers',
    blurb: 'A planeswalker on the board with loyalty counters and abilities.',
    build: () => planeswalkerScenario(),
  },
  {
    id: 'tokens',
    autostart: true,
    group: 'play',
    title: 'Tokens and counters',
    blurb: 'Token creation and stacked permanents laid out on the table.',
    build: () => tokensScenario(),
  },
  {
    id: 'thoughtseize',
    autostart: true,
    group: 'play',
    title: 'Reveal and choose',
    blurb: 'Thoughtseize: look at the opponent hand and choose a card.',
    build: () => thoughtseizeScenario(),
  },
  {
    id: 'commander',
    autostart: true,
    group: 'format',
    title: 'Commander pod',
    blurb: 'Four-player Commander table with command zone and commander damage.',
    build: () => commanderPlaygroundScenario(),
  },
  {
    id: 'draft',
    autostart: false,
    group: 'format',
    title: 'Booster draft',
    blurb: 'Pick cards pack by pack, then build the deck from the pool.',
    build: () => draftScenario(),
  },
  {
    id: 'tournament',
    autostart: false,
    group: 'format',
    title: 'Tournament',
    blurb: 'Standings, pairings and the bracket of a running tournament.',
    build: () => tournamentScenario(),
  },
]

export const DEFAULT_SCENARIO_ID = 'blaze'

export function scenarioIdFromSearch(search: string): string {
  const id = new URLSearchParams(search).get('scenario')
  return DEMO_SCENARIOS.some((s) => s.id === id) ? (id as string) : DEFAULT_SCENARIO_ID
}

function currentScenarioId(): string {
  return scenarioIdFromSearch(typeof window === 'undefined' ? '' : window.location.search)
}

function currentDef(): DemoScenarioDef {
  return DEMO_SCENARIOS.find((s) => s.id === currentScenarioId()) ?? DEMO_SCENARIOS[0]
}

const wrapped = new WeakMap<FakeConn, FakeConn>()

function withRoster(conn: FakeConn): FakeConn {
  const existing = wrapped.get(conn)
  if (existing) return existing
  const layered = Object.create(conn) as FakeConn
  layered.lobby = (tables, users) => {
    const ids = new Set(tables.map((t) => t.tableId))
    const extra = demoExtraTables().filter((t) => !ids.has(t.tableId))
    const title = currentDef().title
    const own = tables.filter((t) => !t.tableId.startsWith('demo-table-'))
    const named = own.length === 1 ? tables.map((t) => (t === own[0] ? { ...t, tableName: title } : t)) : tables
    conn.lobby([...named, ...extra], users && users.length > 0 ? users : demoRoster())
  }
  wrapped.set(conn, layered)
  return layered
}

export function withDemoLayer(base: Scenario): Scenario {
  return {
    receivedReports: base.receivedReports,
    onConnect: (conn) => base.onConnect?.(withRoster(conn)),
    onStart: (conn) => base.onStart?.(withRoster(conn)),
    onAction: (conn, action, args, requestId) => {
      const layered = withRoster(conn)
      if (action === 'fetchOnlineDeck' && args.source === 'edhrec') {
        const page = demoEdhrecPage(String(args.urlOrId ?? ''))
        if (page) layered.ok(requestId, action, page)
        else layered.fail(requestId, action, 'not found', 'CARD_NOT_FOUND')
        return
      }
      base.onAction?.(layered, action, args, requestId)
    },
  }
}

export function demoScenario(): Scenario {
  return withDemoLayer(currentDef().build())
}
