import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FloatingCardPreview from './FloatingCardPreview'
import { setLanguage } from '../i18n'
import { setSetting } from '../state/store'
import type { CardView, PermanentView } from '../net/types'

vi.mock('../cards/cardImages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../cards/cardImages')>()),
  awaitImageUrl: vi.fn().mockResolvedValue('https://img.test/card.jpg'),
  cardName: vi.fn().mockImplementation((c: CardView) => c.name || '?'),
  getSourceCardName: vi.fn().mockImplementation((c: CardView) => c.name || '?'),
  isAbilityCard: vi.fn().mockReturnValue(false),
}))

describe('FloatingCardPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

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

  it('shows only the keywords the card has, not ones its rules merely name', () => {
    const anchor = { left: 200, top: 200, right: 290, bottom: 326, width: 90, height: 126 } as DOMRect
    setLanguage('en')
    const lord: CardView = { name: 'Lord of Wings', manaValue: 3, rules: ['Creatures you control have flying.'] }
    const lordRender = render(<FloatingCardPreview card={lord} anchorRect={anchor} boardRect={dummyBoardRect} />)
    expect(lordRender.container.querySelector('.floating-card-keywords')).toBeNull()
    lordRender.unmount()

    const blitzer: CardView = {
      name: 'Blitzer',
      manaValue: 4,
      rules: ['Blitz {2}{R}{R} (You may cast this spell for its blitz cost. If you do, it gains haste and "When this creature dies, draw a card," and it\'s sacrificed at the beginning of the next end step.)'],
    }
    const blitzRender = render(<FloatingCardPreview card={blitzer} anchorRect={anchor} boardRect={dummyBoardRect} />)
    const names = [...blitzRender.container.querySelectorAll('.kw-box-name')].map((el) => el.textContent)
    expect(names).toEqual(['Blitz'])
    blitzRender.unmount()
    setLanguage('es')
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

  it('KEY-9: renders flip badge for double-faced cards and toggles face on Shift key', async () => {
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

  it('positions a hand-anchored preview above the card without transforms', () => {
    const card: CardView = {
      name: 'Mountain',
      manaValue: 0,
      cardTypes: ['LAND'],
    }
    const { container } = render(
      <FloatingCardPreview card={card} anchorRect={handAnchor} boardRect={dummyBoardRect} />,
    )
    const preview = container.querySelector('.floating-card-preview') as HTMLElement
    expect(preview.style.transform).toBe('')
    expect(preview.style.bottom).toBeTruthy()
  })

  it('fades out while leaving', () => {
    const card: CardView = {
      name: 'Mountain',
      manaValue: 0,
      cardTypes: ['LAND'],
    }
    const { container, rerender } = render(
      <FloatingCardPreview card={card} anchorRect={handAnchor} boardRect={dummyBoardRect} />,
    )
    expect(
      (container.querySelector('.floating-card-preview') as HTMLElement).classList.contains('is-leaving'),
    ).toBe(false)
    rerender(<FloatingCardPreview card={card} anchorRect={handAnchor} boardRect={dummyBoardRect} leaving />)
    expect(
      (container.querySelector('.floating-card-preview') as HTMLElement).classList.contains('is-leaving'),
    ).toBe(true)
  })

  it('recarga la imagen al pasar entre habilidades que solo se distinguen por su carta origen', async () => {
    const { awaitImageUrl } = await import('../cards/cardImages')
    vi.mocked(awaitImageUrl).mockImplementation(async (c: CardView) => `https://img.test/${c.sourceCard?.name ?? c.name}.jpg`)
    const ability = (id: string, source: string): CardView => ({
      id,
      name: 'Ability',
      mageObjectType: 'ABILITY',
      manaValue: 0,
      expansionSetCode: '',
      cardNumber: '0',
      sourceCard: { name: source, manaValue: 0 } as CardView,
    })
    const anchor = { left: 900, top: 300, right: 1100, bottom: 360, width: 200, height: 60 } as DOMRect
    const { container, rerender } = render(
      <FloatingCardPreview card={ability('a1', 'Teferi')} anchorRect={anchor} boardRect={null} fixedSide="left" />,
    )
    await act(async () => {})
    expect(container.querySelector('img.floating-card-img')?.getAttribute('src')).toBe('https://img.test/Teferi.jpg')
    rerender(<FloatingCardPreview card={ability('a2', 'Jace')} anchorRect={anchor} boardRect={null} fixedSide="left" />)
    await act(async () => {})
    expect(container.querySelector('img.floating-card-img')?.getAttribute('src')).toBe('https://img.test/Jace.jpg')
  })
  describe('card preview size', () => {
    afterEach(() => setSetting('cardPreviewScale', 1))

    const goblin: PermanentView = { name: 'Raging Goblin', manaValue: 1, cardTypes: ['CREATURE'], power: '1', toughness: '1' }
    const flyer: CardView = { name: 'Serra Angel', manaValue: 5, rules: ['Flying, vigilance'] }
    const midAnchor = { left: 300, top: 300, right: 390, bottom: 426, width: 90, height: 126 } as DOMRect
    const edgeAnchor = { left: 1080, top: 300, right: 1170, bottom: 426, width: 90, height: 126 } as DOMRect

    const renderPreview = (card: CardView, anchor: DOMRect, board: DOMRect | null = dummyBoardRect) => {
      const { container } = render(<FloatingCardPreview card={card} anchorRect={anchor} boardRect={board} />)
      return container.querySelector('.floating-card-preview') as HTMLElement
    }
    const px = (v: string) => parseFloat(v)
    const zoomOf = (el: HTMLElement) => Number(el.style.getPropertyValue('--card-preview-zoom'))

    it('SET-1: the preview size follows the cardPreviewScale setting', () => {
      const base = renderPreview(goblin, midAnchor)
      expect(zoomOf(base)).toBe(1)
      expect(px(base.style.height)).toBe(448)
      cleanup()

      setSetting('cardPreviewScale', 1.5)
      const big = renderPreview(goblin, midAnchor)
      expect(zoomOf(big)).toBe(1.5)
      expect(px(big.style.height)).toBe(448 * 1.5)
      cleanup()

      setSetting('cardPreviewScale', 0.75)
      const small = renderPreview(goblin, midAnchor)
      expect(zoomOf(small)).toBe(0.75)
      expect(px(small.style.height)).toBe(448 * 0.75)
    })

    it('SET-1: a size that does not fit shrinks to the largest size that fits the board', () => {
      setSetting('cardPreviewScale', 2)
      const preview = renderPreview(flyer, midAnchor)
      const zoom = zoomOf(preview)
      expect(zoom).toBeLessThan(2)
      expect(zoom).toBeGreaterThan(1.7)
      const top = px(preview.style.top)
      const height = px(preview.style.height)
      expect(top).toBeGreaterThanOrEqual(12)
      expect(top + height).toBeLessThanOrEqual(dummyBoardRect.height - 12)
      const left = px(preview.style.left)
      expect(left + (320 + 240) * zoom + 10).toBeLessThanOrEqual(dummyBoardRect.width)
      cleanup()

      const smallBoard = { left: 0, top: 0, right: 700, bottom: 420, width: 700, height: 420 } as DOMRect
      const tight = renderPreview(goblin, { left: 100, top: 100, right: 190, bottom: 226, width: 90, height: 126 } as DOMRect, smallBoard)
      expect(px(tight.style.top)).toBeGreaterThanOrEqual(12)
      expect(px(tight.style.top) + px(tight.style.height)).toBeLessThanOrEqual(smallBoard.height - 12)
      expect(zoomOf(tight)).toBeCloseTo((smallBoard.height - 24) / 448, 2)
    })

    it('SET-1: a hand preview at a large size stays above the hand and inside the board', () => {
      setSetting('cardPreviewScale', 2)
      const handCardAnchor = { left: 500, top: 680, right: 590, bottom: 790, width: 90, height: 110 } as DOMRect
      const preview = renderPreview(goblin, handCardAnchor)
      const bottom = px(preview.style.bottom)
      const height = px(preview.style.height)
      expect(bottom).toBeGreaterThanOrEqual(dummyBoardRect.height - handCardAnchor.top + 12)
      expect(dummyBoardRect.height - bottom - height).toBeGreaterThanOrEqual(12)
    })

    it.each([0.75, 1, 1.5, 2])('SET-1: placement still flips at the board edge at %s', (scale) => {
      setSetting('cardPreviewScale', scale)
      const right = renderPreview(goblin, midAnchor)
      expect(px(right.style.left)).toBe(midAnchor.right + 16)
      cleanup()

      const flipped = renderPreview(goblin, edgeAnchor)
      const zoom = zoomOf(flipped)
      const left = px(flipped.style.left)
      expect(left).toBeGreaterThanOrEqual(12)
      expect(left + 320 * zoom).toBeLessThanOrEqual(edgeAnchor.left - 16 + 0.001)
    })
  })
})
