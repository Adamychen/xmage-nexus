import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import './GameStrip.css'

const DROPDOWN_MAX = 420
const DROPDOWN_MARGIN = 12
const DROPDOWN_MIN = 160
const PREFERRED_UP = 240
const SETTLE_MS = 200

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
  const fitRef = useRef(fit)
  const settleTimer = useRef<number | undefined>(undefined)

  const measure = useCallback(function run(settled: boolean) {
    const el = rightRef.current
    const board = el?.closest<HTMLElement>('.board-shell')
    if (!el || !board) return
    const rect = el.getBoundingClientRect()
    const boardRect = board.getBoundingClientRect()
    const zoom = board.offsetHeight > 0 ? boardRect.height / board.offsetHeight : 1
    if (zoom <= 0) return
    const topLimit = Array.from(board.querySelectorAll<HTMLElement>('.oz-top-row')).reduce(
      (limit, row) => Math.max(limit, row.getBoundingClientRect().bottom),
      boardRect.top,
    )
    const above = (rect.top - topLimit) / zoom - DROPDOWN_MARGIN
    const below = (boardRect.bottom - rect.bottom) / zoom - DROPDOWN_MARGIN
    const up = above >= Math.min(PREFERRED_UP, below)
    const max = Math.round(Math.max(DROPDOWN_MIN, Math.min(DROPDOWN_MAX, up ? above : below)))

    window.clearTimeout(settleTimer.current)
    settleTimer.current = undefined
    // El abanico de la mano del rival y las bandas se animan al cargar y la
    // fila superior mide más de lo que acabará midiendo: pasar a `down` con esa
    // altura provisional abre el cajón sobre mi zona y lo salta a `up` al
    // asentarse. Solo se baja si la geometría lleva SETTLE_MS sin cambiar.
    if (!settled && !up && fitRef.current.up) {
      settleTimer.current = window.setTimeout(() => run(true), SETTLE_MS)
      return
    }
    const next = { up, max }
    fitRef.current = next
    setFit((prev) => (prev.up === up && prev.max === max ? prev : next))
  }, [])

  const measureNow = useCallback(() => measure(true), [measure])

  useEffect(() => () => window.clearTimeout(settleTimer.current), [])

  useLayoutEffect(() => {
    measure(false)
    const board = rightRef.current?.closest('.board-shell')
    if (!board || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measure(false))
    observer.observe(board)
    Array.from(board.children).forEach((child) => observer.observe(child))
    board.querySelectorAll('.oz-top-row').forEach((row) => observer.observe(row))
    const frame = requestAnimationFrame(() => measure(false))
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
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
        onPointerDownCapture={measureNow}
        onFocusCapture={measureNow}
      >
        {right}
        {dropdown}
      </div>
    </div>
  )
}
