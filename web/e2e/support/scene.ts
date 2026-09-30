/**
 * Estado del escenario en vivo publicado por la app en window.__mageScene
 * (sceneBridge). Sustituye a los byte-diffs del canvas: los tests asertan
 * sobre este estado (determinista) y el DOM, NO sobre píxeles.
 */

import type { Page } from '@playwright/test'
import { framesOf, lastGameView, myHandEntries, parseFrames, playableInView } from './frames'

export interface SceneCardPosition {
  x: number
  y: number
}

export interface SceneState {
  cards?: Record<string, SceneCardPosition>
  playable?: string[]
  crossZone?: string[]
  game?: { turn?: number; phase?: string; step?: string; priority?: boolean }
}

export interface SceneTargeting {
  active: boolean
  source: string | null
  ids: string[]
  chosen: string[]
  zone?: string | null
}

export interface SceneCombat {
  active: boolean
  mode: 'attack' | 'block' | null
  selectable: string[]
  chosen: string[]
}

/** Estado del escenario expuesto por la app (posiciones + playables en vivo). */
export async function sceneState(page: Page): Promise<SceneState | null> {
  const scene = await page.evaluate(() => (globalThis as unknown as { __mageScene?: SceneState }).__mageScene ?? null)
  return scene && typeof scene === 'object' ? scene : null
}

/** Devuelve true si el hook de escenario existe (build con soporte E2E). */
async function sceneHookAvailable(page: Page): Promise<boolean> {
  return (await page.evaluate(() => (globalThis as unknown as { __mageScene?: unknown }).__mageScene !== undefined)) === true
}

/** Clic lógico por UUID en el escenario (el hook de la app despacha el click
 *  real en el DOM, mucho más fiable que clicar coordenadas del canvas). */
export async function sceneClick(page: Page, id: string): Promise<boolean> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const ok =
      (await page.evaluate(
        (cardId) => (globalThis as unknown as { __mageScene?: { click?: (id: string) => boolean } }).__mageScene?.click?.(cardId) ?? false,
        id,
      )) === true
    if (ok) return true
    await page.waitForTimeout(200)
  }
  return false
}

/** ¿La carta (por UUID) está jugable según el estado REAL de la app? */
export async function playableInScene(page: Page, id: string | null): Promise<boolean> {
  if (!id) return false
  const scene = await sceneState(page)
  return Array.isArray(scene?.playable) && scene.playable.includes(id)
}

/** ¿La carta (por UUID) es jugable desde otra zona (ray) según el estado REAL
 *  de la app? La app puede ir un render por detrás de los frames: reintentar
 *  durante una ventana corta antes de dar un no definitivo. */
export async function crossZoneInScene(page: Page, id: string | null): Promise<boolean> {
  if (!id) return false
  for (let attempt = 0; attempt < 15; attempt++) {
    const scene = await sceneState(page)
    if (Array.isArray(scene?.crossZone) && scene.crossZone.includes(id)) return true
    await page.waitForTimeout(200)
  }
  return false
}

/** Id de la carta por nombre si está en la lista de jugables EN VIVO de la app. */
export async function playableInSceneByName(page: Page, name: string): Promise<string | null> {
  const scene = await sceneState(page)
  const playable = Array.isArray(scene?.playable) ? scene.playable : []
  if (playable.length === 0) return null
  const view = lastGameView(parseFrames(framesOf(page)))
  const entry = myHandEntries(view).find(([, card]) => card.name === name || card.displayName === name)
  return entry && playable.includes(entry[0]) ? entry[0] : null
}

/** ¿La carta por nombre está jugable? Prioriza el estado real de la app; el
 *  canPlayObjects de los frames es intermitente (el servidor no lo manda en
 *  todos los GAME_UPDATE) y clicar contra él falla en ventanas perdidas.
 *  La app puede ir un render por detrás: si la carta está en mano y la app aún
 *  no la marca jugable, se reintenta antes de devolver null. */
export async function isPlayable(page: Page, name: string): Promise<string | null> {
  const view = lastGameView(parseFrames(framesOf(page)))
  const id = myHandEntries(view).find(([, card]) => card.name === name || card.displayName === name)?.[0] ?? null
  if (id && (await playableInScene(page, id))) return id
  if (!(await sceneHookAvailable(page))) {
    return playableInView(view, name)
  }
  if (id) {
    for (let attempt = 0; attempt < 6; attempt++) {
      await page.waitForTimeout(200)
      if (await playableInScene(page, id)) return id
    }
  }
  return null
}

interface SceneFields {
  targeting: SceneTargeting
  combat: SceneCombat
}

/** Espera a que el estado EN VIVO de `field` ('targeting' | 'combat') cumpla
 *  `predicate` (determinista; sustituye a los byte-diffs del canvas, que
 *  dependen del render por detrás de los frames). */
export async function waitScene<K extends keyof SceneFields>(
  page: Page,
  field: K,
  predicate: (value: SceneFields[K]) => boolean,
  label: string,
  timeoutMs = 15_000,
): Promise<SceneFields[K]> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    let value: SceneTargeting | SceneCombat | null = null
    try {
      value = (await page.evaluate(
        (f) => (globalThis as unknown as { __mageScene?: Partial<SceneFields> }).__mageScene?.[f] ?? null,
        field,
      )) as SceneTargeting | SceneCombat | null
    } catch {
      value = null
    }
    if (value && predicate(value as SceneFields[K])) return value as SceneFields[K]
    if (Date.now() >= deadline) {
      throw new Error(`timeout esperando ${label} (último ${field}: ${JSON.stringify(value)})`)
    }
    await page.waitForTimeout(200)
  }
}
