import { describe, expect, it } from 'vitest'
import { pickerColumns } from './settingsUi'

describe('pickerColumns', () => {
  it('SET-13: four or more options that pair up go two per row in a medium container', () => {
    expect(pickerColumns(4)).toMatchObject({ '--cols': 4, '--cols-mid': 2, '--cols-narrow': 2 })
    expect(pickerColumns(6)).toMatchObject({ '--cols': 6, '--cols-mid': 2, '--cols-narrow': 2 })
  })

  it('SET-13: fewer options, or an odd count, keep one column each until the narrow layout', () => {
    expect(pickerColumns(2)).toMatchObject({ '--cols': 2, '--cols-mid': 2, '--cols-narrow': 2 })
    expect(pickerColumns(3)).toMatchObject({ '--cols': 3, '--cols-mid': 3, '--cols-narrow': 1 })
    expect(pickerColumns(5)).toMatchObject({ '--cols': 5, '--cols-mid': 5, '--cols-narrow': 1 })
  })
})
