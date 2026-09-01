import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { gameViewFromAndValidate } from './schema'
import type { GameView } from '../src/net/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RECORDED_DIR = path.join(__dirname, 'recorded')

type AssertKind = 'hasMutatedPermanent' | 'hasNonMutatedCreature' | 'hasAttackingTappedCreature' | 'hasCombatGroup'

function getMe(gv: GameView): GameView['players'][number] | undefined {
  return gv.players?.find((p) => p?.controlled)
}

function combatAttackerIds(gv: GameView): string[] {
  const ids: string[] = []
  for (const group of gv.combat ?? []) {
    const record = group as unknown as Record<string, unknown>
    const attackers = record.attackers
    if (Array.isArray(attackers)) ids.push(...attackers.map(String))
    else if (attackers && typeof attackers === 'object') ids.push(...Object.keys(attackers))
  }
  return ids
}

function runAssert(kind: AssertKind, gv: GameView): boolean {
  const me = getMe(gv)
  const bf = Object.values(me?.battlefield ?? {})
  switch (kind) {
    case 'hasMutatedPermanent':
      return bf.some((c) => (c as { mutated?: boolean; mutateView?: unknown }).mutated && Object.keys((c as { mutateView?: Record<string, unknown> }).mutateView ?? {}).length > 0)
    case 'hasNonMutatedCreature':
      return bf.some((c) => (c.cardTypes ?? []).includes('CREATURE') && !(c as { mutated?: boolean }).mutated)
    case 'hasCombatGroup':
      return combatAttackerIds(gv).length > 0
    case 'hasAttackingTappedCreature': {
      const attackerIds = new Set(combatAttackerIds(gv))
      if (attackerIds.size === 0) return false
      // El atacante debe figurar girado (tapped) en el battlefield o dentro del
      // propio grupo de combate (los no-vigilancia los gira el servidor).
      const tappedInCombat = (gv.combat ?? []).some((group) => {
        const attackers = (group as unknown as Record<string, Record<string, unknown>>).attackers
        if (!attackers || typeof attackers !== 'object' || Array.isArray(attackers)) return false
        return Object.values(attackers).some((a) => (a as { tapped?: boolean }).tapped === true)
      })
      return tappedInCombat || bf.some((c) => attackerIds.has(String(c.id ?? '')) && (c as { tapped?: boolean }).tapped === true)
    }
    default:
      return false
  }
}

const manifest = JSON.parse(fs.readFileSync(path.join(RECORDED_DIR, 'manifest.json'), 'utf8')) as Array<{
  file: string
  mechanic: string
  assert: AssertKind
  note?: string
}>

describe('golden frames grabados del protocolo real (anti-deriva)', () => {
  it('el manifest referencia frames que existen', () => {
    for (const entry of manifest) {
      expect(fs.existsSync(path.join(RECORDED_DIR, entry.file)), `falta ${entry.file}`).toBe(true)
    }
  })

  for (const entry of manifest) {
    it(`el frame ${entry.file} (${entry.mechanic}) pasa la validación de contrato y cumple su invariante`, () => {
      const raw = JSON.parse(fs.readFileSync(path.join(RECORDED_DIR, entry.file), 'utf8')) as { gameView: GameView }
      const res = gameViewFromAndValidate(raw.gameView)
      expect(res.ok, `gameView de ${entry.file} inválido: ${JSON.stringify(res.errors)}`).toBe(true)
      expect(runAssert(entry.assert, raw.gameView), `invariante ${entry.assert} no cumple en ${entry.file}`).toBe(true)
    })
  }
})
