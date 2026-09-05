export interface AutoAnswerRule {
  id: string
  pattern: string
  answer: boolean
}

export function normalizeQuestion(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function findAutoAnswer(rules: AutoAnswerRule[], message: string): AutoAnswerRule | undefined {
  const normalized = normalizeQuestion(message)
  if (!normalized) return undefined
  return rules.find((rule) => rule.pattern === normalized)
}

export function addAutoAnswer(rules: AutoAnswerRule[], message: string, answer: boolean): AutoAnswerRule[] {
  const pattern = normalizeQuestion(message)
  if (!pattern) return rules
  const existing = rules.find((rule) => rule.pattern === pattern)
  if (existing) {
    if (existing.answer === answer) return rules
    return rules.map((rule) => (rule.pattern === pattern ? { ...rule, answer } : rule))
  }
  return [...rules, { id: `auto-${Date.now().toString(36)}-${rules.length}`, pattern, answer }]
}

export function removeAutoAnswer(rules: AutoAnswerRule[], id: string): AutoAnswerRule[] {
  return rules.filter((rule) => rule.id !== id)
}

export function clearAutoAnswers(): AutoAnswerRule[] {
  return []
}
