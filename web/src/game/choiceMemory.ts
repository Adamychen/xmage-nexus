export interface ChoiceMemoryRule {
  id: string
  pattern: string
  value: string
}

const MAX_RULES = 50

export function normalizeChoiceQuestion(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function findChoiceMemory(rules: ChoiceMemoryRule[], message: string): ChoiceMemoryRule | undefined {
  const normalized = normalizeChoiceQuestion(message)
  if (!normalized) return undefined
  return rules.find((rule) => rule.pattern === normalized)
}

export function addChoiceMemory(rules: ChoiceMemoryRule[], message: string, value: string): ChoiceMemoryRule[] {
  const pattern = normalizeChoiceQuestion(message)
  if (!pattern) return rules
  const existing = rules.find((rule) => rule.pattern === pattern)
  if (existing) {
    if (existing.value === value) return rules
    return rules.map((rule) => (rule.pattern === pattern ? { ...rule, value } : rule))
  }
  const next = [...rules, { id: `choice-${Date.now().toString(36)}-${rules.length}`, pattern, value }]
  return next.length > MAX_RULES ? next.slice(next.length - MAX_RULES) : next
}

export function removeChoiceMemory(rules: ChoiceMemoryRule[], id: string): ChoiceMemoryRule[] {
  return rules.filter((rule) => rule.id !== id)
}

export function clearChoiceMemory(): ChoiceMemoryRule[] {
  return []
}
