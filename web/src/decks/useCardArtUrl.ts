import { useEffect, useState } from 'react'
import { cardArtPreference } from '../cards/artPreferences'
import { useCustomCardArt } from '../cards/customCardArt'
import { fetchCardJson, hasPrinting, type CardRef, type ScryfallCardJson } from '../cards/scryfallCards'

export function artUrlFromCardJson(data: ScryfallCardJson | null): string | null {
  if (!data) return null
  return data.image_uris?.art_crop
    ?? data.card_faces?.[0]?.image_uris?.art_crop
    ?? data.image_uris?.normal
    ?? data.card_faces?.[0]?.image_uris?.normal
    ?? null
}

/**
 * URL de arte (CDN cards.scryfall.io) de una carta, resuelta con la cola global
 * de Scryfall y su caché persistente. Sustituye a usar como `<img src>` los
 * endpoints `api.scryfall.com/cards/...?format=image`, que cuentan contra el
 * límite de la API.
 */
export function useCardArtUrl(card: CardRef | null | undefined): string | null {
  // Arte propio del usuario primero (misma prioridad que en partida).
  const customArt = useCustomCardArt(card?.cardName ?? null)
  const [url, setUrl] = useState<string | null>(null)
  const preferred = card ? cardArtPreference(card.cardName) : null
  const ref = card && preferred ? { ...card, setCode: preferred.setCode, cardNumber: preferred.cardNumber } : card
  const key = ref ? `${ref.cardName}|${ref.setCode ?? ''}|${ref.cardNumber ?? ''}` : ''
  useEffect(() => {
    if (!ref || (!ref.cardName && !hasPrinting(ref))) {
      setUrl(null)
      return
    }
    let cancelled = false
    void fetchCardJson(ref, { fallbackToName: true }).then((data) => {
      if (!cancelled) setUrl(artUrlFromCardJson(data))
    })
    return () => {
      cancelled = true
    }
  }, [key])
  if (customArt) return customArt
  return url
}
