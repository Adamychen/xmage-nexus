export type SleeveId = 'classic' | 'midnight' | 'wood' | 'nebula' | 'jace' | 'bolas'

export interface SleeveDef {
  id: SleeveId
  name: string
  kind: 'image' | 'css'
  imageUrl?: string
  css?: string
  accent?: string
  emblem?: string
}

export const SLEEVES: SleeveDef[] = [
  {
    id: 'classic',
    name: 'Clásico',
    kind: 'image',
    imageUrl: 'https://cards.scryfall.io/back.png',
  },
  {
    id: 'midnight',
    name: 'Medianoche',
    kind: 'css',
    css: 'radial-gradient(ellipse 90% 70% at 50% 20%, #2a2f5a 0%, #1a1e33 45%, #0d1022 100%)',
    accent: '#ffb03a',
    emblem: '◆',
  },
  {
    id: 'wood',
    name: 'Madera',
    kind: 'css',
    css: 'radial-gradient(ellipse 100% 80% at 50% 0%, #5a3a20 0%, #3a2414 40%, #1a1208 100%)',
    accent: '#ffb03a',
    emblem: '⬢',
  },
  {
    id: 'nebula',
    name: 'Nebulosa',
    kind: 'css',
    css: 'radial-gradient(ellipse 110% 85% at 50% -8%, rgba(180,80,255,0.55) 0%, transparent 55%), radial-gradient(ellipse 100% 75% at 30% 70%, rgba(56,189,248,0.35) 0%, transparent 60%), linear-gradient(180deg, #1a1033 0%, #0d1022 60%, #070912 100%)',
    accent: '#c084fc',
    emblem: '✦',
  },
  {
    id: 'jace',
    name: 'Jace',
    kind: 'image',
    imageUrl: '/avatars/10.jpg',
  },
  {
    id: 'bolas',
    name: 'Nicol Bolas',
    kind: 'image',
    imageUrl: '/avatars/15.jpg',
  },
]

const SLEEVE_MAP = new Map<SleeveId, SleeveDef>(SLEEVES.map((s) => [s.id, s]))

export function getSleeveDef(id: string): SleeveDef {
  return SLEEVE_MAP.get(id as SleeveId) ?? SLEEVE_MAP.get('classic')!
}

export function isValidSleeveId(id: string): boolean {
  return SLEEVE_MAP.has(id as SleeveId)
}
