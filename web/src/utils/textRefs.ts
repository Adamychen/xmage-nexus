export function stripTags(line: string): string {
  return line.replace(/<[^>]*>/g, '').trim()
}

export function substituteCardRefs(text: string, cardName: string): string {
  if (!text) return ''
  return text
    .replace(/\{this\}/gi, cardName)
    .replace(/ICON_GOOD/g, '✓')
    .replace(/ICON_BAD/g, '✗')
}

export function sanitizePromptText(message?: string, sourceName?: string): string {
  if (!message) return ''
  let out = typeof sourceName === 'string' && sourceName.length > 0
    ? message.replace(/\{this\}/gi, sourceName)
    : message
  out = out
    .replace(/<br\s*\/?>\s*<hintstart\s*\/?>/gi, '')
    .replace(/<hintstart\s*\/?>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/ICON_GOOD/g, '✓')
    .replace(/ICON_BAD/g, '✗')
    .replace(/ICON_REQUIRE/g, '⚠')
    .replace(/ICON_RESTRICT/g, '⊘')
  return stripTags(out).replace(/\s+/g, ' ').trim()
}
