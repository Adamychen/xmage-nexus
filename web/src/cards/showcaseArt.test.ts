import { describe, expect, it } from 'vitest'
import { existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { showcaseArtUrl } from './showcaseArt'
import showcaseArt from '../data/showcaseArt.generated.json'

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public')
const ART = showcaseArt as Record<string, string>

describe('showcaseArt', () => {
  it('every manifest entry has its art committed under public/showcase', () => {
    const missing = Object.entries(ART).filter(([, path]) => !existsSync(join(PUBLIC_DIR, path)))
    expect(missing).toEqual([])
  })

  it('keeps the showcase payload bounded (regression guard for §4.6c)', () => {
    const totalKb = Object.values(ART).reduce((sum, path) => {
      const file = join(PUBLIC_DIR, path)
      return sum + (existsSync(file) ? statSync(file).size : 0)
    }, 0) / 1024
    // 13 arts ≈ 700 KiB today; anything past 1.5 MiB means the set grew by accident.
    expect(totalKb).toBeLessThan(1500)
  })

  it('resolves curated cards and nothing else', () => {
    expect(showcaseArtUrl('Mountain')).toBe('/showcase/mountain.jpg')
    expect(showcaseArtUrl('Lightning Bolt')).toBe('/showcase/lightning-bolt.jpg')
    expect(showcaseArtUrl('Llanowar Elves')).toBeNull()
    expect(showcaseArtUrl(null)).toBeNull()
    expect(showcaseArtUrl(undefined)).toBeNull()
  })
})
