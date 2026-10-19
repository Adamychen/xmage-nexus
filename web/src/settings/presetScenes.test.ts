import { describe, expect, it } from 'vitest'
import { GAMEPLAY_PRESETS } from './gameplayPresets'
import { PRESET_DEMO_SCENES } from './presetScenes'
import { PLAYMATS } from '../appearance/playmats'
import { PHASES } from '../game/phaseStops'
import { showcaseArtUrl } from '../cards/showcaseArt'

describe('preset demo scenes', () => {
  it('derives the phase-stop story from the actual preset bundle', () => {
    const stops = (id: 'simple' | 'balanced' | 'manual') =>
      GAMEPLAY_PRESETS.find((p) => p.id === id)!.bundle.phaseStops.yourTurn
    // Simple runs the whole turn without a stop; balanced holds your mains; manual stops everywhere.
    expect(PRESET_DEMO_SCENES.simple.stopKeys).toEqual([])
    expect(stops('simple').main1).toBe(false)
    expect(PRESET_DEMO_SCENES.balanced.stopKeys).toEqual(['main1', 'main2'])
    expect(PRESET_DEMO_SCENES.manual.stopKeys).toEqual(PHASES.map((p) => p.key))
  })

  it('names a mode per preset: auto plays itself, stops pauses, manual is clicks', () => {
    expect(PRESET_DEMO_SCENES.simple.mode).toBe('auto')
    expect(PRESET_DEMO_SCENES.balanced.mode).toBe('stops')
    expect(PRESET_DEMO_SCENES.manual.mode).toBe('manual')
  })

  it('uses only curated cards (paint offline, no network)', () => {
    for (const scene of Object.values(PRESET_DEMO_SCENES)) {
      expect(scene.cards.length).toBeGreaterThanOrEqual(4)
      for (const card of scene.cards) {
        expect(showcaseArtUrl(card.name), card.name).not.toBeNull()
      }
    }
  })

  it('backs every scene with a real playmat id (styled by playmats.css)', () => {
    const ids = PLAYMATS.map((m) => m.id)
    for (const scene of Object.values(PRESET_DEMO_SCENES)) {
      expect(ids).toContain(scene.mat)
    }
    expect(Object.values(PRESET_DEMO_SCENES).map((s) => s.mat)).toEqual(['ember', 'tides', 'abyss'])
  })
})