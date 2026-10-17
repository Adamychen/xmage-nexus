import { useEffect } from 'react'
import { musicEngine } from './musicEngine'

export function useLobbyMusic(active: boolean, enabled: boolean): void {
  useEffect(() => {
    if (!active || !enabled) return
    musicEngine.start('lobby')
    return () => musicEngine.stop('lobby')
  }, [active, enabled])
}
