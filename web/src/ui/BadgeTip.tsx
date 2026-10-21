import { useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './BadgeTip.css'

export interface BadgeTipContent {
  title: string
  body?: string
}

interface Props extends Omit<HTMLAttributes<HTMLSpanElement>, 'title' | 'role' | 'aria-label'> {
  tip: BadgeTipContent
  className?: string
  children: ReactNode
}

const GAP = 6
const MARGIN = 8
const TOUCH_MS = 2600

export default function BadgeTip({ tip, className, children, ...rest }: Props) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number>(0)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  const hide = () => {
    window.clearTimeout(timer.current)
    setOpen(false)
    setPos(null)
  }

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    const bubble = bubbleRef.current
    if (!open || !anchor || !bubble) return
    const a = anchor.getBoundingClientRect()
    const w = bubble.offsetWidth
    const h = bubble.offsetHeight
    const left = Math.min(Math.max(a.left + a.width / 2 - w / 2, MARGIN), Math.max(MARGIN, window.innerWidth - w - MARGIN))
    const above = a.top - h - GAP
    const top = above >= MARGIN ? above : a.bottom + GAP
    setPos({ left, top })
  }, [open, tip.title, tip.body])

  return (
    <span
      {...rest}
      ref={anchorRef}
      className={`${className ?? ''} has-badge-tip`}
      role="img"
      aria-label={tip.body ? `${tip.title}: ${tip.body}` : tip.title}
      onPointerEnter={(e) => {
        window.clearTimeout(timer.current)
        setOpen(true)
        if (e.pointerType === 'touch') timer.current = window.setTimeout(hide, TOUCH_MS)
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'touch') hide()
      }}
    >
      {children}
      {open &&
        createPortal(
          <div
            ref={bubbleRef}
            className="badge-tip"
            role="tooltip"
            style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          >
            <strong className="badge-tip-title">{tip.title}</strong>
            {tip.body && <span className="badge-tip-body">{tip.body}</span>}
          </div>,
          document.body,
        )}
    </span>
  )
}
