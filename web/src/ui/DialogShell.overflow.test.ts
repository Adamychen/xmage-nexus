// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const shell = readFileSync(fileURLToPath(new URL('./DialogShell.css', import.meta.url)), 'utf8')
const styles = readFileSync(fileURLToPath(new URL('../styles.css', import.meta.url)), 'utf8')
const create = readFileSync(fileURLToPath(new URL('../lobby/CreateTableDialog.css', import.meta.url)), 'utf8')

// Popups (modal dialogs and board overlays). Full-screen flows are NOT popups
// and keep their height: draft, construct, sideboard, deck builder, tournament
// panel and the context menu.
const popups = [
  'styles.css',
  'lobby/JoinTableDialog.css',
  'setup/SetupWizard.css',
  'board/PileOverlay.css',
  'board/CardInspector.css',
]

function rule(css: string, selector: string): string {
  const m = css.match(new RegExp(`(^|[,}\\s])${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`))
  return m ? m[2] : ''
}

describe('dialog height is a share of the screen', () => {
  // Los popups toman el 70% del alto de la pantalla (issue #12). Si alguien
  // vuelve a un valor en px o sube el porcentaje, este caso lo dice.
  it('caps every dialog at 70% of the viewport height', () => {
    expect(styles).toContain('--dlg-max-h: 70vh')
  })

  it('leaves no popup taller than that share', () => {
    const taller: string[] = []
    for (const file of popups) {
      const css = readFileSync(fileURLToPath(new URL(`../${file}`, import.meta.url)), 'utf8')
      for (const m of css.matchAll(/max-height:\s*(?:min\(\s*)?([\d.]+)vh/g)) {
        if (Number.parseFloat(m[1]) > 70) taller.push(`${file}: ${m[0].trim()}`)
      }
    }
    expect(taller).toEqual([])
  })
})

describe('create-table dialog overflow', () => {
  it('caps the large dialog with the shared token, not a hardcoded 90vh', () => {
    expect(rule(shell, '.dlg-lg')).toContain('max-height: var(--dlg-max-h)')
  })

  // Un solo eje de scroll, y que sea el CUERPO del paso: con el panel entero
  // desplazándose, el stepper y el botón Crear Mesa se iban fuera de pantalla.
  it('scrolls the step body, not the whole panel', () => {
    expect(rule(create, '.create-table-body')).toContain('overflow-y: auto')
    expect(rule(create, '.create-table-body')).toContain('flex: 1 1 auto')
    expect(rule(create, '.create-table-body')).toContain('min-height: 0')
    expect(rule(create, '.create-table-body')).not.toContain('max-height: 52vh')
  })

  it('lays the wizard out as a flex column so the chrome stays put', () => {
    expect(rule(create, '.create-table-dialog')).toContain('flex-direction: column')
  })

  it('ellipsizes step labels instead of letting them overflow', () => {
    expect(rule(create, '.wizard-step-text')).toContain('text-overflow: ellipsis')
  })
})