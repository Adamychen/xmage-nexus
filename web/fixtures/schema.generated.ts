// @generated — Do not edit manually.
// Source: schema/contract.schema.json (definitions.GameView)
// Generado por scripts/gen-zod.mjs. Si el contrato cambia, regenerá:
//   npm run gen-zod
import { z } from 'zod'

export const gameViewSchema = z.object({
  priorityTime: z.number(),
  turn: z.number(),
  phase: z.string(),
  step: z.string(),
  activePlayerId: z.string(),
  activePlayerName: z.string(),
  priorityPlayerName: z.string(),
  players: z.array(z.record(z.string(), z.unknown())).nullish(),
  myHand: z.record(z.string(), z.unknown()).optional(),
  stack: z.record(z.string(), z.unknown()).nullish(),
  myPlayerId: z.union([z.string(), z.null()]).optional(),
  canPlayObjects: z.record(z.string(), z.unknown()).nullish(),
})
