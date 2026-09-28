/**
 * Helpers for the looked-at / revealed / companion viewers (`.pile-overlay` modals that
 * `infoWindowState` latches open when such a group first appears).
 */

import { expect, type Page } from '@playwright/test'

/**
 * Closes any info-window viewer that opened on its own.
 *
 * They latch open (desktop `CardInfoWindowDialog` parity) and cover the board, so a spec that is
 * about hovering or clicking has to get rid of them first. A spec that is *about* a viewer must
 * not call this: use `info-windows.spec.ts`, which drives the dedicated `infoWindows` scenario.
 *
 * No-op when none is open, so it is safe to call unconditionally.
 */
export async function dismissInfoWindows(page: Page): Promise<void> {
  const overlays = page.locator('.pile-overlay')
  for (let i = await overlays.count(); i > 0; i = await overlays.count()) {
    const close = overlays.first().locator('.pile-overlay-close')
    if (await close.count()) {
      await close.first().click()
    } else {
      await page.keyboard.press('Escape')
    }
    await expect(overlays).toHaveCount(i - 1)
  }
}
