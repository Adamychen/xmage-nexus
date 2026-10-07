export interface AutoAnswerRule {
  id: string
  pattern: string
  answer: boolean
  /**
   * Clave exacta del servidor (`options.autoAnswerMessage` del GAME_ASK, con el
   * nombre de la fuente como "{this}"). Con ella la regla vive en XMage
   * (REQUEST_AUTO_ANSWER_TEXT_YES/NO): HumanPlayer.chooseUse contesta sin
   * preguntar al cliente. Las reglas antiguas sin clave solo las aplica el cliente.
   */
  key?: string
}

export function normalizeQuestion(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * Respaldo del cliente: el servidor ya contesta las reglas con clave, así que
 * esto solo actúa con reglas antiguas sin clave o antes de que el servidor las
 * tenga (p.ej. una pregunta que llegue antes de la sincronización de GAME_INIT).
 */
export function findAutoAnswer(rules: AutoAnswerRule[], message: string, key?: string): AutoAnswerRule | undefined {
  if (key) {
    const byKey = rules.find((rule) => rule.key === key)
    if (byKey) return byKey
  }
  const normalized = normalizeQuestion(message)
  if (!normalized) return undefined
  return rules.find((rule) => rule.pattern === normalized)
}

export function addAutoAnswer(rules: AutoAnswerRule[], message: string, answer: boolean, key?: string): AutoAnswerRule[] {
  const pattern = normalizeQuestion(message)
  if (!pattern) return rules
  const existing = rules.find((rule) => rule.pattern === pattern || (!!key && rule.key === key))
  if (existing) {
    if (existing.answer === answer && (!key || existing.key === key)) return rules
    return rules.map((rule) => (rule === existing ? { ...rule, answer, ...(key ? { key } : null) } : rule))
  }
  const rule: AutoAnswerRule = { id: `auto-${Date.now().toString(36)}-${rules.length}`, pattern, answer }
  if (key) rule.key = key
  return [...rules, rule]
}

export function removeAutoAnswer(rules: AutoAnswerRule[], id: string): AutoAnswerRule[] {
  return rules.filter((rule) => rule.id !== id)
}

export function clearAutoAnswers(): AutoAnswerRule[] {
  return []
}

/**
 * Acciones que dejan las respuestas automáticas del servidor igual que `rules`:
 * XMage solo permite borrarlas todas (REQUEST_AUTO_ANSWER_RESET_ALL), así que
 * se resetea y se vuelven a enviar las que tienen clave.
 */
export function serverAutoAnswerActions(rules: AutoAnswerRule[]): { action: string; data: string | null }[] {
  const out: { action: string; data: string | null }[] = [{ action: 'REQUEST_AUTO_ANSWER_RESET_ALL', data: null }]
  for (const rule of rules) {
    if (!rule.key) continue
    out.push({ action: rule.answer ? 'REQUEST_AUTO_ANSWER_TEXT_YES' : 'REQUEST_AUTO_ANSWER_TEXT_NO', data: rule.key })
  }
  return out
}
