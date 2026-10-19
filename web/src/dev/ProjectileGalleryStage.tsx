import { useEffect } from 'react'
import ProjectileOverlay from '../board/ProjectileOverlay'
import { replayProjectileDemo } from './projectileDemo'

export default function ProjectileGalleryStage() {
  useEffect(() => {
    replayProjectileDemo()
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
    </div>
  )
}
