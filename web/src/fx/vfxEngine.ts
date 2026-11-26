import { fxEnabled, fxMotionAllowed, getFxPrefs } from '../board/fx'
import { onFxReset } from './fxEngine'
import { resolveVfxRgb, rgba, type RgbTriplet, type VfxColorKey } from './vfxPalette'

export interface Point {
  x: number
  y: number
}

export interface RectLike {
  left: number
  top: number
  width: number
  height: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  endSize: number
  life: number
  maxLife: number
  rgb: RgbTriplet
  drag: number
  gravity: number
  additive: boolean
  /** Optional spiral pull toward a center (used by exile vortex). */
  attractX?: number
  attractY?: number
  swirl?: number
  /** Optional shard rotation for shatter effects. */
  rot?: number
  vRot?: number
  shard?: boolean
}

interface RingEffect {
  x: number
  y: number
  startR: number
  endR: number
  lineWidth: number
  life: number
  maxLife: number
  rgb: RgbTriplet
}

interface SlashEffect {
  x: number
  y: number
  angle: number
  length: number
  life: number
  maxLife: number
  rgb: RgbTriplet
}

interface CrackEffect {
  points: Point[]
  life: number
  maxLife: number
  rgb: RgbTriplet
  width: number
}

interface ProjectileEffect {
  from: Point
  ctrl: Point
  to: Point
  life: number
  maxLife: number
  rgb: RgbTriplet
  color: VfxColorKey
  radius: number
  trailAccum: number
  onImpact?: () => void
  impacted: boolean
}

const MAX_PARTICLES = 600
const WHITE_CORE: RgbTriplet = [255, 255, 255]

function quadBezier(p0: Point, p1: Point, p2: Point, t: number): Point {
  const u = 1 - t
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  }
}

export class VfxEngine {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private width = 0
  private height = 0
  private dpr = 1
  private rafId: number | null = null
  private lastTime = 0

  private particles: Particle[] = []
  private rings: RingEffect[] = []
  private slashes: SlashEffect[] = []
  private cracks: CrackEffect[] = []
  private projectiles: ProjectileEffect[] = []

  attach(canvas: HTMLCanvasElement): void {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.resize()
    if (this.hasActiveEffects()) this.ensureLoop()
  }

  detach(canvas: HTMLCanvasElement): void {
    if (this.canvas !== canvas) return
    this.stopLoop()
    this.canvas = null
    this.ctx = null
  }

  resize(): void {
    if (!this.canvas || typeof window === 'undefined') return
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.canvas.width = Math.max(1, Math.round(this.width * this.dpr))
    this.canvas.height = Math.max(1, Math.round(this.height * this.dpr))
    if (this.ctx) {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    }
  }

  hasActiveEffects(): boolean {
    return (
      this.particles.length > 0 ||
      this.rings.length > 0 ||
      this.slashes.length > 0 ||
      this.cracks.length > 0 ||
      this.projectiles.length > 0
    )
  }

  activeCount(): number {
    return this.particles.length + this.rings.length + this.slashes.length + this.cracks.length + this.projectiles.length
  }

  clear(): void {
    this.particles.length = 0
    this.rings.length = 0
    this.slashes.length = 0
    this.cracks.length = 0
    this.projectiles.length = 0
    this.stopLoop()
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.width, this.height)
    }
  }

  private pushParticle(p: Particle): void {
    if (this.particles.length >= MAX_PARTICLES) {
      this.particles.shift()
    }
    this.particles.push(p)
  }

  /** Radial additive sparks (impact, slam, combat hit, token pop). */
  sparkBurst(
    x: number,
    y: number,
    color: VfxColorKey = 'gold',
    opts?: { count?: number; speed?: number; size?: number; life?: number; gravity?: number },
  ): void {
    if (!fxMotionAllowed()) return
    const rgb = resolveVfxRgb(color)
    const count = opts?.count ?? 22
    const baseSpeed = opts?.speed ?? 260
    const baseSize = opts?.size ?? 4.5
    const baseLife = opts?.life ?? 0.45
    const gravity = opts?.gravity ?? 180

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4
      const spd = baseSpeed * (0.45 + Math.random() * 0.85)
      this.pushParticle({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: baseSize * (0.65 + Math.random() * 0.7),
        endSize: 0.4,
        life: 0,
        maxLife: baseLife * (0.7 + Math.random() * 0.6),
        rgb,
        drag: 0.92,
        gravity,
        additive: true,
      })
    }
    this.ensureLoop()
  }

  /** Expanding glowing shockwave ring (creature slam, heavy spell, counterspell). */
  shockwave(
    x: number,
    y: number,
    color: VfxColorKey = 'gold',
    opts?: { startR?: number; endR?: number; lineWidth?: number; duration?: number },
  ): void {
    if (!fxEnabled()) return
    this.rings.push({
      x,
      y,
      startR: opts?.startR ?? 14,
      endR: opts?.endR ?? 110,
      lineWidth: opts?.lineWidth ?? 5,
      life: 0,
      maxLife: opts?.duration ?? 0.38,
      rgb: resolveVfxRgb(color),
    })
    this.ensureLoop()
  }

  /** Arena-style combat slash + perpendicular impact sparks. */
  slash(x: number, y: number, angle = -0.65, color: VfxColorKey = 'ember', length = 115): void {
    if (!fxMotionAllowed()) return
    const rgb = resolveVfxRgb(color)
    this.slashes.push({ x, y, angle, length, life: 0, maxLife: 0.24, rgb })
    this.sparkBurst(x, y, color, { count: 16, speed: 300, size: 3.8, life: 0.32, gravity: 90 })
    this.shockwave(x, y, color, { startR: 10, endR: 72, lineWidth: 3.5, duration: 0.26 })
    this.ensureLoop()
  }

  /** Curved mana projectile with additive particle trail and arrival impact. */
  projectile(
    from: Point,
    to: Point,
    color: VfxColorKey = 'R',
    durationSec = 0.34,
    onImpact?: () => void,
  ): void {
    if (!fxMotionAllowed()) {
      onImpact?.()
      return
    }
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dist = Math.hypot(dx, dy) || 1
    const perpX = -dy / dist
    const perpY = dx / dist
    const bend = Math.min(110, dist * 0.22) * (dx >= 0 ? -1 : 1)
    const ctrl: Point = {
      x: (from.x + to.x) / 2 + perpX * bend,
      y: (from.y + to.y) / 2 + perpY * bend,
    }
    this.projectiles.push({
      from,
      ctrl,
      to,
      life: 0,
      maxLife: Math.max(0.12, durationSec),
      rgb: resolveVfxRgb(color),
      color,
      radius: 9,
      trailAccum: 0,
      onImpact,
      impacted: false,
    })
    this.ensureLoop()
  }

  /** Destroy shatter: tumbling ember/ash shards bursting from a card rectangle. */
  shatter(rect: RectLike, color: VfxColorKey = 'ember', count = 28): void {
    if (!fxMotionAllowed()) return
    const rgb = resolveVfxRgb(color)
    const ash = resolveVfxRgb('ash')
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    for (let i = 0; i < count; i++) {
      const px = rect.left + Math.random() * rect.width
      const py = rect.top + Math.random() * rect.height
      const dx = px - cx
      const dy = py - cy
      const isEmber = i % 3 === 0
      this.pushParticle({
        x: px,
        y: py,
        vx: dx * (1.8 + Math.random() * 1.4) + (Math.random() - 0.5) * 80,
        vy: dy * (1.4 + Math.random() * 1.2) - 40 - Math.random() * 70,
        size: isEmber ? 4 + Math.random() * 4 : 6 + Math.random() * 6,
        endSize: 1,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.35,
        rgb: isEmber ? rgb : ash,
        drag: 0.95,
        gravity: 340,
        additive: isEmber,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 10,
        shard: !isEmber,
      })
    }
    this.shockwave(cx, cy, color, { startR: 16, endR: Math.max(rect.width, rect.height) * 0.85, lineWidth: 3, duration: 0.35 })
    this.ensureLoop()
  }

  /** Exile vortex: luminous motes spiraling inward toward the card center. */
  exileVortex(rect: RectLike, color: VfxColorKey = 'W', count = 30): void {
    if (!fxMotionAllowed()) return
    const rgb = resolveVfxRgb(color)
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const rMax = Math.hypot(rect.width, rect.height) * 0.55
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3
      const r = rMax * (0.55 + Math.random() * 0.55)
      this.pushParticle({
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
        size: 3 + Math.random() * 3.5,
        endSize: 0.5,
        life: 0,
        maxLife: 0.45 + Math.random() * 0.2,
        rgb,
        drag: 0.9,
        gravity: 0,
        additive: true,
        attractX: cx,
        attractY: cy,
        swirl: 4.5,
      })
    }
    this.shockwave(cx, cy, color, { startR: rMax * 0.9, endR: 6, lineWidth: 3.5, duration: 0.42 })
    this.ensureLoop()
  }

  /** Mythic / Legendary ETB flourish: double shockwave + grand radial spark burst. */
  mythicBurst(x: number, y: number, color: VfxColorKey = 'gold'): void {
    if (!fxMotionAllowed()) return
    this.shockwave(x, y, color, { startR: 20, endR: 170, lineWidth: 6, duration: 0.52 })
    this.shockwave(x, y, 'W', { startR: 10, endR: 115, lineWidth: 3, duration: 0.38 })
    this.sparkBurst(x, y, color, { count: 42, speed: 340, size: 5.5, life: 0.65, gravity: 90 })
    this.ensureLoop()
  }

  /** Spawns jagged procedural fracture lines radiating from `(cx, cy)`. */
  private spawnCracks(cx: number, cy: number, radius: number, count: number, color: VfxColorKey, duration: number, width = 3): void {
    const rgb = resolveVfxRgb(color)
    for (let i = 0; i < count; i++) {
      const baseAngle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35
      const segments = 4 + Math.floor(Math.random() * 3)
      const len = radius * (0.7 + Math.random() * 0.55)
      const points: Point[] = [{ x: cx, y: cy }]
      for (let s = 1; s <= segments; s++) {
        const frac = s / segments
        const jitter = (Math.random() - 0.5) * 0.42
        const a = baseAngle + jitter * (1 - frac * 0.4)
        points.push({
          x: cx + Math.cos(a) * len * frac,
          y: cy + Math.sin(a) * len * frac,
        })
      }
      this.cracks.push({ points, life: 0, maxLife: duration * (0.85 + Math.random() * 0.3), rgb, width })
    }
  }

  /**
   * MTG Arena-style Counterspell shatter: electric blue arcane fracture web,
   * contracting-then-exploding shockwaves, and faceted crystal shards.
   */
  counterShatter(rect: RectLike): void {
    if (!fxMotionAllowed()) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const r = Math.hypot(rect.width, rect.height) * 0.55
    const blue = resolveVfxRgb('U')
    const cyan = resolveVfxRgb('arena')

    // Arcane fracture web + crisp double barrier shockwave
    this.spawnCracks(cx, cy, r * 1.15, 7, 'arena', 0.46, 3.2)
    this.shockwave(cx, cy, 'arena', { startR: r * 0.95, endR: 12, lineWidth: 3.5, duration: 0.22 })
    this.shockwave(cx, cy, 'U', { startR: 14, endR: r * 1.45, lineWidth: 5, duration: 0.42 })
    this.shockwave(cx, cy, 'W', { startR: 8, endR: r * 1.05, lineWidth: 2.5, duration: 0.3 })

    // Crystalline blue/cyan shards + additive electric sparks
    for (let i = 0; i < 34; i++) {
      const px = rect.left + Math.random() * rect.width
      const py = rect.top + Math.random() * rect.height
      const dx = px - cx
      const dy = py - cy
      const isSpark = i % 2 === 0
      this.pushParticle({
        x: px,
        y: py,
        vx: dx * (2.6 + Math.random() * 2.2) + (Math.random() - 0.5) * 140,
        vy: dy * (2.4 + Math.random() * 2.0) - 55 - Math.random() * 80,
        size: isSpark ? 3.5 + Math.random() * 3 : 6 + Math.random() * 6,
        endSize: 0.6,
        life: 0,
        maxLife: 0.48 + Math.random() * 0.34,
        rgb: isSpark ? cyan : blue,
        drag: 0.93,
        gravity: isSpark ? 80 : 280,
        additive: true,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 14,
        shard: !isSpark,
      })
    }
    this.ensureLoop()
  }

  /**
   * MTG Arena-style Player Elimination: glowing magma fracture web across the
   * avatar, triple cataclysmic shockwave, and a shower of embers & obsidian shards.
   */
  playerEliminated(rect: RectLike): void {
    if (!fxMotionAllowed()) return
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const r = Math.max(90, Math.min(220, Math.hypot(rect.width, rect.height) * 0.45))
    const ember = resolveVfxRgb('ember')
    const blood = resolveVfxRgb('blood')
    const ash = resolveVfxRgb('ash')
    const gold = resolveVfxRgb('gold')

    // Cataclysmic fracture bolts + triple expanding shockwave
    this.spawnCracks(cx, cy, r * 1.25, 10, 'ember', 0.72, 4.2)
    this.shockwave(cx, cy, 'W', { startR: 16, endR: r * 1.6, lineWidth: 6, duration: 0.45 })
    this.shockwave(cx, cy, 'ember', { startR: 22, endR: r * 2.1, lineWidth: 7, duration: 0.68 })
    this.shockwave(cx, cy, 'blood', { startR: 12, endR: r * 1.35, lineWidth: 4.5, duration: 0.55 })

    // 64 high-energy embers, gold sparks, and tumbling obsidian shards
    for (let i = 0; i < 64; i++) {
      const angle = (Math.PI * 2 * i) / 64 + (Math.random() - 0.5) * 0.35
      const speed = (160 + Math.random() * 380) * (i % 3 === 0 ? 1.25 : 0.85)
      const isShard = i % 3 === 1
      const rgb = isShard ? ash : i % 4 === 0 ? gold : i % 2 === 0 ? ember : blood
      this.pushParticle({
        x: cx + (Math.random() - 0.5) * Math.min(rect.width, 120) * 0.5,
        y: cy + (Math.random() - 0.5) * Math.min(rect.height, 120) * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        size: isShard ? 8 + Math.random() * 9 : 3.5 + Math.random() * 5,
        endSize: 0.8,
        life: 0,
        maxLife: 0.65 + Math.random() * 0.55,
        rgb,
        drag: 0.94,
        gravity: isShard ? 360 : 120,
        additive: !isShard,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 12,
        shard: isShard,
      })
    }
    this.ensureLoop()
  }

  private ensureLoop(): void {
    if (this.rafId != null || typeof requestAnimationFrame !== 'function') return
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now()
    this.rafId = requestAnimationFrame(this.tick)
  }

  private stopLoop(): void {
    if (this.rafId != null && typeof cancelAnimationFrame === 'function') {
      try {
        cancelAnimationFrame(this.rafId)
      } catch {
        /* ignore timer/rAF stub mismatch in tests */
      }
    }
    this.rafId = null
  }

  private tick = (now: number): void => {
    this.rafId = null
    const rawDt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000))
    this.lastTime = now
    const speed = getFxPrefs().speed
    this.step(rawDt * speed)
    this.draw()
    if (this.hasActiveEffects()) {
      this.rafId = requestAnimationFrame(this.tick)
    }
  }

  /** Advances simulation by `dt` seconds (exposed for deterministic unit tests). */
  step(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i]!
      pr.life += dt
      const t = Math.min(1, pr.life / pr.maxLife)
      const pos = quadBezier(pr.from, pr.ctrl, pr.to, t)

      pr.trailAccum += dt
      while (pr.trailAccum >= 0.012) {
        pr.trailAccum -= 0.012
        this.pushParticle({
          x: pos.x + (Math.random() - 0.5) * 6,
          y: pos.y + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 45,
          vy: (Math.random() - 0.5) * 45,
          size: pr.radius * (0.45 + Math.random() * 0.35),
          endSize: 0.5,
          life: 0,
          maxLife: 0.22 + Math.random() * 0.12,
          rgb: pr.rgb,
          drag: 0.9,
          gravity: 0,
          additive: true,
        })
      }

      if (t >= 1) {
        this.projectiles.splice(i, 1)
        if (!pr.impacted) {
          pr.impacted = true
          this.sparkBurst(pr.to.x, pr.to.y, pr.color, { count: 24, speed: 290, size: 4.5, life: 0.4 })
          this.shockwave(pr.to.x, pr.to.y, pr.color, { startR: 10, endR: 88, lineWidth: 4, duration: 0.32 })
          pr.onImpact?.()
        }
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!
      p.life += dt
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1)
        continue
      }
      if (p.attractX != null && p.attractY != null) {
        const dx = p.attractX - p.x
        const dy = p.attractY - p.y
        const swirl = p.swirl ?? 0
        p.vx = dx * 5.2 - dy * swirl
        p.vy = dy * 5.2 + dx * swirl
        p.x += p.vx * dt
        p.y += p.vy * dt
      } else {
        const decay = Math.pow(p.drag, dt * 60)
        p.vx *= decay
        p.vy = p.vy * decay + p.gravity * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
      }
      if (p.rot != null && p.vRot != null) {
        p.rot += p.vRot * dt
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i]!
      r.life += dt
      if (r.life >= r.maxLife) this.rings.splice(i, 1)
    }

    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i]!
      s.life += dt
      if (s.life >= s.maxLife) this.slashes.splice(i, 1)
    }

    for (let i = this.cracks.length - 1; i >= 0; i--) {
      const c = this.cracks[i]!
      c.life += dt
      if (c.life >= c.maxLife) this.cracks.splice(i, 1)
    }
  }

  private draw(): void {
    const ctx = this.ctx
    if (!ctx) return
    ctx.clearRect(0, 0, this.width, this.height)

    // Rings
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const r of this.rings) {
      const t = Math.min(1, r.life / r.maxLife)
      const ease = 1 - Math.pow(1 - t, 3)
      const radius = Math.max(1, r.startR + (r.endR - r.startR) * ease)
      const alpha = (1 - t) * 0.85
      ctx.beginPath()
      ctx.arc(r.x, r.y, radius, 0, Math.PI * 2)
      ctx.strokeStyle = rgba(r.rgb, alpha)
      ctx.lineWidth = Math.max(1, r.lineWidth * (1 - t * 0.7))
      ctx.stroke()
    }

    // Slashes
    for (const s of this.slashes) {
      const t = Math.min(1, s.life / s.maxLife)
      const alpha = Math.sin(t * Math.PI)
      ctx.save()
      ctx.translate(s.x, s.y)
      ctx.rotate(s.angle)
      const half = s.length * (0.45 + 0.55 * Math.min(1, t * 2.2)) * 0.5
      const grad = ctx.createLinearGradient(-half, 0, half, 0)
      grad.addColorStop(0, rgba(s.rgb, 0))
      grad.addColorStop(0.5, rgba(WHITE_CORE, alpha))
      grad.addColorStop(1, rgba(s.rgb, 0))
      ctx.beginPath()
      ctx.moveTo(-half, 0)
      ctx.quadraticCurveTo(0, -10 * (1 - t), half, 0)
      ctx.quadraticCurveTo(0, 4 * (1 - t), -half, 0)
      ctx.fillStyle = grad
      ctx.fill()
      ctx.restore()
    }

    // Procedural fracture cracks (glowing outer aura + white-hot core)
    for (const c of this.cracks) {
      if (c.points.length < 2) continue
      const t = Math.min(1, c.life / c.maxLife)
      const reveal = Math.min(1, t * 4.5)
      const alpha = t < 0.2 ? 1 : Math.max(0, 1 - (t - 0.2) / 0.8)
      const segs = Math.max(1, Math.ceil((c.points.length - 1) * reveal))
      ctx.beginPath()
      ctx.moveTo(c.points[0]!.x, c.points[0]!.y)
      for (let i = 1; i <= segs; i++) {
        ctx.lineTo(c.points[i]!.x, c.points[i]!.y)
      }
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.strokeStyle = rgba(c.rgb, alpha * 0.9)
      ctx.lineWidth = c.width * (1.8 - t * 0.8)
      ctx.stroke()
      ctx.strokeStyle = rgba(WHITE_CORE, alpha * 0.95)
      ctx.lineWidth = Math.max(1, c.width * 0.45 * (1 - t * 0.5))
      ctx.stroke()
    }

    // Projectiles
    for (const pr of this.projectiles) {
      const t = Math.min(1, pr.life / pr.maxLife)
      const pos = quadBezier(pr.from, pr.ctrl, pr.to, t)
      const grad = ctx.createRadialGradient(pos.x, pos.y, 1, pos.x, pos.y, pr.radius * 2.4)
      grad.addColorStop(0, rgba(WHITE_CORE, 0.95))
      grad.addColorStop(0.35, rgba(pr.rgb, 0.85))
      grad.addColorStop(1, rgba(pr.rgb, 0))
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, pr.radius * 2.4, 0, Math.PI * 2)
      ctx.fill()
    }

    // Particles
    for (const p of this.particles) {
      const t = Math.min(1, p.life / p.maxLife)
      const alpha = 1 - t * t
      const size = Math.max(0.5, p.size + (p.endSize - p.size) * t)
      ctx.globalCompositeOperation = p.additive ? 'lighter' : 'source-over'
      if (p.shard) {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot ?? 0)
        ctx.fillStyle = rgba(p.rgb, alpha * 0.9)
        ctx.fillRect(-size / 2, -size * 0.35, size, size * 0.7)
        ctx.restore()
      } else {
        ctx.fillStyle = rgba(p.rgb, alpha)
        ctx.beginPath()
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()
  }
}

export const vfx = new VfxEngine()

onFxReset(() => vfx.clear())
