/**
 * Nombres de mazo canónicos para los E2E.
 *
 * Única fuente de verdad: `src/lobby/decks.ts` (el cliente los define ahí).
 * Centralizarlos evita que un rename en `decks.ts` rompa los specs en silencio:
 * al derivar los nombres de los exports del módulo, un cambio de nombre allí
 * rompe la compilación aquí (en vez de fallar el test en runtime).
 */
import {
  ADVANCED_DECK,
  AI_OPPONENT_DECK,
  COMBAT_BLOCK_SIM_DECK,
  COMBAT_HUMAN_DECK,
  COMBAT_OPPONENT_DECK,
  DEFAULT_DECK,
  LANDS_DECK,
  MUTATE_DECK,
  STABLE_DECK,
} from '../src/lobby/decks'

export const DECK = {
  starter: STABLE_DECK.name,
  bolt: DEFAULT_DECK.name,
  advanced: ADVANCED_DECK.name,
  aiLands: AI_OPPONENT_DECK.name,
  lands: LANDS_DECK.name,
  combatSim: COMBAT_OPPONENT_DECK.name,
  combatHuman: COMBAT_HUMAN_DECK.name,
  blockSim: COMBAT_BLOCK_SIM_DECK.name,
  mutate: MUTATE_DECK.name,
} as const
