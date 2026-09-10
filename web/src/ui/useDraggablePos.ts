import { useCallback, useEffect, useState } from 'react'

export interface DragPos {
  left: number
  top: number
}

export const DRAG_MARGIN = 8

export function sanitizeDragPos(p: unknown): DragPos | null {
  if (!p || typeof p !== 'object') return null
  const { left, top } = p as Record<string, unknown>
  if (typeof left !== 'number' || typeof top !== 'number') return null
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null
  return { left, top }
}

export function clampDragPos(
  left: number,
  top: number,
  elW: number,
  elH: number,
  vw: number,
  vh: number,
  margin = DRAG_MARGIN,
): DragPos {
  const w = Math.max(1, elW || 1)
  const h = Math.max(1, elH || 1)
  const maxLeft = Math.max(margin, vw - w - margin)
  const maxTop = Math.max(margin, vh - h - margin)
  return {
    left: Math.min(Math.max(margin, left), maxLeft),
    top: Math.min(Math.max(margin, top), maxTop),
  }
}

export function loadDragPos(key: string): DragPos | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return sanitizeDragPos(JSON.parse(raw))
  } catch {
    return null
  }
}

function measureEl(el: HTMLElement | null, fallbackW: number, fallbackH: number) {
  if (!el) return { w: fallbackW, h: fallbackH }
  const rect = el.getBoundingClientRect()
  return {
    w: rect.width || el.offsetWidth || fallbackW,
    h: rect.height || el.offsetHeight || fallbackH,
  }
}

export function useDraggablePos(
  key: string,
  getEl: () => HTMLElement | null,
  fallbackW = 320,
  fallbackH = 40,
): [DragPos | null, (p: DragPos | null) => void] {
  const [pos, setPosState] = useState<DragPos | null>(null)

  useEffect(() => {
    const raw = loadDragPos(key)
    if (!raw) return
    const apply = () => {
      const el = getEl()
      const { w, h } = measureEl(el, fallbackW, fallbackH)
      setPosState(clampDragPos(raw.left, raw.top, w, h, window.innerWidth, window.innerHeight))
    }
    const raf = requestAnimationFrame(apply)
    apply()
    return () => cancelAnimationFrame(raf)
  }, [key])

  useEffect(() => {
    const onResize = () => {
      setPosState((prev) => {
        if (!prev) return prev
        const { w, h } = measureEl(getEl(), fallbackW, fallbackH)
        const next = clampDragPos(prev.left, prev.top, w, h, window.innerWidth, window.innerHeight)
        try {
          localStorage.setItem(key, JSON.stringify(next))
        } catch {}
        return next
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [key])

  const setPos = useCallback(
    (p: DragPos | null) => {
      setPosState(p)
      try {
        if (p) localStorage.setItem(key, JSON.stringify(p))
        else localStorage.removeItem(key)
      } catch {}
    },
    [key],
  )

  return [pos, setPos]
}
