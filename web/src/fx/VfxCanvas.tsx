import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { vfx } from './vfxEngine'
import './VfxCanvas.css'

/**
 * Full-viewport transparent Canvas 2D overlay for MTG Arena-style particles & VFX.
 * Portaled to `document.body` so ancestor transforms (e.g. board shake or gallery
 * layout wrappers) never offset `position: fixed` viewport coordinates.
 */
export default function VfxCanvas() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    vfx.attach(canvas)
    const onResize = () => vfx.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      vfx.detach(canvas)
    }
  }, [])

  const node = <canvas ref={ref} className="vfx-canvas" data-testid="vfx-canvas" aria-hidden="true" />
  return typeof document !== 'undefined' ? createPortal(node, document.body) : node
}
