import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { xmageImplemented } from './xmageCatalog'

/**
 * Nombres (en minúsculas) de las cartas de la lista que la release de XMage del
 * proxy NO implementa. Vacío sin proxy: sin datos no se marca nada.
 */
export function useXmageUnimplemented(names: string[]): Set<string> {
  const wsAlive = useStore((s) => s.wsAlive)
  const [unimplemented, setUnimplemented] = useState<Set<string>>(() => new Set())
  const joined = useMemo(() => [...new Set(names)].sort().join('\n'), [names])

  useEffect(() => {
    if (!wsAlive || !joined) return
    let cancelled = false
    void xmageImplemented(joined.split('\n')).then((map) => {
      if (cancelled || !map) return
      const out = new Set<string>()
      for (const [name, ok] of map) if (!ok) out.add(name)
      setUnimplemented((prev) => (sameSet(prev, out) ? prev : out))
    })
    return () => {
      cancelled = true
    }
  }, [joined, wsAlive])

  return unimplemented
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}
