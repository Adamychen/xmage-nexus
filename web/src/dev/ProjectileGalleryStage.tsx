import { useEffect } from 'react'
import ProjectileOverlay from '../board/ProjectileOverlay'
import VfxCanvas from '../fx/VfxCanvas'
import { replayProjectileDemo } from './projectileDemo'

export default function ProjectileGalleryStage() {
  useEffect(() => {
    const id = requestAnimationFrame(() => replayProjectileDemo())
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <div className="projectile-stage" data-projectile-stage="">
      <div className="projectile-stage-source" data-fx-from="">
        <span>Stack card</span>
      </div>
      <div className="projectile-stage-target" data-fx-to="">
        <span>Target</span>
      </div>
      <ProjectileOverlay />
      <VfxCanvas />
    </div>
  )
}
