import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import AboutModal from './AboutModal'
import { APP_VERSION } from './version'

afterEach(() => cleanup())

function mockReleases() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            url.includes('xmage-nexus')
              ? [{ tag_name: 'v9.9', name: 'Nine', body: '- **fix**', html_url: 'https://github.com/n', published_at: null }]
              : [{ tag_name: 'xmage_9', name: 'Xm', body: 'hello', html_url: 'https://github.com/x', published_at: null }],
          ),
      }),
    ),
  )
}

describe('AboutModal', () => {
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

  it('shows version and repo links on the about tab', () => {
    render(<AboutModal onClose={() => {}} />)
    expect(screen.getByTestId('about-modal')).toBeTruthy()
    expect(screen.getByText(APP_VERSION, { exact: false })).toBeTruthy()
    expect(screen.getByTestId('about-tab-about')).toBeTruthy()
    expect(screen.getByTestId('about-tab-news')).toBeTruthy()
  })

  it('loads both feeds on the news tab and marks them seen', async () => {
    mockReleases()
    render(<AboutModal onClose={() => {}} initialTab="news" />)
    await waitFor(() => expect(screen.getByTestId('about-feed-nexus')).toBeTruthy())
    expect(screen.getByText('Nine')).toBeTruthy()
    expect(screen.getByText('Xm')).toBeTruthy()
    expect(screen.getByText('fix')).toBeTruthy()
    const seen = JSON.parse(mockStorage['mage-web-news-seen'] as string)
    expect(seen).toEqual({ nexus: 'v9.9', xmage: 'xmage_9' })
  })

  it('closes on ✕ and on Escape', () => {
    const onClose = vi.fn()
    render(<AboutModal onClose={onClose} />)
    fireEvent.click(screen.getByTestId('about-close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
