#!/usr/bin/env node
/**
 * gen-zod.mjs — Genera validadores zod *runtime* del contrato a partir de
 * web/schema/contract.schema.json.
 *
 * Objetivo: cerrar la deriva entre el contrato (fuente de verdad) y la
 * validación runtime de los frames. Hoy `fixtures/schema.ts` mantenía
 * `gameViewSchema` a mano, en paralelo al contrato → podía divergir sin que
 * nada lo detectara. Este generador deriva `gameViewSchema` de
 * `definitions.GameView` para un allowlist curado de campos que el cliente
 * valida en runtime.
 *
 * Anti-deriva:
 *  - Si el contrato deja de exponer un campo del allowlist → el generador
 *    FALLA (drift de protocolo detectado en tiempo de generación / CI).
 *  - Para los campos primitivos, el tipo zod (z.number()/z.string()/...) se
 *    deriva del contrato, así que un cambio de tipo se propaga al validador.
 *  - Los campos objeto/$ref se emiten con envoltorios *loose* (tolerancia a
 *    campos futuros), igual que el schema manual anterior.
 *
 * Uso: node scripts/gen-zod.mjs [--validate]
 *  - sin flag: escribe web/fixtures/schema.generated.ts
 *  - --validate: falla si el archivo existente difiere (para CI)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SCHEMA_PATH = join(ROOT, 'web/schema/contract.schema.json')
const OUT_PATH = join(ROOT, 'web/fixtures/schema.generated.ts')

const validate = process.argv.includes('--validate')

const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))
const defs = schema.definitions ?? {}

/**
 * Campos del GameView que el cliente valida en runtime (espejo de schema.ts).
 * Orden idéntico al schema manual anterior para minimizar el diff.
 */
const GAME_VIEW_FIELDS = [
  'priorityTime',
  'turn',
  'phase',
  'step',
  'activePlayerId',
  'activePlayerName',
  'priorityPlayerName',
  'players',
  'myHand',
  'stack',
  'myPlayerId',
  'canPlayObjects',
]

function gameViewProp(field) {
  const gv = defs.GameView
  if (!gv || !gv.properties || !(field in gv.properties)) {
    throw new Error(
      `[gen-zod] El contrato ya no expone GameView.${field}. Es deriva de protocolo: ` +
        `actualizá contract.schema.json y este generador a la vez.`,
    )
  }
  return gv.properties[field]
}

/** Envoltorios loose (tolerancia a campos futuros), exactos al schema anterior. */
const LOOSE = {
  players: 'z.array(z.record(z.string(), z.unknown())).nullish()',
  myHand: 'z.record(z.string(), z.unknown()).optional()',
  stack: 'z.record(z.string(), z.unknown()).nullish()',
  canPlayObjects: 'z.record(z.string(), z.unknown()).nullish()',
}

function zodExprFor(field) {
  const def = gameViewProp(field)
  // myPlayerId: ["string","null"] → unión + opcional (igual que antes)
  if (Array.isArray(def.type)) {
    const parts = def.type.filter((t) => t !== 'null')
    if (parts.length === 1 && parts[0] === 'string') {
      return 'z.union([z.string(), z.null()]).optional()'
    }
    return `z.union([${parts.map(primitiveZod).join(', ')}]).optional()`
  }
  // objeto / $ref / array → envoltorio loose (no derivable estrictamente)
  if (def.$ref || def.type === 'object' || def.type === 'array') {
    if (field in LOOSE) return LOOSE[field]
    return def.type === 'array'
      ? 'z.array(z.unknown()).nullish()'
      : 'z.record(z.string(), z.unknown()).optional()'
  }
  // primitivo estricto y requerido (derivado del contrato)
  return primitiveZod(def.type)
}

function primitiveZod(type) {
  if (type === 'string') return 'z.string()'
  if (type === 'number' || type === 'integer') return 'z.number()'
  if (type === 'boolean') return 'z.boolean()'
  return 'z.unknown()'
}

function generateGameViewSchema() {
  const body = GAME_VIEW_FIELDS.map((f) => `  ${f}: ${zodExprFor(f)},`).join('\n')
  return `export const gameViewSchema = z.object({\n${body}\n})`
}

function generate() {
  return [
    '// @generated — Do not edit manually.',
    '// Source: schema/contract.schema.json (definitions.GameView)',
    '// Generado por scripts/gen-zod.mjs. Si el contrato cambia, regenerá:',
    '//   npm run gen-zod',
    "import { z } from 'zod'",
    '',
    generateGameViewSchema(),
    '',
  ].join('\n')
}

const output = generate()

if (validate) {
  if (!existsSync(OUT_PATH)) {
    console.error('schema.generated.ts no existe — corre gen-zod.mjs sin --validate primero')
    process.exit(1)
  }
  const existing = readFileSync(OUT_PATH, 'utf8')
  if (existing.trim() !== output.trim()) {
    console.error('schema.generated.ts está desactualizado — corre: node scripts/gen-zod.mjs')
    process.exit(1)
  }
  console.log('schema.generated.ts está al día')
} else {
  mkdirSync(dirname(OUT_PATH), { recursive: true })
  writeFileSync(OUT_PATH, output)
  console.log(`Wrote ${OUT_PATH}`)
}
