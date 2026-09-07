import type { LogEntry } from '../state/slices/lobby'

export interface SavedGameLogEntry {
  time: number
  from: string
  text: string
}

export interface SavedGameLog {
  key: string
  savedAt: number
  gameId: string | null
  title: string
  entries: SavedGameLogEntry[]
}

export const MAX_SAVED_GAME_LOGS = 20

export interface GameLogBackend {
  keys(): Promise<string[]>
  get(key: string): Promise<SavedGameLog | undefined>
  set(key: string, log: SavedGameLog): Promise<void>
  del(key: string): Promise<void>
}

export function createMemoryGameLogBackend(): GameLogBackend {
  const map = new Map<string, SavedGameLog>()
  return {
    keys: async () => [...map.keys()],
    get: async (key) => map.get(key),
    set: async (key, log) => {
      map.set(key, log)
    },
    del: async (key) => {
      map.delete(key)
    },
  }
}

async function loadIdbGameLogBackend(): Promise<GameLogBackend> {
  try {
    if (typeof indexedDB === 'undefined') return createMemoryGameLogBackend()
    const { createStore, get, set, del, keys } = await import('idb-keyval')
    const store = createStore('mage-nexus-game-logs', 'logs')
    return {
      keys: () => keys<string>(store) as Promise<string[]>,
      get: (key) => get<SavedGameLog>(key, store),
      set: (key, log) => set(key, log, store),
      del: (key) => del(key, store),
    }
  } catch {
    return createMemoryGameLogBackend()
  }
}

export class GameLogStore {
  private backendPromise: Promise<GameLogBackend> | null = null

  constructor(private readonly backend?: GameLogBackend) {}

  private resolveBackend(): Promise<GameLogBackend> {
    if (this.backend) return Promise.resolve(this.backend)
    if (!this.backendPromise) this.backendPromise = loadIdbGameLogBackend()
    return this.backendPromise
  }

  async save(input: { gameId: string | null; title: string; entries: SavedGameLogEntry[] }): Promise<SavedGameLog> {
    const backend = await this.resolveBackend()
    const savedAt = Date.now()
    const key = `${savedAt}_${(input.gameId ?? 'game').slice(0, 8)}`
    const log: SavedGameLog = { key, savedAt, gameId: input.gameId, title: input.title, entries: input.entries }
    await backend.set(key, log)
    const keys = (await backend.keys()).sort()
    const overflow = keys.length - MAX_SAVED_GAME_LOGS
    for (let i = 0; i < overflow; i++) {
      await backend.del(keys[i])
    }
    return log
  }

  async list(): Promise<SavedGameLog[]> {
    const backend = await this.resolveBackend()
    const keys = (await backend.keys()).sort().reverse()
    const logs: SavedGameLog[] = []
    for (const key of keys) {
      const log = await backend.get(key)
      if (log) logs.push(log)
    }
    return logs
  }

  async getLatest(): Promise<SavedGameLog | undefined> {
    const backend = await this.resolveBackend()
    const keys = (await backend.keys()).sort()
    if (keys.length === 0) return undefined
    return backend.get(keys[keys.length - 1])
  }
}

export const gameLogStore = new GameLogStore()

export function buildGameLogHtml(log: SavedGameLog): string {
  const esc = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const rows = log.entries
    .map((e) => {
      const time = new Date(e.time).toLocaleString()
      return `<div>[${esc(time)}] <b>${esc(e.from)}</b>: ${esc(e.text)}</div>`
    })
    .join('\n')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(log.title)}</title></head><body style="background:#000;color:#ddd;font-family:monospace;font-size:12px;"><h2>${esc(log.title)}</h2>\n${rows}\n</body></html>`
}

export function toSavedEntries(entries: LogEntry[]): SavedGameLogEntry[] {
  return entries.map(({ time, from, text }) => ({ time, from, text }))
}

export function downloadGameLog(log: SavedGameLog): void {
  try {
    if (typeof document === 'undefined' || typeof URL === 'undefined') return
    const blob = new Blob([buildGameLogHtml(log)], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gamelog_${new Date(log.savedAt).toISOString().replace(/[:.]/g, '-')}.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {}
}

export async function downloadLatestGameLog(fallback: {
  title: string
  entries: SavedGameLogEntry[]
}): Promise<boolean> {
  try {
    const latest = await gameLogStore.getLatest()
    if (latest) {
      downloadGameLog(latest)
      return true
    }
  } catch {}
  if (fallback.entries.length === 0) return false
  downloadGameLog({ key: 'current', savedAt: Date.now(), gameId: null, title: fallback.title, entries: fallback.entries })
  return true
}
