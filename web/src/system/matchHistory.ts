export type MatchResult = 'win' | 'loss'

export interface MatchRecord {
  id: string
  endedAt: number
  gameId: string | null
  deckName: string | null
  format: string | null
  opponents: string[]
  result: MatchResult
  turns: number | null
  life: number | null
}

export const MAX_MATCH_RECORDS = 500

export interface MatchHistoryBackend {
  keys(): Promise<string[]>
  get(key: string): Promise<MatchRecord | undefined>
  set(key: string, record: MatchRecord): Promise<void>
  del(key: string): Promise<void>
}

export function createMemoryMatchHistoryBackend(): MatchHistoryBackend {
  const map = new Map<string, MatchRecord>()
  return {
    keys: async () => [...map.keys()],
    get: async (key) => map.get(key),
    set: async (key, record) => {
      map.set(key, record)
    },
    del: async (key) => {
      map.delete(key)
    },
  }
}

async function loadIdbBackend(): Promise<MatchHistoryBackend> {
  try {
    if (typeof indexedDB === 'undefined') return createMemoryMatchHistoryBackend()
    const { createStore, get, set, del, keys } = await import('idb-keyval')
    const store = createStore('mage-nexus-match-history', 'matches')
    return {
      keys: () => keys<string>(store) as Promise<string[]>,
      get: (key) => get<MatchRecord>(key, store),
      set: (key, record) => set(key, record, store),
      del: (key) => del(key, store),
    }
  } catch {
    return createMemoryMatchHistoryBackend()
  }
}

export class MatchHistoryStore {
  private backendPromise: Promise<MatchHistoryBackend> | null = null

  constructor(private readonly backend?: MatchHistoryBackend) {}

  private getBackend(): Promise<MatchHistoryBackend> {
    if (this.backend) return Promise.resolve(this.backend)
    this.backendPromise ??= loadIdbBackend()
    return this.backendPromise
  }

  async list(): Promise<MatchRecord[]> {
    const backend = await this.getBackend()
    const records = await Promise.all((await backend.keys()).map((key) => backend.get(key)))
    return records.filter((r): r is MatchRecord => !!r).sort((a, b) => b.endedAt - a.endedAt)
  }

  async add(input: Omit<MatchRecord, 'id'>): Promise<MatchRecord | null> {
    const backend = await this.getBackend()
    const keys = await backend.keys()
    const gameKey = input.gameId ? input.gameId.slice(0, 8) : null
    if (gameKey && keys.some((k) => k.endsWith(`_${gameKey}`))) return null
    const record: MatchRecord = { ...input, id: `${input.endedAt}_${gameKey ?? 'nogame'}` }
    await backend.set(record.id, record)
    const all = [...keys, record.id].sort()
    for (const stale of all.slice(0, Math.max(0, all.length - MAX_MATCH_RECORDS))) await backend.del(stale)
    return record
  }

  async clear(): Promise<void> {
    const backend = await this.getBackend()
    for (const key of await backend.keys()) await backend.del(key)
  }
}

export const matchHistoryStore = new MatchHistoryStore()

export interface Tally {
  games: number
  wins: number
  losses: number
  winRate: number
}

export interface StatsRow extends Tally {
  key: string
}

export interface MatchStats {
  overall: Tally
  byDeck: StatsRow[]
  byFormat: StatsRow[]
  byOpponent: StatsRow[]
}

const emptyTally = (): Tally => ({ games: 0, wins: 0, losses: 0, winRate: 0 })

function add(tally: Tally, result: MatchResult) {
  tally.games++
  if (result === 'win') tally.wins++
  else tally.losses++
  tally.winRate = tally.wins / tally.games
}

function rowsOf(records: MatchRecord[], keysOf: (r: MatchRecord) => string[]): StatsRow[] {
  const map = new Map<string, Tally>()
  for (const record of records) {
    for (const key of keysOf(record)) {
      const tally = map.get(key) ?? emptyTally()
      add(tally, record.result)
      map.set(key, tally)
    }
  }
  return [...map.entries()]
    .map(([key, tally]) => ({ key, ...tally }))
    .sort((a, b) => b.games - a.games || a.key.localeCompare(b.key))
}

export function computeStats(records: MatchRecord[]): MatchStats {
  const overall = emptyTally()
  for (const record of records) add(overall, record.result)
  return {
    overall,
    byDeck: rowsOf(records, (r) => (r.deckName ? [r.deckName] : [])),
    byFormat: rowsOf(records, (r) => (r.format ? [r.format] : [])),
    byOpponent: rowsOf(records, (r) => r.opponents),
  }
}
