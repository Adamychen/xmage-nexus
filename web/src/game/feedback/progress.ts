import type { FeedbackTextFn } from './types'

export interface TargetProgress {
  selected: number
  max?: number
  min?: number
  remaining?: number
}

const SELECTED_RE = /\s*\(selected\s+(\d+)(?:\s+of\s+(\d+))?(?:,\s*min\s+(\d+))?\)/i
const MORE_RE = /\s*\((\d+)\s+more\)/i

function plain(message: string): string {
  return message.replace(/<[^>]*>/g, '')
}

export function targetProgress(message: string, chosenTargets?: string[]): TargetProgress | undefined {
  const text = plain(message)
  const chosen = chosenTargets?.length ?? 0
  const selected = SELECTED_RE.exec(text)
  if (selected) {
    const out: TargetProgress = { selected: Math.max(chosen, Number(selected[1])) }
    if (selected[2]) out.max = Number(selected[2])
    if (selected[3]) out.min = Number(selected[3])
    return out
  }
  const more = MORE_RE.exec(text)
  if (more) return { selected: chosen, remaining: Number(more[1]) }
  return chosen > 0 ? { selected: chosen } : undefined
}

export function stripTargetProgress(message: string): string {
  return message.replace(SELECTED_RE, '').replace(MORE_RE, '').trim()
}

export function targetProgressLabel(progress: TargetProgress, t: FeedbackTextFn): string {
  const base = progress.max != null
    ? t('game', 'target_progress', { selected: progress.selected, max: progress.max })
    : t('game', 'target_progress_open', { selected: progress.selected })
  return progress.min ? `${base} · ${t('game', 'target_progress_min', { min: progress.min })}` : base
}
