/**
 * Helpers de clic sobre el header de un jugador (zonas de vida), por DOM.
 * Sin dependencias de Pixi/canvas.
 */

import type { Page } from '@playwright/test'
import { framesOf, lastGameView, parseFrames } from './frames'

/** Clic en el header (zona de vida) de un jugador oponente por playerId. */
export async function clickPlayerTarget(page: Page, playerId: string): Promise<boolean> {
  const el = page.locator(`[data-player-id="${playerId}"] .player-info-bar`)
  if (await el.count() > 0) {
    await el.first().click()
    return true
  }

  const view = lastGameView(parseFrames(framesOf(page)))
  const players = (view?.players ?? []) as { playerId?: string; controlled?: boolean }[]
  const opponents = players.filter((p) => !p.controlled)
  const index = opponents.findIndex((p) => p.playerId === playerId)
  if (index < 0) return false

  // data-role es estable en los tres modos (las zonas espejadas no llevan
  // la clase .opponent-zone, solo data-role="opponent")
  const oppZones = page.locator('[data-role="opponent"]')
  const zone = oppZones.nth(index)
  const infoBar = zone.locator('.player-info-bar')
  if (await infoBar.count() > 0) {
    await infoBar.first().click()
    return true
  }
  return false
}

/** Clic en el header de un jugador cualquiera (controlado o no) por playerId. */
export async function clickPlayerHeader(page: Page, playerId: string): Promise<boolean> {
  const view = lastGameView(parseFrames(framesOf(page)))
  const players = (view?.players ?? []) as { playerId?: string; controlled?: boolean }[]
  const player = players.find((p) => p.playerId === playerId)
  if (!player) return false

  if (player.controlled) {
    const infoBar = page.locator('.player-zone:not(.mirrored) .player-info-bar')
    if (await infoBar.count() > 0) {
      await infoBar.first().click()
      return true
    }
    return false
  }

  return clickPlayerTarget(page, playerId)
}
