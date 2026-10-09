import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import App from './App'

const { doConnect } = vi.hoisted(() => ({ doConnect: vi.fn<() => Promise<void>>() }))

vi.mock('./state/gateway', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./state/gateway')>()
  return { ...actual, doConnect }
})

const store = new Map<string, string>()
const stub = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size },
}

const session = {
  wsHost: 'wss://proxy.example',
  proxyPort: 443,
  serverHost: 'beta.xmage.today',
  port: 17171,
  username: 'player',
  password: '',
}

beforeEach(() => {
  doConnect.mockClear()
  store.clear()
  vi.stubGlobal('localStorage', stub)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('what App does on load', () => {
  it('logs back in with the saved connection', async () => {
    store.set('nexus_setup_v', '1')
    store.set('mage-web-conn', JSON.stringify(session))

    render(<App />)

    await waitFor(() => expect(doConnect).toHaveBeenCalled())
    expect(doConnect).toHaveBeenCalledWith(
      'wss://proxy.example', 443, 'beta.xmage.today', 17171, 'player', '', undefined, undefined,
    )
  })

  it('logs back in even when the setup wizard was never completed', async () => {
    // The device state of the bug: the wizard was dismissed with the X, so no setup
    // flag, and the saved connection is what should bring the session back.
    store.set('mage-web-conn', JSON.stringify(session))

    render(<App />)

    await waitFor(() => expect(doConnect).toHaveBeenCalled())
  })

  it('dials nothing when the device holds no session', () => {
    render(<App />)

    expect(doConnect).not.toHaveBeenCalled()
  })

  it('shows the wizard on a device that never played, and not on one that did', () => {
    const first = render(<App />)
    expect(first.getByTestId('setup-wizard')).toBeTruthy()
    first.unmount()

    store.set('mage-web-conn', JSON.stringify(session))
    const second = render(<App />)
    expect(second.queryByTestId('setup-wizard')).toBeNull()
  })
})