import { describe, expect, it } from 'vitest'
import { sanitizePromptText } from './promptText'
import { parseFeedback } from './parse'

const SLICER_RULE =
  "At the beginning of each opponent's upkeep, you may have that player gain control of {this} until end of turn. If you do, untap {this}, goad it, and it can't be sacrificed this turn. If you don't, convert it."

describe('sanitizePromptText', () => {
  it('resuelve {this} con el nombre de la fuente en el ASK real de Slicer', () => {
    const out = sanitizePromptText(SLICER_RULE, 'Slicer, Hired Muscle')
    expect(out).not.toContain('{this}')
    expect(out).toContain('Slicer, Hired Muscle')
    expect(out).toBe(
      "At the beginning of each opponent's upkeep, you may have that player gain control of Slicer, Hired Muscle until end of turn. If you do, untap Slicer, Hired Muscle, goad it, and it can't be sacrificed this turn. If you don't, convert it.",
    )
  })

  it('sin sourceName deja {this} visible y no inventa nombre', () => {
    const out = sanitizePromptText(SLICER_RULE)
    expect(out).toContain('{this}')
    expect(out).not.toContain('Slicer, Hired Muscle')
  })

  it('resuelve {THIS} (case-insensitive)', () => {
    expect(sanitizePromptText('{THIS} attacks', 'Slicer, Hired Muscle')).toBe('Slicer, Hired Muscle attacks')
  })

  it('no toca costes de maná', () => {
    expect(sanitizePromptText('Pay {1}{U}, {W/U}, {2/B} or {X}')).toBe('Pay {1}{U}, {W/U}, {2/B} or {X}')
  })

  it('sustituye ICON_REQUIRE / ICON_RESTRICT / ICON_GOOD / ICON_BAD', () => {
    expect(sanitizePromptText('ICON_REQUIREGoaded by Bob (must attack)')).toBe('⚠Goaded by Bob (must attack)')
    expect(sanitizePromptText("ICON_RESTRICTThis creature can't attack")).toBe("⊘This creature can't attack")
    expect(sanitizePromptText('ICON_GOOD{this} is monstrous', 'Bear')).toBe('✓Bear is monstrous')
    expect(sanitizePromptText("ICON_BAD{this} isn't renowned", 'Bear')).toBe("✗Bear isn't renowned")
    expect(sanitizePromptText("ICON_REQUIREGoaded by <font color='#20B2AA'>uslice20kjn3r</font> (must attack)"))
      .toBe('⚠Goaded by uslice20kjn3r (must attack)')
  })

  it('quita la marca del motor <br/><hintstart/>', () => {
    expect(sanitizePromptText('Hello<br/><hintstart/>')).toBe('Hello')
    expect(sanitizePromptText('<br/><hintstart/>')).toBe('')
  })

  it('convierte <br> y <br/> sueltos en espacio', () => {
    expect(sanitizePromptText('Line one<br/>Line two<br>Line three')).toBe('Line one Line two Line three')
  })

  it('elimina tags HTML y colapsa espacios dobles', () => {
    expect(sanitizePromptText("<i>Flying</i>  and   <font color='#fff'>haste</font>")).toBe('Flying and haste')
  })

  it('message vacío o undefined devuelve cadena vacía', () => {
    expect(sanitizePromptText(undefined)).toBe('')
    expect(sanitizePromptText('')).toBe('')
  })
})

describe('pipeline de prompts (parseFeedback)', () => {
  it('GAME_ASK sanea message con options.secondMessage', () => {
    const prompt = parseFeedback('GAME_ASK', 'g1', {
      message: '<b>Choose</b> a creature for {this}  now',
      options: { secondMessage: 'Slicer, Hired Muscle' },
    })
    expect(prompt?.message).toBe('Choose a creature for Slicer, Hired Muscle now')
    expect(prompt?.message).not.toContain('{this}')
  })
})
