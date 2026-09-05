import { render, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HandViewer from './HandViewer'
import { setLanguage } from '../i18n'

describe('HandViewer', () => {
  beforeEach(() => {
    setLanguage('es')
    document.body.innerHTML = ''
  })

  const known: Array<[string, { id: string; name: string; manaValue: number; expansionSetCode: string; cardNumber: string }]> = [
    ['k1', { id: 'k1', name: 'Lightning Bolt', manaValue: 1, expansionSetCode: 'lea', cardNumber: '1' }],
    ['k2', { id: 'k2', name: 'Shock', manaValue: 1, expansionSetCode: 'lea', cardNumber: '2' }],
  ]

  function openViewer(props: Partial<React.ComponentProps<typeof HandViewer>> = {}) {
    return render(
      <HandViewer
        playerName="Bob"
        known={known}
        unknownCount={3}
        onClose={() => {}}
        {...props}
      />
    )
  }

  it('renders in a portal with known cards face-up and the backs stack', () => {
    openViewer()
    const viewer = document.body.querySelector('[data-testid="hand-viewer"]')
    expect(viewer).not.toBeNull()
    expect(viewer?.textContent).toContain('Bob')
    expect(viewer?.textContent).toContain('Lightning Bolt')
    expect(viewer?.textContent).toContain('Shock')
    const backs = document.body.querySelectorAll('[data-testid="hand-viewer-back"]')
    expect(backs.length).toBe(3)
  })

  it('renders every back with a #N badge continuing the known numbering (library style)', () => {
    openViewer({ known: [], unknownCount: 7 })
    const backs = document.body.querySelectorAll('[data-testid="hand-viewer-back"]')
    expect(backs.length).toBe(7)
    backs.forEach((back, i) => {
      expect(back.querySelector('.card-slot.face-down.pile-card')).not.toBeNull()
      expect(back.querySelector('.pile-position-badge')?.textContent).toBe(`#${i + 1}`)
    })
  })

  it('numbers known cards #1..#K and backs after them', () => {
    openViewer()
    const viewer = document.body.querySelector('[data-testid="hand-viewer"]')!
    const badges = viewer.querySelectorAll('.pile-card-wrapper .pile-position-badge')
    expect([...badges].map((b) => b.textContent)).toEqual(['#1', '#2', '#3', '#4', '#5'])
  })

  it('closes on ✕ button and on Escape', () => {
    const onClose = vi.fn()
    const first = openViewer({ onClose })
    fireEvent.click(document.body.querySelector('.pile-overlay-close')!)
    expect(onClose).toHaveBeenCalledTimes(1)
    first.unmount()
    document.body.innerHTML = ''
    openViewer({ onClose })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('forwards clicks only on targeted/playable known cards', () => {
    const onCardClick = vi.fn()
    openViewer({ targetIds: new Set(['k1']), onCardClick })
    const slots = document.body.querySelectorAll('[data-testid="hand-viewer"] .pile-card-wrapper.is-revealed')
    expect(slots.length).toBe(2)
    fireEvent.click(slots[0].querySelector('.card-slot')!)
    expect(onCardClick).toHaveBeenCalledWith('k1')
    fireEvent.click(slots[1].querySelector('.card-slot')!)
    expect(onCardClick).toHaveBeenCalledTimes(1)
  })
})
