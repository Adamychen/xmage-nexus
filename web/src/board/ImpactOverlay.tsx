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
    case 'token-fade':
      return (
        <div className="fx-burst fx-token-fade" style={at}>
          <Particles fx={fx} count={9} spread={Math.max(26, fx.w * 0.4)} rise={fx.h * 0.3} className="fx-puff" />
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
