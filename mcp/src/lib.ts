import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const MAX_CAPTURE = 1_000_000

export interface RunResult {
  code: number
  timedOut: boolean
  seconds: number
  stdout: string
  stderr: string
}

export interface RunOptions {
  cwd?: string
  timeoutMs?: number
  env?: Record<string, string>
}

export function runCommand(command: string, args: string[] = [], options: RunOptions = {}): Promise<RunResult> {
  const { cwd = repoRoot, timeoutMs = 600_000, env } = options
  const started = Date.now()
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const append = (current: string, chunk: Buffer) =>
      current.length >= MAX_CAPTURE ? current : current + chunk.toString('utf8')
    child.stdout.on('data', (chunk: Buffer) => {
      stdout = append(stdout, chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = append(stderr, chunk)
    })
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)
    child.once('error', (error) => {
      clearTimeout(timer)
      resolve({ code: 127, timedOut, seconds: elapsed(started), stdout, stderr: `${stderr}\n${error.message}` })
    })
    child.once('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, timedOut, seconds: elapsed(started), stdout, stderr })
    })
  })
}

export function runNode(script: string, args: string[] = [], options: RunOptions = {}): Promise<RunResult> {
  const scriptPath = path.isAbsolute(script) ? script : path.join(repoRoot, script)
  return runCommand(process.execPath, [scriptPath, ...args], options)
}

export function elapsed(started: number): number {
  return Math.round(((Date.now() - started) / 1000) * 10) / 10
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function truncate(value: string, max = 40_000): string {
  if (value.length <= max) return value
  return `… [truncado ${value.length - max} caracteres]\n${value.slice(value.length - max)}`
}

export function tailLines(value: string, lines = 100): string {
  return value.split(/\r?\n/).slice(-lines).join('\n')
}

export function json(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export function textResult(value: string) {
  return { content: [{ type: 'text' as const, text: value }] }
}

export interface ScriptLib {
  runDir: string
  PORTS: { server: number; proxy: number; proxyHttp: number; vite: number }
  logFileFor: (component: string) => string[]
  readPid: (name: string) => number | null
  isAlive: (pid: number | null) => boolean
  waitForPort: (port: number, timeoutMs?: number) => Promise<boolean>
  waitForPortDown: (port: number, timeoutMs?: number) => Promise<boolean>
}

let cachedLib: ScriptLib | null = null

export async function scriptLib(): Promise<ScriptLib> {
  if (cachedLib) return cachedLib
  const url = pathToFileURL(path.join(repoRoot, 'scripts', 'lib.mjs')).href
  cachedLib = (await import(url)) as unknown as ScriptLib
  return cachedLib
}

export function fileInfo(file: string): { exists: boolean; size: number; mtime: string | null } {
  try {
    const stat = fs.statSync(file)
    return { exists: true, size: stat.size, mtime: stat.mtime.toISOString() }
  } catch {
    return { exists: false, size: 0, mtime: null }
  }
}
