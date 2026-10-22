import { describe, expect, it } from 'vitest'
import type { Page } from '@playwright/test'
import { captureFrame, parsedLen, waitFrameAt } from '../e2e/support/frames'

function pageWith(frames: Array<Record<string, unknown> | null>): Page {
  return { __frames: frames } as unknown as Page
}

describe('frame cursors survive buffer trimming', () => {
  it('finds a mana ask after a cursor taken before the buffer was trimmed', async () => {
    const frames: Array<Record<string, unknown> | null> = []
    const page = pageWith(frames)
    for (let i = 0; i < 640; i++) captureFrame(frames, { method: 'GAME_UPDATE' }, 500)
    const cursor = parsedLen(page)
    for (let i = 640; i < 700; i++) captureFrame(frames, { method: i === 650 ? 'GAME_PLAY_MANA' : 'GAME_UPDATE' }, 500)
    expect(frames).toHaveLength(500)

    const found = await waitFrameAt(page, (f) => f.method === 'GAME_PLAY_MANA', 'GAME_PLAY_MANA', 1_000, cursor)
    expect(found.frame.method).toBe('GAME_PLAY_MANA')
    expect(found.index).toBe(650)
  })

  it('a cursor at the newest frame does not re-match an earlier frame', async () => {
    const frames: Array<Record<string, unknown> | null> = []
    const page = pageWith(frames)
    captureFrame(frames, { method: 'GAME_PLAY_MANA' }, 500)
    const cursor = parsedLen(page)
    await expect(waitFrameAt(page, (f) => f.method === 'GAME_PLAY_MANA', 'GAME_PLAY_MANA', 300, cursor)).rejects.toThrow()
  })

  it('stamps every captured frame with an increasing sequence number, null frames included', () => {
    const frames: Array<Record<string, unknown> | null> = []
    captureFrame(frames, { method: 'A' }, 500)
    captureFrame(frames, null, 500)
    captureFrame(frames, { method: 'B' }, 500)
    expect(frames[0]).toMatchObject({ __seq: 0 })
    expect(frames[2]).toMatchObject({ __seq: 2 })
    expect(parsedLen(pageWith(frames))).toBe(3)
  })
})
