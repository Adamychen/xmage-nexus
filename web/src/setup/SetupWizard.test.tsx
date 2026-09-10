import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SetupWizard from './SetupWizard'
import { isSetupDone } from './setupFlag'
import { loadConn } from '../state/persistence'

const mockStorage: Record<string, string> = {}

beforeEach(() => {
  for (const k of Object.keys(mockStorage)) delete mockStorage[k]
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, value: string) => {
      mockStorage[key] = value
    },
    removeItem: (key: string) => {
      delete mockStorage[key]
    },
    clear: () => {
      for (const k of Object.keys(mockStorage)) delete mockStorage[k]
    },
  })
  try { localStorage.removeItem('mage-web-conn') } catch {}
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function next(times = 1) {
  for (let i = 0; i < times; i++) fireEvent.click(screen.getByTestId('setup-next'))
}

describe('SetupWizard', () => {
  it('walks the seven steps with back/next and a live counter', () => {
    render(<SetupWizard onClose={() => {}} />)
    expect(screen.getByTestId('setup-wizard')).toBeTruthy()
    expect(screen.getByTestId('setup-counter').textContent).toContain('1')
    expect(screen.getByTestId('settings-ui-lang')).toBeTruthy()

    next()
    expect(screen.getByTestId('setup-username')).toBeTruthy()
    expect(screen.getByTestId('setup-counter').textContent).toContain('2')

    next()
    expect(screen.getByTestId('setup-preset-official')).toBeTruthy()
    fireEvent.click(screen.getByTestId('setup-back'))
    expect(screen.getByTestId('setup-username')).toBeTruthy()
    next(2)
    expect(screen.getByTestId('settings-layout-arena')).toBeTruthy()
    expect(screen.getByTestId('setup-counter').textContent).toContain('4')

    next()
    expect(screen.getByTestId('settings-sound-card')).toBeTruthy()

    next()
    expect(screen.getByTestId('setup-counter').textContent).toContain('6')

    next()
    expect(screen.getByTestId('setup-enter')).toBeTruthy()
    expect(screen.getByTestId('setup-counter').textContent).toContain('7')
  })

  it('skip marks setup done with defaults and closes', () => {
    const onClose = vi.fn()
    render(<SetupWizard onClose={onClose} />)
    fireEvent.click(screen.getByTestId('setup-skip'))
    expect(isSetupDone()).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('finish saves identity+server, notifies login and closes', () => {
    const onClose = vi.fn()
    const seen: Event[] = []
    const listener = (e: Event) => seen.push(e)
    window.addEventListener('nexus:setup-conn', listener)
    try {
      render(<SetupWizard onClose={onClose} />)
      next()
      fireEvent.change(screen.getByTestId('setup-username'), { target: { value: 'nuevo' } })
      next()
      fireEvent.click(screen.getByTestId('setup-preset-official'))
      next(4)
      fireEvent.click(screen.getByTestId('setup-enter'))
    } finally {
      window.removeEventListener('nexus:setup-conn', listener)
    }
    expect(isSetupDone()).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    const saved = loadConn()
    expect(saved?.username).toBe('nuevo')
    expect(saved?.serverHost).toBe('beta.xmage.today')
    expect(seen).toHaveLength(1)
  })

  it('custom server preset reveals network fields', () => {
    render(<SetupWizard onClose={() => {}} />)
    next(2)
    expect(screen.queryByTestId('setup-server-host')).toBeNull()
    fireEvent.click(screen.getByTestId('setup-preset-custom'))
    expect(screen.getByTestId('setup-proxy-host')).toBeTruthy()
    expect(screen.getByTestId('setup-server-host')).toBeTruthy()
    expect(screen.getByTestId('setup-port')).toBeTruthy()
  })
})
