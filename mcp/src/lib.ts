import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { StringDecoder } from 'node:string_decoder'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const HEAD_CAPTURE = 200_000
const TAIL_CAPTURE = 800_000
const STDIO_GRACE_MS = 2_000

class OutputCapture {
  private readonly decoder = new StringDecoder('utf8')
  private head = ''
  private tail = ''
  private total = 0

  push(chunk: Buffer): void {
    this.add(this.decoder.write(chunk))
  }

  text(): string {
    this.add(this.decoder.end())
    const tail = this.tail.slice(-TAIL_CAPTURE)
    const dropped = this.total - this.head.length - tail.length
    return dropped > 0 ? `${this.head}\n…[truncated ${dropped} chars]…\n${tail}` : this.head + tail
  }

  private add(text: string): void {
    this.total += text.length
    const room = HEAD_CAPTURE - this.head.length
    if (room > 0) this.head += text.slice(0, room)
    const rest = room > 0 ? text.slice(room) : text
    if (!rest) return
    this.tail += rest
    if (this.tail.length > 2 * TAIL_CAPTURE) this.tail = this.tail.slice(-TAIL_CAPTURE)
  }
}

function killTree(child: ChildProcess): void {
  if (!child.pid) return
  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    killer.once('error', () => child.kill('SIGKILL'))
    return
  }
  try {
    process.kill(-child.pid, 'SIGKILL')
  } catch {
    child.kill('SIGKILL')
  }
}

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
      detached: process.platform !== 'win32',
      windowsHide: true,
    })
    const stdout = new OutputCapture()
    const stderr = new OutputCapture()
    let timedOut = false
    let settled = false
    let graceTimer: NodeJS.Timeout | null = null
    const finish = (code: number, extraStderr = '') => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (graceTimer) clearTimeout(graceTimer)
      child.stdout.destroy()
      child.stderr.destroy()
      resolve({ code, timedOut, seconds: elapsed(started), stdout: stdout.text(), stderr: stderr.text() + extraStderr })
    }
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
    const timer = setTimeout(() => {
      timedOut = true
      killTree(child)
    }, timeoutMs)
    child.once('error', (error) => finish(127, `\n${error.message}`))
    child.once('exit', (code) => {
      graceTimer = setTimeout(() => finish(code ?? 1), STDIO_GRACE_MS)
    })
    child.once('close', (code) => finish(code ?? 1))
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
