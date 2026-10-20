import type { CSSProperties } from 'react'
import { useImpacts, particleVectors, type ImpactFx, type ManaColor } from './impactFx'
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
