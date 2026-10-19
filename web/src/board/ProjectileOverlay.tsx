import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { useProjectiles, type ProjectileFx } from './projectileFx'
import type { ManaColor } from './impactFx'
import './ProjectileOverlay.css'

type Vars = CSSProperties & Record<`--${string}`, string | number>

function rgbVar(c: ManaColor | undefined): string {
  return c ? `var(--mana-${c}-rgb)` : 'var(--gold-rgb)'
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2
}

function shrinkAndFade(t: number): { scale: number; opacity: number } {
  if (t < 0.12) return { scale: 0.5 + (0.5 * t) / 0.12, opacity: t / 0.12 }
  if (t > 0.85) return { scale: 1 - 0.2 * ((t - 0.85) / 0.15), opacity: (1 - t) / 0.15 }
  return { scale: 1, opacity: 1 }
}

function ProjectileItem({ projectile }: { projectile: ProjectileFx }) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const { from, measureTo, to0, duration } = projectile
    let last = to0
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const measured = measureTo()
      if (measured) last = { x: measured.left + measured.width / 2, y: measured.top + measured.height / 2 }
      const e = easeInOut(t)
      const dx = (last.x - from.x) * e
      const dy = (last.y - from.y) * e
      const { scale, opacity } = shrinkAndFade(t)
      const heading = (Math.atan2(last.y - from.y, last.x - from.x) * 180) / Math.PI
      el.style.transform = `translate(${dx}px, ${dy}px) rotate(${heading}deg) scale(${scale})`
      el.style.opacity = String(opacity)
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [projectile])

  return (
    <span
      ref={ref}
      className="projectile"
      data-testid="fx-projectile"
      style={{
        left: projectile.from.x,
        top: projectile.from.y,
        '--proj-rgb': rgbVar(projectile.colors[0]),
      } as Vars}
    />
  )
}

export default function ProjectileOverlay() {
  const items = useProjectiles()
  if (items.length === 0) return null
  return (
    <div className="projectile-overlay" aria-hidden>
      {items.map((p) => (
        <ProjectileItem key={p.id} projectile={p} />
      ))}
    </div>
  )
}
