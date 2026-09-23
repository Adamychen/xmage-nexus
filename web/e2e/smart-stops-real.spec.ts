import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { FAKE_MODE } from './dual'
import { startGame } from './support/start-game'
import { framesOf, parseSent, sentOf } from './support/frames'
import { writeFileSync } from 'node:fs'
import { DECK } from '../fixtures/deck-names'

test.skip(FAKE_MODE, 'Real only: validates smart stops against the canPlayObjects the XMage engine actually sends.')

test.setTimeout(300_000)

const STALL_MS = 3_000
const HOLD_MS = 2_000

interface Live {
  turn: number
  step: string
  hasPriority: boolean
  isActive: boolean
  feedback: string | null
  combat: boolean
  meaningful: string[]
  lands: number
}

async function live(page: Page): Promise<Live> {
  return page.evaluate(() => {
    const s = (globalThis as any).__mageStore?.getState?.()
    const g = s?.game
    const me = g?.players?.find((p: any) => p.controlled)
    const meaningful: string[] = []
    for (const [id, st] of Object.entries<any>(g?.canPlayObjects?.objects ?? {})) {
      if ((st?.basicPlayAbilities?.length ?? 0) + (st?.basicCastAbilities?.length ?? 0) + (st?.other?.length ?? 0) > 0) meaningful.push(id)
    }
    for (const id of s?.playableIds ?? []) if (g?.myHand?.[id] && !meaningful.includes(id)) meaningful.push(id)
    const lands = Object.values<any>(me?.battlefield ?? {}).filter((c) => (c.cardTypes ?? []).includes('LAND')).length
    return {
      turn: g?.turn ?? 0,
      step: g?.step ?? '',
      hasPriority: !!me?.hasPriority,
      isActive: !!me?.isActive,
      feedback: (s?.feedback?.method as string | undefined) ?? null,
      combat: (s?.combat?.selectable?.length ?? 0) > 0,
      meaningful,
      lands,
    }
  })
}

function autoPasses(page: Page): number {
  return parseSent(sentOf(page)).filter((f) => f.action === 'sendPlayerBoolean' && f.args?.value === false).length
}

test('smart stops pass empty windows and hold castable ones (real engine)', { tag: '@smart-stops-real' }, async ({ page }) => {
  const session = await startGame(page, { prefix: 'ss', deck: DECK.bolt, simDeck: DECK.aiLands })
  await session.helper.stop()
  await page.evaluate(() => (globalThis as any).__mageStore.setSetting('smartStops', true))

  const passBtn = page.locator('.big-action-btn.interactive')
  const stops: Array<{ phase: 1 | 2; turn: number; step: string; mine: boolean }> = []
  let manualPasses = 0
  let stallSince: { key: string; at: number } | null = null
  let landPlayed = false
  const deadline = Date.now() + (process.env.SS_DEADLINE_MS ? Number(process.env.SS_DEADLINE_MS) : 240_000)

  try {
    while (Date.now() < deadline) {
      const g = await live(page)

      if (g.feedback === 'GAME_TARGET') {
        await page.locator('.hand-card.targetable, .card-grid-cell').last().click({ timeout: 5_000 }).catch(() => {})
        await page.waitForTimeout(300)
        continue
      }
      if (!g.hasPriority || g.feedback || g.combat) {
        stallSince = null
        await page.waitForTimeout(100)
        continue
      }

      const key = `${g.turn}|${g.step}|${g.meaningful.join(',')}`
      if (g.meaningful.length === 0) {
        if (!stallSince || stallSince.key !== key) stallSince = { key, at: Date.now() }
        if (Date.now() - stallSince.at > STALL_MS) {
          throw new Error(`smart stops did not pass an empty window: turn=${g.turn} step=${g.step} active=${g.isActive}`)
        }
        await page.waitForTimeout(100)
        continue
      }
      stallSince = null

      const phase: 1 | 2 = g.lands > 0 ? 2 : 1
      await page.waitForTimeout(HOLD_MS)
      const after = await live(page)
      expect(after.turn, `held window moved on its own (${g.step})`).toBe(g.turn)
      expect(after.step, `held window moved on its own (turn ${g.turn})`).toBe(g.step)
      expect(after.hasPriority, `lost priority in a castable window (${g.step})`).toBe(true)
      stops.push({ phase, turn: g.turn, step: g.step, mine: g.isActive })

      const phase2OppStop = stops.some((s) => s.phase === 2 && !s.mine)
      if (phase2OppStop) break

      const phase1MyTurns = new Set(stops.filter((s) => s.phase === 1 && s.mine).map((s) => s.turn)).size
      if (!landPlayed && phase1MyTurns >= 2 && g.isActive && g.step === 'PRECOMBAT_MAIN') {
        await page.locator('[data-testid="hand-bar"] .hand-card.playable', { hasText: 'Mountain' }).first()
          .dispatchEvent('click', undefined, { timeout: 10_000 })
        landPlayed = true
        await expect.poll(async () => (await live(page)).lands, { timeout: 15_000 }).toBeGreaterThan(0)
        continue
      }

      await passBtn.click()
      manualPasses++
      await expect.poll(async () => {
        const n = await live(page)
        return `${n.turn}|${n.step}|${n.hasPriority}`
      }, { timeout: 20_000 }).not.toBe(`${g.turn}|${g.step}|true`)
    }
  } finally {
    if (process.env.SS_DUMP) {
      const rows: Array<[number, string]> = []
      for (const f of framesOf(page)) {
        if (!f || f.type !== 'event') continue
        const gv = (f.data as any)?.gameView
        const me = gv?.players?.find((p: any) => p.controlled)
        const objs = Object.values<any>(gv?.canPlayObjects?.objects ?? {})
        const nonMana = objs.filter((st) => (st?.basicPlayAbilities?.length ?? 0) + (st?.basicCastAbilities?.length ?? 0) + (st?.other?.length ?? 0) > 0).length
        rows.push([f.__t as number, `IN  ${f.method} ${gv ? `t${gv.turn} ${gv.step} prio=${!!me?.hasPriority} active=${!!me?.isActive} cycle=${gv.gameCycle} objs=${objs.length} nonMana=${nonMana}` : ''}`])
      }
      rows.push([Date.now(), `STOPS ${JSON.stringify(stops)}`])
    for (const f of sentOf(page)) if (f) rows.push([f.__t as number, `OUT ${f.action} ${JSON.stringify(f.args ?? {})}`])
      rows.sort((a, b) => a[0] - b[0])
      writeFileSync(process.env.SS_DUMP, rows.map(([t, l]) => `${t} ${l}`).join('\n'))
    }
  }

  const phase1 = stops.filter((s) => s.phase === 1)
  const phase2Opp = stops.filter((s) => s.phase === 2 && !s.mine)
  console.log(`[smart-stops-real] stops=${JSON.stringify(stops)} manualPasses=${manualPasses} totalPasses=${autoPasses(page)}`)
  expect(phase1.every((s) => s.mine && (s.step === 'PRECOMBAT_MAIN' || s.step === 'POSTCOMBAT_MAIN')), 'phase 1 must only stop in my main phases').toBe(true)
  expect(phase1.length, 'phase 1 should have reached my main phases').toBeGreaterThan(0)
  expect(phase2Opp.length, 'with Bolt castable the client must stop in the opponent turn').toBeGreaterThan(0)
  expect(autoPasses(page) - manualPasses, 'the client should have passed empty windows by itself').toBeGreaterThan(3)
  expect(session.pageErrors, `pageerrors: ${session.pageErrors.map(String).join(' | ')}`).toEqual([])
})
