import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { useImpacts, particleVectors, type ImpactFx, type ManaColor } from './impactFx'
import { wipeBoardRect } from './boardWipe'
import KeywordGlyph from './KeywordGlyph'
import './ImpactOverlay.css'

function rgbVar(c: ManaColor | undefined): string {
  return c ? `var(--mana-${c}-rgb)` : 'var(--gold-rgb)'
}

type Vars = CSSProperties & Record<`--${string}`, string | number>

function Particles({ fx, count, spread, className, rise = 0 }: { fx: ImpactFx; count: number; spread: number; className: string; rise?: number }) {
  return (
    <>
      {particleVectors(fx.id, count, spread).map((p, i) => (
        <span
          key={i}
          className={className}
          style={{
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy - rise}px`,
            '--s': p.size.toFixed(2),
            animationDelay: `${p.delay}ms`,
          } as Vars}
        />
      ))}
    </>
  )
}

/** The board wipe's wash follows the board while it plays: the stack panel closes as the wipe resolves and the board widens under it. */
function WipeItem({ style }: { style: Vars }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (typeof requestAnimationFrame !== 'function') return
    let raf = 0
    const follow = () => {
      const el = ref.current
      const rect = wipeBoardRect()
      if (el && rect) {
        el.style.left = `${rect.left + rect.width / 2}px`
        el.style.top = `${rect.top + rect.height / 2}px`
        el.style.width = `${rect.width}px`
        el.style.height = `${rect.height}px`
      }
      raf = requestAnimationFrame(follow)
    }
    raf = requestAnimationFrame(follow)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div ref={ref} className="fx-burst fx-wipe" data-testid="fx-wipe" style={style}>
      <span className="fx-wipe-dim" />
      <span className="fx-wipe-flash" />
      <span className="fx-wipe-wave" />
    </div>
  )
}

function ImpactItem({ fx }: { fx: ImpactFx }) {
  const base: Vars = { '--fx-dur': `${fx.duration}ms` }
  const at: Vars = { ...base, left: fx.x, top: fx.y, width: fx.w, height: fx.h }
  switch (fx.kind) {
    case 'slam':
      return (
        <div
          className="fx-slam"
          data-weight={fx.weight}
          data-testid="fx-slam"
          style={{ ...base, '--slam-a-rgb': rgbVar(fx.colors[0]), '--slam-b-rgb': rgbVar(fx.colors[1] ?? fx.colors[0]) } as Vars}
        >
          <span className="fx-slam-flash" />
          <span className="fx-slam-ring" />
        </div>
      )
    case 'sparks':
      return (
        <div className="fx-burst fx-sparks" style={at}>
          <span className="fx-hit-flash" />
          <Particles fx={fx} count={10} spread={Math.max(40, fx.w * 0.7)} className="fx-spark" />
        </div>
      )
    case 'destroy':
      return (
        <div className="fx-burst fx-destroy" data-testid="fx-destroy" style={at}>
          <span className="fx-destroy-scorch" />
          <Particles fx={fx} count={14} spread={Math.max(36, fx.w * 0.6)} rise={fx.h * 0.6} className="fx-ember" />
        </div>
      )
    case 'exile':
      return (
        <div className="fx-burst fx-exile" data-testid="fx-exile" style={at}>
          <span className="fx-exile-beam" />
          <span className="fx-exile-ring" />
          <Particles fx={fx} count={10} spread={Math.max(30, fx.w * 0.45)} rise={fx.h * 0.9} className="fx-mote" />
        </div>
      )
    case 'token-pop':
      return (
        <div className="fx-burst fx-token-pop" data-testid="fx-token-pop" style={at}>
          <span className="fx-pop-ring" />
          <Particles fx={fx} count={8} spread={Math.max(34, fx.w * 0.65)} className="fx-sparkle" />
        </div>
      )
    case 'enter-ring':
      return (
        <div className="fx-burst fx-enter-ring" data-testid="fx-enter-ring" style={at}>
          <span className="fx-enter-ring-wave" />
          <span className="fx-enter-ring-wave fx-enter-ring-wave--late" />
        </div>
      )
    case 'token-fade':
      return (
        <div className="fx-burst fx-token-fade" style={at}>
          <Particles fx={fx} count={9} spread={Math.max(26, fx.w * 0.4)} rise={fx.h * 0.3} className="fx-puff" />
        </div>
      )
    case 'countered':
      return (
        <div className="fx-burst fx-countered" data-testid="fx-countered" style={at}>
          <span className="fx-countered-flash" />
          <span className="fx-countered-crack" />
          <Particles fx={fx} count={12} spread={Math.max(44, fx.w * 0.8)} className="fx-shard" />
        </div>
      )
    case 'transform':
      return (
        <div className="fx-burst fx-transform" data-testid="fx-transform" style={at}>
          <span className="fx-transform-sweep" />
          <span className="fx-transform-ring" />
        </div>
      )
    case 'bounce':
      return (
        <div className="fx-burst fx-bounce" data-testid="fx-bounce" style={at}>
          <span className="fx-bounce-swirl" />
          <Particles fx={fx} count={8} spread={Math.max(30, fx.w * 0.5)} className="fx-droplet" />
        </div>
      )
    case 'heal':
      return (
        <div className="fx-burst fx-heal" data-testid="fx-heal" style={at}>
          <span className="fx-heal-glow" />
          <Particles fx={fx} count={12} spread={Math.max(24, fx.w * 0.35)} rise={Math.max(40, fx.h * 1.4)} className="fx-heal-mote" />
        </div>
      )
    case 'flicker':
      return (
        <div className="fx-burst fx-flicker" data-testid="fx-flicker" style={at}>
          <span className="fx-flicker-implode" />
          <span className="fx-flicker-flash" />
          <span className="fx-flicker-ring" />
        </div>
      )
    case 'phase':
      return (
        <div className="fx-burst fx-phase" data-testid="fx-phase" style={at}>
          <span className="fx-phase-shimmer" />
          <Particles fx={fx} count={8} spread={Math.max(24, fx.w * 0.4)} rise={fx.h * 0.4} className="fx-phase-mote" />
        </div>
      )
    case 'sacrifice':
      return (
        <div className="fx-burst fx-sacrifice" data-testid="fx-sacrifice" style={at}>
          <span className="fx-sacrifice-sigil" />
          <span className="fx-sacrifice-drain" />
          <Particles fx={fx} count={12} spread={Math.max(22, fx.w * 0.35)} rise={-Math.max(36, fx.h * 0.7)} className="fx-blood-drop" />
        </div>
      )
    case 'copy':
      return (
        <div className="fx-burst fx-copy" data-testid="fx-copy" style={at}>
          <span className="fx-copy-echo" />
          <span className="fx-copy-echo fx-copy-echo--late" />
        </div>
      )
    case 'ultimate':
      return (
        <div className="fx-burst fx-ultimate" data-testid="fx-ultimate" style={at}>
          <span className="fx-ultimate-rays" />
          <span className="fx-ultimate-core" />
          <span className="fx-ultimate-wave" />
          <span className="fx-ultimate-wave fx-ultimate-wave--late" />
          <Particles fx={fx} count={16} spread={Math.max(80, fx.w * 1.4)} className="fx-ultimate-spark" />
        </div>
      )
    case 'eliminated':
      return (
        <div className="fx-burst fx-eliminated" data-testid="fx-eliminated" style={at}>
          <span className="fx-eliminated-dim" />
          <span className="fx-eliminated-crack" />
          <Particles fx={fx} count={10} spread={Math.max(60, Math.min(fx.w, fx.h) * 0.45)} className="fx-shard fx-eliminated-shard" />
        </div>
      )
    case 'conceded':
      return (
        <div className="fx-burst fx-conceded" data-testid="fx-conceded" style={at}>
          <span className="fx-conceded-wash" />
        </div>
      )
    case 'wipe':
      return <WipeItem style={at} />
    case 'face-up':
      return (
        <div className="fx-burst fx-face-up" data-testid="fx-face-up" style={{ ...at, '--reveal-rgb': rgbVar(fx.colors[0]) } as Vars}>
          <span className="fx-face-up-shroud" />
          <span className="fx-face-up-burst" />
          <span className="fx-face-up-ring" />
          <Particles fx={fx} count={10} spread={Math.max(40, fx.w * 0.7)} className="fx-face-up-mote" />
        </div>
      )
    case 'poison':
      return (
        <div className="fx-burst fx-poison" data-testid="fx-poison" style={at}>
          <span className="fx-poison-splash" />
          <Particles fx={fx} count={7} spread={Math.max(14, fx.w * 0.5)} rise={-Math.max(30, fx.h * 2.4)} className="fx-poison-drop" />
        </div>
      )
    case 'poison-lethal':
      return (
        <div className="fx-burst fx-poison-lethal" data-testid="fx-poison-lethal" style={at}>
          <span className="fx-poison-cloud" />
          <span className="fx-poison-ring" />
          <Particles fx={fx} count={14} spread={Math.max(50, fx.w * 0.55)} rise={-Math.max(40, fx.h * 0.8)} className="fx-poison-drop" />
        </div>
      )
    case 'energy':
      return (
        <div className="fx-burst fx-energy" data-testid="fx-energy" style={at}>
          <span className="fx-energy-flash" />
          <span className="fx-energy-bolt" />
          <Particles fx={fx} count={8} spread={Math.max(26, fx.w * 0.9)} className="fx-energy-spark" />
        </div>
      )
    case 'control': {
      const dx = (fx.toX ?? fx.x) - fx.x
      const dy = (fx.toY ?? fx.y) - fx.y
      return (
        <div
          className="fx-burst fx-control"
          data-testid="fx-control"
          style={{ ...at, '--tint': fx.tint ?? 'var(--gold-300)', '--len': `${Math.hypot(dx, dy)}px`, '--angle': `${Math.atan2(dy, dx)}rad` } as Vars}
        >
          <span className="fx-control-grip" />
          <span className="fx-control-tether"><span className="fx-control-beam" /></span>
          <span className="fx-control-anchor" style={{ '--ax': `${dx}px`, '--ay': `${dy}px` } as Vars} />
        </div>
      )
    }
    case 'command':
      return (
        <div className="fx-burst fx-command" data-testid="fx-command" style={at}>
          <span className="fx-command-column" />
          <span className="fx-command-ring" />
          <span className="fx-command-crown" />
          <Particles fx={fx} count={10} spread={Math.max(30, fx.w * 0.5)} rise={fx.h * 0.9} className="fx-command-mote" />
        </div>
      )
    case 'tuck':
      return (
        <div className="fx-burst fx-tuck" data-testid="fx-tuck" style={at}>
          <span className="fx-tuck-vortex" />
          <Particles fx={fx} count={9} spread={Math.max(34, fx.w * 0.6)} className="fx-tuck-mote" />
        </div>
      )
    case 'attach': {
      const dx = (fx.toX ?? fx.x) - fx.x
      const dy = (fx.toY ?? fx.y) - fx.y
      return (
        <div
          className="fx-burst fx-attach"
          data-testid="fx-attach"
          style={{ ...at, '--attach-rgb': rgbVar(fx.colors[0]), '--len': `${Math.hypot(dx, dy)}px`, '--angle': `${Math.atan2(dy, dx)}rad` } as Vars}
        >
          <span className="fx-attach-frame" />
          <span className="fx-attach-ring" />
          <span className="fx-attach-tether"><span className="fx-attach-beam" /></span>
          <span className="fx-attach-knot" style={{ '--ax': `${dx}px`, '--ay': `${dy}px` } as Vars} />
        </div>
      )
    }
    case 'mutate':
      return (
        <div className="fx-burst fx-mutate" data-testid="fx-mutate" style={{ ...at, '--mutate-a-rgb': rgbVar(fx.colors[0] ?? 'g'), '--mutate-b-rgb': rgbVar(fx.colors[1] ?? 'b') } as Vars}>
          <span className="fx-mutate-flash" />
          <span className="fx-mutate-ripple" />
          <span className="fx-mutate-ripple fx-mutate-ripple--2" />
          <span className="fx-mutate-ripple fx-mutate-ripple--3" />
          <Particles fx={fx} count={12} spread={Math.max(40, fx.w * 0.75)} className="fx-mutate-mote" />
        </div>
      )
    case 'animate':
      return (
        <div className="fx-burst fx-animate" data-testid="fx-animate" style={{ ...at, '--animate-rgb': rgbVar(fx.colors[0]) } as Vars}>
          <span className="fx-animate-column" />
          <span className="fx-animate-ring" />
          <Particles fx={fx} count={10} spread={Math.max(26, fx.w * 0.45)} rise={Math.max(40, fx.h * 1.1)} className="fx-animate-mote" />
        </div>
      )
    case 'emblem':
      return (
        <div className="fx-burst fx-emblem" data-testid="fx-emblem" style={at}>
          <span className="fx-emblem-flash" />
          <span className="fx-emblem-ring" />
          <span className="fx-emblem-ring fx-emblem-ring--late" />
          <Particles fx={fx} count={10} spread={Math.max(40, fx.w * 0.8)} className="fx-emblem-spark" />
        </div>
      )
    case 'dungeon':
      return (
        <div className="fx-burst fx-dungeon" data-testid="fx-dungeon" style={at}>
          <span className="fx-dungeon-glow" />
          <span className="fx-dungeon-ring" />
          <Particles fx={fx} count={8} spread={Math.max(24, fx.w * 0.6)} rise={Math.max(20, fx.h)} className="fx-dungeon-ember" />
        </div>
      )
    case 'planeswalk':
      return (
        <div className="fx-burst fx-planeswalk" data-testid="fx-planeswalk" style={at}>
          <span className="fx-planeswalk-portal" />
          <span className="fx-planeswalk-flash" />
          <Particles fx={fx} count={12} spread={Math.max(50, fx.w * 0.9)} className="fx-planeswalk-mote" />
        </div>
      )
    case 'flip':
      return (
        <div className="fx-burst fx-flip" data-testid="fx-flip" style={{ ...at, '--flip-rgb': rgbVar(fx.colors[0]) } as Vars}>
          <span className="fx-flip-flash" />
          <span className="fx-flip-arc" />
        </div>
      )
    case 'first-strike':
      return (
        <div className="fx-burst fx-first-strike" data-testid="fx-first-strike" style={at}>
          <span className="fx-first-strike-slash" />
        </div>
      )
    case 'deathtouch':
      return (
        <div className="fx-burst fx-deathtouch" data-testid="fx-deathtouch" style={{ ...at, '--rise': `${fx.h * 0.2}px` } as Vars}>
          <span className="fx-deathtouch-ring" />
          <span className="fx-deathtouch-skull">
            <KeywordGlyph id="deathtouch" category="combat" set="outline" />
          </span>
          <Particles fx={fx} count={8} spread={Math.max(30, fx.w * 0.5)} rise={fx.h * 0.6} className="fx-deathtouch-mote" />
        </div>
      )
    case 'lifelink': {
      const dx = (fx.toX ?? fx.x) - fx.x
      const dy = (fx.toY ?? fx.y) - fx.y
      return (
        <div
          className="fx-burst fx-lifelink"
          data-testid="fx-lifelink"
          style={{ ...at, '--len': `${Math.hypot(dx, dy)}px`, '--angle': `${Math.atan2(dy, dx)}rad` } as Vars}
        >
          <span className="fx-lifelink-glow" />
          <span className="fx-lifelink-path">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <span key={i} className="fx-lifelink-mote" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </span>
        </div>
      )
    }
    case 'trample': {
      const dx = (fx.toX ?? fx.x) - fx.x
      const dy = (fx.toY ?? fx.y) - fx.y
      return (
        <div
          className="fx-burst fx-trample"
          data-testid="fx-trample"
          style={{ ...at, '--len': `${Math.hypot(dx, dy)}px`, '--angle': `${Math.atan2(dy, dx)}rad` } as Vars}
        >
          <span className="fx-trample-path">
            <span className="fx-trample-wave" />
          </span>
          <span className="fx-trample-burst" style={{ '--ax': `${dx}px`, '--ay': `${dy}px` } as Vars} />
        </div>
      )
    }
    case 'indestructible':
      return (
        <div className="fx-burst fx-indestructible" data-testid="fx-indestructible" style={at}>
          <span className="fx-indestructible-shield" />
          <span className="fx-indestructible-crack" />
          <span className="fx-indestructible-flash" />
        </div>
      )
  }
}

export default function ImpactOverlay() {
  const impacts = useImpacts()
  if (impacts.length === 0) return null
  return (
    <div className="impact-overlay" aria-hidden="true">
      {impacts.map((fx) => (
        <ImpactItem key={fx.id} fx={fx} />
      ))}
    </div>
  )
}
