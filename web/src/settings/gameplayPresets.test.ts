import { describe, expect, it } from 'vitest'
import { GAMEPLAY_PRESETS, PRESET_OWNED_KEYS, gameplayPreset, isGameplayPresetId } from './gameplayPresets'

function allValues(stops: Record<string, boolean>): boolean[] {
  return Object.values(stops)
}

describe('gameplay presets', () => {
  it('simple: full automation, smart pool payment and no phase stops', () => {
    const { bundle } = gameplayPreset('simple')
    expect(bundle.smartStops).toBe(true)
    expect(bundle.holdPriority).toBe(false)
    expect(bundle.manaPayment).toEqual({
      auto: true,
      restricted: false,
      useFirstAbility: false,
      confirmEmptyPool: false,
      smart: true,
    })
    expect(allValues(bundle.phaseStops.yourTurn).every((v) => v === false)).toBe(true)
    expect(allValues(bundle.phaseStops.opponentTurn).every((v) => v === false)).toBe(true)
  })

  it('balanced: smart automation, but pool confirmation and default phase stops', () => {
    const { bundle } = gameplayPreset('balanced')
    expect(bundle.smartStops).toBe(true)
    expect(bundle.manaPayment.auto).toBe(true)
    expect(bundle.manaPayment.smart).toBe(true)
    expect(bundle.manaPayment.restricted).toBe(true)
    expect(bundle.manaPayment.confirmEmptyPool).toBe(true)
    expect(allValues(bundle.phaseStops.yourTurn).every((v) => v === true)).toBe(true)
    expect(allValues(bundle.phaseStops.opponentTurn).every((v) => v === true)).toBe(true)
  })

  it('manual: no automation and default phase stops', () => {
    const { bundle } = gameplayPreset('manual')
    expect(bundle.smartStops).toBe(false)
    expect(bundle.manaPayment.auto).toBe(false)
    expect(bundle.manaPayment.smart).toBe(false)
    expect(allValues(bundle.phaseStops.yourTurn).every((v) => v === true)).toBe(true)
  })

  it('no preset owns auto-keep, so it never changes the mulligan preference', () => {
    expect(PRESET_OWNED_KEYS.has('autoKeepMulligan')).toBe(false)
    for (const preset of GAMEPLAY_PRESETS) {
      expect(preset.bundle).not.toHaveProperty('autoKeepMulligan')
    }
  })

  it('ids are unique and validated', () => {
    const ids = GAMEPLAY_PRESETS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(isGameplayPresetId(id)).toBe(true)
    expect(isGameplayPresetId('custom')).toBe(false)
    expect(isGameplayPresetId(null)).toBe(false)
    expect(isGameplayPresetId(7)).toBe(false)
  })
})
