import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function css(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

function block(source: string, selector: string): string {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = source.match(new RegExp(`(^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`))
  if (!match) throw new Error(`selector not found: ${selector}`)
  return match[2]
}

/** Todos los X de cerrar modal/overlay: el glifo (Icon SVG) debe quedar centrado
 *  en su caja, sin depender de la métrica de la fuente. */
const CLOSE_BUTTONS: Array<[string, string]> = [
  ['./DialogShell.css', '.dlg-close'],
  ['../settings/SettingsModal.css', '.settings-close'],
  ['../appearance/AppearanceSettingsModal.css', '.appearance-close'],
  ['../appearance/SleevePickerModal.css', '.sleeve-picker-close'],
  ['../lobby/CreateTableDialog.css', '.create-dialog-close-btn'],
  ['../lobby/JoinTableDialog.css', '.close-btn'],
  ['../lobby/TournamentBracket.css', '.tournament-close-btn'],
  ['../lobby/LeaderboardModal.css', '.leaderboard-close-btn'],
  ['../lobby/UserActionModal.css', '.user-action-close-btn'],
  ['../lobby/AvatarPickerModal.css', '.avatar-picker-close-btn'],
  ['../game/HelpWikiModal.css', '.wiki-close-btn'],
  ['../game/TournamentPanel.css', '.tournament-panel-close'],
  ['../game/CardPreview.css', '.card-preview-close'],
  ['../decks/DeckImportModal.css', '.deck-import-close-btn'],
  ['../system/AboutModal.css', '.about-close-btn'],
  ['./../board/PileOverlay.css', '.pile-overlay-close'],
]

describe('modal close buttons are centered (no font-metric drift)', () => {
  it.each(CLOSE_BUTTONS)('%s %s', (file, selector) => {
    const decls = block(css(file), selector)
    const display = decls.match(/display:\s*([a-z-]+)/)?.[1]
    if (display === 'grid') {
      expect(decls).toContain('place-items: center')
      return
    }
    expect(['flex', 'inline-flex'], `${selector} display=${display}`).toContain(display)
    expect(decls).toContain('align-items: center')
    expect(decls).toContain('justify-content: center')
  })
})
