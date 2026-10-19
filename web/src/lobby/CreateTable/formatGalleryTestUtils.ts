import { fireEvent, waitFor } from '@testing-library/react'
import { expect } from 'vitest'

export type FormatField = 'format-game-type' | 'format-deck-type'

/** The option currently shown on a format field's trigger. */
export function formatValue(field: FormatField): string | null {
  return document.querySelector(`[data-testid="${field}"] .format-trigger-value`)?.textContent ?? null
}

export async function openGallery(field: FormatField): Promise<void> {
  fireEvent.click(document.querySelector(`[data-testid="${field}"]`)!)
  await waitFor(() => expect(document.querySelector('.fg-body')).not.toBeNull())
}

/** Names of every option the open gallery offers, whatever the filter. */
export function galleryNames(): string[] {
  return Array.from(document.querySelectorAll('.fg-tile-name')).map((n) => n.textContent ?? '')
}

export function closeGallery(): void {
  fireEvent.keyDown(window, { key: 'Escape' })
}

/** Chooses an option by its full value (a double-click, as in the gallery): a plain tile, or a mode chip of a grouped game type. */
export async function pickFormat(field: FormatField, option: string): Promise<void> {
  await openGallery(field)
  const target = Array.from(document.querySelectorAll<HTMLElement>('.fg-body [data-value]')).find((el) => el.dataset.value === option)
  expect(target, `option "${option}" in the gallery`).toBeDefined()
  fireEvent.doubleClick(target!)
}
