import { getCachedAvatar, cacheAvatar } from './avatarCache'

export interface AvatarDefinition {
  id: number
  name: string
  path: string
  isSpecial?: boolean
  nameKey?: string
}

export const OFFICIAL_AVATARS: AvatarDefinition[] = [
  { id: 10, name: 'Jace Beleren', path: '/avatars/10.jpg' },
  { id: 11, name: 'Chandra Nalaar', path: '/avatars/11.jpg' },
  { id: 12, name: 'Liliana Vess', path: '/avatars/12.jpg' },
  { id: 13, name: 'Garruk Wildspeaker', path: '/avatars/13.jpg' },
  { id: 14, name: 'Ajani Goldmane', path: '/avatars/14.jpg' },
  { id: 15, name: 'Nicol Bolas', path: '/avatars/15.jpg' },
  { id: 16, name: 'Teferi, Hero of Dominaria', path: '/avatars/16.jpg' },
  { id: 17, name: 'Karn Liberated', path: '/avatars/17.jpg' },
  { id: 18, name: 'Elspeth Tirel', path: '/avatars/18.jpg' },
  { id: 19, name: 'Gideon Jura', path: '/avatars/19.jpg' },
  { id: 20, name: 'Sorin Markov', path: '/avatars/20.jpg' },
  { id: 21, name: 'Nissa Revane', path: '/avatars/21.jpg' },
  { id: 22, name: 'Sarkhan Vol', path: '/avatars/22.jpg' },
  { id: 23, name: 'Kiora, Master of the Depths', path: '/avatars/23.jpg' },
  { id: 24, name: 'Ugin, the Spirit Dragon', path: '/avatars/24.jpg' },
  { id: 25, name: 'Tamiyo, the Moon Sage', path: '/avatars/25.jpg' },
  { id: 26, name: 'Vraska, Golgari Queen', path: '/avatars/26.jpg' },
  { id: 27, name: 'Ral Zarek', path: '/avatars/27.jpg' },
  { id: 28, name: 'Domri Rade', path: '/avatars/28.jpg' },
  { id: 29, name: 'Ashiok, Nightmare Weaver', path: '/avatars/29.jpg' },
  { id: 30, name: 'Nahiri, the Harbinger', path: '/avatars/30.jpg' },
  { id: 31, name: 'Kaya, Ghost Assassin', path: '/avatars/31.jpg' },
  { id: 32, name: 'Saheeli Rai', path: '/avatars/32.jpg' },
  // Special Animated Avatars (IDs >= 1000)
  { id: 1000, name: 'Animated: Arcane Orb', path: '/avatars/special/0.gif', isSpecial: true, nameKey: 'avatar_sp_arcane_orb' },
  { id: 1001, name: 'Animated: Mythic Dragon', path: '/avatars/special/1.gif', isSpecial: true, nameKey: 'avatar_sp_mythic_dragon' },
  { id: 1002, name: 'Animated: Elemental Mage', path: '/avatars/special/2.gif', isSpecial: true, nameKey: 'avatar_sp_elemental_mage' },
  { id: 1004, name: 'Animated: Mana Spark', path: '/avatars/special/4.gif', isSpecial: true, nameKey: 'avatar_sp_mana_spark' },
  { id: 1006, name: 'Animated: Dimensional Portal', path: '/avatars/special/6.gif', isSpecial: true, nameKey: 'avatar_sp_dimensional_portal' },
  { id: 1008, name: 'Animated: Sacred Flame', path: '/avatars/special/8.gif', isSpecial: true, nameKey: 'avatar_sp_sacred_flame' },
  { id: 1010, name: 'Animated: Necromancer', path: '/avatars/special/10.gif', isSpecial: true, nameKey: 'avatar_sp_necromancer' },
  { id: 1012, name: 'Animated: Lord of Shadows', path: '/avatars/special/12.gif', isSpecial: true, nameKey: 'avatar_sp_shadow_lord' },
  { id: 1014, name: 'Animated: Celestial Spark', path: '/avatars/special/14.gif', isSpecial: true, nameKey: 'avatar_sp_celestial_spark' },
  { id: 1016, name: 'Animated: Astral Vortex', path: '/avatars/special/16.gif', isSpecial: true, nameKey: 'avatar_sp_astral_vortex' },
  { id: 1018, name: 'Animated: Red Lightning', path: '/avatars/special/18.gif', isSpecial: true, nameKey: 'avatar_sp_red_lightning' },
  { id: 1020, name: 'Animated: Orb of Light', path: '/avatars/special/20.gif', isSpecial: true, nameKey: 'avatar_sp_light_orb' },
  { id: 1021, name: 'Animated: Cosmic Crystal', path: '/avatars/special/21.gif', isSpecial: true, nameKey: 'avatar_sp_cosmic_crystal' },
]

/** Genera un ID de avatar temático determinista a partir del nombre de usuario cuando el servidor no emite avatarId. */
export function getDeterministicAvatarId(username?: string): number {
  if (!username || !username.trim()) return 10
  let hash = 0
  const clean = username.trim().toLowerCase()
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i)
    hash |= 0
  }
  const absHash = Math.abs(hash)
  // Mapear sobre el rango de los 23 avatares principales (IDs 10 a 32)
  const availableIds = [
    10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
  ]
  return availableIds[absHash % availableIds.length]
}

export function resolveAvatarPath(avatarId?: number | null, username?: string): string {
  if (avatarId !== undefined && avatarId !== null && avatarId > 0 && username) {
    cacheAvatar(username, avatarId)
  }

  const effectiveId =
    avatarId !== undefined && avatarId !== null && avatarId > 0
      ? avatarId
      : (getCachedAvatar(username) ?? getDeterministicAvatarId(username))

  // Check in curated list
  const found = OFFICIAL_AVATARS.find((a) => a.id === effectiveId)
  if (found) return found.path

  // Fallback for custom or special IDs
  if (effectiveId >= 1000) {
    return `/avatars/special/${effectiveId - 1000}.gif`
  }

  if (effectiveId === 64) {
    return '/avatars/i64.jpg'
  }

  return `/avatars/${effectiveId}.jpg`
}

