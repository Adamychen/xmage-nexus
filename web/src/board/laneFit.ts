/**
 * How much room the 1v1 walkway needs, and what it shows when the band gives
 * it less than that.
 *
 * The walkway answers one question — *who is playing* — and a name truncated to
 * `Rivalmuygr…` does not answer it. So the walkway never clips a name: when it
 * does not fit it shows *less* (the active seat alone, then dots only). Which
 * of those fits depends on the font the platform resolves for `--font-ui`, so
 * it is measured, not hard-coded: the same layout that fits on macOS with a
 * 94.9 px name needs 101 px on Linux's wider system-ui, and a magic `max-width`
 * would silently truncate there.
 */

export type LaneFit = 'full' | 'solo' | 'dots'

export interface LaneFitInput {
  /** Natural width of every seat + arrows, names unwrapped. */
  needAll: number
  /** Natural width of the active seat alone, name unwrapped. */
  needActive: number
  /** Natural width of the active seat with its name dropped (dot + badge). */
  needActiveDots: number
  /** Room the band actually gives the walkway. */
  avail: number
}

/**
 * The widest layout that fits, or `full` when nothing is known (no measurement
 * yet, or an environment without layout like jsdom): the walkway starts whole
 * and only ever loses information when the measurement says it must.
 */
export function chooseLaneFit(input: LaneFitInput): LaneFit {
  const { needAll, needActive, needActiveDots, avail } = input
  if (!(avail > 0) || !(needAll > 0)) return 'full'
  if (needAll <= avail) return 'full'
  if (needActive <= avail) return 'solo'
  if (needActiveDots <= avail) return 'dots'
  // Nothing fits: keep the most information the band can still carry, and let
  // the row scroll rather than cutting the active name in half.
  return 'dots'
}
