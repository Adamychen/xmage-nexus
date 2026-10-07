import { useEffect, useRef, useState } from 'react'
import type { DeckV2 } from './types'
import { commanderEligibility } from '../net/commands'
import { isCommanderEligible } from './deckUtils'

/**
 * Elegibilidad de comandante según las clases reales de XMage (acción
 * `commanderEligibility` del proxy). Fuente de verdad frente a la heurística
 * local `isCommanderEligible` (texto de oráculo de Scryfall): resuelve casos
 * como Grist, the Hunger Tide, que xmage marca elegible aunque su línea de
 * tipo sea Planeswalker (CR 903.5a).
 *
 * Advisory: si el proxy no está disponible (sin conexión o BD de cartas sin
 * construir) el mapa queda vacío y los consumidores caen a la heurística local.
 */

/** La elegibilidad es de la carta (su clase en xmage), no de la impresión. */
export function commanderEligibilityKey(cardName: string): string {
  return cardName.trim().toLowerCase()
}

// Cache a nivel de módulo: la elegibilidad es estable entre mazos y recargas.
const cached = new Map<string, boolean>()
const known = new Set<string>()
const inFlight = new Set<string>()

export function useCommanderEligibility(deck: DeckV2 | null, enabled: boolean) {
  const [map, setMap] = useState<Map<string, boolean>>(() => new Map(cached))
  const inFlightRef = useRef(inFlight)

  useEffect(() => {
    if (!deck || !enabled) return
    const pending = new Set<string>()
    for (const c of [...deck.cards, ...deck.sideboard]) {
      const k = commanderEligibilityKey(c.cardName)
      if (!k || known.has(k) || inFlightRef.current.has(k)) continue
      pending.add(k)
    }
    if (pending.size === 0) return
    const names = [...pending]
    for (const k of names) {
      known.add(k)
      inFlightRef.current.add(k)
    }
    commanderEligibility(names)
      .then((res) => {
        // Sin proxy o sin BD de cartas: liberar las claves para reintentar
        // cuando vuelva la conexión (patrón advisory de fetchDeckIssues).
        if (!res || !res.ready) {
          for (const k of names) {
            known.delete(k)
            inFlightRef.current.delete(k)
          }
          return
        }
        for (const r of res.results) {
          const k = commanderEligibilityKey(r.name)
          inFlightRef.current.delete(k)
          cached.set(k, r.eligible)
        }
        setMap(new Map(cached))
      })
      .catch(() => {
        for (const k of names) {
          known.delete(k)
          inFlightRef.current.delete(k)
        }
      })
  }, [deck, enabled])

  return map
}

/** Elegibilidad de una carta: proxy primero, heurística local como fallback. */
export function commanderEligibleFor(
  eligibilityMap: Map<string, boolean> | null | undefined,
  cardName: string,
  meta: { oracleText?: string; typeLine?: string } | undefined | null,
): boolean | undefined {
  const fromProxy = eligibilityMap?.get(commanderEligibilityKey(cardName))
  if (fromProxy !== undefined) return fromProxy
  // Igual que los consumidores originales: sin meta no se puede validar.
  if (!meta) return undefined
  return isCommanderEligible(meta)
}