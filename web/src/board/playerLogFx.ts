import { cleanMageText } from '../game/gameEventParser'
import { getState } from '../state/state'
import { soundManager } from '../audio/soundManager'
import { fxMotionAllowed, fxMotionDuration } from './fx'
import { spawnImpact } from './impactFx'
import { spawnFloater } from './feedbackFx'
import { afterLayout, objectIdAfter, replayClass, visibleRect } from './gameLogFx'

const STACK_ZONES = '.stack-zone, .stack-deck, .stack-list'

/** "<player> chooses to pay … / chooses not to pay … / pays the cost to prevent the effect". */
export function parsePayChoice(message: string): { player: string; paid: boolean } | null {
  const m = cleanMageText(message).match(/^(.+?) (chooses not to pay|chooses to pay|pays the cost to prevent)\b/i)
  const player = m?.[1]?.trim()
  if (!m || !player) return null
  return { player, paid: !/^chooses not to pay$/i.test(m[2]) }
}

/** "[<source>: ]<player> has chosen[ the color][:] <choice>", excluding the Ring-bearer and companion lines. */
export function parseChosen(message: string): { player: string; choice: string; sourceId: string | null } | null {
  const text = cleanMageText(message)
  if (/ as (Ring-bearer|their companion)\.?$/i.test(text)) return null
  const m = text.match(/^(?:(.+?): )?(.+?) has chosen(?: the color)?:? (.+?)\.?$/i)
  if (!m) return null
  const player = m[2].trim()
  const choice = m[3].trim()
  if (!player || !choice) return null
  const cut = message.search(/\bhas chosen\b/i)
  const sourceId = cut > 0 ? objectIdAfter(message.slice(0, cut), 0) : null
  return { player, choice, sourceId }
}

/** "<player> has completed <dungeon>". */
export function parseDungeonCompleted(message: string): { player: string; dungeon: string } | null {
  const m = cleanMageText(message).match(/^(.+?) has completed (.+?)\.?$/i)
  const player = m?.[1]?.trim()
  const dungeon = m?.[2]?.trim()
  return player && dungeon ? { player, dungeon } : null
}

/** Game-log hook: pay / decline, a chosen value and a completed dungeon, for players of the current game. */
export function sniffPlayerLogFx(message: string, gameId: string | null | undefined): void {
  if (!gameId) return
  const s = getState()
  if (s.gameId !== gameId) return
  const players = s.game?.players ?? []
  const findPlayer = (name: string) => players.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase())

  const pay = parsePayChoice(message)
  if (pay) {
    const player = findPlayer(pay.player)
    if (player) animatePayChoice(player.playerId, pay.paid)
    return
  }
  const dungeon = parseDungeonCompleted(message)
  if (dungeon) {
    const player = findPlayer(dungeon.player)
    if (player) animateDungeonCompleted(player.playerId, dungeon.dungeon)
    return
  }
  const chosen = parseChosen(message)
  if (chosen) {
    const player = findPlayer(chosen.player)
    if (player) animateChosen(player.playerId, chosen.choice, chosen.sourceId)
  }
}

const PAY_MS = 700
const DUNGEON_COMPLETE_MS = 1100

/** Paid to prevent a counter or sacrifice (gold ring) or declined (the portrait shakes its head). */
export function animatePayChoice(playerId: string, paid: boolean): void {
  if (!fxMotionAllowed() || typeof document === 'undefined') return
  afterLayout(() => {
    const bar = document.querySelector(`.player-info-bar[data-player-id="${playerId}"]`)
    if (!bar) return
    replayClass(bar, paid ? 'fx-paid' : 'fx-declined', fxMotionDuration(PAY_MS) + 40)
    if (paid) soundManager.play('tap', 'game')
  })
}

/** A dungeon room completed: the dungeon badge bursts and the dungeon name floats over the bar. */
export function animateDungeonCompleted(playerId: string, dungeon: string): void {
  if (!fxMotionAllowed() || typeof document === 'undefined') return
  afterLayout(() => {
    const bar = document.querySelector(`.player-info-bar[data-player-id="${playerId}"]`)
    const badge = bar?.querySelector('.badge-dungeon') ?? null
    const rect = visibleRect(badge) ?? visibleRect(bar)
    if (!rect) return
    if (badge) replayClass(badge, 'fx-dungeon-complete', fxMotionDuration(DUNGEON_COMPLETE_MS) + 40)
    spawnImpact('dungeon', rect)
    spawnFloater(`dungeon-done-${playerId}`, visibleRect(bar) ?? rect, dungeon, 'good', true)
  })
}

/** A value chosen on a source (or by the player alone): the choice floats over the source card or the player bar. */
export function animateChosen(playerId: string, choice: string, sourceId: string | null): void {
  if (!fxMotionAllowed() || typeof document === 'undefined') return
  afterLayout(() => {
    let rect: DOMRect | null = null
    if (sourceId) {
      for (const el of document.querySelectorAll(`.card-slot[data-card-id="${sourceId}"]`)) {
        if (el.closest(STACK_ZONES)) continue
        rect = visibleRect(el)
        if (rect) break
      }
    }
    if (!rect) rect = visibleRect(document.querySelector(`.player-info-bar[data-player-id="${playerId}"]`))
    if (!rect) return
    spawnFloater(`chosen-${sourceId ?? playerId}`, rect, choice, 'mixed', true)
  })
}
