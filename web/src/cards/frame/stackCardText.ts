import type { CardView } from '../../net/types'

export interface StackCardText {
  lines: string[]
  xLine: string | null
}

const HINT_START = /^<br\s*\/?>\s*<hintstart\s*\/?>$/i
const CHOSEN_MODE = /Chosen mode:\s*([\s\S]*?)\s*(?:<\/i>\s*<\/span>\s*)?$/i
const TARGET_ON_STACK = /Target on stack:/i
const RELATED_OBJECTS = /Related objects:/i
const MODE_LIST = /&bull|•/
const MODE_HEAD = /(?:<br\s*\/?>\s*)?(?:&bull|•)[\s\S]*$/i
const CHOOSE_TAIL = /\s*[^,.;:]*(?:&mdash;|—)\s*$/

function withoutModeList(line: string): string | null {
  if (!MODE_LIST.test(line)) return line
  const head = line.replace(MODE_HEAD, '').replace(CHOOSE_TAIL, '').trim()
  return head || null
}
const X_ICON_TEXT = /^x=(\d+)$/i

function announcedX(card: CardView): string | null {
  for (const icon of card.cardIcons ?? []) {
    if (icon?.cardIconType !== 'OTHER_COST_X') continue
    const m = X_ICON_TEXT.exec(String(icon.text ?? '').trim())
    if (m) return `X = ${m[1]}`
  }
  return null
}

export function stackCardText(card: CardView, localizedRules?: string[] | null): StackCardText {
  const rules = card.rules ?? []
  const hintAt = rules.findIndex((r) => HINT_START.test(String(r).trim()))
  const visible = hintAt >= 0 ? rules.slice(0, hintAt) : rules

  const printed: string[] = []
  const chosen: string[] = []
  for (const raw of visible) {
    const line = String(raw)
    const mode = line.includes('Chosen mode:') ? CHOSEN_MODE.exec(line) : null
    if (mode) {
      chosen.push(mode[1])
      continue
    }
    if (TARGET_ON_STACK.test(line) || RELATED_OBJECTS.test(line)) continue
    printed.push(line)
  }

  const base = localizedRules && localizedRules.length > 0 ? localizedRules : printed
  const lines = chosen.length > 0
    ? [...base.map(withoutModeList).filter((l): l is string => l !== null), ...chosen]
    : base
  return { lines, xLine: announcedX(card) }
}
