import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import CardIcons from './CardIcons'

describe('the icons the server sends on a card', () => {
  it('BRD-59: a commander is marked with the Commander symbol, not with letters from its hint', () => {
    const { container } = render(<CardIcons icons={[{ cardIconType: 'COMMANDER', hint: 'Card is commander' }]} />)
    const mark = container.querySelector('.card-commander-mark')
    expect(mark).not.toBeNull()
    expect(mark?.querySelector('svg.commander-mark')).not.toBeNull()
    expect(container.textContent).not.toContain('CI')
    expect(container.querySelector('.card-icons')).toBeNull()
  })

  it('BRD-59: the mark sits beside the other icons when the card carries both', () => {
    const { container } = render(
      <CardIcons
        icons={[
          { cardIconType: 'COMMANDER', hint: 'Card is commander' },
          { cardIconType: 'OTHER_HAS_RESTRICTIONS', hint: 'Must attack this turn' },
        ]}
      />,
    )
    expect(container.querySelector('.card-commander-mark')).not.toBeNull()
    expect(container.querySelectorAll('.card-icons .card-icon')).toHaveLength(1)
  })

  it('an ability icon with no text of its own still falls back to its hint', () => {
    const { container } = render(<CardIcons icons={[{ cardIconType: 'ABILITY_OTHER', hint: 'Phasing out' }]} />)
    expect(container.querySelector('.card-icon.ability')?.textContent).toBe('PO')
  })
})
