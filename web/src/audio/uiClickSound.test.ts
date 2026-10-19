import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { soundManager } from './soundManager'
import { installUiClickSound } from './uiClickSound'

const click = (el: Element, detail = 1) => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }))
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

describe('installUiClickSound', () => {
  let uninstall: () => void
  let play: MockInstance<typeof soundManager.play>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(10_000)
    play = vi.spyOn(soundManager, 'play').mockImplementation(() => {})
    uninstall = installUiClickSound()
    document.body.innerHTML = ''
  })

  afterEach(async () => {
    uninstall()
    vi.useRealTimers()
    await nextFrame()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  const button = (attrs = '') => {
    const el = document.createElement('button')
    el.textContent = 'Go'
    if (attrs) el.setAttribute(attrs.split('=')[0], attrs.split('=')[1] ?? '')
    document.body.appendChild(el)
    return el
  }

  it('plays the click sound once for a normal button', () => {
    click(button())
    expect(play).toHaveBeenCalledTimes(1)
    expect(play).toHaveBeenCalledWith('ui_click', 'ui')
  })

  it('plays for role="button" elements', () => {
    const el = document.createElement('div')
    el.setAttribute('role', 'button')
    document.body.appendChild(el)
    click(el)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('does not play for a disabled button', () => {
    const el = button()
    ;(el as HTMLButtonElement).disabled = true
    click(el)
    expect(play).not.toHaveBeenCalled()
  })

  it('does not play for an aria-disabled button', () => {
    click(button('aria-disabled=true'))
    expect(play).not.toHaveBeenCalled()
  })

  it('does not play inside the game board', () => {
    const slot = document.createElement('div')
    slot.className = 'card-slot'
    const inner = document.createElement('button')
    slot.appendChild(inner)
    document.body.appendChild(slot)
    click(inner)
    expect(play).not.toHaveBeenCalled()
  })

  it('does not play for elements marked data-no-click-sound', () => {
    click(button('data-no-click-sound='))
    expect(play).not.toHaveBeenCalled()
  })

  it('does not play for keyboard activation', () => {
    click(button(), 0)
    expect(play).not.toHaveBeenCalled()
  })

  it('does not play for clicks outside buttons', () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    click(div)
    expect(play).not.toHaveBeenCalled()
  })

  it('collapses two rapid clicks within 60 ms into one sound', () => {
    const el = button()
    click(el)
    vi.advanceTimersByTime(20)
    click(el)
    expect(play).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(60)
    click(el)
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('does not double up when the handler already played the sound', () => {
    play.mockRestore()
    play = vi.spyOn(soundManager, 'play')
    const el = button()
    el.addEventListener('click', () => soundManager.play('ui_click', 'ui'))
    click(el)
    expect(play).toHaveBeenCalledTimes(1)
  })
})
