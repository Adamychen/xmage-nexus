import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { t } from '../i18n'
import { matchingSets, playableSets, setCodeFor } from './scryfallSets'
import { matchingKeywords } from './keywordCatalog'
import { buildScryfallQuery } from './filterQuery'

const scryfallJson = vi.hoisted(() => vi.fn(async (url: string) => url.includes('/catalog/keyword-abilities') ? ({
  data: ['Flying', 'First strike', 'Living weapon', 'Afflict'],
}) : ({
  data: [
    { code: 'MSC', name: 'Marvel Super Heroes Commander', set_type: 'commander' },
    { code: 'mh3', name: 'Modern Horizons 3', set_type: 'draft_innovation' },
    { code: 'tmh3', name: 'Modern Horizons 3 Tokens', set_type: 'token' },
    { code: 'ymh3', name: 'Alchemy: MH3', set_type: 'alchemy', digital: true },
  ],
})))
vi.mock('../cards/scryfallClient', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cards/scryfallClient')>()),
  scryfallJson,
}))

const { ArenaFilterBar } = await import('./ArenaFilterBar')

function renderBar(over: Partial<Parameters<typeof ArenaFilterBar>[0]> = {}) {
  const props = {
    query: '',
    onQueryChange: vi.fn(),
    colorFilter: new Set<string>(),
    onToggleColor: vi.fn(),
    cmcFilter: null,
    onCmcChange: vi.fn(),
    typeFilter: null,
    onTypeChange: vi.fn(),
    rarityFilter: new Set<never>(),
    onToggleRarity: vi.fn(),
    keywordFilter: new Set<string>(),
    onToggleKeyword: vi.fn(),
    powerFilter: null,
    onPowerChange: vi.fn(),
    toughnessFilter: null,
    onToughnessChange: vi.fn(),
    setFilter: null,
    onSetChange: vi.fn(),
    onReset: vi.fn(),
    ...over,
  }
  render(<ArenaFilterBar {...props} />)
  return props
}

const setOptions = () => within(screen.getByRole('listbox')).getAllByRole('option')

afterEach(() => {
  cleanup()
  scryfallJson.mockClear()
})

describe('ArenaFilterBar', () => {
  it('DCK-22: mana value is one dropdown, and All clears it', () => {
    const props = renderBar({ cmcFilter: 3 })
    const select = screen.getByRole('combobox', { name: t('decks', 'filter_cmc') }) as HTMLSelectElement

    expect(select.value).toBe('3')
    expect([...select.options].map((o) => o.textContent)).toEqual([t('common', 'all'), '0', '1', '2', '3', '4', '5', '6', '7+'])
    fireEvent.change(select, { target: { value: '7' } })
    expect(props.onCmcChange).toHaveBeenLastCalledWith(7)
    fireEvent.change(select, { target: { value: '' } })
    expect(props.onCmcChange).toHaveBeenLastCalledWith(null)
  })

  it('DCK-22: card type is one dropdown, and All clears it', () => {
    const props = renderBar()
    const select = screen.getByRole('combobox', { name: t('decks', 'filter_type') }) as HTMLSelectElement

    expect(select.value).toBe('')
    expect(select.options).toHaveLength(9)
    fireEvent.change(select, { target: { value: 'Creature' } })
    expect(props.onTypeChange).toHaveBeenLastCalledWith('Creature')
    fireEvent.change(select, { target: { value: '' } })
    expect(props.onTypeChange).toHaveBeenLastCalledWith(null)
  })

  it('DCK-22: rarity is one dropdown that keeps several picks', () => {
    const props = renderBar({ rarityFilter: new Set(['rare']) })
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('decks', 'filter_advanced')) }))
    const trigger = screen.getByRole('button', { name: t('decks', 'filter_rarity') })
    expect(trigger.textContent).toBe(t('decks', 'rarity_rare'))

    fireEvent.click(trigger)
    const options = screen.getAllByRole('menuitemcheckbox')
    expect(options.map((o) => o.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true', 'false'])
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: new RegExp(t('decks', 'rarity_mythic')) }))
    expect(props.onToggleRarity).toHaveBeenLastCalledWith('mythic')
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(4)
  })

  it('DCK-22: keywords are one dropdown that keeps several picks and names how many there are', () => {
    const props = renderBar({ keywordFilter: new Set(['Flying', 'Haste']) })
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('decks', 'filter_advanced')) }))
    const trigger = screen.getByRole('button', { name: t('decks', 'filter_keyword') })
    expect(trigger.textContent).toMatch(/ \+1$/)

    fireEvent.click(trigger)
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(24)
    fireEvent.click(screen.getAllByRole('menuitemcheckbox')[2])
    expect(props.onToggleKeyword).toHaveBeenLastCalledWith('Trample')
  })

  it('DCK-22: the keyword dropdown searches every keyword ability, and Enter picks the first match', async () => {
    const props = renderBar()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('decks', 'filter_advanced')) }))
    fireEvent.click(screen.getByRole('button', { name: t('decks', 'filter_keyword') }))
    const search = screen.getByRole('textbox', { name: t('decks', 'filter_keyword') })

    fireEvent.change(search, { target: { value: 'living' } })
    await waitFor(() => expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(1))
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(props.onToggleKeyword).toHaveBeenLastCalledWith('Living weapon')

    fireEvent.change(search, { target: { value: '' } })
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(24)
  })

  it('DCK-22: a picked keyword outside the common list stays on top of the list', () => {
    renderBar({ keywordFilter: new Set(['Afflict']) })
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('decks', 'filter_advanced')) }))
    fireEvent.click(screen.getByRole('button', { name: t('decks', 'filter_keyword') }))
    const items = screen.getAllByRole('menuitemcheckbox')
    expect(items).toHaveLength(25)
    expect(items[0].getAttribute('aria-checked')).toBe('true')
  })

  it('DCK-22: the set dropdown lists every paper set once the advanced filters open, with a search box', async () => {
    const props = renderBar()
    expect(scryfallJson).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('decks', 'filter_advanced')) }))
    const trigger = screen.getByRole('button', { name: t('decks', 'filter_set') })
    expect(trigger.textContent).toBe(t('decks', 'filter_any'))
    fireEvent.click(trigger)
    await waitFor(() => expect(setOptions()).toHaveLength(3))
    expect(setOptions().map((o) => o.textContent)).toEqual([t('decks', 'filter_any'), 'MSCMarvel Super Heroes Commander', 'MH3Modern Horizons 3'])

    fireEvent.change(screen.getByRole('textbox', { name: t('decks', 'filter_set') }), { target: { value: 'marvel' } })
    expect(setOptions()).toHaveLength(2)
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Marvel Super Heroes Commander/ }))
    expect(props.onSetChange).toHaveBeenLastCalledWith('msc')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('DCK-22: Enter in the set search applies a typed name by its code, or anything else as typed', async () => {
    const props = renderBar()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('decks', 'filter_advanced')) }))
    fireEvent.click(screen.getByRole('button', { name: t('decks', 'filter_set') }))
    await waitFor(() => expect(setOptions()).toHaveLength(3))

    const search = screen.getByRole('textbox', { name: t('decks', 'filter_set') })
    fireEvent.change(search, { target: { value: 'Modern Horizons 3' } })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(props.onSetChange).toHaveBeenLastCalledWith('mh3')

    fireEvent.click(screen.getByRole('button', { name: t('decks', 'filter_set') }))
    fireEvent.change(screen.getByRole('textbox', { name: t('decks', 'filter_set') }), { target: { value: 'xyz' } })
    fireEvent.keyDown(screen.getByRole('textbox', { name: t('decks', 'filter_set') }), { key: 'Enter' })
    expect(props.onSetChange).toHaveBeenLastCalledWith('xyz')
  })

  it('DCK-22: Escape or a click outside closes a dropdown', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(t('decks', 'filter_advanced')) }))
    fireEvent.click(screen.getByRole('button', { name: t('decks', 'filter_rarity') }))
    expect(screen.getAllByRole('menuitemcheckbox')).toHaveLength(4)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryAllByRole('menuitemcheckbox')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: t('decks', 'filter_rarity') }))
    fireEvent.pointerDown(document.body)
    expect(screen.queryAllByRole('menuitemcheckbox')).toHaveLength(0)
  })
})

describe('keywordCatalog', () => {
  it('DCK-22: a keyword search matches the English name or the translated one, once each', () => {
    const label = (kw: string) => (kw === 'Flying' ? 'Vuela' : kw)
    expect(matchingKeywords(['Flying', 'Haste'], ['flying', 'Fabricate'], 'vue', label)).toEqual(['Flying'])
    expect(matchingKeywords(['Flying', 'Haste'], ['flying', 'Fabricate'], 'f', label)).toEqual(['Flying', 'Fabricate'])
    expect(matchingKeywords(['Flying', 'Haste'], ['Fabricate'], '', label)).toEqual(['Flying', 'Haste'])
  })

  it('DCK-22: a keyword of two words is searched as one phrase', () => {
    const q = buildScryfallQuery({
      rawQuery: '', colorFilter: new Set(), typeFilter: null, cmcFilter: null, rarityFilter: new Set(),
      keywordFilter: new Set(['First Strike', 'Flying']), powerFilter: null, toughnessFilter: null, setFilter: null,
    })
    expect(q).toContain('keyword:"first strike"')
    expect(q).toContain('keyword:flying')
  })
})

describe('scryfallSets', () => {
  it('DCK-22: tokens, memorabilia and digital-only sets are left out of the suggestions', () => {
    expect(playableSets([
      { code: 'MH3', name: 'Modern Horizons 3', set_type: 'draft_innovation' },
      { code: 'tmh3', name: 'Modern Horizons 3 Tokens', set_type: 'token' },
      { code: 'pmh3', name: 'MH3 Art Series', set_type: 'memorabilia' },
      { code: 'ymh3', name: 'Alchemy: MH3', set_type: 'alchemy', digital: true },
    ])).toEqual([{ code: 'mh3', name: 'Modern Horizons 3' }])
  })

  it('DCK-22: a set search matches the code or the name', () => {
    const sets = [{ code: 'mh3', name: 'Modern Horizons 3' }, { code: 'msc', name: 'Marvel Super Heroes Commander' }]
    expect(matchingSets(sets, 'MSC')).toEqual([sets[1]])
    expect(matchingSets(sets, 'horizons')).toEqual([sets[0]])
    expect(matchingSets(sets, '')).toEqual(sets)
  })

  it('DCK-22: an unknown set is searched as typed', () => {
    const sets = [{ code: 'mh3', name: 'Modern Horizons 3' }]
    expect(setCodeFor(' MH3 ', sets)).toBe('mh3')
    expect(setCodeFor('modern horizons 3', sets)).toBe('mh3')
    expect(setCodeFor('xyz', sets)).toBe('xyz')
    expect(setCodeFor('  ', sets)).toBeNull()
  })
})
