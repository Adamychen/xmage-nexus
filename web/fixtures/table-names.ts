/**
 * Nombres de mesa (tableName) canónicos para los escenarios del FixtureServer
 * y los specs que los arrancan.
 *
 * El cliente crea la mesa con `startGame({ tableName })` y el escenario la
 * emite en el lobby; si los dos strings no coinciden, el test no encuentra su
 * mesa (fallo opaco). Centralizarlos en un único módulo evita esa clase de
 * typo y hace el rename de una mesa un cambio en un solo lugar.
 *
 * Los `tableName` de los escenarios basados en `makeBaseScenario` son los que
 * el spec debe pasar a `startGame`. Los que solo usa el escenario (p.ej. los
 * de demo/espectador) se listan igual para no dejar strings mágicos sueltos.
 */
export const TABLE = {
  combat: 'combat-test',
  combatMultiBlock: 'combat-multi-block',
  combatHumanAttack: 'combat-human-attack',
  combatHumanBlock: 'combat-human-block',
  targeting: 'targeting-test',
  spellsBlaze: 'blaze-test',
  spellsArc: 'arc-test',
  spellsBoros: 'boros-test',
  spellsBallista: 'ballista-test',
  complexCosts: 'complex-costs-test',
  allInteractions: 'all-interactions-test',
  missingPrompts: 'missing-prompts-test',
  mechanics: 'Mechanics & Reminder Showcase',
  chat: 'Chat Test',
  decksGallery: 'decks-gallery-test',
  fullFlowDemo: 'Demo IA vs IA',
  crossZone: 'cz-test',
  crossZoneExile: 'cz-exile-test',
  mutate: 'Mutate Showcase',
  mutateRecorded: 'Mutate Recorded (real frame)',
  bestOf3: 'best-of-3-test',
  bestOf5: 'best-of-5-test',
  bestOfN: 'best-of-n-test',
  concede: 'concede-test',
  defeatSimWins: 'sim-wins-test',
  mulligan: 'mulligan-test',
  mulliganShowcase: 'Mulligan Showcase',
  stackPriority: 'stack-priority-test',
  thoughtseize: 'thoughtseize-test',
  voting: 'voting-test',
  planeswalker: 'planeswalker-test',
} as const
