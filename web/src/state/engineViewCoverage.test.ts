import { describe, expect, it } from 'vitest'

// @ts-expect-error node: specifiers are not in the DOM lib; this test runs in Node under vitest
import { readFileSync } from 'node:fs'
// @ts-expect-error node: specifiers are not in the DOM lib; this test runs in Node under vitest
import { fileURLToPath } from 'node:url'
// @ts-expect-error node: specifiers are not in the DOM lib; this test runs in Node under vitest
import { dirname, resolve } from 'node:path'
// @ts-expect-error no type declarations for the oracle script (plain node .mjs)
import { computeEngineViewGap } from '../../../scripts/engine-view-schema.mjs'

const here = dirname(fileURLToPath(import.meta.url))

// Baseline of the engine→view gap, committed on purpose. The web client is a
// remote DTO client: any engine state that is NOT copied into the `mage.view.*`
// DTO cannot be shown, no matter what we do client-side. This baseline locks in
// the current set so a future XMage change that adds (or removes) engine-only
// state is caught — forcing a human to triage it.
const BASELINE = resolve(here, '../../fixtures/engine-view-gap.baseline.json')
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))

// Displayable state we KNOW lives in the engine but is not in the view DTO.
// These are accepted protocol limitations (only fixable by an upstream server
// change to `mage.view.*`), EXCEPT goad which, although field-missing, IS
// conveyed via `cardIcons` (OTHER_HAS_RESTRICTIONS) + `rules` text. If any of
// these disappears from the gap it means upstream started exposing it and the
// client should start modeling it.
const KNOWN_DISPLAYABLE_GAPS: Record<string, string[]> = {
  PermanentView: ['goadingPlayers', 'harnessed', 'monstrous', 'renowned'],
  PlayerView: ['abilities'],
}

const computed = computeEngineViewGap()

describe('engine→view coverage (no unexposed engine state goes unnoticed)', () => {
  it('engine→view gap matches the committed baseline', () => {
    expect(computed).toEqual(baseline)
  })

  for (const [view, fields] of Object.entries(KNOWN_DISPLAYABLE_GAPS)) {
    it(`known displayable gap '${view}' is still present in the engine→view diff`, () => {
      const missing = (computed[view]?.missing ?? []) as string[]
      for (const f of fields) {
        expect(missing, `Engine state '${f}' on ${view} is no longer engine-only — upstream may now expose it; model it client-side.`).toContain(f)
      }
    })
  }
})
