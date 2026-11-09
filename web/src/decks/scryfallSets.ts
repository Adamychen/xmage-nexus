import { useEffect, useState } from 'react'
import { scryfallJson } from '../cards/scryfallClient'

export interface ScryfallSetOption {
  code: string
  name: string
}

interface ScryfallSetJson {
  code: string
  name: string
  set_type: string
  digital?: boolean
}

const SKIPPED_SET_TYPES = new Set(['token', 'memorabilia', 'minigame', 'treasure_chest', 'alchemy'])

export function playableSets(data: ScryfallSetJson[]): ScryfallSetOption[] {
  return data
    .filter((s) => !s.digital && !SKIPPED_SET_TYPES.has(s.set_type))
    .map((s) => ({ code: s.code.toLowerCase(), name: s.name }))
}

export function setCodeFor(input: string, sets: ScryfallSetOption[]): string | null {
  const v = input.trim().toLowerCase()
  if (!v) return null
  return sets.find((s) => s.code === v || s.name.toLowerCase() === v)?.code ?? v
}

export function useScryfallSets(enabled: boolean): ScryfallSetOption[] {
  const [sets, setSets] = useState<ScryfallSetOption[]>([])
  useEffect(() => {
    if (!enabled || sets.length > 0) return
    let alive = true
    void scryfallJson<{ data?: ScryfallSetJson[] }>('https://api.scryfall.com/sets', { persist: true }).then((res) => {
      if (alive && res?.data) setSets(playableSets(res.data))
    })
    return () => { alive = false }
  }, [enabled, sets.length])
  return sets
}

export function matchingSets(sets: ScryfallSetOption[], query: string, limit = 80): ScryfallSetOption[] {
  const q = query.trim().toLowerCase()
  if (!q) return sets.slice(0, limit)
  return sets.filter((s) => s.code.includes(q) || s.name.toLowerCase().includes(q)).slice(0, limit)
}
