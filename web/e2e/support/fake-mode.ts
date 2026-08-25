/**
 * Guard centralizado de modo fake para los E2E.
 *
 * Los specs que dependen del guion determinista del FixtureServer usaban
 * `test.skip(!FAKE_MODE, '<mensaje largo>')` repetido en ~15 archivos. Eso
 * duplicaba el mensaje y el criterio. Ahora se usa `fakeOnly()` como anotación
 * (equivale a `test.skip(!FAKE_MODE, FAKE_ONLY_REASON)`) pero con el criterio
 * y el mensaje centralizados en un único lugar.
 */
import { test as base } from '@playwright/test'
import { FAKE_MODE } from '../dual'

export const FAKE_ONLY_REASON =
  'Solo fake: depende del guion determinista del FixtureServer. En real el helper auto-pasa y el servidor avanza por timers: ver lección en PROJECT.md.'

/** Anotación: skipea el siguiente test salvo en modo fake. */
export function fakeOnly(): void {
  base.skip(!FAKE_MODE, FAKE_ONLY_REASON)
}
