import type { PermanentView } from '../net/types'

const MARQUEE_TYPES = new Set(['saga', 'planeswalker', 'battle'])

function hasMarqueeType(values: unknown): boolean {
  if (!Array.isArray(values)) return false
  return values.some((t) => MARQUEE_TYPES.has(String(t).toLowerCase()))
}

/** Sagas, planeswalkers y batallas: van al dock marquee (derecha de la fila
 *  de criaturas). Las criaturas se excluyen aquí — el particionado de
 *  BoardZone las deja en la banda de criaturas (combate manda). */
export function isMarqueePermanent(perm: PermanentView): boolean {
  const types = perm.cardTypes ?? []
  if (types.some((t) => t === 'Creature' || String(t).toLowerCase() === 'creature')) return false
  if (hasMarqueeType(types)) return true
  return MARQUEE_TYPES.has(String(perm.mageObjectType ?? '').toLowerCase())
}
