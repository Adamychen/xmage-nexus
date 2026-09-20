/**
 * Helpers de latencia percibida (plan4 §5.4) para los E2E:
 * - `withDelayedFakeServer`: FixtureServer con retardo de eco configurable.
 * - Marcas de `window.__magePerf` (click/ack/evento) del build dev.
 * - Sonda DOM para medir el primer cambio visual tras un clic con precisión
 *   sub-100 ms (MutationObserver + performance.now en la página).
 */

import type { Page } from '@playwright/test'
import { FakeServer, type FakeServerOptions, type Scenario } from '../../fixtures/fake'
import { FAKE_MODE } from '../dual'
import { getFakePort, setFakePort } from './fake-port'

export const LATENCY_ECHO_MS = 1200

/** Arranca un FixtureServer con eco diferido (no-op en modo real). */
export async function withDelayedFakeServer<T>(
  makeScenario: () => Scenario,
  run: () => Promise<T>,
  echoDelayMs = LATENCY_ECHO_MS,
): Promise<T> {
  if (!FAKE_MODE) return run()
  const server = await FakeServer.start(0, makeScenario, { echoDelayMs } satisfies FakeServerOptions)
  const previousPort = getFakePort()
  setFakePort(server.port)
  try {
    return await run()
  } finally {
    try {
      await server.stop()
    } finally {
      setFakePort(previousPort)
    }
  }
}

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
 * Espera a que no llegue ningún evento del servidor durante `quietMs`: con eco
 * diferido, los eventos de acciones previas (helper/escenario) siguen en vuelo
 * y el primero que aterriza tras el clic se confundiría con su eco.
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
