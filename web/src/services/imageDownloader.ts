import { getDeckStorage } from '../decks/storage'

export type DownloadSource = 'scryfall_normal' | 'scryfall_large' | 'scryfall_small'
export type DownloadScope =
  | 'STANDARD'
  | 'MODERN'
  | 'COMMANDER'
  | 'MY_DECKS'
  | 'BASIC_LANDS'
  | 'TOKENS'
  | 'ALL'
  | string // specific set code like 'MH3', 'BLB', 'FDN'

export interface DownloadProgress {
  status: 'idle' | 'fetching_list' | 'running' | 'paused' | 'done' | 'error'
  total: number
  completed: number
  failed: number
  currentItem: string
  speedCardsPerSec: number
  bytesDownloaded: number
  errorMsg?: string
}

export interface CacheStats {
  cardCount: number
  symbolCount: number
  estimatedBytes: number
}

const CACHE_NAME_IMAGES = 'xmage-card-images-v1'
const CACHE_NAME_SYMBOLS = 'xmage-symbols-v1'

export const POPULAR_SETS: Array<{ code: string; name: string; releaseYear: number }> = [
  { code: 'FDN', name: 'Foundations (2024)', releaseYear: 2024 },
  { code: 'DSK', name: 'Duskmourn: House of Horror (2024)', releaseYear: 2024 },
  { code: 'BLB', name: 'Bloomburrow (2024)', releaseYear: 2024 },
  { code: 'MH3', name: 'Modern Horizons 3 (2024)', releaseYear: 2024 },
  { code: 'OTJ', name: 'Outlaws of Thunder Junction (2024)', releaseYear: 2024 },
  { code: 'MKM', name: 'Murders at Karlov Manor (2024)', releaseYear: 2024 },
  { code: 'LCI', name: 'The Lost Caverns of Ixalan (2023)', releaseYear: 2023 },
  { code: 'WOE', name: 'Wilds of Eldraine (2023)', releaseYear: 2023 },
  { code: 'MOM', name: 'March of the Machine (2023)', releaseYear: 2023 },
  { code: 'ONE', name: 'Phyrexia: All Will Be One (2023)', releaseYear: 2023 },
  { code: 'BRO', name: 'The Brothers\' War (2022)', releaseYear: 2022 },
  { code: 'DMU', name: 'Dominaria United (2022)', releaseYear: 2022 },
  { code: 'NEO', name: 'Kamigawa: Neon Dynasty (2022)', releaseYear: 2022 },
  { code: 'MID', name: 'Innistrad: Midnight Hunt (2021)', releaseYear: 2021 },
  { code: 'VOW', name: 'Innistrad: Crimson Vow (2021)', releaseYear: 2021 },
  { code: 'MH2', name: 'Modern Horizons 2 (2021)', releaseYear: 2021 },
  { code: 'KHM', name: 'Kaldheim (2021)', releaseYear: 2021 },
  { code: 'ZNR', name: 'Zendikar Rising (2020)', releaseYear: 2020 },
  { code: 'IKO', name: 'Ikoria: Lair of Behemoths (2020)', releaseYear: 2020 },
  { code: 'THB', name: 'Theros Beyond Death (2020)', releaseYear: 2020 },
  { code: 'ELD', name: 'Throne of Eldraine (2019)', releaseYear: 2019 },
  { code: 'WAR', name: 'War of the Spark (2019)', releaseYear: 2019 },
  { code: 'MH1', name: 'Modern Horizons (2019)', releaseYear: 2019 },
  { code: 'RNA', name: 'Ravnica Allegiance (2019)', releaseYear: 2019 },
  { code: 'GRN', name: 'Guilds of Ravnica (2018)', releaseYear: 2018 },
]

export interface CardToDownload {
  name: string
  setCode: string
  cardNumber: string
  imageUrl: string
}

class ImageDownloadManager {
  private progress: DownloadProgress = {
    status: 'idle',
    total: 0,
    completed: 0,
    failed: 0,
    currentItem: '',
    speedCardsPerSec: 0,
    bytesDownloaded: 0,
  }

  private queue: CardToDownload[] = []
  private abortController: AbortController | null = null
  private listeners: Array<(p: DownloadProgress) => void> = []
  private isPaused = false

  public getProgress(): DownloadProgress {
    return { ...this.progress }
  }

  public subscribe(cb: (p: DownloadProgress) => void): () => void {
    this.listeners.push(cb)
    cb(this.getProgress())
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb)
    }
  }

  private notify() {
    const copy = this.getProgress()
    for (const l of this.listeners) l(copy)
  }

  public async getCacheStats(): Promise<CacheStats> {
    if (typeof caches === 'undefined') {
      return { cardCount: 0, symbolCount: 0, estimatedBytes: 0 }
    }
    try {
      let cardCount = 0
      let symbolCount = 0

      const imgCache = await caches.open(CACHE_NAME_IMAGES).catch(() => null)
      if (imgCache) {
        const keys = await imgCache.keys()
        cardCount = keys.length
      }

      const symCache = await caches.open(CACHE_NAME_SYMBOLS).catch(() => null)
      if (symCache) {
        const keys = await symCache.keys()
        symbolCount = keys.length
      }

      // Average normal image ~140KB, symbol ~4KB
      const estimatedBytes = cardCount * 140000 + symbolCount * 4000
      return { cardCount, symbolCount, estimatedBytes }
    } catch {
      return { cardCount: 0, symbolCount: 0, estimatedBytes: 0 }
    }
  }

  public async clearCache(): Promise<void> {
    if (typeof caches !== 'undefined') {
      await caches.delete(CACHE_NAME_IMAGES).catch(() => {})
      await caches.delete(CACHE_NAME_SYMBOLS).catch(() => {})
    }
    this.progress.bytesDownloaded = 0
    this.notify()
  }

  public async downloadSymbols(onStep?: (done: number, total: number) => void): Promise<{ success: boolean; count: number }> {
    if (typeof caches === 'undefined') return { success: false, count: 0 }
    try {
      const res = await fetch('https://api.scryfall.com/symbology', {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return { success: false, count: 0 }
      const json = (await res.json()) as { data?: Array<{ symbol: string; svg_uri?: string }> }
      const data = json.data ?? []

      const cache = await caches.open(CACHE_NAME_SYMBOLS)
      let done = 0

      for (const item of data) {
        if (!item.svg_uri) continue
        try {
          const match = await cache.match(item.svg_uri)
          if (!match) {
            const svgRes = await fetch(item.svg_uri)
            if (svgRes.ok) {
              await cache.put(item.svg_uri, svgRes)
            }
          }
        } catch {
          // ignore single symbol fail
        }
        done++
        if (onStep) onStep(done, data.length)
      }

      return { success: true, count: done }
    } catch {
      return { success: false, count: 0 }
    }
  }

  public pause() {
    this.isPaused = true
    this.progress.status = 'paused'
    this.notify()
  }

  public resume(concurrency = 5) {
    if (this.progress.status === 'paused') {
      this.isPaused = false
      this.progress.status = 'running'
      this.notify()
      void this.runQueue(concurrency)
    }
  }

  public cancel() {
    this.isPaused = false
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.queue = []
    this.progress.status = 'idle'
    this.progress.currentItem = ''
    this.notify()
  }

  public async startDownload(
    scope: DownloadScope,
    source: DownloadSource = 'scryfall_normal',
    concurrency = 5,
    onlyMissing = true
  ): Promise<void> {
    this.cancel()
    this.abortController = new AbortController()
    this.progress = {
      status: 'fetching_list',
      total: 0,
      completed: 0,
      failed: 0,
      currentItem: 'Consultando lista de cartas...',
      speedCardsPerSec: 0,
      bytesDownloaded: 0,
    }
    this.notify()

    try {
      const cards = await this.fetchCardListForScope(scope, source)
      if (cards.length === 0) {
        this.progress.status = 'done'
        this.progress.currentItem = 'No se encontraron cartas para este filtro.'
        this.notify()
        return
      }

      let toDownload = cards
      if (onlyMissing && typeof caches !== 'undefined') {
        this.progress.currentItem = 'Verificando cartas ya descargadas...'
        this.notify()
        const cache = await caches.open(CACHE_NAME_IMAGES)
        const missing: CardToDownload[] = []
        for (const c of cards) {
          const match = await cache.match(c.imageUrl)
          if (!match) {
            missing.push(c)
          }
        }
        toDownload = missing
      }

      this.queue = toDownload
      this.progress.total = toDownload.length
      this.progress.completed = cards.length - toDownload.length
      this.progress.status = 'running'
      this.notify()

      if (toDownload.length === 0) {
        this.progress.status = 'done'
        this.progress.currentItem = '¡Todas las cartas ya están en la caché local!'
        this.notify()
        return
      }

      await this.runQueue(concurrency)
    } catch (err: any) {
      this.progress.status = 'error'
      this.progress.errorMsg = err.message || 'Error al iniciar la descarga'
      this.notify()
    }
  }

  private async runQueue(concurrency: number) {
    if (typeof caches === 'undefined') return
    const cache = await caches.open(CACHE_NAME_IMAGES)
    const activeWorkers = Math.max(1, Math.min(10, concurrency))
    const startTime = Date.now()
    let downloadedSinceStart = 0

    const worker = async () => {
      while (this.queue.length > 0 && !this.isPaused && !this.abortController?.signal.aborted) {
        const item = this.queue.shift()
        if (!item) break

        this.progress.currentItem = `[${item.setCode.toUpperCase()}] ${item.name} (#${item.cardNumber})`
        this.notify()

        try {
          const res = await fetch(item.imageUrl, {
            signal: this.abortController?.signal,
          })

          if (res.ok) {
            await cache.put(item.imageUrl, res.clone())
            this.progress.completed++
            downloadedSinceStart++
            const elapsedSec = Math.max(1, (Date.now() - startTime) / 1000)
            this.progress.speedCardsPerSec = Number((downloadedSinceStart / elapsedSec).toFixed(1))
          } else {
            this.progress.failed++
          }
        } catch (err: any) {
          if (this.abortController?.signal.aborted) return
          this.progress.failed++
        }

        this.notify()
        // Rate limit courtesy delay ~60ms
        await new Promise((r) => setTimeout(r, 60))
      }
    }

    const workers = Array.from({ length: activeWorkers }, () => worker())
    await Promise.all(workers)

    if (this.queue.length === 0 && !this.isPaused && !this.abortController?.signal.aborted) {
      this.progress.status = 'done'
      this.progress.currentItem = '✓ ¡Descarga completada con éxito!'
      this.notify()
    }
  }

  private async fetchCardListForScope(scope: DownloadScope, source: DownloadSource): Promise<CardToDownload[]> {
    const sizeParam = source === 'scryfall_large' ? 'large' : source === 'scryfall_small' ? 'small' : 'normal'

    // Scope 0: ALL (All images from selected source via Scryfall Bulk Data)
    if (scope === 'ALL') {
      try {
        const bulkMetaRes = await fetch('https://api.scryfall.com/bulk-data/default-cards', {
          headers: { Accept: 'application/json' },
          signal: this.abortController?.signal,
        })
        if (bulkMetaRes.ok) {
          const meta = (await bulkMetaRes.json()) as { download_uri?: string }
          if (meta.download_uri) {
            this.progress.currentItem = 'Descargando catálogo completo de cartas de MTG...'
            this.notify()
            const bulkDataRes = await fetch(meta.download_uri, { signal: this.abortController?.signal })
            if (bulkDataRes.ok) {
              const allCards = (await bulkDataRes.json()) as Array<{
                name: string
                set: string
                collector_number: string
                image_uris?: { normal?: string; large?: string; small?: string }
                card_faces?: Array<{ image_uris?: { normal?: string; large?: string; small?: string } }>
              }>

              const list: CardToDownload[] = []
              for (const c of allCards) {
                const url =
                  (sizeParam === 'large' ? c.image_uris?.large : sizeParam === 'small' ? c.image_uris?.small : c.image_uris?.normal) ??
                  c.card_faces?.[0]?.image_uris?.normal ??
                  `https://api.scryfall.com/cards/${c.set}/${c.collector_number}?format=image&version=${sizeParam}`

                list.push({
                  name: c.name,
                  setCode: c.set,
                  cardNumber: c.collector_number,
                  imageUrl: url,
                })
              }
              return list
            }
          }
        }
      } catch {
        // fallback to query
      }
      return this.fetchScryfallSearchList('game:paper', sizeParam, 40000)
    }

    // Scope 1: MY_DECKS
    if (scope === 'MY_DECKS') {
      const storage = getDeckStorage()
      const decks = await storage.list()
      const seen = new Set<string>()
      const list: CardToDownload[] = []

      for (const d of decks) {
        for (const c of [...d.cards, ...d.sideboard]) {
          const key = `${c.setCode.toLowerCase()}/${c.cardNumber}`
          if (!seen.has(key) && c.setCode && c.cardNumber) {
            seen.add(key)
            list.push({
              name: c.cardName,
              setCode: c.setCode,
              cardNumber: c.cardNumber,
              imageUrl: `https://api.scryfall.com/cards/${c.setCode.toLowerCase()}/${c.cardNumber}?format=image&version=${sizeParam}`,
            })
          }
        }
      }
      return list
    }

    // Scope 2: BASIC_LANDS
    if (scope === 'BASIC_LANDS') {
      const query = 't:basic game:paper'
      return this.fetchScryfallSearchList(query, sizeParam, 400)
    }

    // Scope 3: TOKENS
    if (scope === 'TOKENS') {
      const query = 't:token game:paper'
      return this.fetchScryfallSearchList(query, sizeParam, 600)
    }

    // Scope 4: STANDARD
    if (scope === 'STANDARD') {
      const query = 'f:standard game:paper'
      return this.fetchScryfallSearchList(query, sizeParam, 3000)
    }

    // Scope 5: MODERN
    if (scope === 'MODERN') {
      const query = 'f:modern game:paper'
      return this.fetchScryfallSearchList(query, sizeParam, 5000)
    }

    // Scope 6: COMMANDER
    if (scope === 'COMMANDER') {
      const query = 'f:commander game:paper (is:commander or order:edhrec)'
      return this.fetchScryfallSearchList(query, sizeParam, 2000)
    }

    // Scope 7: Specific Set Code (e.g. MH3, BLB, DSK)
    const setCode = scope.toLowerCase()
    const query = `s:${setCode} game:paper`
    return this.fetchScryfallSearchList(query, sizeParam, 1000)
  }

  private async fetchScryfallSearchList(query: string, sizeParam: string, maxCards = 3000): Promise<CardToDownload[]> {
    const list: CardToDownload[] = []
    let nextUrl: string | null = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&order=set`

    while (nextUrl && list.length < maxCards && !this.abortController?.signal.aborted) {
      const res = await fetch(nextUrl, {
        headers: { Accept: 'application/json' },
        signal: this.abortController?.signal,
      })

      if (!res.ok) break
      const data = (await res.json()) as {
        has_more?: boolean
        next_page?: string
        data?: Array<{
          name: string
          set: string
          collector_number: string
          image_uris?: { normal?: string; large?: string; small?: string }
          card_faces?: Array<{ image_uris?: { normal?: string; large?: string; small?: string } }>
        }>
      }

      for (const c of data.data ?? []) {
        const url =
          (sizeParam === 'large' ? c.image_uris?.large : sizeParam === 'small' ? c.image_uris?.small : c.image_uris?.normal) ??
          c.card_faces?.[0]?.image_uris?.normal ??
          `https://api.scryfall.com/cards/${c.set}/${c.collector_number}?format=image&version=${sizeParam}`

        list.push({
          name: c.name,
          setCode: c.set,
          cardNumber: c.collector_number,
          imageUrl: url,
        })
      }

      nextUrl = data.has_more && data.next_page ? data.next_page : null
      await new Promise((r) => setTimeout(r, 60))
    }

    return list
  }
}

export const imageDownloader = new ImageDownloadManager()
