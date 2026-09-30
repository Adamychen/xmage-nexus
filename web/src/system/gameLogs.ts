import type { LogEntry } from '../state/slices/lobby'
import { getLanguage, toBcp47Locale, type SupportedLanguage } from '../i18n'
import { createKeyedIdbStore, createMemoryKeyedStore, type KeyedStore } from './keyedStore'
import { downloadBlob } from '../utils/download'

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

export type GameLogBackend = KeyedStore<SavedGameLog>

export function createMemoryGameLogBackend(): GameLogBackend {
  return createMemoryKeyedStore<SavedGameLog>(MAX_SAVED_GAME_LOGS)
}

export class GameLogStore {
  private backendPromise: Promise<GameLogBackend> | null = null

  constructor(private readonly backend?: GameLogBackend) {}

  private resolveBackend(): Promise<GameLogBackend> {
    if (this.backend) return Promise.resolve(this.backend)
    if (!this.backendPromise) {
      this.backendPromise = createKeyedIdbStore<SavedGameLog>('mage-nexus-game-logs', 'logs', MAX_SAVED_GAME_LOGS)
    }
    return this.backendPromise
  }

  async save(input: { gameId: string | null; title: string; entries: SavedGameLogEntry[] }): Promise<SavedGameLog> {
    const backend = await this.resolveBackend()
    const savedAt = Date.now()
    const key = `${savedAt}_${(input.gameId ?? 'game').slice(0, 8)}`
    const log: SavedGameLog = { key, savedAt, gameId: input.gameId, title: input.title, entries: input.entries }
    await backend.set(key, log)
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

export function buildGameLogHtml(log: SavedGameLog, lang?: SupportedLanguage): string {
  const esc = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const locale = toBcp47Locale(lang ?? getLanguage())
  const rows = log.entries
    .map((e) => {
      const time = new Date(e.time).toLocaleString(locale)
      return `<div>[${esc(time)}] <b>${esc(e.from)}</b>: ${esc(e.text)}</div>`
    })
    .join('\n')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(log.title)}</title></head><body style="background:#000;color:#ddd;font-family:monospace;font-size:12px;"><h2>${esc(log.title)}</h2>\n${rows}\n</body></html>`
}

export function toSavedEntries(entries: LogEntry[]): SavedGameLogEntry[] {
  return entries.map(({ time, from, text }) => ({ time, from, text }))
}

export function downloadGameLog(log: SavedGameLog): void {
  downloadBlob(
    new Blob([buildGameLogHtml(log)], { type: 'text/html' }),
    `gamelog_${new Date(log.savedAt).toISOString().replace(/[:.]/g, '-')}.html`,
    1000,
  )
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
