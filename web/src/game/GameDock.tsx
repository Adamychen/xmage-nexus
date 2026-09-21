import { createContext, useContext, useLayoutEffect } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import './GameDock.css'

const DOCK_GAP = 8
const DOCK_FALLBACK = 104
const BOTTOM_RESOURCES_SELECTOR = '.pz-bottom-row .resource-bar'

const PromptSlotContext = createContext<HTMLElement | null>(null)

export const PromptSlotProvider = PromptSlotContext.Provider

export function DockPrompt({ children }: { children: ReactNode }) {
  const slot = useContext(PromptSlotContext)
  return slot ? createPortal(children, slot) : <>{children}</>
}

export function useDockOffset(wrapRef: RefObject<HTMLElement | null>, deps: readonly unknown[]) {
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const measure = () => {
      const bar = wrap.querySelector<HTMLElement>(BOTTOM_RESOURCES_SELECTOR)
      const wrapRect = wrap.getBoundingClientRect()
      const zoom = wrap.offsetHeight > 0 ? wrapRect.height / wrap.offsetHeight : 1
      const px = bar && zoom > 0
        ? Math.round(Math.max(0, (wrapRect.bottom - bar.getBoundingClientRect().top) / zoom) + DOCK_GAP)
        : DOCK_FALLBACK
      wrap.style.setProperty('--dock-bottom', `${px}px`)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(wrap)
    const bar = wrap.querySelector(BOTTOM_RESOURCES_SELECTOR)
    if (bar) observer.observe(bar)
    return () => observer.disconnect()
  }, deps)
}

interface GameDockProps {
  action: ReactNode
  onPromptSlot: (el: HTMLElement | null) => void
}

export default function GameDock({ action, onPromptSlot }: GameDockProps) {
  return (
    <div className="game-dock" data-testid="game-dock">
      <div className="game-dock-prompt" ref={onPromptSlot} />
      {action}
    </div>
  )
}
