import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import LoginRetryHint from './LoginRetryHint'
import { t } from '../i18n'

describe('LoginRetryHint', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('counts the wait down so the retry does not look frozen', () => {
    render(<LoginRetryHint attempt={2} max={4} until={Date.now() + 5000} />)
    const expected = t('login', 'retrying_session', { s: 5, n: 2, max: 4 })
    expect(screen.getByTestId('login-retry-hint').textContent).toBe(expected)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByTestId('login-retry-hint').textContent)
      .toBe(t('login', 'retrying_session', { s: 3, n: 2, max: 4 }))
  })

  it('never shows a negative countdown', () => {
    render(<LoginRetryHint attempt={1} max={4} until={Date.now() - 1000} />)
    expect(screen.getByTestId('login-retry-hint').textContent)
      .toBe(t('login', 'retrying_session', { s: 0, n: 1, max: 4 }))
  })
})
