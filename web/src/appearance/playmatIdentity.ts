import type { GameView, PlayerView } from '../net/types'
import { commandersOf } from '../board/commanders'
import { cardManaColors, type ManaColor } from '../board/impactFx'

const BASIC_LAND_COLOR: Record<string, ManaColor> = {
  plains: 'w',
  island: 'u',
  swamp: 'b',
  mountain: 'r',
  forest: 'g',
}

const ORDER: ManaColor[] = ['w', 'u', 'b', 'r', 'g']

function playerFor(game: GameView | null | undefined): PlayerView | undefined {
  const players = game?.players ?? []
  return players.find((p) => p.controlled) ?? players[0]
}

export function identityColors(game: GameView | null | undefined): ManaColor[] {
  const player = playerFor(game)
  if (!player) return []
  const commanderColors = new Set<ManaColor>()
  for (const c of commandersOf(player)) {
    if (!c.isCompanion) cardManaColors(c.card).forEach((col) => commanderColors.add(col))
  }
  if (commanderColors.size > 0) return ORDER.filter((c) => commanderColors.has(c))

  const counts = new Map<ManaColor, number>()
  for (const perm of Object.values(player.battlefield ?? {})) {
    const basic = BASIC_LAND_COLOR[String(perm.name ?? '').toLowerCase()]
    const colors = basic ? [basic] : cardManaColors(perm)
    for (const c of colors) counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))
    .slice(0, 3)
    .map(([c]) => c)
}

export function playmatVars(colors: ManaColor[]): Record<string, string> {
  const rgb = (c: ManaColor | undefined, fallback: string) => (c ? `var(--mana-${c}-rgb)` : fallback)
  return {
    '--mat-a-rgb': rgb(colors[0], 'var(--brand-rgb)'),
    '--mat-b-rgb': rgb(colors[1] ?? colors[0], 'var(--purple-rgb)'),
    '--mat-c-rgb': rgb(colors[2] ?? colors[1] ?? colors[0], 'var(--gold-rgb)'),
  }
}
