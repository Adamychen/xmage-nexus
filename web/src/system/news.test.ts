import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  renderNewsMarkdown,
  loadNewsCache,
  isNewsCacheFresh,
  hasUnseenNews,
  markNewsSeen,
  loadSeenNews,
  getNews,
  refreshNews,
  NEWS_TTL_MS,
  type NewsRelease,
} from './news'

const mk = (repo: 'nexus' | 'xmage', tag: string): NewsRelease => ({
  repo,
  tag,
  name: tag,
  body: 'body',
  url: `https://github.com/x/${tag}`,
  publishedAt: null,
})

describe('renderNewsMarkdown', () => {
  it('escapes HTML then renders bold, code, links and lists', () => {
    const html = renderNewsMarkdown('<script>alert(1)</script>\n**bold** and `code`\n- a\n- b\n[link](https://example.com)')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<a href="https://example.com" target="_blank"')
  })

  it('renders headings without allowing raw HTML injection', () => {
    const html = renderNewsMarkdown('## Title <img src=x>')
    expect(html).toContain('<h3>Title &lt;img src=x&gt;</h3>')
  })
})

describe('news cache and seen markers', () => {
  const mockStorage: Record<string, string> = {}

  beforeEach(() => {
    for (const k of Object.keys(mockStorage)) delete mockStorage[k]
    vi.unstubAllGlobals()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStorage[key] = value
      },
      removeItem: (key: string) => {
        delete mockStorage[key]
      },
    })
  })

  it('fresh cache is served without network', async () => {
    const releases = [mk('nexus', 'v1')]
    mockStorage['mage-web-news-cache'] = JSON.stringify({ fetchedAt: Date.now(), releases })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { releases: out, offline } = await getNews()
    expect(out).toEqual(releases)
    expect(offline).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('stale cache triggers refresh and falls back offline', async () => {
    const releases = [mk('nexus', 'v1')]
    mockStorage['mage-web-news-cache'] = JSON.stringify({
      fetchedAt: Date.now() - NEWS_TTL_MS - 1,
      releases,
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const { releases: out, offline } = await getNews()
    expect(out).toEqual(releases)
    expect(offline).toBe(true)
  })

  it('refreshNews maps the GitHub API and truncates long bodies', async () => {
    const body = 'x'.repeat(5000)
    const json = (repo: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { tag_name: 'v2', name: 'Two', body, html_url: `https://github.com/${repo}/r/v2`, published_at: '2026-09-01' },
          ]),
      })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => json(url.includes('xmage-nexus') ? 'nexus' : 'xmage')),
    )
    const out = await refreshNews()
    expect(out).toHaveLength(2)
    expect(out[0].body).toHaveLength(2000)
    expect(loadNewsCache()?.releases).toHaveLength(2)
  })

  it('tracks unseen releases per repo', () => {
    const releases = [mk('nexus', 'v2'), mk('xmage', 'xmage_1.4.61V1')]
    expect(hasUnseenNews(releases)).toBe(true)
    markNewsSeen(releases)
    expect(loadSeenNews()).toEqual({ nexus: 'v2', xmage: 'xmage_1.4.61V1' })
    expect(hasUnseenNews(releases)).toBe(false)
    expect(hasUnseenNews([mk('nexus', 'v3'), mk('xmage', 'xmage_1.4.61V1')])).toBe(true)
  })

  it('isNewsCacheFresh respects the 24h TTL', () => {
    expect(isNewsCacheFresh(null)).toBe(false)
    expect(isNewsCacheFresh({ fetchedAt: Date.now(), releases: [] })).toBe(true)
    expect(isNewsCacheFresh({ fetchedAt: Date.now() - NEWS_TTL_MS, releases: [] })).toBe(false)
  })
})
