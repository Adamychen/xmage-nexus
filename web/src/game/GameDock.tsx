import { createContext, useContext, useLayoutEffect } from 'react'
import type { ReactNode, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { HandPromptSlotContext } from '../board/BoardShell'
import './GameDock.css'

const DOCK_GAP = 8
const DOCK_FALLBACK = 104
const BOTTOM_RESOURCES_SELECTOR = '.pz-bottom-row .resource-bar'
const BOTTOM_ROW_SELECTOR = '.pz-bottom-row'
const DOCK_SELECTOR = '[data-testid="game-dock"]'
const SEAT_COPY_SELECTOR = '.spotlight-copy'

const PromptSlotContext = createContext<HTMLElement | null>(null)

const HandPromptContext = createContext<HTMLElement | null>(null)

/** PRM-18: the slot across the middle of the board, where the order being given is read. */
const OrderPromptContext = createContext<HTMLElement | null>(null)

interface PromptSlotProviderProps {
  value: HTMLElement | null
  /** Slot above the own hand, published by the board through `onHandSlot`. */
  hand?: HTMLElement | null
  onHandSlot?: ((el: HTMLElement | null) => void) | null
  /** PRM-18: slot across the middle of the board, for the order being given. */
  order?: HTMLElement | null
  children: ReactNode
}

export function PromptSlotProvider({ value, hand = null, onHandSlot = null, order = null, children }: PromptSlotProviderProps) {
  return (
    <PromptSlotContext.Provider value={value}>
      <OrderPromptContext.Provider value={order}>
        <HandPromptContext.Provider value={hand}>
          <HandPromptSlotContext.Provider value={onHandSlot}>{children}</HandPromptSlotContext.Provider>
        </HandPromptContext.Provider>
      </OrderPromptContext.Provider>
    </PromptSlotContext.Provider>
  )
}

export function DockPrompt({ children }: { children: ReactNode }) {
  const slot = useContext(PromptSlotContext)
  return slot ? createPortal(children, slot) : <>{children}</>
}

/**
 * PRM-18: the order the player is being given, read across the middle of the board instead of in
 * the corner the controls live in. With no board to lay it over (a dialog standing in for the
 * bar), it falls back to the dock, where it is still beside what answers it.
 */
export function OrderPrompt({ children }: { children: ReactNode }) {
  const slot = useContext(OrderPromptContext)
  return slot ? createPortal(children, slot) : <DockPrompt>{children}</DockPrompt>
}

/** Prompt about the own hand: floats above the fan when the board publishes
 *  its hand slot, otherwise falls back to the dock. */
export function HandPrompt({ children }: { children: ReactNode }) {
  const slot = useContext(HandPromptContext)
  return slot ? createPortal(children, slot) : <DockPrompt>{children}</DockPrompt>
}

function ownResourceBar(wrap: HTMLElement): HTMLElement | null {
  return Array.from(wrap.querySelectorAll<HTMLElement>(BOTTOM_RESOURCES_SELECTOR)).find((el) => !el.closest(SEAT_COPY_SELECTOR)) ?? null
}

function ownBottomRow(wrap: HTMLElement): HTMLElement | null {
  return Array.from(wrap.querySelectorAll<HTMLElement>(BOTTOM_ROW_SELECTOR)).find((el) => !el.closest(SEAT_COPY_SELECTOR)) ?? null
}

export function useDockOffset(wrapRef: RefObject<HTMLElement | null>, deps: readonly unknown[]) {
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const measure = () => {
      const bar = ownResourceBar(wrap)
      const dock = wrap.querySelector<HTMLElement>(DOCK_SELECTOR)
      const wrapRect = wrap.getBoundingClientRect()
      const zoom = wrap.offsetHeight > 0 ? wrapRect.height / wrap.offsetHeight : 1
      const px = bar && zoom > 0
        ? Math.round(Math.max(0, (wrapRect.bottom - bar.getBoundingClientRect().top) / zoom) + DOCK_GAP)
        : DOCK_FALLBACK
      wrap.style.setProperty('--dock-bottom', `${px}px`)
      const clear = dock && zoom > 0
        ? Math.round(Math.max(0, (wrapRect.bottom - dock.getBoundingClientRect().top) / zoom))
        : 0
      wrap.style.setProperty('--dock-clear', `${clear}px`)
      const row = ownBottomRow(wrap)
      if (row && zoom > 0) {
        wrap.style.setProperty('--own-bar-offset', `${Math.round(Math.max(0, (wrapRect.bottom - row.getBoundingClientRect().top) / zoom))}px`)
      } else {
        wrap.style.removeProperty('--own-bar-offset')
      }
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(wrap)
    const bar = ownResourceBar(wrap)
    if (bar) observer.observe(bar)
    const row = ownBottomRow(wrap)
    if (row) observer.observe(row)
    const dock = wrap.querySelector(DOCK_SELECTOR)
    if (dock) observer.observe(dock)
    return () => observer.disconnect()
  }, deps)
}

interface GameDockProps {
  action: ReactNode
  rewind?: ReactNode
  onPromptSlot: (el: HTMLElement | null) => void
}

export default function GameDock({ action, rewind = null, onPromptSlot }: GameDockProps) {
  return (
    <div className="game-dock" data-testid="game-dock">
      <div className="game-dock-prompt" ref={onPromptSlot} />
      <div className="game-dock-row">
        {rewind && (
          <div className="game-dock-rewind" data-testid="game-dock-rewind">
            {rewind}
          </div>
        )}
        {action}
      </div>
    </div>
  )
}
