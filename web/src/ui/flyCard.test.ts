import { afterEach, describe, expect, it, vi } from 'vitest'
import { flyCardTo } from './flyCard'

const TARGET = '.fly-test-target'

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect
}

function mountPair(sourceRect: DOMRect, targetRect: DOMRect) {
  const source = document.createElement('div')
  source.className = 'tile'
  source.getBoundingClientRect = () => sourceRect
  const img = document.createElement('img')
  img.src = 'https://cards.example/art.jpg'
  source.append(img)
  const target = document.createElement('div')
  target.className = 'fly-test-target'
  target.getBoundingClientRect = () => targetRect
  document.body.append(source, target)
  return { source, target }
}

describe('flyCardTo', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    document.documentElement.classList.remove('fx-off')
    Reflect.deleteProperty(Element.prototype, 'animate')
    vi.restoreAllMocks()
  })

  it('does nothing when the element cannot animate', () => {
    const { source } = mountPair(rect(0, 0, 100, 140), rect(400, 0, 300, 600))
    flyCardTo(source, TARGET)
    expect(document.querySelector('.fly-card-ghost')).toBeNull()
  })

  it('does nothing with effects turned off', () => {
    const { source } = mountPair(rect(0, 0, 100, 140), rect(400, 0, 300, 600))
    source.animate = vi.fn()
    document.documentElement.classList.add('fx-off')
    flyCardTo(source, TARGET)
    expect(source.animate).not.toHaveBeenCalled()
    expect(document.querySelector('.fly-card-ghost')).toBeNull()
  })

  it('does nothing when the target is not on screen', () => {
    const { source, target } = mountPair(rect(0, 0, 100, 140), rect(400, 0, 300, 600))
    target.remove()
    source.animate = vi.fn()
    flyCardTo(source, TARGET)
    expect(source.animate).not.toHaveBeenCalled()
  })

  it('animates a copy of the tile toward the target and removes it when done', () => {
    const { source } = mountPair(rect(10, 20, 100, 140), rect(400, 0, 300, 600))
    const finishes: Array<() => void> = []
    const animate = vi.fn((_frames: unknown, _options?: unknown) => ({
      set onfinish(fn: () => void) { finishes.push(fn) },
      set oncancel(_fn: () => void) {},
    }) as unknown as Animation)
    Object.defineProperty(Element.prototype, 'animate', { value: animate, configurable: true, writable: true })
    flyCardTo(source, TARGET)
    const ghost = document.querySelector<HTMLElement>('.fly-card-ghost')
    expect(ghost).not.toBeNull()
    expect(ghost?.getAttribute('aria-hidden')).toBe('true')
    expect(ghost?.querySelector('img')?.getAttribute('src')).toBe('https://cards.example/art.jpg')
    expect(ghost?.style.left).toBe('10px')
    const [frames, flightOptions] = animate.mock.calls[0] as unknown as [Array<{ transform: string }>, { duration: number }]
    expect(frames.at(-1)?.transform).toMatch(/^translate\(\d+(\.\d+)?px, \d+(\.\d+)?px\) scale\(0\.4\)/)
    expect(flightOptions.duration).toBe(480)
    finishes[0]()
    expect(document.querySelector('.fly-card-ghost')).toBeNull()
  })

  it('flashes the destination on landing, and bounces it only when pop is set', () => {
    const { source } = mountPair(rect(0, 0, 100, 140), rect(400, 0, 300, 600))
    const finishes: Array<() => void> = []
    const animate = vi.fn((_frames: unknown, _options?: unknown) => ({
      set onfinish(fn: () => void) { finishes.push(fn) },
      set oncancel(_fn: () => void) {},
    }) as unknown as Animation)
    Object.defineProperty(Element.prototype, 'animate', { value: animate, configurable: true, writable: true })

    flyCardTo(source, TARGET, { pop: true })
    finishes[0]()
    expect(document.querySelector('.fly-card-ring')).not.toBeNull()
    expect(document.querySelectorAll('.fly-card-spark')).toHaveLength(8)
    expect(document.querySelector('.fly-card-glow')).not.toBeNull()
    const pop = animate.mock.calls.filter(([frames]) => JSON.stringify(frames).includes('"scale":"1.07"'))
    expect(pop).toHaveLength(1)
  })

  it('does not bounce the destination unless asked', () => {
    const { source } = mountPair(rect(0, 0, 100, 140), rect(400, 0, 300, 600))
    const finishes: Array<() => void> = []
    const animate = vi.fn((_frames: unknown, _options?: unknown) => ({
      set onfinish(fn: () => void) { finishes.push(fn) },
      set oncancel(_fn: () => void) {},
    }) as unknown as Animation)
    Object.defineProperty(Element.prototype, 'animate', { value: animate, configurable: true, writable: true })

    flyCardTo(source, TARGET)
    finishes[0]()
    expect(document.querySelector('.fly-card-ring')).not.toBeNull()
    expect(animate.mock.calls.some(([frames]) => JSON.stringify(frames).includes('"scale":"1.07"'))).toBe(false)
  })

  describe('with a destination that is rendered later', () => {
    function manualFrames() {
      const queue: FrameRequestCallback[] = []
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => { queue.push(cb); return queue.length })
      return () => {
        const pending = queue.splice(0)
        pending.forEach((cb) => cb(0))
      }
    }

    it('flies once the destination exists and has stopped moving', () => {
      const { source, target } = mountPair(rect(0, 0, 100, 140), rect(400, 0, 300, 600))
      target.remove()
      const animate = vi.fn(() => ({ set onfinish(_f: () => void) {}, set oncancel(_f: () => void) {} }) as unknown as Animation)
      Object.defineProperty(Element.prototype, 'animate', { value: animate, configurable: true, writable: true })
      const frame = manualFrames()
      let rendered: HTMLElement | null = null
      flyCardTo(source, () => rendered)
      frame()
      frame()
      expect(animate).not.toHaveBeenCalled()
      rendered = target
      frame()
      expect(animate).not.toHaveBeenCalled()
      frame()
      expect(animate.mock.calls[0]).toBeDefined()
    })

    it('does not fly at all when the destination never appears', () => {
      const { source } = mountPair(rect(0, 0, 100, 140), rect(400, 0, 300, 600))
      const animate = vi.fn()
      Object.defineProperty(Element.prototype, 'animate', { value: animate, configurable: true, writable: true })
      const frame = manualFrames()
      flyCardTo(source, () => null)
      for (let i = 0; i < 200; i++) frame()
      expect(animate).not.toHaveBeenCalled()
      expect(document.querySelector('.fly-card-ghost')).toBeNull()
    })
  })
})
