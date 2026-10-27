import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import MechanicsGlossary from './MechanicsGlossary'

describe('MechanicsGlossary', () => {
  afterEach(() => {
    cleanup()
  })

  it('PNL-9: lists the seven table mechanics, each with its own name and explanation', () => {
    const { getByTestId } = render(<MechanicsGlossary />)
    const glossary = getByTestId('mechanics-glossary')
    const names = [...glossary.querySelectorAll('dt')].map((el) => el.textContent ?? '')
    const texts = [...glossary.querySelectorAll('dd')].map((el) => el.textContent ?? '')
    expect(names).toHaveLength(7)
    expect(texts).toHaveLength(7)
    expect(names.every((name) => name.length > 0)).toBe(true)
    expect(texts.every((text) => text.length > 0)).toBe(true)
  })

  it('PNL-9: no entry reuses the text of another, and no name repeats as a title', () => {
    const { getByTestId } = render(<MechanicsGlossary />)
    const glossary = getByTestId('mechanics-glossary')
    const names = [...glossary.querySelectorAll('dt')].map((el) => el.textContent ?? '')
    const texts = [...glossary.querySelectorAll('dd')].map((el) => el.textContent ?? '')
    expect(new Set(names).size).toBe(names.length)
    expect(new Set(texts).size).toBe(texts.length)
    const heading = glossary.textContent ?? ''
    for (const name of names) {
      expect(heading.split(name).length - 1, name).toBe(1)
    }
    expect(glossary.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(0)
  })
})
