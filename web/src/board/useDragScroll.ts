import { useEffect, useRef } from 'react'

const DRAG_THRESHOLD_PX = 5

/**
 * useDragScroll provides smooth click-and-drag horizontal panning ("Hand tool")
 * for battlefield card bands, while preserving standard card click interactions.
 * Also converts vertical mouse wheel into horizontal scroll when overflowing.
 */
export function useDragScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let isDown = false
    let startX = 0
    let initialScrollLeft = 0
    let hasDragged = false

    const updateOverflow = () => {
      if (!el) return
      const hasOverflow = el.scrollWidth > el.clientWidth + 2
      el.classList.toggle('has-overflow', hasOverflow)
    }

    updateOverflow()

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateOverflow) : null
    if (ro) ro.observe(el)

    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(updateOverflow) : null
    if (mo) mo.observe(el, { childList: true, subtree: true })

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      if (el.scrollWidth <= el.clientWidth + 2) return

      isDown = true
      startX = e.pageX
      initialScrollLeft = el.scrollLeft
      hasDragged = false
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isDown) return
      const currentX = e.pageX
      const deltaX = currentX - startX

      if (!hasDragged && Math.abs(deltaX) >= DRAG_THRESHOLD_PX) {
        hasDragged = true
        el.classList.add('is-dragging')
      }

      if (hasDragged) {
        e.preventDefault()
        el.scrollLeft = initialScrollLeft - deltaX
      }
    }

    const onPointerUp = () => {
      if (!isDown) return
      isDown = false
      el.classList.remove('is-dragging')

      if (hasDragged) {
        const capturePrevent = (clickEvt: MouseEvent) => {
          clickEvt.stopImmediatePropagation()
          clickEvt.preventDefault()
        }
        window.addEventListener('click', capturePrevent, { capture: true, once: true })
        setTimeout(() => {
          window.removeEventListener('click', capturePrevent, { capture: true })
        }, 60)
      }
    }

    const onPointerCancel = () => {
      isDown = false
      hasDragged = false
      el.classList.remove('is-dragging')
    }

    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth + 2) return
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()
        el.scrollLeft += e.deltaY
      }
    }

    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      ro?.disconnect()
      mo?.disconnect()
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerCancel)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  return ref
}
