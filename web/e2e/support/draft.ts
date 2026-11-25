import { expect, type Locator } from '@playwright/test'

async function revealInFan(card: Locator): Promise<void> {
  const slot = card.locator('xpath=ancestor::div[contains(concat(" ", @class, " "), " arena-fan-slot ")][1]')
  const lane = card.locator('xpath=ancestor::div[contains(concat(" ", @class, " "), " arena-fan-lane ")][1]')
  const page = card.page()
  for (let i = 0; i < 30; i++) {
    const cls = (await slot.getAttribute('class')) ?? ''
    if (!/\bis-(piled|off-fan)\b/.test(cls)) return
    const cardBox = await slot.boundingBox()
    const laneBox = await lane.boundingBox()
    if (!cardBox || !laneBox) return
    const right = cardBox.x + cardBox.width / 2 > laneBox.x + laneBox.width / 2
    await page.mouse.move(laneBox.x + laneBox.width / 2, laneBox.y + laneBox.height / 2)
    await page.mouse.wheel(0, right ? 120 : -120)
    await page.waitForTimeout(60)
  }
  await expect(slot).not.toHaveClass(/\bis-(piled|off-fan)\b/)
}

export async function draftCardPoint(card: Locator): Promise<{ x: number; y: number }> {
  const box = await card.boundingBox()
  if (!box) throw new Error('draft card has no box')
  return { x: Math.round(box.width * 0.25), y: Math.round(box.height * 0.5) }
}

async function onVisibleStrip(card: Locator, act: (position: { x: number; y: number }) => Promise<void>): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    await revealInFan(card)
    try {
      await act(await draftCardPoint(card))
      return
    } catch (err) {
      if (attempt >= 4) throw err
    }
  }
}

export async function clickDraftCard(card: Locator): Promise<void> {
  await onVisibleStrip(card, (position) => card.click({ position, timeout: 3_000 }))
}

export async function hoverDraftCard(card: Locator): Promise<void> {
  await onVisibleStrip(card, (position) => card.hover({ position, timeout: 3_000 }))
}
