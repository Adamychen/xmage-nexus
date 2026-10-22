import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { runCommand } from '../src/lib.ts'

function isDead(pid: number): boolean {
  try {
    process.kill(pid, 0)
  } catch {
    return true
  }
  try {
    const state = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1]?.[0]
    return state === 'Z' || state === 'X'
  } catch {
    return true
  }
}

describe('runCommand output capture', () => {
  it('keeps the tail of a 1.2 MB output with a truncation marker between head and tail', async () => {
    const script = "process.stdout.write('a'.repeat(1_200_000) + '\\nRESULTADO: PASS\\n')"
    const res = await runCommand(process.execPath, ['-e', script])
    expect(res.code).toBe(0)
    expect(res.stdout.startsWith('aaaa')).toBe(true)
    expect(res.stdout.includes('…[truncated ')).toBe(true)
    expect(res.stdout.endsWith('RESULTADO: PASS\n')).toBe(true)
    expect(res.stdout.length < 1_100_000).toBe(true)
  }, 30_000)
})

describe('runCommand timeout', () => {
  it.skipIf(process.platform === 'win32')(
    'kills grandchildren holding stdout and returns promptly',
    async () => {
      const grandchild = 'setTimeout(() => process.exit(0), 30000); setInterval(() => {}, 1000)'
      const child = [
        "const { spawn } = require('node:child_process')",
        `const g = spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { stdio: 'inherit' })`,
        "console.log('GRANDCHILD ' + g.pid)",
        'setInterval(() => {}, 1000)',
      ].join('\n')
      const started = Date.now()
      const res = await runCommand(process.execPath, ['-e', child], { timeoutMs: 500 })
      expect(Date.now() - started).toBeLessThan(3_000)
      expect(res.timedOut).toBe(true)
      const pid = Number(res.stdout.match(/GRANDCHILD (\d+)/)?.[1])
      expect(pid).toBeGreaterThan(0)
      expect(isDead(pid)).toBe(true)
    },
    15_000,
  )
})
