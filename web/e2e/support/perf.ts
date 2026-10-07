/**
 * Helpers de latencia percibida (plan4 §5.4) para los E2E:
 * - Marcas de `window.__magePerf` (click/ack/evento) del build dev.
 * - Sonda DOM para medir el primer cambio visual tras un clic con precisión
 *   sub-100 ms (MutationObserver + performance.now en la página).
 */

import type { Page } from '@playwright/test'
import type { HumanHelper } from '../wshelper'

export const LATENCY_ECHO_MS = 1200

export interface PerfEntry {
  kind: 'click' | 'ack' | 'event'
  name: string
  mono: number
  wall: number
  extra?: Record<string, unknown>
}

export async function perfClear(page: Page): Promise<void> {
  await page.evaluate(() => {
    ;(globalThis as unknown as { __magePerf?: { clear: () => void } }).__magePerf?.clear()
  })
}

export async function perfEntries(page: Page): Promise<PerfEntry[]> {
  return page.evaluate(() => {
    const perf = (globalThis as unknown as { __magePerf?: { entries: () => PerfEntry[] } }).__magePerf
    return perf?.entries() ?? []
  })
}

/**
 * Waits for `quietMs` with no server event arriving: with a delayed echo, events
 * from earlier actions (helper/scenario) are still in flight and the first one
 * landing after the click would be mistaken for its echo.
 *
 * NOTE: silence between arrivals does NOT mean an empty channel. With
 * `echoDelayMs` an event can be scheduled in the middle of that silence and
 * arrive 1200 ms later, so arrival-gap alone still allows an impossible "echo"
 * (faster than the delay). Hence the settling floor in `freezeAndDrain`.
 */
export async function waitEventsQuiet(page: Page, quietMs = LATENCY_ECHO_MS + 300, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const idle = await page.evaluate(() => {
      const perf = (globalThis as unknown as { __magePerf?: { entries: () => PerfEntry[] } }).__magePerf
      const events = (perf?.entries() ?? []).filter((e) => e.kind === 'event')
      const last = events.length ? events[events.length - 1].mono : 0
      return performance.now() - last
    })
    if (idle >= quietMs) return
    if (Date.now() > deadline) throw new Error(`eventos del servidor sin pausa de ${quietMs}ms`)
    await page.waitForTimeout(Math.min(200, quietMs - idle + 20))
  }
}

/**
 * Settling floor for a measurement window: 1500 ms (helper auto-pass timer) +
 * 300 ms (its retry step) + 1200 ms (the fake echo delay) is how long an event
 * scheduled before the freeze can still take to land.
 */
export const SETTLE_MS = 3_000

/**
 * Opens a measurement window: freezes the HumanHelper autopilot and drains the
 * channel before the click. Two waits are needed and neither is enough alone:
 *
 * - `SETTLE_MS`: the settling floor. The helper fires its auto-pass 1500 ms after
 *   a priority window opens (retrying every 300 ms) and the FixtureServer
 *   delays every event by 1200 ms, so anything sent before the pause can still
 *   land after the click. Without this floor the pause arrived too late and the
 *   spec measured "echoes" of 43/59/486/637/689 ms - a round trip the fake
 *   server cannot produce, which is the signature of timing someone else's
 *   request.
 * - `quietMs`: silence between arrivals, which is what cuts the Sim turn's emit
 *   chain (it emits every 400 ms, so 1500 ms without arrivals means it ended).
 *
 * With the emitter frozen, the floor satisfied and the channel silent, any event
 * arriving after the click really is the answer to the measured click.
 */
export async function freezeAndDrain(
  page: Page,
  helper: HumanHelper,
  quietMs = LATENCY_ECHO_MS + 300,
  timeoutMs = 15_000,
): Promise<void> {
  helper.paused = true
  await page.waitForTimeout(SETTLE_MS)
  await waitEventsQuiet(page, quietMs, timeoutMs)
}

export interface AckProbeExpect {
  className?: string
  disabled?: boolean
  textIncludes?: string
}

/**
 * Arma una sonda sobre `selector`: escucha el próximo clic (captura) y mide con
 * `performance.now()` cuánto tarda en cumplirse `expect` (clase/disabled/texto).
 * El clic lo ejecuta el test por la vía que prefiera (Playwright/sceneClick).
 */
export async function armAckProbe(page: Page, selector: string, expect: AckProbeExpect): Promise<void> {
  await page.evaluate(
    ({ selector, expect }) => {
      const state: { t0: number; elapsed: number; ok: boolean | null; observer?: MutationObserver } = {
        t0: -1,
        elapsed: -1,
        ok: null,
      }
      ;(window as unknown as { __mageAck?: unknown }).__mageAck = state
      const matches = (): boolean => {
        const node = document.querySelector(selector)
        if (!node) return false
        if (expect.className && !node.classList.contains(expect.className)) return false
        if (expect.disabled && !(node as HTMLButtonElement).disabled) return false
        if (expect.textIncludes && !(node.textContent ?? '').includes(expect.textIncludes)) return false
        return true
      }
      const check = () => {
        if (state.t0 < 0 || state.ok !== null) return
        if (matches()) {
          state.ok = true
          state.elapsed = performance.now() - state.t0
        }
      }
      document.addEventListener('click', () => { state.t0 = performance.now() }, { capture: true, once: true })
      state.observer = new MutationObserver(check)
      state.observer.observe(document.body, {
        subtree: true,
        attributes: true,
        childList: true,
        characterData: true,
      })
      setTimeout(() => { if (state.ok === null) state.ok = false }, 5000)
    },
    { selector, expect },
  )
}

/** Ms hasta el primer cambio visual observado; -1 si no llegó. */
export async function readAckMs(page: Page, timeoutMs = 3000): Promise<number> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const res = await page.evaluate(() => {
      const s = (window as unknown as {
        __mageAck?: { ok: boolean | null; elapsed: number; observer?: MutationObserver }
      }).__mageAck
      if (!s || s.ok === null) return { done: false as const }
      s.observer?.disconnect()
      return { done: true as const, ok: s.ok, elapsed: s.elapsed }
    })
    if (res.done) return res.ok ? res.elapsed : -1
    if (Date.now() > deadline) return -1
    await page.waitForTimeout(20)
  }
}
