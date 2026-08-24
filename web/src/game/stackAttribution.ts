import type { GameView, PlayerView } from '../net/types'

const ZONE_KEYS = ['battlefield', 'graveyard', 'exile'] as const

function zoneOwnerIndex(players: PlayerView[]): Map<string, PlayerView> {
  const index = new Map<string, PlayerView>()
  for (const player of players) {
    for (const key of ZONE_KEYS) {
      for (const id of Object.keys((player[key] ?? {}) as Record<string, unknown>)) {
        if (!index.has(id)) index.set(id, player)
      }
    }
  }
  return index
}

/**
 * Infers who controls each stack entry when the server does not say so.
 *
 * Unpatched XMage servers (e.g. beta.xmage.today) build GameView without any
 * controller attribution on stack CardViews, so the UI would show every spell
 * and ability as "Desconocido". Two inference rules cover the common cases:
 *
 * 1. Abilities/permanents: their sourceCard sits in a known zone (battlefield,
 *    graveyard, exile) of exactly one player -> that player controls it.
 * 2. Spells appearing this frame: the caster is whoever held priority in the
 *    previous frame (heuristic; wrong only if several players acted between
 *    two received frames).
 *
 * Entries that already carry controllerId/controllerName (patched local server,
 * FixtureServer scenarios) are never touched. Attribution injected here is
 * carried forward on later frames so labels persist until the object leaves
 * the stack.
 */
export function attributeStackControllers(prev: GameView | null | undefined, next: GameView): GameView {
  const prevStack = prev?.stack ?? {}
  const owners = zoneOwnerIndex(next.players ?? [])

  for (const [id, entry] of Object.entries(next.stack ?? {})) {
    if (!entry || typeof entry !== 'object') continue
    if (entry.controllerId || entry.controllerName) continue

    const before = prevStack[id]
    if (before?.controllerId) {
      entry.controllerId = before.controllerId
      continue
    }
    if (before?.controllerName) {
      entry.controllerName = before.controllerName
      continue
    }

    const srcId = entry.sourceCard?.id
    const owner = srcId ? owners.get(srcId) : undefined
    if (owner) {
      entry.controllerName = owner.name
      continue
    }

    const isNewSincePrev = !Object.prototype.hasOwnProperty.call(prevStack, id)
    if (isNewSincePrev && entry.mageObjectType === 'SPELL') {
      const name = prev?.priorityPlayerName || prev?.activePlayerName || ''
      if (name) entry.controllerName = name
    }
  }
  return next
}
