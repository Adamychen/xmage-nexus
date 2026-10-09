import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { bootPlan, bootPlanFromStorage } from './bootRestore'
import { isSetupDone, markSetupDone } from './setupFlag'
import { saveConn, loadConn, type ConnectionInfo } from '../state/persistence'

// vitest runs on jsdom but Node's own `localStorage` global shadows it here, so the
// device state is stubbed the way SetupWizard.test.tsx does it.
const store = new Map<string, string>()
const stub = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)) },
  removeItem: (k: string) => { store.delete(k) },
  clear: () => store.clear(),
  key: (i: number) => [...store.keys()][i] ?? null,
  get length() { return store.size },
}

const conn: ConnectionInfo = {
  wsHost: 'wss://proxy.example',
  proxyPort: 443,
  serverHost: 'beta.xmage.today',
  port: 17171,
  username: 'player',
  password: '',
}

beforeEach(() => {
  store.clear()
  vi.stubGlobal('localStorage', stub)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('bootPlan', () => {
  it('a device that never played shows the wizard and has nothing to restore', () => {
    expect(bootPlan(false, false)).toEqual({ restore: false, showWizard: true })
  })

  it('a stored connection restores even when the setup wizard was never finished', () => {
    // The regression: isSetupDone() used to gate the re-login too, so dismissing the
    // wizard with the X switched restoring off and landed the player back on login.
    expect(bootPlan(false, true)).toEqual({ restore: true, showWizard: false })
  })

  it('a finished wizard with a connection restores without the wizard', () => {
    expect(bootPlan(true, true)).toEqual({ restore: true, showWizard: false })
  })

  it('a finished wizard with no connection neither restores nor nags', () => {
    expect(bootPlan(true, false)).toEqual({ restore: false, showWizard: false })
  })
})

describe('bootPlanFromStorage', () => {
  it('reads the real device state: wizard first, session later', () => {
    expect(bootPlanFromStorage()).toEqual({ restore: false, showWizard: true })

    saveConn(conn)
    expect(bootPlanFromStorage()).toEqual({ restore: true, showWizard: false })
  })

  it('a saved connection made after closing the wizard with the X still restores', () => {
    // what the player who dismissed the wizard and then logged in has on the device
    saveConn(conn)
    expect(isSetupDone()).toBe(false)
    expect(bootPlanFromStorage()).toEqual({ restore: true, showWizard: false })
  })

  it('a completed wizard with no session stays quiet', () => {
    markSetupDone()
    expect(bootPlanFromStorage()).toEqual({ restore: false, showWizard: false })
  })

  it('a stored connection without a user is not a session', () => {
    store.set('mage-web-conn', JSON.stringify({ ...conn, username: '' }))
    expect(loadConn()?.username).toBe('')
    expect(bootPlanFromStorage()).toEqual({ restore: false, showWizard: true })
  })
})
