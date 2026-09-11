import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { describe, expect, it } from 'vitest'

const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.ts')

const DECK = {
  name: 'MCP real game',
  cards: [
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 4 },
    { cardName: 'Raging Goblin', setCode: 'M10', cardNumber: '153', amount: 2 },
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 54 },
  ],
  sideboard: [],
}

interface PromptView {
  mode: string
  title: string
  flags?: string[]
  options: { id: string; label: string; value: string }[]
}

interface CompactState {
  turn: number
  phase: string
  myTurn: boolean
  hand: { id: string; name: string; types?: string; playable?: boolean }[]
  battlefield: { mine: { name: string }[] }
}

function parseJson(text: string): Record<string, unknown> {
  return JSON.parse(text.slice(text.indexOf('{'))) as Record<string, unknown>
}

describe.skipIf(process.env.MCP_E2E !== '1')('real deterministic game vs Sim', () => {
  it('plays lands, casts a creature, attacks and finishes the game', async () => {
    const client = new Client({ name: 'real-game', version: '0.0.0' })
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry] }))
    let tableId: string | null = null
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      const result = await client.callTool({ name, arguments: args })
      const content = (result as { content?: { type?: string; text?: string }[] }).content ?? []
      const text = content
        .filter((item) => item.type === 'text')
        .map((item) => item.text ?? '')
        .join('\n')
      if (result.isError) throw new Error(`${name}: ${text}`)
      return text
    }

    try {
      await call('mage_connect', {})
      const created = parseJson(
        await call('mage_create_table', {
          name: `mcp-real-${Date.now().toString(36)}`,
          playerTypes: ['HUMAN', 'SIM'],
          skipInitShuffling: true,
          skipStartingPlayerChoice: true,
        }),
      )
      tableId = String(created.tableId)
      await call('mage_join_table', { tableId, deck: DECK })
      const started = parseJson(await call('mage_start_match', { tableId, waitMs: 30_000 }))
      expect(String(started.gameId).length).toBeGreaterThan(0)

      let lastSeq = 0
      let landTurn = -1
      let goblinCast = false
      let attacked = false
      let gameOver = false
      let lastState: CompactState | null = null

      for (let step = 0; step < 400 && !gameOver; step++) {
        const wait = parseJson(await call('mage_wait_for_prompt', { timeoutMs: 15_000, afterSeq: lastSeq }))
        if (wait.gameOver) {
          gameOver = true
          break
        }
        if (wait.timeout) continue
        lastSeq = Number(wait.promptSeq)
        const prompt = wait.prompt as PromptView
        const state = wait.state as CompactState | null
        if (state) lastState = state

        if (prompt.mode === 'boolean') {
          const keep = prompt.options.find((option) => option.value === 'false') ?? prompt.options[0]
          await call('mage_choose', { optionId: keep?.id })
          continue
        }
        if (prompt.mode === 'combat') {
          if (/blockers/i.test(prompt.title)) {
            await call('mage_combat', { confirm: true })
          } else {
            const attackers = prompt.options.slice(0, 2).map((option) => option.id)
            await call('mage_combat', { attackers, confirm: true })
            if (attackers.length) attacked = true
          }
          continue
        }
        if (prompt.mode === 'mana') {
          await call('mage_pay_mana', { sourceId: prompt.options[0]?.id })
          continue
        }
        if (prompt.mode === 'select') {
          const hand = state?.hand ?? []
          const land = hand.find((card) => card.playable && card.types?.includes('LAND'))
          const goblin = hand.find((card) => card.playable && card.name === 'Raging Goblin')
          if (state?.myTurn && state.phase === 'PRECOMBAT_MAIN' && land && landTurn !== state.turn) {
            landTurn = state.turn
            await call('mage_play_card', { cardId: land.id })
          } else if (goblin && !goblinCast) {
            goblinCast = true
            await call('mage_play_card', { cardId: goblin.id })
          } else {
            await call('mage_pass_priority')
          }
          continue
        }
        if (prompt.mode === 'uuid' && prompt.options[0]) {
          await call('mage_choose', { optionId: prompt.options[0].id })
          continue
        }
        if (prompt.mode === 'integer') {
          await call('mage_choose', { value: 0 })
          continue
        }
        if (prompt.mode === 'string' && prompt.options[0]) {
          await call('mage_choose', { optionId: prompt.options[0].id })
          continue
        }
        await call('mage_pass_priority')
      }

      console.log('realGame', JSON.stringify({ gameOver, goblinCast, attacked, turn: lastState?.turn }))
      expect(goblinCast).toBe(true)
      expect(attacked).toBe(true)
      expect(gameOver).toBe(true)
      expect(lastState?.turn ?? 0).toBeGreaterThanOrEqual(3)
    } finally {
      if (tableId) {
        try {
          await call('mage_leave_table', { tableId, remove: true })
        } catch {
          /* mesa ya cerrada */
        }
      }
      await client.close()
    }
  }, 300_000)
})
