import { cardPrintings, resolvePrintings } from '../net/commands'

/**
 * Consultas a la BD de cartas de XMage del proxy (misma release que el servidor
 * objetivo). Todas son advisory: devuelven null si no hay proxy o su BD no
 * está lista, y el llamador sigue con Scryfall como siempre.
 */

export interface XmagePrinting {
  cardName: string
  setCode: string
  cardNumber: string
}

export type XmageStrategy = 'default' | 'oldest' | 'set'

const key = (name: string) => name.trim().toLowerCase()

/**
 * Impresión que elegirían los importadores de XMage para cada nombre. Mapa por
 * nombre en minúsculas; los nombres que XMage no tiene no aparecen.
 */
export async function xmagePrintingsFor(
  names: string[],
  strategy: XmageStrategy = 'default',
  setCode?: string,
): Promise<Map<string, XmagePrinting> | null> {
  if (names.length === 0) return new Map()
  try {
    const report = await resolvePrintings(names, strategy, setCode)
    if (!report?.ready || !Array.isArray(report.results)) return null
    const out = new Map<string, XmagePrinting>()
    for (const r of report.results) {
      if (!r.found || !r.setCode || !r.cardNumber) continue
      out.set(key(r.name), { cardName: r.cardName ?? r.name, setCode: r.setCode, cardNumber: r.cardNumber })
    }
    return out
  } catch {
    return null
  }
}

/** Impresiones implementadas de una carta ([] = no implementada); null sin proxy. */
export async function xmagePrintingsOf(name: string): Promise<{ setCode: string; cardNumber: string }[] | null> {
  try {
    const report = await cardPrintings([name])
    if (!report?.ready || !Array.isArray(report.results)) return null
    return report.results[0]?.printings ?? []
  } catch {
    return null
  }
}

// La lista de cartas de una release no cambia durante la sesión: se cachea.
const implementedCache = new Map<string, boolean>()

/**
 * ¿Está implementada cada carta en la release de XMage del proxy? Mapa por
 * nombre en minúsculas; null si no hay proxy (no se puede saber).
 */
export async function xmageImplemented(names: string[]): Promise<Map<string, boolean> | null> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  const missing = unique.filter((n) => !implementedCache.has(key(n)))
  if (missing.length > 0) {
    try {
      const report = await cardPrintings(missing, 1)
      if (!report?.ready || !Array.isArray(report.results)) return null
      for (const r of report.results) implementedCache.set(key(r.name), r.printings.length > 0)
    } catch {
      return null
    }
  }
  const out = new Map<string, boolean>()
  for (const n of unique) {
    const v = implementedCache.get(key(n))
    if (v !== undefined) out.set(key(n), v)
  }
  return out
}

/** Solo para tests. */
export function resetXmageCatalogCache() {
  implementedCache.clear()
}
