import { createContext, useContext, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { BoardLayoutEngine, registrationSignature, type SeatRegistration } from './layoutEngine'
import type { BoardLayoutKind } from './solveBoardLayout'

const EngineContext = createContext<BoardLayoutEngine | null>(null)
const OwnCardWContext = createContext<number | undefined>(undefined)

export interface BoardLayoutProviderProps {
  boardRef: RefObject<HTMLElement | null>
  layout: BoardLayoutKind
  opponentsCappedByOwn?: boolean
  children: ReactNode
}

export function BoardLayoutProvider({ boardRef, layout, opponentsCappedByOwn = false, children }: BoardLayoutProviderProps) {
  const [engine] = useState(() => new BoardLayoutEngine({ layout, opponentsCappedByOwn }))
  const [ownCardW, setOwnCardW] = useState<number | undefined>(undefined)

  useLayoutEffect(() => {
    engine.onSolved = setOwnCardW
    engine.configure({ layout, opponentsCappedByOwn })
    return () => {
      engine.onSolved = null
    }
  }, [engine, layout, opponentsCappedByOwn])

  useLayoutEffect(() => {
    engine.setBoard(boardRef.current)
  })

  useLayoutEffect(() => () => engine.dispose(), [engine])

  return (
    <EngineContext.Provider value={engine}>
      <OwnCardWContext.Provider value={ownCardW}>{children}</OwnCardWContext.Provider>
    </EngineContext.Provider>
  )
}

/** The solved card width of the own seat, for anything that sized itself from it. */
export function useBoardLayoutOwnCardW(): number | undefined {
  return useContext(OwnCardWContext)
}

/**
 * Registers one seat with the board's layout. Rendered inside a `BoardZone`
 * (it draws nothing). Outside a provider (unit tests, previews) the seat is
 * laid out alone by its own engine, with the same solver.
 */
export function BoardLayoutSeat({ reg }: { reg: SeatRegistration | null }): null {
  const shared = useContext(EngineContext)
  const [local] = useState<BoardLayoutEngine | null>(() =>
    shared ? null : new BoardLayoutEngine({ layout: 'standard', opponentsCappedByOwn: false }),
  )
  const engine = shared ?? local
  const key = useId()
  const signature = reg ? registrationSignature(reg) : ''
  const latest = useRef(reg)

  useLayoutEffect(() => {
    latest.current = reg
  })

  useLayoutEffect(() => {
    const next = latest.current
    if (!engine || !next) return
    engine.register(key, next)
    // BRD-67: solved before the browser paints the seat's new contents, not in the animation frame
    // the engine schedules, which draws them once at the card size the previous contents had. The
    // microtask runs after the whole commit, so every seat of this render is already registered and
    // the board is solved once with all of them: solving inside the effect instead solves the board
    // again for each seat and writes sizes the next seat changes (BRD-21).
    queueMicrotask(() => engine.flush())
    return () => engine.unregister(key)
  }, [engine, key, signature])

  useLayoutEffect(() => () => local?.dispose(), [local])

  return null
}
