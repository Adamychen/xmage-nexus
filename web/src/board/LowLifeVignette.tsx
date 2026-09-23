import { useEffect, useRef } from 'react'
import type { GameView } from '../net/types'
import { heartbeatCount, heartbeatIntervalMs, lowLifeLevel, poisonOf } from './lowLife'
import { soundManager } from '../audio/soundManager'
import './LowLifeVignette.css'

export default function LowLifeVignette({ game }: { game: GameView | null }) {
  const me = game?.players?.find((p) => p.controlled)
  const level = lowLifeLevel(me)
  const life = me?.life
  const poison = me ? poisonOf(me) : 0
  const prevRef = useRef<{ life?: number; poison: number; level: number }>({ life, poison, level })

  useEffect(() => {
    const prev = prevRef.current
    prevRef.current = { life, poison, level }
    if (level === 0) return
    const worse = (typeof prev.life === 'number' && typeof life === 'number' && life < prev.life)
      || poison > prev.poison
      || level > prev.level
    if (!worse) return
    const timers: Array<ReturnType<typeof setTimeout>> = []
    const beats = heartbeatCount(level)
    const gap = heartbeatIntervalMs(level)
    for (let i = 0; i < beats; i++) {
      timers.push(setTimeout(() => soundManager.play('heartbeat', 'game'), i * gap))
    }
    return () => timers.forEach((t) => clearTimeout(t))
  }, [life, poison, level])

  if (level === 0) return null
  return <div className="low-life-vignette" data-level={level} data-testid="low-life-vignette" aria-hidden="true" />
}
