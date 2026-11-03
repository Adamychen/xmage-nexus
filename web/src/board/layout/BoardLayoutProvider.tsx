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
    return () => engine.unregister(key)
  }, [engine, key, signature])

  useLayoutEffect(() => () => local?.dispose(), [local])

  return null
}
