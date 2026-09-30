export interface KeyedStore<T> {
  keys(): Promise<string[]>
  get(key: string): Promise<T | undefined>
  set(key: string, value: T): Promise<void>
  del(key: string): Promise<void>
}

function prune<T>(map: Map<string, T>, cap?: number) {
  if (!cap) return
  const keys = [...map.keys()].sort()
  for (const key of keys.slice(0, Math.max(0, keys.length - cap))) map.delete(key)
}

export function createMemoryKeyedStore<T>(cap?: number): KeyedStore<T> {
  const map = new Map<string, T>()
  return {
    keys: async () => [...map.keys()],
    get: async (key) => map.get(key),
    set: async (key, value) => {
      map.set(key, value)
      prune(map, cap)
    },
    del: async (key) => {
      map.delete(key)
    },
  }
}

export async function createKeyedIdbStore<T>(dbName: string, storeName: string, cap?: number): Promise<KeyedStore<T>> {
  try {
    if (typeof indexedDB === 'undefined') return createMemoryKeyedStore<T>(cap)
    const { createStore, get, set, del, keys } = await import('idb-keyval')
    const store = createStore(dbName, storeName)
    return {
      keys: () => keys<string>(store) as Promise<string[]>,
      get: (key) => get<T>(key, store),
      set: async (key, value) => {
        await set(key, value, store)
        if (cap) {
          const all = (await keys<string>(store) as string[]).sort()
          for (const stale of all.slice(0, Math.max(0, all.length - cap))) await del(stale, store)
        }
      },
      del: (key) => del(key, store),
    }
  } catch {
    return createMemoryKeyedStore<T>(cap)
  }
}
