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

  it('BRD-24: pointing at or focusing a known card opens no side preview panel', () => {
    openViewer()
    const card = document.querySelector('[data-testid="hand-viewer"] .zone-fan-item.is-revealed .pile-card') as HTMLElement
    fireEvent.mouseEnter(card)
    fireEvent.focus(card)
    expect(document.querySelector('.floating-card-preview')).toBeNull()
  })

  it('HND-9: renders in a portal with known cards face-up and the backs stack', () => {
    openViewer()
    const viewer = document.body.querySelector('[data-testid="hand-viewer"]')
    expect(viewer).not.toBeNull()
    expect(viewer?.textContent).toContain('Bob')
    expect(viewer?.textContent).toContain('Lightning Bolt')
    expect(viewer?.textContent).toContain('Shock')
    const backs = document.body.querySelectorAll('[data-testid="hand-viewer-back"]')
    expect(backs.length).toBe(3)
  })

  it('renders every unknown card as a face-down back', () => {
    openViewer({ known: [], unknownCount: 7 })
    const backs = document.body.querySelectorAll('[data-testid="hand-viewer-back"]')
    expect(backs.length).toBe(7)
    backs.forEach((back) => {
      expect(back.querySelector('.card-slot.face-down.pile-card')).not.toBeNull()
    })
  })

  it('HND-9: draws the known cards first, then the backs, with no numbers', () => {
    openViewer()
    const viewer = document.body.querySelector('[data-testid="hand-viewer"]')!
    expect(viewer.querySelectorAll('.pile-position-badge')).toHaveLength(0)
    expect(viewer.textContent).not.toMatch(/#\d/)
  })

  it('HND-9: closes on ✕ button and on Escape', () => {
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

  it('TGT-5, HND-9: forwards clicks only on targeted/playable known cards', () => {
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
