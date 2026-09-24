export function targetsStackObject(stack: Record<string, unknown> | null | undefined, targetIds: readonly string[]): boolean {
  if (!stack || targetIds.length === 0) return false
  return targetIds.some((id) => id in stack)
}
