import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const FLAG_FONT = 'Twemoji Country Flags'

describe('flag font in every interface font stack', () => {
  it('APR-4: no stylesheet sets an interface font stack that skips the flag font', () => {
    const root = join(process.cwd(), 'src')
    const sheets = (readdirSync(root, { recursive: true }) as string[]).filter((f) => f.endsWith('.css'))
    const offenders = sheets.flatMap((file) =>
      [...readFileSync(`${root}/${file}`, 'utf8').matchAll(/font-family:\s*([^;]+);/g)]
        .map((m) => m[1])
        .filter((stack) => /Segoe UI|system-ui|-apple-system|BlinkMacSystemFont/.test(stack) && !stack.includes(FLAG_FONT))
        .map((stack) => `${file}: ${stack}`),
    )
    expect(sheets.length).toBeGreaterThan(100)
    expect(offenders).toEqual([])
  })
})
