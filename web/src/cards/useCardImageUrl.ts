import { useEffect, useState } from 'react'
import type { CardView } from '../net/types'
import { awaitImageUrl, cardKey, peekImageUrl } from './cardImages'
import { customArtName, useCustomCardArt } from './customCardArt'

interface Resolved {
  key: string | null
  url: string | null
}

/**
 * Única vía de los componentes para obtener el arte de una carta. Depende de la
 * clave de arte ya resuelta (`cardKey`), no de campos sueltos de la vista, y solo
 * devuelve una imagen que corresponda a la clave actual: nunca la de la carta
 * anterior mientras carga la nueva. Tablero, pila, previsualizaciones y vuelos
 * comparten así resolución, caché y token/variante elegidos.
 *
 * Prioridad: si el usuario subió su propia imagen para esta carta
 * (`customCardArt`) gana sobre Scryfall; en cuanto el arte está en memoria el
 * override es síncrono y no se pide nada a la red.
 */
export function useCardImageUrl(card: CardView | null | undefined, enabled = true): string | null {
  const customArt = useCustomCardArt(enabled && card ? customArtName(card) : null)
  const key = enabled && card ? cardKey(card) : null
  const [resolved, setResolved] = useState<Resolved>(() => ({ key, url: peekImageUrl(key) }))

  useEffect(() => {
    if (!key || !card) return
    const cached = peekImageUrl(key)
    if (cached) {
      setResolved((prev) => (prev.key === key && prev.url === cached ? prev : { key, url: cached }))
      return
    }
    let cancelled = false
    awaitImageUrl(card).then((url) => {
      if (!cancelled) setResolved({ key, url })
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (customArt) return customArt
  if (!key) return null
  if (resolved.key === key) return resolved.url
  return peekImageUrl(key)
}
