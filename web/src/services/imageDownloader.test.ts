import { describe, it, expect, beforeEach, vi } from 'vitest'
import { imageDownloader, POPULAR_SETS } from './imageDownloader'

describe('imageDownloader service', () => {
  beforeEach(() => {
    imageDownloader.cancel()
  })

  it('has initial idle state and popular sets catalogue', () => {
    const progress = imageDownloader.getProgress()
    expect(progress.status).toBe('idle')
    expect(progress.total).toBe(0)
    expect(progress.completed).toBe(0)
    expect(POPULAR_SETS.length).toBeGreaterThan(10)
    expect(POPULAR_SETS.some((s) => s.code === 'MH3')).toBe(true)
  })

  it('subscribes and notifies progress updates', () => {
    const fn = vi.fn()
    const unsubscribe = imageDownloader.subscribe(fn)
    expect(fn).toHaveBeenCalled()

    imageDownloader.pause()
    expect(fn).toHaveBeenCalledWith(expect.objectContaining({ status: 'paused' }))

    unsubscribe()
  })

  it('handles pause and resume', () => {
    imageDownloader.pause()
    expect(imageDownloader.getProgress().status).toBe('paused')
    imageDownloader.cancel()
    expect(imageDownloader.getProgress().status).toBe('idle')
  })
})
