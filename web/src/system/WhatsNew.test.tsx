import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import WhatsNewButton from './WhatsNew'
import { loadSeenNews } from './news'

const NEXUS = [
  { tag_name: 'v9.9', name: 'v9.9', body: '<details><summary>What changed in v9.9</summary>\n\n**Board**\n- One board fills the main area.\n\n</details>', html_url: 'https://github.com/n', published_at: '2026-10-29T09:00:00Z' },
  { tag_name: 'v9.8', name: 'v9.8', body: '- Older note', html_url: 'https://github.com/n8', published_at: '2026-10-20T09:00:00Z' },
]
const XMAGE = [{ tag_name: 'xmage_9', name: 'Xm', body: 'hello', html_url: 'https://github.com/x', published_at: null }]

describe('WhatsNewButton', () => {
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve({ ok: true, json: () => Promise.resolve(url.includes('xmage-nexus') ? NEXUS : XMAGE) }),
      ),
    )
  })

  afterEach(() => cleanup())

  it('LBY-26: shows the unseen marker only while there are unseen releases', () => {
    const { rerender } = render(<WhatsNewButton unseen onSeen={() => {}} />)
    expect(screen.getByTestId('whats-new-dot')).toBeTruthy()
    rerender(<WhatsNewButton unseen={false} onSeen={() => {}} />)
    expect(screen.queryByTestId('whats-new-dot')).toBeNull()
  })

  it('LBY-26: opens the latest release expanded, the older ones folded, and marks them seen', async () => {
    const onSeen = vi.fn()
    render(<WhatsNewButton unseen onSeen={onSeen} />)
    fireEvent.click(screen.getByTestId('whats-new-button'))
    await waitFor(() => expect(screen.getByTestId('whats-new-latest').textContent).toContain('One board fills the main area.'))
    expect(screen.getByTestId('whats-new-latest').querySelector('h4.news-group')?.textContent).toBe('Board')
    expect((screen.getByTestId('whats-new-previous') as HTMLDetailsElement).open).toBe(false)
    expect(screen.getAllByTestId('whats-new-older-release').map((d) => d.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('v9.8')]))
    expect(onSeen).toHaveBeenCalled()
    expect(loadSeenNews()).toEqual({ nexus: 'v9.9', xmage: 'xmage_9' })
  })

  it('LBY-26: Escape and a click outside close the panel', async () => {
    render(<div><span data-testid="outside">x</span><WhatsNewButton unseen={false} onSeen={() => {}} /></div>)
    fireEvent.click(screen.getByTestId('whats-new-button'))
    expect(screen.getByTestId('whats-new-panel')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByTestId('whats-new-panel')).toBeNull())
    fireEvent.click(screen.getByTestId('whats-new-button'))
    fireEvent.pointerDown(screen.getByTestId('outside'))
    await waitFor(() => expect(screen.queryByTestId('whats-new-panel')).toBeNull())
  })
})
