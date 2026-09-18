import { stripTags } from '../utils/textRefs'

export type Designation = 'monstrous' | 'renowned' | 'suspected' | 'paired' | 'classlevel'
  | 'casesolved' | 'harnessed' | 'evidence' | 'prepared' | 'protector'

const POSITIVE_RE = /^(?:ICON_GOOD\s*)?\{this\}\s+is\s+(monstrous|renowned)\s*\.?$/i
const SUSPECT_RE = /^suspected\s*\(has menace and can't block\)\.?$/i
const PAIRED_RE = /^paired with\s+(.+?)(?:\s*\[[0-9a-fA-F]{2,8}\])?\s*\.?$/i
const CLASS_LEVEL_RE = /^class level:\s*(\d+)\s*\.?$/i
const CASE_SOLVED_RE = /^(?:ICON_GOOD\s*)?case is solved\s*\.?$/i
const HARNESSED_RE = /^(?:ICON_GOOD\s*)?\{this\}\s+is\s+harnessed\s*\.?$/i
const EVIDENCE_RE = /^(?!ICON_BAD\s*)(?:ICON_GOOD\s*)?evidence was used(?:\s*\(need:\s*(\d+),\s*can collect:\s*(\d+)\))?\s*\.?$/i
const PREPARED_RE = /^prepared\s*\.?$/i
const PROTECTOR_RE = /^protected by\s+(.+?)(?:\s*\[[0-9a-fA-F]{2,8}\])?\s*\.?$/i

/**
 * Reads the live designation hints the engine appends to `rules`
 * (`MonstrousHint` / `RenownedHint` / `HarnessedHint` / `CaseSolvedHint` /
 * `EvidenceHint` via `ConditionHint`: `ICON_GOOD{this} is monstrous` when true,
 * `ICON_BAD{this} isn't …` when false; suspect, prepared and protector arrive
 * as `info` lines). Returns only the ACTIVE designations — the negative
 * branches mean "no badge".
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
    else if (CASE_SOLVED_RE.test(line)) push('casesolved')
    else if (HARNESSED_RE.test(line)) push('harnessed')
    else if (EVIDENCE_RE.test(line)) push('evidence')
    else if (PREPARED_RE.test(line)) push('prepared')
    else if (PROTECTOR_RE.test(line)) push('protector')
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
 * Evidence amounts from the `EvidenceHint` rules line
 * ("Evidence was used (need: N, can collect: M)"), or null.
 */
export function evidenceCounts(rules?: readonly string[] | null): { need: number; canCollect: number } | null {
  if (!rules) return null
  for (const raw of rules) {
    if (typeof raw !== 'string') continue
    const m = EVIDENCE_RE.exec(stripTags(raw))
    if (m && m[1] != null && m[2] != null) {
      return { need: parseInt(m[1], 10), canCollect: parseInt(m[2], 10) }
    }
  }
  return null
}

/**
 * Protector name from the `protector` info line ("Protected by Name"), or null.
 */
export function protectorName(rules?: readonly string[] | null): string | null {
  if (!rules) return null
  for (const raw of rules) {
    if (typeof raw !== 'string') continue
    const m = PROTECTOR_RE.exec(stripTags(raw))
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
export { substituteCardRefs } from '../utils/textRefs'
