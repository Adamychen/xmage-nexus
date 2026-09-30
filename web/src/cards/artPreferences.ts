export interface CardArtPreference {
  setCode: string
  cardNumber: string
}

const STORAGE_KEY = 'mage-web-card-art-v1'
let cache: Record<string, CardArtPreference> | null = null

function load(): Record<string, CardArtPreference> {
  if (cache) return cache
  cache = {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : null
    if (parsed && typeof parsed === 'object') {
      for (const [name, value] of Object.entries(parsed)) {
        const p = value as Partial<CardArtPreference> | null
        if (typeof p?.setCode === 'string' && typeof p?.cardNumber === 'string' && p.setCode && p.cardNumber) {
          cache[name.trim().toLowerCase()] = { setCode: p.setCode, cardNumber: p.cardNumber }
        }
      }
    }
  } catch {
    cache = {}
  }
  return cache
}

function faceKeys(cardName: string): string[] {
  const parts = cardName.split(' // ').map((p) => p.trim().toLowerCase()).filter(Boolean)
  return parts.length > 0 ? [...new Set(parts)] : []
}

export function cardArtPreference(cardName?: string | null): CardArtPreference | null {
  const key = faceKeys(cardName ?? '')[0]
  if (!key) return null
  return load()[key] ?? null
}

export function setCardArtPreference(cardName: string, setCode: string, cardNumber: string): void {
  const map = load()
  for (const key of faceKeys(cardName)) map[key] = { setCode, cardNumber }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {}
}

export function resetCardArtPreferences(): void {
  cache = {}
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}
