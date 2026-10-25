// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LoginScreen from './LoginScreen'
import { doConnect } from '../state/gateway'
import { setState } from '../state/state'
import { saveConn, loadConn } from '../state/persistence'

vi.mock('../state/gateway', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../state/gateway')>()),
  doConnect: vi.fn(() => Promise.resolve()),
}))

function portInputs(container: HTMLElement) {
  const [proxy, server] = Array.from(container.querySelectorAll<HTMLInputElement>('.network-field-port input'))
  return { proxy, server }
}

function submit(container: HTMLElement) {
  fireEvent.submit(container.querySelector('form')!)
}

describe('LoginScreen ports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setState({ phase: 'idle', error: null } as never)
  })

  afterEach(() => {
    cleanup()
  })

  it('LBY-1: an empty server port is not replaced by 17171: it warns and does not connect', () => {
    const { container } = render(<LoginScreen />)
    const { server } = portInputs(container)
    fireEvent.change(server, { target: { value: '' } })
    expect(server.value).toBe('')
    submit(container)
    expect(doConnect).not.toHaveBeenCalled()
    expect(container.querySelector('.error-box')?.textContent).toMatch(/65535/)
  })

  it('LBY-1: the proxy port can be cleared and retyped (does not snap back to 8787)', () => {
    const { container } = render(<LoginScreen />)
    const { proxy } = portInputs(container)
    fireEvent.change(proxy, { target: { value: '' } })
    expect(proxy.value).toBe('')
    fireEvent.change(proxy, { target: { value: '9000' } })
    expect(proxy.value).toBe('9000')
  })

  it('LBY-1: rejects ports outside 1-65535 without connecting', () => {
    const { container } = render(<LoginScreen />)
    const { proxy, server } = portInputs(container)
    fireEvent.change(server, { target: { value: '70000' } })
    submit(container)
    expect(doConnect).not.toHaveBeenCalled()

    fireEvent.change(server, { target: { value: '17172' } })
    fireEvent.change(proxy, { target: { value: '0' } })
    submit(container)
    expect(doConnect).not.toHaveBeenCalled()
    expect(container.querySelector('.error-box')?.textContent).toMatch(/65535/)
  })

  it('LBY-1: valid ports connect with those ports', () => {
    const { container } = render(<LoginScreen />)
    const { proxy, server } = portInputs(container)
    fireEvent.change(proxy, { target: { value: '8790' } })
    fireEvent.change(server, { target: { value: '17172' } })
    submit(container)
    expect(doConnect).toHaveBeenCalledWith(expect.any(String), 8790, expect.any(String), 17172, expect.any(String), expect.any(String), expect.anything(), expect.anything())
  })
})

describe('LoginScreen contributors', () => {
  afterEach(() => {
    cleanup()
  })

  it('LBY-16: lists every contributor in a box beside the card, without taking clicks', () => {
    const { getByTestId } = render(<LoginScreen />)
    const box = getByTestId('login-contributors')
    expect(box.querySelector('h2')?.textContent).toBeTruthy()
    const names = Array.from(box.querySelectorAll('li')).map((li) => li.textContent)
    expect(names).toEqual(['NovaGlow', 'DarioBarrabinoDev'])
  })
})

describe('LoginScreen saved connection', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
  })

  it('LBY-17: reopening with a saved connection leaves the password field empty', () => {
    vi.stubEnv('DEV', false)
    saveConn({ wsHost: 'localhost', proxyPort: 8787, serverHost: 'localhost', port: 17171, username: 'alice', password: 'secret' })
    const { getByTestId, unmount } = render(<LoginScreen />)
    expect((getByTestId('login-password') as HTMLInputElement).value).toBe('')
    expect(loadConn()?.password).toBe('')
    unmount()
  })

  it('LBY-17: a password typed before leaving is not restored on remount', () => {
    vi.stubEnv('DEV', false)
    saveConn({ wsHost: 'localhost', proxyPort: 8787, serverHost: 'localhost', port: 17171, username: 'alice', password: 'secret' })
    const first = render(<LoginScreen />)
    fireEvent.change(first.getByTestId('login-password'), { target: { value: 'typed-later' } })
    first.unmount()
    const { getByTestId } = render(<LoginScreen />)
    expect((getByTestId('login-password') as HTMLInputElement).value).toBe('')
  })
})
