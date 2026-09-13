/**
 * Guard centralizado de modo fake para los E2E.
 *
 * Los specs que dependen del guion determinista del FixtureServer usaban
 * `test.skip(!FAKE_MODE, '<mensaje largo>')` repetido en ~15 archivos. Eso
 * duplicaba el mensaje y el criterio. Ahora se usa `fakeOnly()` como anotación
 * (equivale a `test.skip(!FAKE_MODE, FAKE_ONLY_REASON)`) pero con el criterio
 * y el mensaje centralizados en un único lugar.
 */
import { test as base, type Page } from '@playwright/test'
import { FAKE_MODE } from '../dual'

export const FAKE_ONLY_REASON =
  'Solo fake: depende del guion determinista del FixtureServer. En real el helper auto-pasa y el servidor avanza por timers: ver lección en PROJECT.md.'

/** Anotación: skipea el siguiente test salvo en modo fake. */
export function fakeOnly(): void {
  base.skip(!FAKE_MODE, FAKE_ONLY_REASON)
}

/**
 * Hermeticidad de nombres en inglés: el enrich de nombres localizados de
 * Scryfall corre en carrera con los asertos — si la red gana, las cartas
 * muestran "Relámpago"/"Tutor infernal" y el test falla. Se bloquean las dos
 * vías del enrich (búsqueda `name:/^...$/` y directa `set/num/lang`); el resto
 * de Scryfall (panel de búsqueda, arte) sigue con red real.
 */
export async function blockLocalizedEnrich(page: Page): Promise<void> {
  await page.route('**/api.scryfall.com/cards/search*', (route) =>
    route.request().url().includes('name%3A%2F%5E')
      ? route.fulfill({ json: { object: 'list', data: [] } })
      : route.continue(),
  )
  await page.route('**/api.scryfall.com/cards/*/*/*', (route) =>
    route.fulfill({ status: 404, body: 'no such printing in tests' }),
  )
}
