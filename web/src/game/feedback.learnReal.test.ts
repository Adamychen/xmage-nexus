import { describe, expect, it } from 'vitest'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { parseFeedback } from './feedback'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Anti-drift del prompt LEARN/wish: el frame REAL que el servidor 1.4.62 envía
 * al elegir una Lesson del sideboard (WishEffect → HumanPlayer.choose(Outcome,
 * Cards, TargetCard) → GAME_TARGET con el overload Cards), capturado en vivo
 * por scripts/drivers/learn.mjs. El parser del cliente debe producir un
 * FeedbackPrompt que el CardGrid renderice con la Lesson seleccionable y el
 * clic responda sendPlayerUUID(<lesson-id>).
 */
const RAW = JSON.parse(readFileSync(resolve(here, '../../fixtures/recorded/learn-raw-target.json'), 'utf8')) as {
  objectId?: string
  data: Record<string, unknown>
}

describe('learn: frame REAL del wire → parser del cliente', () => {
  const fp = parseFeedback('GAME_TARGET', RAW.objectId ?? null, RAW.data)

  it('GAME_TARGET "Select a Lesson card" produce un CardGrid con la Lesson seleccionable', () => {
    expect(fp).not.toBeNull()
    expect(fp!.method).toBe('GAME_TARGET')
    expect(fp!.message).toContain('Lesson')
    // cards (grid) desde cardsView1: el CardView real de la Lesson (zone OUTSIDE)
    expect(fp!.cards ?? []).toHaveLength(1)
    const lesson = fp!.cards![0]
    expect(lesson.name).toBe('Environmental Sciences')
    // options (seleccionables) desde options.possibleTargets (targets llega null)
    expect(fp!.options.map((o) => o.id)).toEqual([lesson.id])
    // contrato del CardGrid: selectable.has(card.id) === true → visible y clicable
    const selectable = new Set(fp!.options.map((o) => o.id))
    expect(selectable.has(lesson.id)).toBe(true)
    // requerido (flag=true): sin "Cancelar" implícito; modo uuid → sendPlayerUUID
    expect(fp!.mode).toBe('uuid')
    expect(fp!.required).not.toBe(false)
  })

  it('no colapsa a handPick (la Lesson vive fuera de la mano)', async () => {
    const { handPickIds } = await import('./handPick')
    // ni todas las cards ni todas las options están en la mano → grid, no TargetBar
    expect(handPickIds(fp!, new Set(['hand-1', 'hand-2']))).toBeNull()
  })
})