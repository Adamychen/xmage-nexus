#!/usr/bin/env node
// Stack control WITHOUT blocking the shell: spawns node scripts/dev.mjs <args> as a detached
// process and returns at once. dev.mjs output goes to .run/dev.out.log.
// Usage: node scripts/ctl.mjs start|stop|restart|status [server|proxy|vite|all]
// Example: node scripts/ctl.mjs restart proxy

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { log, logError, parseStackCommand, runDir } from './lib.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const parsed = parseStackCommand(process.argv.slice(2))
if (!parsed.ok) {
  logError(parsed.error)
  process.exit(2)
}
const args = [parsed.action, parsed.target]

fs.mkdirSync(runDir, { recursive: true })
const nodeBin = process.execPath
const devScript = path.join(repoRoot, 'scripts', 'dev.mjs')

if (parsed.action === 'status') {
  const result = spawnSync(nodeBin, [devScript, ...args], {
    cwd: repoRoot,
    windowsHide: true,
    stdio: 'inherit',
  })
  process.exit(result.status ?? 1)
}

const out = fs.openSync(path.join(runDir, 'dev.out.log'), 'a')
const child = spawn(nodeBin, [devScript, ...args], {
  cwd: repoRoot,
  detached: true,
  windowsHide: true,
  stdio: ['ignore', out, out],
})
child.unref()
fs.closeSync(out)

const message = `dev.mjs ${args.join(' ')} launched in background (pid ${Number.isFinite(child.pid) ? child.pid : 'unknown'}) — output in .run/dev.out.log`
fs.appendFileSync(path.join(runDir, 'ctl.out.log'), `${new Date().toISOString()} ${message}\n`)
log(message)
