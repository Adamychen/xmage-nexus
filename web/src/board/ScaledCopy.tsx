import { useEffect, useRef, useState, type ReactNode } from 'react'

export function copyScale(outerW: number, outerH: number, refW: number, refH: number): number {
  if (outerW <= 0 || outerH <= 0 || refW <= 0 || refH <= 0) return 0
  return Math.min(outerW / refW, outerH / refH)
}

export interface ScaledCopyProps {
  refWidth: number
  refHeight: number
  className?: string
  testId?: string
  playerId: string
  onClick?: (e: React.MouseEvent) => void
  children: ReactNode
  overlay?: ReactNode
}

export function useLayoutBox(ref: React.RefObject<HTMLElement | null>): { w: number; h: number } {
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return box
}

export default function ScaledCopy({ refWidth, refHeight, className, testId, playerId, onClick, children, overlay }: ScaledCopyProps) {
  const outerRef = useRef<HTMLDivElement>(null)
  const outer = useLayoutBox(outerRef)

  const scale = copyScale(outer.w, outer.h, refWidth, refHeight)
  const ready = scale > 0
  const left = ready ? (outer.w - refWidth * scale) / 2 : 0
  const top = ready ? (outer.h - refHeight * scale) / 2 : 0

  return (
    <div
      ref={outerRef}
      className={`spotlight-copy${className ? ` ${className}` : ''}`}
      data-testid={testId}
      data-copy-player={playerId}
      data-scale={ready ? Number(scale.toFixed(3)) : undefined}
      onClick={onClick}
    >
      <div
        className="spotlight-copy-frame"
        style={{
          width: refWidth,
          height: refHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top,
          left,
          visibility: ready ? undefined : 'hidden',
        }}
      >
        {children}
      </div>
      {overlay}
    </div>
  )
}
