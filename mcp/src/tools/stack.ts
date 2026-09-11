import fs from 'node:fs'
import path from 'node:path'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { fileInfo, json, repoRoot, runNode, scriptLib, sleep, textResult, truncate } from '../lib.ts'

const TARGETS = ['server', 'proxy', 'vite', 'all'] as const
const COMPONENTS = ['server', 'proxy', 'vite'] as const

type Target = (typeof TARGETS)[number]
type Component = (typeof COMPONENTS)[number]
type Lib = Awaited<ReturnType<typeof scriptLib>>

function componentsFor(target: Target): Component[] {
  return target === 'all' ? [...COMPONENTS] : [target]
}

function portFor(lib: Lib, component: Component): number {
  if (component === 'server') return lib.PORTS.server
  if (component === 'proxy') return lib.PORTS.proxy
  return lib.PORTS.vite
}

interface StatusRow {
  component: Component
  state: 'RUNNING' | 'stopped'
  pid: number | null
  port: number
  log: string | null
}

async function statusRows(target: Target): Promise<StatusRow[]> {
  const lib = await scriptLib()
  return componentsFor(target).map((component) => {
    const pid = lib.readPid(component)
    const running = lib.isAlive(pid)
    return {
      component,
      state: running ? ('RUNNING' as const) : ('stopped' as const),
      pid: running ? pid : null,
      port: portFor(lib, component),
      log: lib.logFileFor(component)[0] ?? null,
    }
  })
}

function summarize(rows: StatusRow[]): string {
  return rows
    .map((row) => `${row.component}: ${row.state}${row.pid ? ` (pid ${row.pid})` : ''} · puerto ${row.port}`)
    .join('\n')
}

async function converge(action: 'start' | 'stop' | 'restart', waitMs: number, before: StatusRow[]) {
  const lib = await scriptLib()
  const wantedUp = action !== 'stop'
  const started = Date.now()
  let converged = false
  while (Date.now() - started <= waitMs) {
    const checks = await Promise.all(
      before.map(async (row) => {
        const pid = lib.readPid(row.component)
        const up = await (wantedUp ? lib.waitForPort(row.port, 800) : lib.waitForPortDown(row.port, 800)).catch(
          () => false,
        )
        if (!wantedUp) return !up
        return up && pid !== null && pid !== row.pid
      }),
    )
    if (checks.every(Boolean)) {
      converged = true
      break
    }
    await sleep(700)
  }
  return { converged, waitedMs: Date.now() - started }
}

const MAX_TAIL_BYTES = 1_500_000

function readTailLines(file: string, maxLines: number, grep: string | undefined, ignoreCase: boolean): string {
  try {
    const stat = fs.statSync(file)
    const start = Math.max(0, stat.size - MAX_TAIL_BYTES)
    const length = stat.size - start
    const buffer = Buffer.alloc(length)
    const fd = fs.openSync(file, 'r')
    try {
      fs.readSync(fd, buffer, 0, length, start)
    } finally {
      fs.closeSync(fd)
    }
    let lines = buffer.toString('utf8').split(/\r?\n/)
    if (grep) {
      const regex = new RegExp(grep, ignoreCase ? 'i' : '')
      lines = lines.filter((line) => regex.test(line))
    }
    if (!lines.length) return grep ? '(sin coincidencias)' : '(sin contenido)'
    return lines.slice(-maxLines).join('\n')
  } catch (error) {
    return `(error leyendo ${file}: ${(error as Error).message})`
  }
}

export function registerStackTools(server: McpServer): void {
  server.registerTool(
    'mage_stack',
    {
      title: 'Mage dev stack',
      description:
        'Control del stack de desarrollo (servidor XMage 17171, proxy WS 8787, Vite 5173). ' +
        'status: estado de procesos + puertos. start/stop/restart delegan en scripts/ctl.mjs ' +
        '(no bloquea) y esperan hasta waitMs a que los puertos converjan. ' +
        'Un arranque en frío del servidor (escaneo de cartas) puede necesitar waitMs alto (600000).',
      inputSchema: {
        action: z.enum(['status', 'start', 'stop', 'restart']).default('status'),
        target: z.enum(TARGETS).default('all'),
        waitMs: z.number().int().min(0).max(900_000).default(120_000),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ action, target, waitMs }) => {
      const before = await statusRows(target)
      if (action === 'status') {
        return textResult(`${summarize(before)}\n\n${json({ status: before })}`)
      }
      const control = await runNode('scripts/ctl.mjs', [action, target], { timeoutMs: 30_000 })
      const { converged, waitedMs } = await converge(action, waitMs, before)
      const after = await statusRows(target)
      const hint = converged
        ? action === 'stop'
          ? 'stack detenido'
          : 'stack listo'
        : `no convergió en ${waitedMs}ms — revisa logs con mage_logs (target ${target})`
      return textResult(
        `${hint}\n\n${summarize(after)}\n\n${json({
          action,
          target,
          converged,
          waitedMs,
          control: {
            code: control.code,
            seconds: control.seconds,
            output: truncate(`${control.stdout}${control.stderr}`.trim(), 4_000),
          },
          status: after,
        })}`,
      )
    },
  )

  server.registerTool(
    'mage_logs',
    {
      title: 'Mage stack logs',
      description:
        'Cola de los logs del stack (.run/*.log con fallbacks). Filtra por regex opcional (grep) ' +
        'y devuelve las últimas lines por fichero.',
      inputSchema: {
        target: z.enum(TARGETS).default('all'),
        lines: z.number().int().min(1).max(2_000).default(60),
        grep: z.string().optional(),
        ignoreCase: z.boolean().default(true),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ target, lines, grep, ignoreCase }) => {
      const lib = await scriptLib()
      const blocks: string[] = []
      for (const component of componentsFor(target)) {
        const files = lib.logFileFor(component)
        if (!files.length) {
          blocks.push(`===== ${component} (sin logs) =====`)
          continue
        }
        for (const file of files) {
          const info = fileInfo(file)
          const tail = readTailLines(file, lines, grep, ignoreCase)
          blocks.push(
            `===== ${component} — ${path.relative(repoRoot, file)} (${info.size} bytes, ${info.mtime}) =====\n${tail}`,
          )
        }
      }
      return textResult(truncate(blocks.join('\n\n'), 40_000))
    },
  )
}
