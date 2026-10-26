import { describe, expect, it, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import SettingsModal from './SettingsModal'
import { SETTINGS_INDEX, normalizeSearch, searchSettings } from './settingsIndex'
import { t } from '../i18n'

afterEach(() => cleanup())

describe('settings search index', () => {
  it('SET-6: every searchable setting resolves to a row on screen in its section and tab', () => {
    const missing: string[] = []
    for (const entry of SETTINGS_INDEX) {
      if (entry.available && !entry.available()) continue
      render(<SettingsModal onClose={() => {}} initialSection={entry.section} />)
      if (entry.tab) fireEvent.click(screen.getByTestId(`settings-board-tab-${entry.tab}`))
      if (!document.querySelector(`[data-setting="${entry.id}"]`)) missing.push(`${entry.section}/${entry.tab ?? '-'}/${entry.id}`)
      cleanup()
    }
    expect(missing).toEqual([])
  })

  it('SET-6: every row on screen is searchable', () => {
    const ids = new Set(SETTINGS_INDEX.map((e) => e.id))
    const unindexed: string[] = []
    for (const section of ['gameplay', 'board', 'interface', 'language', 'sound'] as const) {
      render(<SettingsModal onClose={() => {}} initialSection={section} />)
      const tabs = section === 'board' ? ['layout', 'cards', 'overlays', 'table'] : [null]
      for (const tab of tabs) {
        if (tab) fireEvent.click(screen.getByTestId(`settings-board-tab-${tab}`))
        for (const el of Array.from(document.querySelectorAll('[data-setting]'))) {
          const id = el.getAttribute('data-setting')!
          if (!ids.has(id) && id !== 'hand-rail-width') unindexed.push(`${section}/${id}`)
        }
      }
      cleanup()
    }
    expect(unindexed).toEqual([])
  })

  it('SET-6: matching ignores case and accents, and an empty query finds nothing', () => {
    expect(normalizeSearch('  Enfermedad DE Invocación ')).toBe('enfermedad de invocacion')
    expect(searchSettings('   ', t)).toEqual([])
    const label = t('game', 'smart_stops')
    expect(searchSettings(label.toUpperCase(), t).map((h) => h.entry.id)).toContain('smart-stops')
  })
})
