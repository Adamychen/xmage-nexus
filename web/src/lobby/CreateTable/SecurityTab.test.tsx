import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import SecurityTab from './SecurityTab'

const stubForm = (over: Record<string, unknown> = {}) => ({
  password: '',
  setPassword: vi.fn(),
  showPassword: false,
  setShowPassword: vi.fn(),
  minimumRating: 0,
  quitRatio: 100,
  edhPowerLevel: 100,
  isMultiplayerGame: false,
  ...over,
}) as any

describe('SecurityTab password field', () => {
  afterEach(() => cleanup())

  it('caps the table password at 64 characters', () => {
    const { container } = render(<SecurityTab form={stubForm()} />)
    const input = container.querySelector('input[type="password"]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.maxLength).toBe(64)
  })
})
