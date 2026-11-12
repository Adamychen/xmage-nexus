import * as cmds from '../net/commands'
import type { ServerPreferences } from '../net/commands'
import { serverPhaseStops } from '../game/phaseStops'
import { getState } from './state'
import type { AppState } from './state'

/** The `UserData` preferences the server's HumanPlayer runs on, taken from Settings (SET-11). */
export function serverPreferences(settings: AppState['settings']): ServerPreferences {
  return {
    phases: serverPhaseStops(settings.smartStops, settings.phaseStops),
    confirmEmptyManaPool: settings.manaPayment.confirmEmptyPool,
  }
}

/**
 * Sends every server preference in one call. XMage replaces the whole `UserData` on each
 * update (`UserData.update`), so a call with only the stops reset "confirm empty mana pool"
 * and a call with only that flag reset the stops to the engine defaults.
 */
export function pushServerPreferences(settings: AppState['settings'] = getState().settings): void {
  void cmds.updatePreferences(serverPreferences(settings))
}
