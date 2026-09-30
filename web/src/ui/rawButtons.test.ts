// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('..', import.meta.url))
const MAX_RAW_BUTTONS = 91

describe('raw <button> ratchet', () => {
  it('outside ui/, no new hand-rolled <button> appears (use Button, IconButton, CloseButton, ChipButton, MenuItem or Tabs)', () => {
    let count = 0
    for (const file of readdirSync(SRC, { recursive: true, encoding: 'utf8' }).map((rel) => join(SRC, rel))) {
      if (!file.endsWith('.tsx') || file.includes('.test.') || file.startsWith(join(SRC, 'ui'))) continue
      count += (readFileSync(file, 'utf8').match(/<button\b/g) ?? []).length
    }
    expect(count).toBeLessThanOrEqual(MAX_RAW_BUTTONS)
  })
})
