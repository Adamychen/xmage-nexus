export type Designation = 'monstrous' | 'renowned' | 'suspected' | 'paired' | 'classlevel'

const POSITIVE_RE = /^(?:ICON_GOOD\s*)?\{this\}\s+is\s+(monstrous|renowned)\s*\.?$/i
const SUSPECT_RE = /^suspected\s*\(has menace and can't block\)\.?$/i
const PAIRED_RE = /^paired with\s+(.+?)(?:\s*\[[0-9a-fA-F]{2,8}\])?\s*\.?$/i
const CLASS_LEVEL_RE = /^class level:\s*(\d+)\s*\.?$/i

function stripTags(line: string): string {
  return line.replace(/<[^>]*>/g, '').trim()
}

/**
 * Reads the live designation hints the engine appends to `rules`
 * (`MonstrousHint` / `RenownedHint` via `ConditionHint`: `ICON_GOOD{this} is
 * monstrous` when true, `ICON_BAD{this} isn't …` when false; suspect and the
 * soulbond pair arrive as `info` lines). Returns only the ACTIVE
 * designations — the negative branches mean "no badge".
 *
 * The regexes are anchored to the full hint line so static ability text
 * ("If this creature isn't monstrous, put X +1/+1 counters…",
 * "Soulbond (You may pair …)") never matches.
 */
export function cardDesignations(rules?: readonly string[] | null): Designation[] {
  if (!rules) return []
  const out: Designation[] = []
  const push = (d: Designation) => { if (!out.includes(d)) out.push(d) }
  for (const raw of rules) {
    if (typeof raw !== 'string') continue
    const line = stripTags(raw)
    const m = POSITIVE_RE.exec(line)
    if (m) {
      push(m[1].toLowerCase() as Designation)
      continue
    }
    if (SUSPECT_RE.test(line)) push('suspected')
    else if (PAIRED_RE.test(line)) push('paired')
    else if (CLASS_LEVEL_RE.test(line)) push('classlevel')
  }
  return out
}

/**
 * Partner name from the soulbond `info` line
 * ("Paired with <font …>Name [hash]</font>"), or null.
 */
export function pairedPartnerName(rules?: readonly string[] | null): string | null {
  if (!rules) return null
  for (const raw of rules) {
    if (typeof raw !== 'string') continue
    const m = PAIRED_RE.exec(stripTags(raw))
    if (m) return m[1].trim()
  }
  return null
}

/**
 * Class level from the `ClassLevelHint` rules line ("Class level: N"), or null.
 */
export function classLevelOf(rules?: readonly string[] | null): number | null {
  if (!rules) return null
  for (const raw of rules) {
    if (typeof raw !== 'string') continue
    const m = CLASS_LEVEL_RE.exec(stripTags(raw))
    if (m) return parseInt(m[1], 10)
  }
  return null
}

/**
 * Makes raw server rules readable: `{this}` → card name (otherwise the mana
 * tokenizer renders it as a bogus mana badge) and the desktop hint markers
 * `ICON_GOOD` / `ICON_BAD` → ✓ / ✗.
 */
export function substituteCardRefs(text: string, cardName: string): string {
  if (!text) return ''
  return text
    .replace(/\{this\}/gi, cardName)
    .replace(/ICON_GOOD/g, '✓')
    .replace(/ICON_BAD/g, '✗')
}
