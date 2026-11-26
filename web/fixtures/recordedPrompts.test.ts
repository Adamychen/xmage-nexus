import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { parseFeedback } from '../src/game/feedback/parse'
import type { LibraryStep } from '../src/game/feedback/types'
import { createLibraryPlan, nextPlanAnswer } from '../src/game/feedback/libraryPlan'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROMPTS_DIR = path.join(__dirname, 'recorded', 'prompts')

interface RecordedPrompt {
  method: string
  objectId: string | null
  data: Record<string, unknown>
}

interface RecordedPrompts {
  recordedAt: string
  gameId: string | null
  prompts: RecordedPrompt[]
}

function load(file: string): RecordedPrompts {
  return JSON.parse(fs.readFileSync(path.join(PROMPTS_DIR, file), 'utf8')) as RecordedPrompts
}

function parsed(recording: RecordedPrompts) {
  return recording.prompts.map((p) => parseFeedback(p.method, p.objectId ?? recording.gameId, p.data))
}

const CHAINS: ReadonlyArray<{ file: string; steps: LibraryStep[]; pick: LibraryStep }> = [
  { file: 'surveil-chain.json', steps: ['surveil-pick', 'top-order'], pick: 'surveil-pick' },
  { file: 'scry-chain.json', steps: ['scry-pick', 'scry-pick', 'bottom-order'], pick: 'scry-pick' },
]

describe('prompt texts recorded from the engine', () => {
  for (const chain of CHAINS) {
    describe(chain.file, () => {
      const recording = load(chain.file)

      it('every recorded prompt parses', () => {
        expect(recording.prompts.length).toBeGreaterThan(0)
        for (const prompt of parsed(recording)) expect(prompt).not.toBeNull()
      })

      it('the library chain prompts get their libraryStep in recorded order', () => {
        const steps = parsed(recording)
          .map((prompt) => prompt?.libraryStep)
          .filter((step): step is LibraryStep => step !== undefined)
        expect(steps).toEqual(chain.steps)
      })

      it('only the mulligan ask is left without a libraryStep', () => {
        const rest = parsed(recording).filter((prompt) => prompt?.libraryStep === undefined)
        for (const prompt of rest) expect(prompt?.isMulligan).toBe(true)
      })

      it('every chain prompt carries the cards it asks about', () => {
        for (const prompt of parsed(recording).filter((p) => p?.libraryStep)) {
          expect(prompt?.cards?.length).toBe(2)
        }
      })

      it('the pick prompt lists the cards top of library first', () => {
        const pick = parsed(recording).find((prompt) => prompt?.libraryStep === chain.pick)
        expect(pick?.cards?.map((card) => card.name)).toEqual(['Mountain', 'Plains'])
      })
    })
  }
})

describe("kodamas-reach-chain.json (PRM-6: a library search for up to two cards)", () => {
  const recording = load('kodamas-reach-chain.json')
  const prompts = parsed(recording).filter((prompt) => prompt?.method === 'GAME_TARGET')

  it('PRM-6: the search states its maximum only in the message, and the parser reads it', () => {
    const search = prompts[0]!
    expect(search.max, 'the engine leaves max at 0').toBe(0)
    expect(search.progress).toEqual({ selected: 0, max: 2 })
    expect(search.libraryStep).toBeUndefined()
  })

  it('PRM-6: a plan of two lands answers the two search prompts and leaves the battlefield pick to the player', () => {
    const [search, again, battlefield] = prompts
    const away = search!.options.filter((o) => /Forest|Mountain/.test(o.label)).map((o) => o.id)
    const chosen = again!.chosenTargets ?? []
    const ordered = [...chosen, ...away.filter((id) => !chosen.includes(id))].slice(0, 2)
    let plan = createLibraryPlan(search!.gameId, (search!.cards ?? []).map((c) => c.id), { mode: 'pick', top: [], away: ordered })
    const first = nextPlanAnswer(plan, search!)!
    expect(first.answer).toEqual({ kind: 'uuid', value: ordered[0] })
    plan = first.plan
    const second = nextPlanAnswer(plan, again!)!
    expect(second.answer).toEqual({ kind: 'uuid', value: ordered[1] })
    expect(second.plan.settled).toBe(true)
    expect(nextPlanAnswer(second.plan, battlefield!), 'the battlefield pick is a new decision').toBeNull()
    expect(battlefield!.cards?.map((c) => c.name).sort()).toEqual(['Forest', 'Mountain'])
  })
})
