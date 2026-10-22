import { useEffect, useState } from 'react'

const layers: object[] = []

export function isTopLayer(layer: object): boolean {
  return layers[layers.length - 1] === layer
}

export function useLayer(enabled = true): object {
  const [layer] = useState(() => ({}))
  useEffect(() => {
    if (!enabled) return
    layers.push(layer)
    return () => {
      const index = layers.lastIndexOf(layer)
      if (index >= 0) layers.splice(index, 1)
    }
  }, [layer, enabled])
  return layer
}

export function useEscape(onEscape: () => void, enabled = true) {
  const layer = useLayer(enabled)
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopLayer(layer)) onEscape()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [layer, onEscape, enabled])
}
