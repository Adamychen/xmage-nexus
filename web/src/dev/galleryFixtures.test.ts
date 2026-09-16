import { describe, expect, it } from 'vitest'
import { buildGalleryEntries, recordedFrames } from './galleryFixtures'

describe('galería de estados (P3)', () => {
  const entries = buildGalleryEntries()

  it('incluye todos los frames de juego del registro', () => {
    expect(recordedFrames.length).toBeGreaterThan(30)
    for (const frame of recordedFrames) {
      expect(entries.some((entry) => entry.id === `frame:${frame.mechanic}`), frame.file).toBe(true)
    }
  })

  it('ids únicos y grupos conocidos', () => {
    const ids = entries.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...new Set(entries.map((entry) => entry.group))]).toEqual(['Frames reales', 'Prompts', 'Pantallas'])
  })

  it('los prompts apuntan a ids reales del frame base', () => {
    const prompts = entries.filter((entry) => entry.group === 'Prompts')
    expect(prompts.length).toBeGreaterThanOrEqual(10)
    for (const entry of prompts) {
      expect(entry.game, entry.id).toBeTruthy()
      expect(entry.gameId, entry.id).toBeTruthy()
      expect(entry.feedback?.gameId, entry.id).toBe(entry.gameId)
    }

    const target = prompts.find((entry) => entry.id === 'prompt:target')
    const targetId = target?.feedback?.options[0]?.id
    const inBattlefield = (target?.game?.players ?? []).some((p) => targetId != null && p.battlefield?.[targetId])
    expect(inBattlefield, `objetivo ${targetId} debe existir en el campo`).toBe(true)

    const mana = prompts.find((entry) => entry.id === 'prompt:mana')
    expect(mana?.feedback?.playerId).toBeTruthy()
    expect(mana?.playableIds?.length).toBeGreaterThan(0)
  })

  it('la entrada de login no arrastra partida', () => {
    const login = entries.find((entry) => entry.id === 'screen:login')
    expect(login?.phase).toBe('idle')
    expect(login?.game).toBeUndefined()
  })
})
