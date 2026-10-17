import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { musicEngine } from './musicEngine'
import { useLobbyMusic } from './useLobbyMusic'

describe('useLobbyMusic', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts the lobby theme when the lobby mounts and stops it when a game starts', () => {
    const start = vi.spyOn(musicEngine, 'start').mockImplementation(() => {})
    const stop = vi.spyOn(musicEngine, 'stop').mockImplementation(() => {})
    const { rerender, unmount } = renderHook(({ active }) => useLobbyMusic(active, true), { initialProps: { active: true } })
    expect(start).toHaveBeenCalledWith('lobby')
    rerender({ active: false })
    expect(stop).toHaveBeenCalledWith('lobby')
    unmount()
  })

  it('restarts the lobby theme when returning to the lobby', () => {
    const start = vi.spyOn(musicEngine, 'start').mockImplementation(() => {})
    vi.spyOn(musicEngine, 'stop').mockImplementation(() => {})
    const { rerender, unmount } = renderHook(({ active }) => useLobbyMusic(active, true), { initialProps: { active: true } })
    rerender({ active: false })
    rerender({ active: true })
    expect(start.mock.calls.filter(([mode]) => mode === 'lobby')).toHaveLength(2)
    unmount()
  })

  it('does not start while the music setting is off', () => {
    const start = vi.spyOn(musicEngine, 'start').mockImplementation(() => {})
    const { unmount } = renderHook(() => useLobbyMusic(true, false))
    expect(start).not.toHaveBeenCalled()
    unmount()
  })

  it('stops the lobby theme when the setting is switched off in the lobby', () => {
    const start = vi.spyOn(musicEngine, 'start').mockImplementation(() => {})
    const stop = vi.spyOn(musicEngine, 'stop').mockImplementation(() => {})
    const { rerender, unmount } = renderHook(({ enabled }) => useLobbyMusic(true, enabled), { initialProps: { enabled: true } })
    expect(start).toHaveBeenCalledWith('lobby')
    rerender({ enabled: false })
    expect(stop).toHaveBeenCalledWith('lobby')
    unmount()
  })
})
