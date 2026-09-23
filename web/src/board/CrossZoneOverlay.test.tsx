import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import CrossZoneOverlay, { crossZoneLabel } from './CrossZoneOverlay'
import { makeCard } from '../__fixtures__/gameViews'
import { t } from '../i18n'

describe('CrossZoneOverlay', () => {
  afterEach(cleanup)

  it('renders into document.body so board bars cannot stack above it', () => {
    const { container } = render(
      <div style={{ position: 'relative', zIndex: 10 }} data-testid="resource-bar">
        <CrossZoneOverlay
          playables={[{ id: 'a1', card: makeCard({ id: 'a1', name: 'Arc Trail' }), value: 'Arc Trail', zone: 'graveyard' }]}
          onClose={() => {}}
          onPlay={() => {}}
        />
      </div>,
    )
    expect(container.querySelector('.pile-overlay-backdrop')).toBeNull()
    const backdrop = document.body.querySelector(':scope > .pile-overlay-backdrop')
    expect(backdrop).not.toBeNull()
    expect(backdrop!.querySelector('h3')!.textContent).toBe(`${t('game', 'cross_zone_title')} (1)`)
    expect(backdrop!.querySelector('.cross-zone-source')!.textContent).toBe(t('board', 'pile_graveyard'))
  })

  it('labels every zone the lookup can produce', () => {
    expect(crossZoneLabel('exile', t)).toBe(t('board', 'pile_exile'))
    expect(crossZoneLabel('exile:Hideaway', t)).toBe(`${t('board', 'pile_exile')} · Hideaway`)
    expect(crossZoneLabel('library', t)).toBe(t('board', 'pile_library'))
    expect(crossZoneLabel('stack', t)).toBe(t('game', 'pile_stack'))
    expect(crossZoneLabel('sideboard', t)).toBe(t('board', 'zone_sideboard'))
    expect(crossZoneLabel('helper', t)).toBe('helper')
  })
})
