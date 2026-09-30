import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'index.ts')

export function contentText(result: unknown): string {
  const items = Array.isArray((result as { content?: unknown }).content)
    ? (result as { content: { type?: string; text?: string }[] }).content
    : []
  return items
    .filter((item) => item.type === 'text')
    .map((item) => item.text ?? '')
    .join('\n')
}

export async function startTestClient(name: string): Promise<Client> {
  const client = new Client({ name, version: '0.0.0' })
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry] }))
  return client
}

export const basePlayer = {
  playerId: 'p1',
  name: 'me',
  controlled: true,
  isActive: true,
  hasPriority: true,
  life: 20,
  handCount: 0,
  libraryCount: 53,
  battlefield: {},
  graveyard: {},
}

export const rivalPlayer = {
  playerId: 'p2',
  name: 'rival',
  controlled: false,
  isActive: false,
  hasPriority: false,
  life: 20,
  handCount: 7,
  libraryCount: 53,
  battlefield: {},
  graveyard: {},
}

export function baseGameView(turn: number) {
  return {
    turn,
    phase: 'PRECOMBAT_MAIN',
    step: 'PRECOMBAT_MAIN',
    activePlayerName: 'me',
    priorityPlayerName: 'me',
    myHand: {},
    canPlayObjects: { objects: {} },
    stack: {},
    combat: [],
    players: [basePlayer, rivalPlayer],
  }
}
