#!/usr/bin/env node
// Lanza @playwright/mcp reutilizando el Chromium ya instalado por web/
// (playwright-core), sin descargar una segunda copia del navegador.
// Uso: node scripts/playwright-mcp.mjs [args extra para @playwright/mcp]
// Registrado en opencode.json como MCP local "playwright".

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MCP_VERSION = process.env.PLAYWRIGHT_MCP_VERSION || '0.0.80'

function browserExecutable() {
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) return process.env.PLAYWRIGHT_EXECUTABLE_PATH
  try {
    const require = createRequire(import.meta.url)
    const { chromium } = require(path.join(repoRoot, 'web', 'node_modules', 'playwright-core'))
    return chromium.executablePath()
  } catch {
    return ''
  }
}

const executable = browserExecutable()
const args = ['-y', `@playwright/mcp@${MCP_VERSION}`]
if (!process.argv.includes('--output-dir')) {
  const outputDir = path.join(repoRoot, '.run', 'playwright-mcp')
  fs.mkdirSync(outputDir, { recursive: true })
  args.push('--output-dir', outputDir)
}
if (executable && fs.existsSync(executable)) args.push('--executable-path', executable)
args.push(...process.argv.slice(2))

const useShell = process.platform === 'win32'
const child = spawn('npx', args, { cwd: repoRoot, stdio: 'inherit', shell: useShell })
child.on('error', (error) => {
  console.error(`[playwright-mcp] no se pudo lanzar npx: ${error.message}`)
  process.exit(1)
})
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
