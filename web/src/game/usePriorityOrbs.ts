import { useCallback, useEffect, useRef, useState } from 'react'
import { fxMotionAllowed, fxMotionDuration } from '../board/fx'

const PRIORITY_ORB_MS = 400

export interface PriorityFrame {
  gameId: string | null
  holderId: string | null
}

export interface PriorityMove {
  from: string
  to: string
}

export interface PriorityOrb {
  id: number
  x0: number
  y0: number
  x1: number
  y1: number
  xm: number
  ym: number
  ms: number
}

export function priorityMove(prev: PriorityFrame | null, next: PriorityFrame): PriorityMove | null {
  if (!prev || prev.gameId !== next.gameId) return null
  if (!prev.holderId || !next.holderId || prev.holderId === next.holderId) return null
  return { from: prev.holderId, to: next.holderId }
}

interface Point {
  x: number
  y: number
}

function avatarCenter(playerId: string): Point | null {
  const el = Array.from(document.querySelectorAll<HTMLElement>('[data-player-anchor]'))
    .find((node) => node.dataset.playerAnchor === playerId)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

function orbPath(id: number, from: Point, to: Point): PriorityOrb {
  const lift = Math.min(64, 12 + Math.hypot(to.x - from.x, to.y - from.y) * 0.2)
  return {
    id,
    x0: from.x,
    y0: from.y,
    x1: to.x,
    y1: to.y,
    xm: (from.x + to.x) / 2,
    ym: (from.y + to.y) / 2 - lift,
    ms: fxMotionDuration(PRIORITY_ORB_MS),
  }
}

export function usePriorityOrbs(gameId: string | null, holderId: string | null): { orbs: PriorityOrb[]; done: (id: number) => void } {
  const prevRef = useRef<PriorityFrame | null>(null)
  const seqRef = useRef(0)
  const [orbs, setOrbs] = useState<PriorityOrb[]>([])

  useEffect(() => {
    const next: PriorityFrame = { gameId, holderId }
    const move = priorityMove(prevRef.current, next)
    prevRef.current = next
    if (!move || !fxMotionAllowed()) return
    const from = avatarCenter(move.from)
    const to = avatarCenter(move.to)
    if (!from || !to) return
    const id = ++seqRef.current
    setOrbs((cur) => [...cur, orbPath(id, from, to)])
  }, [gameId, holderId])

  const done = useCallback((id: number) => setOrbs((cur) => cur.filter((orb) => orb.id !== id)), [])

  return { orbs, done }
}
