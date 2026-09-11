import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const entry = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'index.ts')

function contentText(result: unknown): string {
  const items = Array.isArray((result as { content?: unknown }).content)
    ? ((result as { content: { type?: string; text?: string }[] }).content)
    : []
  return items
    .filter((item) => item.type === 'text')
    .map((item) => item.text ?? '')
    .join('\n')
}

describe('mage-nexus MCP server', () => {
  const client = new Client({ name: 'mage-mcp-test', version: '0.0.0' })

  beforeAll(async () => {
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [entry] }))
  }, 30_000)

  afterAll(async () => {
    await client.close()
  })

  it('registers the phase A tools', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((tool) => tool.name).sort()
    expect(names).toEqual([
      'mage_action',
      'mage_auto_pass',
      'mage_build',
      'mage_chat',
      'mage_choose',
      'mage_combat',
      'mage_concede',
      'mage_connect',
      'mage_create_table',
      'mage_disconnect',
      'mage_e2e',
      'mage_game_state',
      'mage_join_table',
      'mage_leave_table',
      'mage_lobby',
      'mage_logs',
      'mage_pass_priority',
      'mage_pay_mana',
      'mage_play_card',
      'mage_reconnect',
      'mage_record_fixture',
      'mage_run_tests',
      'mage_session',
      'mage_sessions',
      'mage_stack',
      'mage_start_match',
      'mage_use_session',
      'mage_validate_generated',
      'mage_wait_for_prompt',
    ])
  }, 30_000)

  it('reports stack status for all components', async () => {
    const result = await client.callTool({ name: 'mage_stack', arguments: { action: 'status' } })
    const text = contentText(result)
    expect(text).toContain('"component": "server"')
    expect(text).toContain('"port": 17171')
    expect(text).toMatch(/"state": "(RUNNING|stopped)"/)
  }, 30_000)

  it('tails proxy logs without crashing when empty', async () => {
    const result = await client.callTool({ name: 'mage_logs', arguments: { target: 'proxy', lines: 5 } })
    expect(contentText(result).length).toBeGreaterThan(0)
  }, 30_000)

  it('serves the status resources', async () => {
    const { resources } = await client.listResources()
    expect(resources.map((resource) => resource.uri)).toContain('mage://coverage/interactions')
    const read = await client.readResource({ uri: 'mage://coverage/interactions' })
    const first = (read.contents[0] ?? {}) as { text?: string }
    expect(first.text ?? '').toContain('Interaction Coverage')
  }, 30_000)
})
