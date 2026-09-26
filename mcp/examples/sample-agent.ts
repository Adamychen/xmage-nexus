#!/usr/bin/env node
/**
 * Sample autonomous agent demonstrating end-to-end play via XMage Nexus MCP.
 *
 * Requirements:
 * - Local stack running (XMage server on 17171 + Proxy on 8787).
 *   Start it with: `node scripts/ctl.mjs start all`
 *
 * Usage:
 *   node mcp/examples/sample-agent.ts
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverEntry = path.resolve(__dirname, '..', 'src', 'index.ts')

// Basic mono-red starter deck for demonstration
const SAMPLE_DECK = {
  name: 'Agent Red',
  cards: [
    { cardName: 'Mountain', setCode: 'LEA', cardNumber: '292', amount: 20 },
    { cardName: 'Raging Goblin', setCode: 'M10', cardNumber: '153', amount: 20 },
  ],
  sideboard: [],
}

interface PromptOption {
  id: string
  label: string
  value: string
}

interface PromptView {
  mode: string
  title: string
  options: PromptOption[]
  canPass?: boolean
}

interface CompactCard {
  id: string
  name: string
  playable?: boolean
  types?: string
}

interface CompactGameState {
  turn: number
  phase: string | null
  step: string | null
  myTurn: boolean
  hand: CompactCard[]
  battlefield: { mine: CompactCard[]; theirs: CompactCard[] }
}

async function run() {
  console.log('Connecting to XMage Nexus MCP server over stdio...')
  const client = new Client({ name: 'mage-sample-agent', version: '1.0.0' })
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverEntry],
  })
  await client.connect(transport)

  async function call(toolName: string, args: Record<string, unknown> = {}): Promise<Record<string, any>> {
    const res = await client.callTool({ name: toolName, arguments: args })
    const textContent = (res as { content?: { type?: string; text?: string }[] }).content
      ?.filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n') ?? '{}'

    if (res.isError) {
      throw new Error(`Tool ${toolName} failed: ${textContent}`)
    }

    try {
      const jsonStart = textContent.indexOf('{')
      return jsonStart >= 0 ? JSON.parse(textContent.slice(jsonStart)) : { text: textContent }
    } catch {
      return { raw: textContent }
    }
  }

  let tableId: string | null = null

  try {
    // 1. Connect and authenticate with the XMage proxy
    console.log('1. Connecting to XMage proxy (ws://127.0.0.1:8787)...')
    const conn = await call('mage_connect', { username: `agent-${Date.now().toString(36).slice(-6)}` })
    console.log(`Connected successfully as: ${conn.username}`)

    // 2. Create a 1v1 duel against a proxy Sim bot
    console.log('2. Creating table (HUMAN vs SIM)...')
    const table = await call('mage_create_table', {
      name: 'Agent Demo Match',
      gameType: 'Two Player Duel',
      deckType: 'Constructed - Pioneer',
      playerTypes: ['HUMAN', 'SIM'],
    })
    tableId = String(table.tableId)
    console.log(`Table created: ${tableId}`)

    // 3. Join the table with our deck
    console.log('3. Joining table with starter deck...')
    await call('mage_join_table', { tableId, deck: SAMPLE_DECK })

    // 4. Start the match
    console.log('4. Starting match...')
    const match = await call('mage_start_match', { tableId, waitMs: 30000 })
    console.log(`Match started! Game ID: ${match.gameId}`)

    // 5. Main Autonomous Gameplay Loop
    console.log('5. Entering game loop (listening for decision prompts)...')
    let lastSeq = 0
    let stepCount = 0

    while (stepCount < 100) {
      stepCount++
      const wait = await call('mage_wait_for_prompt', { timeoutMs: 15000, afterSeq: lastSeq })

      if (wait.gameOver) {
        console.log('\nGame Over reached! Result:', JSON.stringify(wait.data))
        break
      }

      if (wait.timeout) {
        console.log('Timeout waiting for prompt. Checking state...')
        continue
      }

      lastSeq = Number(wait.promptSeq)
      const prompt = wait.prompt as PromptView
      const state = wait.state as CompactGameState | null

      console.log(`\n[Prompt #${lastSeq}] Mode: ${prompt.mode} | Title: "${prompt.title}"`)

      // Decision Handling:
      switch (prompt.mode) {
        case 'boolean': {
          // E.g. Opening hand keep/mulligan or yes/no asks
          const keepOption = prompt.options.find((o) => o.value === 'false') ?? prompt.options[0]
          console.log(`Answering boolean prompt with option: ${keepOption?.label ?? 'keep'}`)
          await call('mage_choose', { optionId: keepOption?.id })
          break
        }

        case 'combat': {
          // Declare attack or block
          if (/blockers/i.test(prompt.title)) {
            console.log('Declaring no blockers...')
            await call('mage_combat', { confirm: true })
          } else {
            const attackerIds = prompt.options.map((o) => o.id)
            console.log(`Declaring attackers: ${attackerIds.length} creatures`)
            await call('mage_combat', { attackers: attackerIds, confirm: true })
          }
          break
        }

        case 'mana': {
          // Pay mana using auto-pay or the first available source
          console.log('Paying mana...')
          if (prompt.options.length > 0) {
            await call('mage_pay_mana', { sourceId: prompt.options[0].id })
          } else {
            await call('mage_pay_mana', { special: true })
          }
          break
        }

        case 'select': {
          // Main priority window: check for playable cards
          const hand = state?.hand ?? []
          const playableLand = hand.find((c) => c.playable && c.types?.includes('LAND'))
          const playableSpell = hand.find((c) => c.playable && !c.types?.includes('LAND'))

          if (playableLand) {
            console.log(`Playing land: ${playableLand.name}`)
            await call('mage_play_card', { cardId: playableLand.id })
          } else if (playableSpell) {
            console.log(`Casting spell: ${playableSpell.name}`)
            await call('mage_play_card', { cardId: playableSpell.id })
          } else {
            console.log('Passing priority...')
            await call('mage_pass_priority')
          }
          break
        }

        case 'uuid':
        case 'string': {
          // Target choice, mode, or color selection
          const choice = prompt.options[0]
          console.log(`Selecting choice: ${choice?.label ?? choice?.id}`)
          if (choice) {
            await call('mage_choose', { optionId: choice.id })
          } else {
            await call('mage_pass_priority')
          }
          break
        }

        default: {
          console.log(`Defaulting choice for mode "${prompt.mode}"`)
          if (prompt.options.length > 0) {
            await call('mage_choose', { optionId: prompt.options[0].id })
          } else {
            await call('mage_pass_priority')
          }
          break
        }
      }
    }
  } finally {
    if (tableId) {
      try {
        await call('mage_leave_table', { tableId, remove: true })
      } catch {
        // Table cleanup best-effort
      }
    }
    await client.close()
    console.log('Disconnected. Done.')
  }
}

void run().catch((err) => {
  console.error('Agent execution error:', err)
  process.exit(1)
})
