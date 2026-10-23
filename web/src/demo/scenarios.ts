import type { FakeConn, Scenario } from '../../fixtures/fakeCore'
import type { TranslationSchema } from '../i18n'
import { t } from '../i18n'
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
  titleKey: keyof TranslationSchema['demo']
  blurbKey: keyof TranslationSchema['demo']
  autostart: boolean
  build: () => Scenario
}

export const DEMO_SCENARIOS: DemoScenarioDef[] = [
  {
    id: 'blaze',
    autostart: true,
    group: 'play',
    titleKey: 'scenario_blaze_title',
    blurbKey: 'scenario_blaze_blurb',
    build: () => spellsScenario('blaze'),
  },
  {
    id: 'modes',
    autostart: true,
    group: 'play',
    titleKey: 'scenario_modes_title',
    blurbKey: 'scenario_modes_blurb',
    build: () => spellsScenario('boros'),
  },
  {
    id: 'ballista',
    autostart: true,
    group: 'play',
    titleKey: 'scenario_ballista_title',
    blurbKey: 'scenario_ballista_blurb',
    build: () => spellsScenario('ballista'),
  },
  {
    id: 'targeting',
    autostart: true,
    group: 'play',
    titleKey: 'scenario_targeting_title',
    blurbKey: 'scenario_targeting_blurb',
    build: () => targetingScenario(),
  },
  {
    id: 'attack',
    autostart: true,
    group: 'play',
    titleKey: 'scenario_attack_title',
    blurbKey: 'scenario_attack_blurb',
    build: () => combatHumanAttackScenario(),
  },
  {
    id: 'block',
    autostart: true,
    group: 'play',
    titleKey: 'scenario_block_title',
    blurbKey: 'scenario_block_blurb',
    build: () => combatHumanBlockScenario(),
  },
  {
    id: 'planeswalker',
    autostart: true,
    group: 'play',
    titleKey: 'scenario_planeswalker_title',
    blurbKey: 'scenario_planeswalker_blurb',
    build: () => planeswalkerScenario(),
  },
  {
    id: 'tokens',
    autostart: true,
    group: 'play',
    titleKey: 'scenario_tokens_title',
    blurbKey: 'scenario_tokens_blurb',
    build: () => tokensScenario(),
  },
  {
    id: 'thoughtseize',
    autostart: true,
    group: 'play',
    titleKey: 'scenario_thoughtseize_title',
    blurbKey: 'scenario_thoughtseize_blurb',
    build: () => thoughtseizeScenario(),
  },
  {
    id: 'commander',
    autostart: true,
    group: 'format',
    titleKey: 'scenario_commander_title',
    blurbKey: 'scenario_commander_blurb',
    build: () => commanderPlaygroundScenario(),
  },
  {
    id: 'draft',
    autostart: false,
    group: 'format',
    titleKey: 'scenario_draft_title',
    blurbKey: 'scenario_draft_blurb',
    build: () => draftScenario(),
  },
  {
    id: 'tournament',
    autostart: false,
    group: 'format',
    titleKey: 'scenario_tournament_title',
    blurbKey: 'scenario_tournament_blurb',
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
    const title = t('demo', currentDef().titleKey)
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
