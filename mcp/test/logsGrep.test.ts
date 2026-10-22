import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readTailLines } from '../src/tools/stack.ts'
import { contentText, startTestClient } from './support/mcp.ts'

describe('mage_logs grep', () => {
  let client: Client
  let dir = ''

  beforeAll(async () => {
    client = await startTestClient('logs-grep-test')
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mage-logs-'))
  }, 30_000)

  afterAll(async () => {
    await client.close()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const logs = (grep: string) => client.callTool({ name: 'mage_logs', arguments: { target: 'server', grep } })

  it('reports an invalid regex as a tool error', async () => {
    const result = await logs('(')
    expect(result.isError).toBe(true)
    expect(contentText(result)).toMatch(/invalid regex/i)
  })

  it('rejects patterns longer than 200 characters', async () => {
    const result = await logs('a'.repeat(201))
    expect(result.isError).toBe(true)
    expect(contentText(result)).toMatch(/too long/i)
  })

  it('rejects nested quantifiers that can backtrack catastrophically', async () => {
    for (const pattern of ['(x+)+$', '(x*)*', '(a|b+)+y']) {
      const started = Date.now()
      const result = await logs(pattern)
      expect(result.isError, pattern).toBe(true)
      expect(contentText(result), pattern).toMatch(/nested quantifiers/i)
      expect(Date.now() - started).toBeLessThan(2_000)
    }
  })

  it('still accepts a plain pattern', async () => {
    const result = await logs('turn \\d+')
    expect(result.isError).toBeFalsy()
  })

  it('scans at most 2000 characters of each line', () => {
    const file = path.join(dir, 'long.log')
    fs.writeFileSync(file, `${'x'.repeat(2_500)}needle\nshort needle\n`)
    const tail = readTailLines(file, 10, 'needle', true)
    expect(tail).toBe('short needle')
  })
})
