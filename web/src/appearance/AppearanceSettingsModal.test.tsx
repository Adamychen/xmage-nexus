import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import AppearanceSettingsModal from './AppearanceSettingsModal'
import { getState, setSetting } from '../state/store'
import { t } from '../i18n'

afterEach(() => {
  setSetting('visibleCommander', true)
  cleanup()
})

describe('AppearanceSettingsModal', () => {
  it('toggles the visible commander setting in the board section', () => {
    setSetting('visibleCommander', true)
    render(<AppearanceSettingsModal onClose={() => {}} />)
    const row = screen.getByText(t('lobby', 'visible_commander_label')).closest('.ui-toggle-row') as HTMLElement
    const sw = row.querySelector('[role="switch"]') as HTMLElement
    expect(sw.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(sw)
    expect(getState().settings.visibleCommander).toBe(false)
    expect(sw.getAttribute('aria-checked')).toBe('false')
  })
})
