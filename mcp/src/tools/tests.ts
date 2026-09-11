import path from 'node:path'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { json, repoRoot, runCommand, runNode, textResult, tailLines, truncate } from '../lib.ts'

const TEST_LAYERS = [
  'unit',
  'coverage',
  'typecheck',
  'build',
  'java',
  'self-test',
  'human-test',
  'e2e',
  'i18n',
] as const

interface LayerResult {
  layer: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  seconds: number
}

function parseLayerResults(output: string): LayerResult[] {
  const results: LayerResult[] = []
  const regex = /^\[(PASS|FAIL|SKIP)\] (\S+) \(([\d.]+)s\)/gm
  for (const match of output.matchAll(regex)) {
    results.push({ layer: match[2], status: match[1] as LayerResult['status'], seconds: Number(match[3]) })
  }
  return results
}

function formatRun(prefix: string, res: { code: number; timedOut: boolean; seconds: number; stdout: string; stderr: string }, results?: LayerResult[]) {
  const output = `${res.stdout}\n${res.stderr}`
  const summary = output.match(/RESULTADO: (.+)/)?.[1]?.trim() ?? null
  const header = res.timedOut
    ? `${prefix}: TIMEOUT tras ${res.seconds}s`
    : summary
      ? `${prefix}: ${summary}`
      : `${prefix}: exit ${res.code} (${res.seconds}s)`
  const layerLines = results?.length
    ? results.map((row) => `${row.status} ${row.layer} (${row.seconds}s)`).join('\n')
    : ''
  const failureTail = !res.timedOut && res.code === 0 ? '' : `--- salida (cola) ---\n${truncate(tailLines(output, 120), 30_000)}`
  return [header, layerLines, failureTail].filter(Boolean).join('\n\n')
}

const VALIDATORS = [
  { name: 'gen-types', script: 'scripts/gen-types.mjs' },
  { name: 'gen-zod', script: 'scripts/gen-zod.mjs' },
  { name: 'gen-server-state', script: 'scripts/server-state-schema.mjs' },
  { name: 'gen-splash-i18n', script: 'scripts/gen-splash-i18n.mjs' },
] as const

export function registerTestTools(server: McpServer): void {
  server.registerTool(
    'mage_run_tests',
    {
      title: 'Run Mage test layers',
      description:
        'Ejecuta scripts/test.mjs (orquestador de capas). Sin layers corre TODAS las capas (incluye ' +
        'self-test/human-test/e2e, puede tardar >20 min). Con skip se excluyen capas. Devuelve el ' +
        'resultado por capa y la cola de salida si algo falla.',
      inputSchema: {
        layers: z.array(z.enum(TEST_LAYERS)).optional(),
        skip: z.array(z.enum(TEST_LAYERS)).optional(),
        timeoutSec: z.number().int().min(10).max(3_600).default(1_800),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ layers, skip, timeoutSec }) => {
      const args: string[] = [...(layers ?? [])]
      if (skip?.length) args.push(`--skip=${skip.join(',')}`)
      const res = await runNode('scripts/test.mjs', args, { timeoutMs: timeoutSec * 1_000 })
      const results = parseLayerResults(`${res.stdout}\n${res.stderr}`)
      return textResult(formatRun('test.mjs', res, results))
    },
  )

  server.registerTool(
    'mage_e2e',
    {
      title: 'Run Playwright E2E (UI)',
      description:
        'Ejecuta Playwright en web/ con spec/grep opcionales. backend=fake (default) no necesita stack ' +
        '(FixtureServer + vite propio en 5175); backend=real usa el stack (vite 5173 + proxy 8787). ' +
        'includeKnownBroken re-incluye los tests excluidos por e2e/known-broken.ts. Devuelve el resumen ' +
        '(passed/failed/skipped) y la cola de salida. Ej: spec=decks-gallery.spec.ts grep=@decks.',
      inputSchema: {
        spec: z.string().optional(),
        grep: z.string().optional(),
        backend: z.enum(['fake', 'real']).default('fake'),
        includeKnownBroken: z.boolean().default(false),
        timeoutSec: z.number().int().min(30).max(1_800).default(900),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ spec, grep, backend, includeKnownBroken, timeoutSec }) => {
      const cli = path.join(repoRoot, 'web', 'node_modules', 'playwright', 'cli.js')
      const args = ['test']
      if (spec) args.push(spec.startsWith('e2e/') ? spec : `e2e/${spec}`)
      if (grep) args.push('--grep', grep)
      const env: Record<string, string> = {}
      if (backend === 'real') env.E2E_BACKEND = 'real'
      if (includeKnownBroken) env.E2E_INCLUDE_KNOWN_BROKEN = '1'
      const res = await runCommand(process.execPath, [cli, ...args], {
        cwd: path.join(repoRoot, 'web'),
        env,
        timeoutMs: timeoutSec * 1_000,
      })
      const output = `${res.stdout}\n${res.stderr}`
      const counts = ['passed', 'failed', 'skipped', 'flaky']
        .map((label) => output.match(new RegExp(`(\\d+) ${label}`))?.[0])
        .filter(Boolean)
      const header = res.timedOut
        ? `playwright: TIMEOUT tras ${res.seconds}s`
        : counts.length
          ? `playwright: ${counts.join(', ')} (${res.seconds}s)`
          : `playwright: exit ${res.code} (${res.seconds}s)`
      return textResult(`${header}\n\n${truncate(tailLines(output, 140), 30_000)}`)
    },
  )

  server.registerTool(
    'mage_build',
    {
      title: 'Build Mage artifacts',
      description:
        'Compila artefactos. target=proxy reconstruye Mage.Proxy/target/mage-proxy-1.4.61.jar ' +
        '(detiene el proxy; luego hay que reiniciarlo con mage_stack restart proxy). target=full ' +
        'compila el fork completo (requiere ../xmage-fork).',
      inputSchema: {
        target: z.enum(['proxy', 'full']).default('proxy'),
        timeoutSec: z.number().int().min(10).max(3_600).default(1_800),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ target, timeoutSec }) => {
      const args = target === 'proxy' ? ['proxy'] : []
      const res = await runNode('scripts/build.mjs', args, { timeoutMs: timeoutSec * 1_000 })
      return textResult(formatRun(`build.mjs ${target}`, res))
    },
  )

  server.registerTool(
    'mage_record_fixture',
    {
      title: 'Record protocol fixture',
      description:
        'Graba un frame real GAME_UPDATE de una mecánica con scripts/record.mjs (drivers registrados). ' +
        'Requiere el stack corriendo (servidor + proxy). Escribe web/fixtures/recorded/<mechanic>.json.',
      inputSchema: {
        mechanic: z.string().min(1).default('all'),
        timeoutSec: z.number().int().min(10).max(900).default(300),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ mechanic, timeoutSec }) => {
      const res = await runNode('scripts/record.mjs', [mechanic], { timeoutMs: timeoutSec * 1_000 })
      return textResult(formatRun(`record.mjs ${mechanic}`, res))
    },
  )

  server.registerTool(
    'mage_validate_generated',
    {
      title: 'Validate generated files',
      description:
        'Ejecuta los validadores anti-drift de ficheros generados (gen-types, gen-zod, gen-server-state, ' +
        'gen-splash-i18n) con --validate. Falla si un generado quedó obsoleto.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      const rows: { name: string; ok: boolean; code: number; seconds: number }[] = []
      const details: string[] = []
      for (const check of VALIDATORS) {
        const res = await runNode(check.script, ['--validate'], { timeoutMs: 300_000 })
        rows.push({ name: check.name, ok: res.code === 0, code: res.code, seconds: res.seconds })
        if (res.code !== 0) {
          details.push(`===== ${check.name} =====\n${truncate(tailLines(`${res.stdout}\n${res.stderr}`, 60), 10_000)}`)
        }
      }
      const failed = rows.filter((row) => !row.ok)
      const header = failed.length ? `FALLAN: ${failed.map((row) => row.name).join(', ')}` : 'todos los generados están al día'
      return textResult(`${header}\n\n${json({ results: rows })}${details.length ? `\n\n${details.join('\n\n')}` : ''}`)
    },
  )
}
