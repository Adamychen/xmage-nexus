import type { GameplayPresetId } from './gameplayPresets'
import { GAMEPLAY_PRESETS } from './gameplayPresets'
import { PHASES } from '../game/phaseStops'

export type DemoMode = 'auto' | 'stops' | 'manual'

export interface DemoCard {
  name: string
  kind: 'land' | 'spell'
}

export interface PresetDemoSpec {
  /** 'auto': the client plays the sequence by itself; 'stops': it plays but
   * pauses at stop dots; 'manual': every step is a click (rings). */
  mode: DemoMode
  /** Playmat id used as the backdrop of the mini-demo. */
  mat: string
  cards: DemoCard[]
  /** Your-turn phase keys where the preset bundle stops for input. */
  stopKeys: string[]
}

const CARDS: Record<GameplayPresetId, DemoCard[]> = {
  simple: [
    { name: 'Mountain', kind: 'land' },
    { name: 'Forest', kind: 'land' },
    { name: 'Island', kind: 'land' },
    { name: 'Shivan Dragon', kind: 'spell' },
    { name: 'Lightning Bolt', kind: 'spell' },
  ],
  balanced: [
    { name: 'Island', kind: 'land' },
    { name: 'Giant Growth', kind: 'spell' },
    { name: 'Counterspell', kind: 'spell' },
    { name: 'Sentinel Spider', kind: 'spell' },
  ],
  manual: [
    { name: 'Plains', kind: 'land' },
    { name: 'Swamp', kind: 'land' },
    { name: 'Sol Ring', kind: 'spell' },
    { name: 'Tarmogoyf', kind: 'spell' },
    { name: 'Lightning Bolt', kind: 'spell' },
  ],
}

function demoSpec(id: GameplayPresetId): PresetDemoSpec {
  const preset = GAMEPLAY_PRESETS.find((p) => p.id === id)
  if (!preset) throw new Error(`unknown preset ${id}`)
  const stops = PHASES.filter((p) => preset.bundle.phaseStops.yourTurn[p.key]).map((p) => p.key)
  const mode: DemoMode = id === 'simple' ? 'auto' : id === 'balanced' ? 'stops' : 'manual'
  return { mode, mat: id === 'simple' ? 'ember' : id === 'balanced' ? 'tides' : 'abyss', cards: CARDS[id], stopKeys: stops }
}

export const PRESET_DEMO_SCENES: Record<GameplayPresetId, PresetDemoSpec> = {
  simple: demoSpec('simple'),
  balanced: demoSpec('balanced'),
  manual: demoSpec('manual'),
}