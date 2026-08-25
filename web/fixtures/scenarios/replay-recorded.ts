import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GameView } from '../../src/net/types'
import { makeBaseScenario, type Scenario } from '../fake'
import { TABLE_ID } from '../humanGameConstants'

// Escenario genérico anti-deriva: reemite un frame real capturado por
// scripts/record.mjs (web/fixtures/recorded/<filename>) como GAME_INIT, de modo
// que el web lo renderice SIN necesidad del servidor real (ni de beta). Esto
// prueba que el cliente pinta la FORMA REAL del protocolo, no solo la construida
// a mano en scenarios/*.ts. Fusiona el antiguo mutate-recorded.ts.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RECORDED_DIR = path.join(__dirname, '..', 'recorded')

export const REPLAY_TABLE_NAME = 'Replay Recorded (real frame)'

export function replayRecordedScenario(
  filename: string,
  tableName: string = REPLAY_TABLE_NAME,
): Scenario {
  const raw = JSON.parse(fs.readFileSync(path.join(RECORDED_DIR, filename), 'utf8')) as {
    gameId: string
    gameView: unknown
  }
  const { gameView, gameId } = raw

  return makeBaseScenario({
    tableId: TABLE_ID,
    tableName,
    gameId,
    gameView: gameView as GameView,
  })
}
