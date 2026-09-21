import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import './GameStrip.css'

const DROPDOWN_MAX = 420
const DROPDOWN_MARGIN = 12
const DROPDOWN_MIN = 160
const PREFERRED_UP = 300

interface GameStripProps {
  left: ReactNode
  center: ReactNode
  right: ReactNode
  dropdown: ReactNode
}

interface DropdownFit {
  up: boolean
  max: number
}

export default function GameStrip({ left, center, right, dropdown }: GameStripProps) {
  const rightRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState<DropdownFit>({ up: true, max: DROPDOWN_MAX })

  const measure = useCallback(() => {
    const el = rightRef.current
    const board = el?.closest<HTMLElement>('.board-shell')
    if (!el || !board) return
    const rect = el.getBoundingClientRect()
    const boardRect = board.getBoundingClientRect()
    const zoom = board.offsetHeight > 0 ? boardRect.height / board.offsetHeight : 1
    if (zoom <= 0) return
    const above = (rect.top - boardRect.top) / zoom - DROPDOWN_MARGIN
    const below = (boardRect.bottom - rect.bottom) / zoom - DROPDOWN_MARGIN
    const up = above >= Math.min(PREFERRED_UP, below)
    const max = Math.round(Math.max(DROPDOWN_MIN, Math.min(DROPDOWN_MAX, up ? above : below)))
    setFit((prev) => (prev.up === up && prev.max === max ? prev : { up, max }))
  }, [])

  useLayoutEffect(() => {
    measure()
    const board = rightRef.current?.closest('.board-shell')
    if (!board || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(board)
    Array.from(board.children).forEach((child) => observer.observe(child))
    return () => observer.disconnect()
  }, [measure, !!dropdown])

  return (
    <div className="game-strip" data-testid="game-strip">
      <div className="game-strip-left">{left}</div>
      <div className="game-strip-center">{center}</div>
      <div
        ref={rightRef}
        className="game-strip-right"
        data-dropdown-side={fit.up ? 'up' : 'down'}
        style={{ '--dd-max': `${fit.max}px` } as CSSProperties}
        onPointerDownCapture={measure}
        onFocusCapture={measure}
      >
        {right}
        {dropdown}
      </div>
    </div>
  )
}
