import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FloatingCardPreview from './FloatingCardPreview'
import { setLanguage } from '../i18n'
import type { CardView, PermanentView } from '../net/types'

vi.mock('../cards/cardImages', () => ({
  awaitImageUrl: vi.fn().mockResolvedValue('https://img.test/card.jpg'),
  cardName: vi.fn().mockImplementation((c: CardView) => c.name || '?'),
  getSourceCardName: vi.fn().mockImplementation((c: CardView) => c.name || '?'),
  isAbilityCard: vi.fn().mockReturnValue(false),
}))

describe('FloatingCardPreview', () => {
  let rafQueue: FrameRequestCallback[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    rafQueue = []
    window.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      rafQueue.push(cb)
      return rafQueue.length
    }) as typeof window.requestAnimationFrame
    window.cancelAnimationFrame = (() => {}) as typeof window.cancelAnimationFrame
  })

  afterEach(() => {
    cleanup()
  })

  const flushRaf = async () => {
    await act(async () => {
      const q = rafQueue.splice(0, rafQueue.length)
      q.forEach((cb) => cb(0))
    })
  }

  const dummyBoardRect = {
    left: 0,
    top: 0,
    right: 1200,
    bottom: 800,
    width: 1200,
    height: 800,
  } as DOMRect

  it('renders null when card is null or face down', () => {
    const { container } = render(
      <FloatingCardPreview card={null} anchorRect={null} boardRect={null} />,
    )
    expect(container.firstChild).toBeNull()

    const faceDownCard: CardView = {
      name: 'Secret',
      manaValue: 0,
      faceDown: true,
    }
    const { container: container2 } = render(
      <FloatingCardPreview
        card={faceDownCard}
        anchorRect={{ left: 100, top: 100, right: 200, bottom: 240, width: 100, height: 140 } as DOMRect}
        boardRect={dummyBoardRect}
      />,
    )
    expect(container2.firstChild).toBeNull()
  })

  it('positions battlefield card preview to the right when space allows', () => {
    const card: PermanentView = {
      name: 'Raging Goblin',
      manaValue: 1,
      cardTypes: ['CREATURE'],
      power: '1',
      toughness: '1',
    }

    const anchorRect = {
      left: 300,
      top: 300,
      right: 390,
      bottom: 426,
      width: 90,
      height: 126,
    } as DOMRect

    const { container } = render(
      <FloatingCardPreview
        card={card}
        anchorRect={anchorRect}
        boardRect={dummyBoardRect}
      />,
    )

    const preview = container.querySelector('.floating-card-preview') as HTMLElement
    expect(preview).toBeTruthy()
    // relRight = 390 -> left should be 390 + 16 = 406px
    expect(preview.style.left).toBe('406px')
    expect(preview.textContent).toContain('1/1')
  })

  it('positions hand card preview upwards above the hand', () => {
    const card: CardView = {
      name: 'Mountain',
      manaValue: 0,
      cardTypes: ['LAND'],
    }

    // Card in the bottom hand row (e.g. bottom: 780, near board height 800)
    const anchorRect = {
      left: 500,
      top: 680,
      right: 590,
      bottom: 790,
      width: 90,
      height: 110,
    } as DOMRect

    const { container } = render(
      <FloatingCardPreview
        card={card}
        anchorRect={anchorRect}
        boardRect={dummyBoardRect}
      />,
    )

    const preview = container.querySelector('.floating-card-preview') as HTMLElement
    expect(preview).toBeTruthy()
    expect(preview.style.bottom).toBeTruthy()
  })

  it('renders token and counter badges correctly', () => {
    const tokenCard: PermanentView = {
      name: 'Goblin',
      manaValue: 0,
      isToken: true,
      counters: [{ name: '+1/+1', count: 2 }],
    }

    const anchorRect = {
      left: 200,
      top: 200,
      right: 290,
      bottom: 326,
      width: 90,
      height: 126,
    } as DOMRect

    const { container } = render(
      <FloatingCardPreview
        card={tokenCard}
        anchorRect={anchorRect}
        boardRect={dummyBoardRect}
      />,
    )

    expect(container.textContent).toContain('TOKEN')
    expect(container.textContent).toContain('+2 contadores')
  })

  it('renders keyword boxes for Flying/Deathtouch and loyalty for planeswalkers', () => {
    const kwCard: CardView = {
      name: 'Atraxa',
      manaValue: 4,
      rules: ['Flying, vigilance, deathtouch, lifelink, trample'],
    }
    const kwAnchor = { left: 200, top: 200, right: 290, bottom: 326, width: 90, height: 126 } as DOMRect
    setLanguage('es')
    const { container: kwContainer, unmount } = render(
      <FloatingCardPreview card={kwCard} anchorRect={kwAnchor} boardRect={dummyBoardRect} />,
    )
    expect(kwContainer.querySelector('.floating-card-keywords')).not.toBeNull()
    expect(kwContainer.textContent).toContain('Volar')
    expect(kwContainer.textContent).toContain('Toque mortal')
    unmount()

    setLanguage('en')
    const { container: enContainer, unmount: unmountEn } = render(
      <FloatingCardPreview card={kwCard} anchorRect={kwAnchor} boardRect={dummyBoardRect} />,
    )
    expect(enContainer.textContent).toContain('Flying')
    expect(enContainer.textContent).toContain('Deathtouch')
    expect(enContainer.textContent).not.toContain('Volar')
    unmountEn()
    setLanguage('es')

    const pwCard: PermanentView = {
      name: 'Jace, the Mind Sculptor',
      manaValue: 4,
      cardTypes: ['Planeswalker'],
      loyalty: '3',
    }
    const { container: pwContainer } = render(
      <FloatingCardPreview card={pwCard} anchorRect={kwAnchor} boardRect={dummyBoardRect} />,
    )
    expect(pwContainer.querySelector('.floating-card-loyalty')).not.toBeNull()
    expect(pwContainer.textContent).toContain('3')
  })

  it('renders flip badge for double-faced cards and toggles face on Shift key', async () => {
    const tdfcCard: CardView = {
      name: 'Delver of Secrets',
      manaValue: 1,
      transformable: true,
      secondCardFace: {
        name: 'Insectile Aberration',
        manaValue: 1,
        power: '3',
        toughness: '2',
      },
    }

    const anchorRect = {
      left: 200,
      top: 200,
      right: 290,
      bottom: 326,
      width: 90,
      height: 126,
    } as DOMRect

    const { container } = render(
      <FloatingCardPreview
        card={tdfcCard}
        anchorRect={anchorRect}
        boardRect={dummyBoardRect}
      />,
    )

    const flipBadge = container.querySelector('.floating-card-flip-badge')
    expect(flipBadge).toBeTruthy()
    expect(flipBadge?.textContent).toContain('Anverso')

    // Simulate pressing Shift key to toggle to back face
    fireEvent.keyDown(window, { key: 'Shift' })

    expect(container.querySelector('.floating-card-flip-badge')?.textContent).toContain('Reverso')
    const { awaitImageUrl } = vi.mocked(await import('../cards/cardImages'))
    expect(awaitImageUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Insectile Aberration',
        isSecondCardFace: true,
      })
    )
  })

  it('suppresses preview when modal is open and inModal is false', async () => {    const card: PermanentView = {
      name: 'Raging Goblin',
      manaValue: 1,
      cardTypes: ['CREATURE'],
      power: '1',
      toughness: '1',
    }
    const anchorRect = { left: 100, top: 100, right: 190, bottom: 226, width: 90, height: 126 } as DOMRect

    const { setState, clearFeedback } = await import('../state/store')
    setState({
      feedback: { method: 'GAME_ASK', title: 'Confirm', message: 'Pay?', min: 0, max: 0, gameId: 'g' } as never,
    })

    const { container: suppressed } = render(
      <FloatingCardPreview card={card} anchorRect={anchorRect} boardRect={dummyBoardRect} />,
    )
    expect(suppressed.firstChild).toBeNull()

    const { container: allowed } = render(
      <FloatingCardPreview card={card} anchorRect={anchorRect} boardRect={dummyBoardRect} inModal />,
    )
    expect(allowed.querySelector('.floating-card-preview')).toBeTruthy()

    clearFeedback()
  })

  const handAnchor = {
    left: 500,
    top: 680,
    right: 590,
    bottom: 790,
    width: 90,
    height: 110,
  } as DOMRect

  it('morphs a hand card preview from the anchor rect to full size', async () => {
    const card: CardView = {
      name: 'Mountain',
      manaValue: 0,
      cardTypes: ['LAND'],
    }
    const { container } = render(
      <FloatingCardPreview card={card} anchorRect={handAnchor} boardRect={dummyBoardRect} fromHand />,
    )

    const preview = container.querySelector('.floating-card-preview') as HTMLElement
    expect(preview.classList.contains('is-morph')).toBe(true)
    expect(preview.classList.contains('is-open')).toBe(false)
    expect(preview.style.transform).toBe('translate(115px, 452px) scale(0.28125)')

    await flushRaf()
    await flushRaf()

    const opened = container.querySelector('.floating-card-preview') as HTMLElement
    expect(opened.classList.contains('is-morph')).toBe(true)
    expect(opened.classList.contains('is-open')).toBe(true)
    expect(opened.style.transform).toBe('')
  })

  it('does not morph battlefield card previews', () => {
    const card: PermanentView = {
      name: 'Raging Goblin',
      manaValue: 1,
      cardTypes: ['CREATURE'],
      power: '1',
      toughness: '1',
    }
    const anchorRect = {
      left: 300,
      top: 300,
      right: 390,
      bottom: 426,
      width: 90,
      height: 126,
    } as DOMRect
    const { container } = render(
      <FloatingCardPreview card={card} anchorRect={anchorRect} boardRect={dummyBoardRect} />,
    )
    const preview = container.querySelector('.floating-card-preview') as HTMLElement
    expect(preview.classList.contains('is-morph')).toBe(false)
    expect(preview.style.transform).toBe('')
  })

  it('returns to the start pose while leaving', async () => {
    const card: CardView = {
      name: 'Mountain',
      manaValue: 0,
      cardTypes: ['LAND'],
    }
    const { container, rerender } = render(
      <FloatingCardPreview card={card} anchorRect={handAnchor} boardRect={dummyBoardRect} fromHand />,
    )
    await flushRaf()
    await flushRaf()
    expect(
      (container.querySelector('.floating-card-preview') as HTMLElement).classList.contains('is-open'),
    ).toBe(true)

    rerender(
      <FloatingCardPreview card={card} anchorRect={handAnchor} boardRect={dummyBoardRect} fromHand leaving />,
    )
    const preview = container.querySelector('.floating-card-preview') as HTMLElement
    expect(preview.classList.contains('is-leaving')).toBe(true)
    expect(preview.classList.contains('is-open')).toBe(false)
    expect(preview.style.transform).toBe('translate(115px, 452px) scale(0.28125)')
  })

  it('skips the morph under prefers-reduced-motion', () => {    const prevMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
    try {
      const card: CardView = {
        name: 'Mountain',
        manaValue: 0,
        cardTypes: ['LAND'],
      }
      const { container } = render(
        <FloatingCardPreview card={card} anchorRect={handAnchor} boardRect={dummyBoardRect} />,
      )
      const preview = container.querySelector('.floating-card-preview') as HTMLElement
      expect(preview.classList.contains('is-morph')).toBe(false)
      expect(preview.style.transform).toBe('')
    } finally {
      window.matchMedia = prevMatchMedia
    }
  })

  it('never morphs without fromHand, even at hand position (e.g. battlefield lands)', async () => {
    const card: CardView = {
      name: 'Mountain',
      manaValue: 0,
      cardTypes: ['LAND'],
    }
    const { container } = render(
      <FloatingCardPreview card={card} anchorRect={handAnchor} boardRect={dummyBoardRect} />,
    )
    await flushRaf()
    await flushRaf()
    const preview = container.querySelector('.floating-card-preview') as HTMLElement
    expect(preview.classList.contains('is-morph')).toBe(false)
    expect(preview.classList.contains('is-open')).toBe(false)
    expect(preview.style.transform).toBe('')
    expect(preview.style.bottom).toBeTruthy()
  })
})
