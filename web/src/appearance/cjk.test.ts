import { describe, expect, it } from 'vitest'
import { applyAppearanceToDocument, DEFAULT_APPEARANCE } from '../state/persistence'

function cjkState() {
  const root = document.documentElement
  return {
    boost: root.style.getPropertyValue('--cjk-boost'),
    flag: root.dataset.cjkBoost,
    lang: root.lang,
  }
}

describe('cjk boost wiring', () => {
  it.each([
    ['ja', '1.15', '1'],
    ['zhs', '1.15', '1'],
    ['zh', '1.15', '1'],
  ])('applies 1.15 boost for CJK lang %s when enabled', (lang, boost, flag) => {
    applyAppearanceToDocument({ ...DEFAULT_APPEARANCE, cjkBoost: true }, lang)
    expect(cjkState()).toMatchObject({ boost, flag })
  })

  it.each(['fr', 'es', 'en', 'de'])('stays neutral for non-CJK lang %s', (lang) => {
    applyAppearanceToDocument({ ...DEFAULT_APPEARANCE, cjkBoost: true }, lang)
    expect(cjkState()).toMatchObject({ boost: '1', flag: '0' })
  })

  it('stays neutral when the setting is off even for ja', () => {
    applyAppearanceToDocument({ ...DEFAULT_APPEARANCE, cjkBoost: false }, 'ja')
    expect(cjkState()).toMatchObject({ boost: '1', flag: '0' })
  })

  it('maps zhs to root lang zh', () => {
    applyAppearanceToDocument({ ...DEFAULT_APPEARANCE, cjkBoost: true }, 'zhs')
    expect(document.documentElement.lang).toBe('zh')
  })
})
