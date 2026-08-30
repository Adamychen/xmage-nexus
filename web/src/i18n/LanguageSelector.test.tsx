import { describe, it, expect, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import LanguageSelector from './LanguageSelector'

describe('LanguageSelector', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders with default language flag', () => {
    const { getByRole, getByText } = render(<LanguageSelector />)
    const btn = getByRole('button')
    expect(btn).not.toBeNull()
    expect(getByText(/Español|English/i)).not.toBeNull()
  })

  it('opens dropdown and allows selecting another language', () => {
    const { getByRole, getByText, queryByText } = render(<LanguageSelector />)
    const btn = getByRole('button')
    fireEvent.click(btn)

    expect(getByText('English')).not.toBeNull()
    expect(getByText('Deutsch')).not.toBeNull()
    expect(getByText('Français')).not.toBeNull()

    fireEvent.click(getByText('English'))
    expect(queryByText('Deutsch')).toBeNull()
  })
})
