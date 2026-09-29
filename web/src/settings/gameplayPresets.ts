import type { ManaPaymentStored } from '../state/persistence'
import type { PhaseStops } from '../net/commands'
import { PHASES } from '../game/phaseStops'

export type GameplayPresetId = 'simple' | 'balanced' | 'manual'

export interface GameplayPresetBundle {
  autoPass: boolean
  smartStops: boolean
  holdPriority: boolean
  manaPayment: ManaPaymentStored
  phaseStops: PhaseStops
}

export interface GameplayPreset {
  id: GameplayPresetId
  labelKey: 'preset_simple' | 'preset_balanced' | 'preset_manual'
  descKey: 'preset_simple_desc' | 'preset_balanced_desc' | 'preset_manual_desc'
  bundle: GameplayPresetBundle
}

function uniformStops(value: boolean): PhaseStops {
  const row = (): Record<string, boolean> => Object.fromEntries(PHASES.map((p) => [p.key, value]))
  return { yourTurn: row(), opponentTurn: row() }
}

export const GAMEPLAY_PRESETS: GameplayPreset[] = [
  {
    id: 'simple',
    labelKey: 'preset_simple',
    descKey: 'preset_simple_desc',
    bundle: {
      autoPass: true,
      smartStops: true,
      holdPriority: false,
      manaPayment: { auto: true, restricted: false, useFirstAbility: false, confirmEmptyPool: false, smart: true },
      phaseStops: uniformStops(false),
    },
  },
  {
    id: 'balanced',
    labelKey: 'preset_balanced',
    descKey: 'preset_balanced_desc',
    bundle: {
      autoPass: false,
      smartStops: true,
      holdPriority: false,
      manaPayment: { auto: true, restricted: true, useFirstAbility: false, confirmEmptyPool: true, smart: true },
      phaseStops: uniformStops(true),
    },
  },
  {
    id: 'manual',
    labelKey: 'preset_manual',
    descKey: 'preset_manual_desc',
    bundle: {
      autoPass: false,
      smartStops: false,
      holdPriority: false,
      manaPayment: { auto: false, restricted: true, useFirstAbility: false, confirmEmptyPool: true, smart: false },
      phaseStops: uniformStops(true),
    },
  },
]

export const PRESET_OWNED_KEYS: ReadonlySet<string> = new Set([
  'autoPass', 'smartStops', 'holdPriority', 'manaPayment', 'phaseStops',
])

export function isGameplayPresetId(value: unknown): value is GameplayPresetId {
  return typeof value === 'string' && GAMEPLAY_PRESETS.some((p) => p.id === value)
}

export function gameplayPreset(id: GameplayPresetId): GameplayPreset {
  return GAMEPLAY_PRESETS.find((p) => p.id === id) as GameplayPreset
}
