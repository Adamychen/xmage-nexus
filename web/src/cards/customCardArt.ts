import { useEffect, useSyncExternalStore } from 'react'
import { createStore, del, entries, get, set, type UseStore } from 'idb-keyval'
import type { CardView } from '../net/types'
import { getSourceCardName, isAbilityCard } from './cardImages'
import { CUSTOM_IMAGE_MAX_FILE_BYTES, fileToImageDataUrl, type ImageFit } from '../appearance/customImage'

/**
 * Arte personalizado por carta: el usuario sube su propia imagen y el cliente
 * la usa en partida en lugar del arte de Scryfall. Es una preferencia 100 %
 * local (como las impresiones de `artPreferences.ts`): no viaja por el
 * protocolo, así que el rival ve el arte normal.
 *
 * Las imágenes son dataURL JPEG ya recortados al ratio de carta (63×88), y se
 * guardan en IndexedDB porque un mazo entero personalizado no cabe con
 * holgura en `localStorage`. Clave: nombre de carta normalizado, replicado en
 * cada cara de las DFC (mismo criterio que `artPreferences.ts`) para que el
 * override aplique tenga la cara que tenga en mesa.
 */

/** Ratio de carta MTG escalado a calidad de inspección. */
export const CUSTOM_CARD_ART_FIT: ImageFit = { mode: 'cover', width: 488, height: 680 }
const QUALITY = 0.82

const store: UseStore = createStore('xmage-custom-card-art', 'art')

const memory = new Map<string, string | null>()
const inflight = new Map<string, Promise<string | null>>()
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Mismo criterio de caras que `artPreferences.ts`: "A // B" → ["a", "b"]. */
function faceKeys(cardName: string): string[] {
  const parts = cardName.split(' // ').map((p) => p.trim().toLowerCase()).filter(Boolean)
  return parts.length > 0 ? [...new Set(parts)] : []
}

/**
 * Nombre canónico bajo el que se guarda el arte de una carta en partida. Usa
 * `card.name` (no `displayName`) para coincidir con `cardKey` y con el nombre
 * que el editor de mazos pasa al modal. Null para cartas boca abajo (no se
 * filtra información) y habilidades sin carta origen.
 */
export function customArtName(card: CardView): string | null {
  if (!card || card.faceDown === true) return null
  const raw = isAbilityCard(card) ? getSourceCardName(card) : (card.name || card.displayName || card.alternateName || '')
  const name = raw && !/^ability$/i.test(raw) && !/^habilidad$/i.test(raw) ? raw.trim() : ''
  return name || null
}

/** Arte personalizado ya cargado en memoria (sincrono, sin red ni IDB). */
export function peekCustomCardArt(cardName: string | null | undefined): string | null {
  if (!cardName) return null
  const key = faceKeys(cardName)[0]
  if (!key) return null
  return memory.get(key) ?? null
}

/** Carga el arte de IDB a memoria una sola vez por nombre. */
export function ensureCustomCardArt(cardName: string): Promise<string | null> {
  const key = faceKeys(cardName)[0]
  if (!key) return Promise.resolve(null)
  const cached = memory.get(key)
  if (cached !== undefined) return Promise.resolve(cached)
  const current = inflight.get(key)
  if (current) return current

  const p = (async () => {
    let value: string | null = null
    try {
      const stored = await get<StoredCustomArt | string>(key, store)
      if (isStoredCustomArt(stored)) {
        value = stored.dataUrl
        if (stored.name) displayNames.set(key, stored.name)
      } else if (typeof stored === 'string' && stored.startsWith('data:image/')) {
        value = stored
      }
    } catch {
      value = null
    } finally {
      inflight.delete(key)
    }
    memory.set(key, value)
    emit()
    return value
  })()
  inflight.set(key, p)
  return p
}

/** Nombre en formato display por clave normalizada (p. ej. "lightning bolt" →
 *  "Lightning Bolt"): el store clavea normalizado pero el gestor muestra el
 *  nombre tal cual lo escribió el usuario/Scryfall. */
const displayNames = new Map<string, string>()

/** Valor persistido en IDB: dataURL + nombre original para mostrarlo bien en el
 *  gestor de Ajustes. (Los valores string planos de versiones anteriores se
 *  aceptan y se muestran con la clave normalizada.) */
interface StoredCustomArt {
  name?: string
  dataUrl: string
}

function isStoredCustomArt(value: unknown): value is StoredCustomArt {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as StoredCustomArt).dataUrl === 'string' &&
    (value as StoredCustomArt).dataUrl.startsWith('data:image/')
  )
}

/** Escribe (o borra con null) el arte de una carta y notifica a los suscriptores. */
export function setCustomCardArtDataUrl(cardName: string, dataUrl: string | null): void {
  if (dataUrl !== null && !dataUrl.startsWith('data:image/')) throw new Error('invalid image')
  const displayName = cardName.trim()
  const keys = faceKeys(cardName)
  for (const key of keys) memory.set(key, dataUrl)
  if (dataUrl === null) displayNames.delete(keys[0] ?? '')
  else if (keys[0]) displayNames.set(keys[0], displayName)
  emit()
  void (async () => {
    try {
      if (dataUrl === null) {
        for (const key of keys) await del(key, store)
      } else {
        for (const key of keys) await set(key, { name: displayName, dataUrl } satisfies StoredCustomArt, store)
      }
    } catch {
      // Sin persistencia (p. ej. almacenamiento lleno) la imagen vive solo en memoria.
    }
    emit()
  })()
}

/** Valida, recorta al ratio de carta y guarda la imagen de un archivo. */
export async function setCustomCardArtFromFile(cardName: string, file: File): Promise<void> {
  if (!file.type.startsWith('image/')) throw new Error('not an image')
  if (file.size > CUSTOM_IMAGE_MAX_FILE_BYTES) throw new Error('file too large')
  const dataUrl = await fileToImageDataUrl(file, CUSTOM_CARD_ART_FIT, QUALITY)
  setCustomCardArtDataUrl(cardName, dataUrl)
}

/**
 * Valor reactivo del arte personalizado de una carta. Sincrono cuando ya está
 * en memoria (siempre, tras la primera carga de ese nombre); la primera vez
 * resuelve desde IDB y re-renderiza al terminar.
 */
export function useCustomCardArt(cardName: string | null | undefined): string | null {
  const value = useSyncExternalStore(
    subscribe,
    () => peekCustomCardArt(cardName),
    () => null,
  )
  useEffect(() => {
    if (cardName) void ensureCustomCardArt(cardName)
  }, [cardName])
  return value
}

/** Entrada del listado de artes propios (para el gestor de Ajustes). */
export interface CustomCardArtEntry {
  name: string
  dataUrl: string
}

/** Todas las imágenes propias guardadas, ordenadas por nombre. La memoria se
 *  superpone a IDB: una escritura/borrado reciente aún no persistido se ve igual
 *  (memory es la verdad desde el momento del set, IDB llega después). */
export async function listCustomCardArt(): Promise<CustomCardArtEntry[]> {
  let stored: [string, StoredCustomArt | string][] = []
  try {
    stored = await entries<string, StoredCustomArt | string>(store)
  } catch {
    stored = []
  }
  const merged = new Map<string, string>()
  const names = new Map<string, string>()
  for (const [key, value] of stored) {
    if (isStoredCustomArt(value)) {
      merged.set(key, value.dataUrl)
      if (value.name) names.set(key, value.name)
    } else if (typeof value === 'string' && value.startsWith('data:image/')) {
      merged.set(key, value)
    }
  }
  for (const [key, value] of memory) {
    if (value === null) {
      merged.delete(key)
      names.delete(key)
    } else {
      merged.set(key, value)
      const display = displayNames.get(key)
      if (display) names.set(key, display)
    }
  }
  return [...merged]
    .map(([key, dataUrl]) => ({ name: names.get(key) ?? key, dataUrl }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Suscripción a cambios del store (para el gestor, sin carta concreta). */
export function onCustomCardArtChange(listener: () => void): () => void {
  return subscribe(listener)
}

/** Aislamiento entre tests: vacía memoria e IDB simulado. */
export function resetCustomCardArtCache(): void {
  memory.clear()
  displayNames.clear()
  inflight.clear()
  emit()
}