export interface NewsRelease {
  repo: 'nexus' | 'xmage'
  tag: string
  name: string
  body: string
  url: string
  publishedAt: string | null
}

export const NEXUS_REPO = 'Adamychen/xmage-nexus'
export const XMAGE_REPO = 'magefree/mage'
const NEWS_CACHE_KEY = 'mage-web-news-cache'
const NEWS_SEEN_KEY = 'mage-web-news-seen'
export const NEWS_TTL_MS = 24 * 60 * 60 * 1000
const MAX_BODY_CHARS = 2000
const PER_REPO = 5

interface NewsCache {
  fetchedAt: number
  releases: NewsRelease[]
}

function storage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  } catch {}
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {}
  return null
}

export function loadNewsCache(): NewsCache | null {
  try {
    const raw = storage()?.getItem(NEWS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as NewsCache
    if (!parsed || typeof parsed.fetchedAt !== 'number' || !Array.isArray(parsed.releases)) return null
    return parsed
  } catch {
    return null
  }
}

function saveNewsCache(cache: NewsCache): void {
  try {
    storage()?.setItem(NEWS_CACHE_KEY, JSON.stringify(cache))
  } catch {}
}

export function isNewsCacheFresh(cache: NewsCache | null, now = Date.now()): boolean {
  return !!cache && now - cache.fetchedAt < NEWS_TTL_MS
}

interface GithubRelease {
  tag_name?: string
  name?: string | null
  body?: string | null
  html_url?: string
  published_at?: string | null
}

async function fetchRepoReleases(repo: string, repoKey: NewsRelease['repo']): Promise<NewsRelease[]> {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=${PER_REPO}`, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (!res.ok) throw new Error(`GitHub releases ${repo}: ${res.status}`)
  const list = (await res.json()) as GithubRelease[]
  if (!Array.isArray(list)) return []
  return list.map((r) => ({
    repo: repoKey,
    tag: r.tag_name ?? '',
    name: r.name || r.tag_name || '',
    body: (r.body ?? '').slice(0, MAX_BODY_CHARS),
    url: r.html_url ?? `https://github.com/${repo}/releases`,
    publishedAt: r.published_at ?? null,
  }))
}

export async function refreshNews(): Promise<NewsRelease[]> {
  const [nexus, xmage] = await Promise.all([
    fetchRepoReleases(NEXUS_REPO, 'nexus').catch(() => [] as NewsRelease[]),
    fetchRepoReleases(XMAGE_REPO, 'xmage').catch(() => [] as NewsRelease[]),
  ])
  const releases = [...nexus, ...xmage]
  if (releases.length > 0) saveNewsCache({ fetchedAt: Date.now(), releases })
  return releases
}

export async function getNews(): Promise<{ releases: NewsRelease[]; offline: boolean }> {
  const cached = loadNewsCache()
  if (isNewsCacheFresh(cached)) return { releases: cached!.releases, offline: false }
  try {
    const releases = await refreshNews()
    if (releases.length > 0) return { releases, offline: false }
  } catch {}
  return { releases: cached?.releases ?? [], offline: true }
}

export function loadSeenNews(): { nexus: string | null; xmage: string | null } {
  try {
    const raw = storage()?.getItem(NEWS_SEEN_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { nexus?: string; xmage?: string }
      return { nexus: parsed.nexus ?? null, xmage: parsed.xmage ?? null }
    }
  } catch {}
  return { nexus: null, xmage: null }
}

export function markNewsSeen(releases: NewsRelease[]): void {
  try {
    const seen = loadSeenNews()
    for (const r of releases) {
      if (r.tag && (!seen[r.repo] || seen[r.repo] !== r.tag)) {
        const latest = releases.filter((x) => x.repo === r.repo)[0]?.tag ?? r.tag
        seen[r.repo] = latest
      }
    }
    storage()?.setItem(NEWS_SEEN_KEY, JSON.stringify(seen))
  } catch {}
}

export function hasUnseenNews(releases: NewsRelease[]): boolean {
  if (releases.length === 0) return false
  const seen = loadSeenNews()
  return (['nexus', 'xmage'] as const).some((repo) => {
    const latest = releases.find((r) => r.repo === repo)?.tag
    return !!latest && seen[repo] !== latest
  })
}

export function renderNewsMarkdown(src: string): string {
  const escaped = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const inline = (s: string): string =>
    s
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
      .replace(/(?<!["'=])(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
  const lines = escaped.split('\n')
  const html: string[] = []
  let inList = false
  const closeList = () => {
    if (inList) {
      html.push('</ul>')
      inList = false
    }
  }
  for (const line of lines) {
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      closeList()
      const level = Math.min(4, heading[1].length + 1)
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      continue
    }
    const item = line.match(/^\s*[-*]\s+(.*)$/)
    if (item) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${inline(item[1])}</li>`)
      continue
    }
    closeList()
    if (line.trim() === '') continue
    html.push(`<p>${inline(line)}</p>`)
  }
  closeList()
  return html.join('')
}
