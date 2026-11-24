import * as cmds from '../net/commands'
import type { ServerPreferences } from '../net/commands'
import { serverPhaseStops } from '../game/phaseStops'
import { buildAppearanceToken } from '../appearance/appearanceToken'
import { getState } from './state'
import type { AppState } from './state'

/** The `UserData` preferences the server's HumanPlayer runs on, taken from Settings (SET-11). */
export function serverPreferences(settings: AppState['settings']): ServerPreferences {
  return {
    phases: serverPhaseStops(settings.smartStops, settings.phaseStops),
    confirmEmptyManaPool: settings.manaPayment.confirmEmptyPool,
    // The same object carries what the table is told about this player's own look (APR-6).
    appearance: buildAppearanceToken({ sleeveId: settings.sleeveId }),
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
