import { useLayoutEffect, useRef, useState } from 'react'
import { ARENA_EASE, Flip, fxShake, fxTimeline, gsap, resetFxContext } from '../fx/fxEngine'
import { vfx } from '../fx/vfxEngine'
import type { VfxColorKey } from '../fx/vfxPalette'
import VfxCanvas from '../fx/VfxCanvas'
import Button from '../ui/Button'
import ChipButton from '../ui/ChipButton'
import './ArenaFxSandbox.css'

const COLORS: Array<{ key: VfxColorKey; label: string }> = [
  { key: 'R', label: 'Red' },
  { key: 'U', label: 'Blue' },
  { key: 'W', label: 'White' },
  { key: 'B', label: 'Black' },
  { key: 'G', label: 'Green' },
  { key: 'gold', label: 'Gold' },
]

function centerOf(el: HTMLElement | null): { x: number; y: number } | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

export default function ArenaFxSandbox() {
  const stageRef = useRef<HTMLDivElement>(null)
  const stackRef = useRef<HTMLDivElement>(null)
  const attackerRef = useRef<HTMLDivElement>(null)
  const defenderRef = useRef<HTMLDivElement>(null)
  const mythicRef = useRef<HTMLDivElement>(null)
  const flipRowRef = useRef<HTMLDivElement>(null)
  const flipStateRef = useRef<Flip.FlipState | null>(null)

  const [color, setColor] = useState<VfxColorKey>('R')
  const [lands, setLands] = useState([
    { id: 'land-1', name: 'Mountain', tapped: false },
    { id: 'land-2', name: 'Island', tapped: false },
    { id: 'land-3', name: 'Forest', tapped: false },
    { id: 'land-4', name: 'Plains', tapped: false },
  ])

  useLayoutEffect(() => {
    const state = flipStateRef.current
    if (!state) return
    flipStateRef.current = null
    Flip.from(state, {
      duration: 0.28,
      ease: ARENA_EASE.snapOut,
      stagger: 0.025,
      absolute: false,
    })
  }, [lands])

  const runCombatStrike = () => {
    const atk = attackerRef.current
    const def = defenderRef.current
    const stage = stageRef.current
    const from = centerOf(atk)
    const to = centerOf(def)
    if (!atk || !def || !stage || !from || !to) return

    const dx = (to.x - from.x) * 0.78
    const dy = (to.y - from.y) * 0.78
    const angle = Math.atan2(dy, dx)
    const tl = fxTimeline()
    if (!tl) return

    tl.to(atk, { x: -dx * 0.14, y: -dy * 0.14, scale: 1.07, duration: 0.11, ease: 'power2.out' })
      .to(atk, { x: dx, y: dy, scale: 1.12, duration: 0.13, ease: ARENA_EASE.slamIn })
      .call(() => {
        vfx.slash(to.x, to.y, angle - 0.55, color)
        fxShake(stage, 'medium')
        gsap.fromTo(def, { x: 0 }, { x: dx * 0.08, duration: 0.05, yoyo: true, repeat: 1, clearProps: 'x' })
      })
      .to(atk, { duration: 0.045 }) // brief hitstop
      .to(atk, { x: 0, y: 0, scale: 1, duration: 0.24, ease: ARENA_EASE.recoil, clearProps: 'x,y,scale' })
  }

  const runProjectile = () => {
    const from = centerOf(stackRef.current)
    const to = centerOf(defenderRef.current)
    const def = defenderRef.current
    const stage = stageRef.current
    if (!from || !to || !def || !stage) return
    vfx.projectile(from, to, color, 0.34, () => {
      fxShake(stage, 'light')
      fxShake(def, 'medium')
    })
  }

  const runMythicSlam = () => {
    const card = mythicRef.current
    const stage = stageRef.current
    const c = centerOf(card)
    if (!card || !stage || !c) return
    const tl = fxTimeline()
    if (!tl) return

    tl.set(card, { y: -110, scale: 1.45, opacity: 0 })
      .to(card, { y: -70, scale: 1.5, opacity: 1, duration: 0.22, ease: ARENA_EASE.snapOut })
      .to(card, { duration: 0.16 })
      .to(card, { y: 0, scale: 0.96, duration: 0.16, ease: ARENA_EASE.slamIn })
      .call(() => {
        vfx.mythicBurst(c.x, c.y, color === 'R' ? 'gold' : color)
        fxShake(stage, 'heavy')
      })
      .to(card, { scale: 1, duration: 0.14, ease: ARENA_EASE.pop, clearProps: 'y,scale,opacity' })
  }

  const runDestroyShatter = () => {
    const card = defenderRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const tl = fxTimeline()
    if (!tl) return

    tl.call(() => vfx.shatter(rect, color))
      .to(card, { scale: 0.88, opacity: 0, y: 18, duration: 0.28, ease: 'power2.in' })
      .to(card, { scale: 1, opacity: 1, y: 0, duration: 0.22, delay: 0.25, ease: ARENA_EASE.snapOut, clearProps: 'scale,opacity,y' })
  }

  const runExileVortex = () => {
    const card = defenderRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const tl = fxTimeline()
    if (!tl) return

    tl.call(() => vfx.exileVortex(rect, color))
      .to(card, { scale: 0.35, rotation: 18, opacity: 0, duration: 0.38, ease: 'power3.in' })
      .to(card, { scale: 1, rotation: 0, opacity: 1, duration: 0.24, delay: 0.25, ease: ARENA_EASE.snapOut, clearProps: 'scale,rotation,opacity' })
  }

  const runTapFlip = () => {
    const row = flipRowRef.current
    if (!row) return
    const items = row.querySelectorAll<HTMLElement>('[data-flip-id]')
    flipStateRef.current = Flip.getState(items)
    setLands((prev) => {
      const next = prev.map((l, i) => (i === 0 ? { ...l, tapped: !l.tapped } : l))
      return [...next].sort((a, b) => Number(a.tapped) - Number(b.tapped))
    })
  }

  const runUntapWave = () => {
    const row = flipRowRef.current
    if (!row) return
    setLands((prev) => prev.map((l) => ({ ...l, tapped: false })))
    const items = Array.from(row.querySelectorAll<HTMLElement>('[data-flip-id]'))
    const tl = fxTimeline()
    if (!tl || items.length === 0) return

    items.forEach((node, index) => {
      const at = index * 0.06
      tl.set(node, { transition: 'none' }, 0)
        .fromTo(
          node,
          { rotation: 90, scale: 0.92, y: 0 },
          { rotation: 0, scale: 1.06, y: -12, duration: 0.19, ease: ARENA_EASE.pop },
          at,
        )
        .to(
          node,
          { scale: 1, y: 0, duration: 0.12, ease: ARENA_EASE.snapOut, clearProps: 'rotation,scale,y,transition' },
          at + 0.19,
        )
      const c = centerOf(node)
      if (c) {
        tl.call(
          () => vfx.sparkBurst(c.x, c.y, 'W', { count: 8, speed: 140, size: 3, life: 0.28, gravity: 40 }),
          undefined,
          at + 0.05,
        )
      }
    })
  }

  return (
    <div className="arena-fx-sandbox board-surface" data-arena-fx-sandbox="">
      <div className="arena-fx-controls">
        <div className="arena-fx-colors" role="group" aria-label="VFX color">
          {COLORS.map((c) => (
            <ChipButton
              key={c.key}
              active={color === c.key}
              onClick={() => setColor(c.key)}
            >
              {c.label}
            </ChipButton>
          ))}
        </div>
        <div className="arena-fx-actions">
          <Button size="sm" onClick={runCombatStrike}>Combat Strike</Button>
          <Button size="sm" onClick={runProjectile}>Mana Projectile</Button>
          <Button size="sm" onClick={runMythicSlam}>Mythic Slam</Button>
          <Button size="sm" onClick={runDestroyShatter}>Destroy Shatter</Button>
          <Button size="sm" onClick={runExileVortex}>Exile Vortex</Button>
          <Button size="sm" onClick={runTapFlip}>Tap + FLIP</Button>
          <Button size="sm" onClick={runUntapWave}>Untap Wave</Button>
          <Button size="sm" variant="ghost" onClick={resetFxContext}>Clear</Button>
        </div>
      </div>

      <div className="arena-fx-stage" ref={stageRef}>
        <div className="arena-fx-row arena-fx-row--top">
          <div className="arena-fx-card arena-fx-card--stack" ref={stackRef}>
            <span className="arena-fx-card-tag">STACK</span>
            <strong>Lightning Bolt</strong>
          </div>
          <div className="arena-fx-card arena-fx-card--defender" ref={defenderRef}>
            <span className="arena-fx-card-tag">DEFENDER</span>
            <strong>Tarmogoyf</strong>
            <span className="arena-fx-card-pt">4/5</span>
          </div>
        </div>

        <div className="arena-fx-row arena-fx-row--mid">
          <div className="arena-fx-card arena-fx-card--attacker" ref={attackerRef}>
            <span className="arena-fx-card-tag">ATTACKER</span>
            <strong>Ragavan</strong>
            <span className="arena-fx-card-pt">2/1</span>
          </div>
          <div className="arena-fx-card arena-fx-card--mythic" ref={mythicRef}>
            <span className="arena-fx-card-tag">MYTHIC</span>
            <strong>Sheoldred</strong>
            <span className="arena-fx-card-pt">4/5</span>
          </div>
        </div>

        <div className="arena-fx-row arena-fx-row--lands" ref={flipRowRef}>
          {lands.map((land) => (
            <div
              key={land.id}
              data-flip-id={land.id}
              className={`arena-fx-land${land.tapped ? ' is-tapped' : ''}`}
            >
              {land.name}
            </div>
          ))}
        </div>
      </div>

      <VfxCanvas />
    </div>
  )
}
