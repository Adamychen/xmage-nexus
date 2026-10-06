import { useState, useEffect } from 'react'

/** The vendor-prefixed Fullscreen API of older Safari, Firefox and IE/Edge. */
interface PrefixedDocument extends Document {
  webkitFullscreenElement?: Element | null
  mozFullScreenElement?: Element | null
  msFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
  mozCancelFullScreen?: () => Promise<void> | void
  msExitFullscreen?: () => Promise<void> | void
}

interface PrefixedElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void
  mozRequestFullScreen?: () => Promise<void> | void
  msRequestFullscreen?: () => Promise<void> | void
}

export function isFullscreen(): boolean {
  if (typeof document === 'undefined') return false
  const doc = document as PrefixedDocument
  return !!(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  )
}

export async function toggleFullscreen(): Promise<void> {
  if (typeof document === 'undefined') return
  const doc = document as PrefixedDocument
  try {
    if (!isFullscreen()) {
      const el = doc.documentElement as PrefixedElement
      if (el.requestFullscreen) {
        await el.requestFullscreen()
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen()
      } else if (el.mozRequestFullScreen) {
        await el.mozRequestFullScreen()
      } else if (el.msRequestFullscreen) {
        await el.msRequestFullscreen()
      }
    } else {
      if (doc.exitFullscreen) {
        await doc.exitFullscreen()
      } else if (doc.webkitExitFullscreen) {
        await doc.webkitExitFullscreen()
      } else if (doc.mozCancelFullScreen) {
        await doc.mozCancelFullScreen()
      } else if (doc.msExitFullscreen) {
        await doc.msExitFullscreen()
      }
    }
  } catch (err) {
    console.warn('Error al cambiar pantalla completa:', err)
  }
}

/**
 * Hook para sincronizar el estado reactivo de pantalla completa con los eventos del navegador
 */
export function useFullscreen(): [boolean, () => Promise<void>] {
  const [fullscreenActive, setFullscreenActive] = useState<boolean>(() => isFullscreen())

  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreenActive(isFullscreen())
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    }
  }, [])

  return [fullscreenActive, toggleFullscreen]
}
