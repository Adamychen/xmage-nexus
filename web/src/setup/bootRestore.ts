import { isSetupDone } from './setupFlag'
import { loadConn } from '../state/persistence'

export interface BootPlan {
  /** Log back in with the stored connection and resume the game/draft it had. */
  restore: boolean
  /** Open the setup wizard over whatever screen comes up. */
  showWizard: boolean
}

/**
 * What happens on load, decided in one place because the two answers used to share one
 * flag and that is what lost players their session.
 *
 * `isSetupDone()` was written for the wizard only — closing it with the ✕ means "I have
 * not finished this, show it again" (deliberate since 00553ccb9aa, 2026-09-10, with two
 * tests guarding it). But `App` read the same flag *before* attempting the reload
 * re-login, so the ✕ silently switched restoring off: a player who dismissed the wizard
 * that way landed on the login screen on every reload, with no error to read, because the
 * client never dialled the proxy (measured 2026-10-09 over the Cloudflare tunnel: 0
 * connection attempts after the reload, versus a working re-login once the flag was set —
 * the tunnel and the proxy were fine all along).
 *
 * So the wizard keeps its rule and the session keeps its own: the wizard is about a
 * player who has not played yet, and a stored connection is proof they have. Anyone can
 * reopen the wizard from the login screen once it stops auto-opening.
 */
export function bootPlan(setupDone: boolean, hasSavedConn: boolean): BootPlan {
  return {
    restore: hasSavedConn,
    showWizard: !setupDone && !hasSavedConn,
  }
}

/** The same rule, read from what the device holds right now. */
export function bootPlanFromStorage(): BootPlan {
  return bootPlan(isSetupDone(), !!loadConn()?.username)
}