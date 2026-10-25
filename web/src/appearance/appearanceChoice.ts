export const APPEARANCE_CHOICES = ['system', 'light', 'dark'] as const

export type AppearanceChoice = (typeof APPEARANCE_CHOICES)[number]

export function normalizeAppearanceChoice(value: unknown): AppearanceChoice {
  return (APPEARANCE_CHOICES as readonly unknown[]).includes(value) ? (value as AppearanceChoice) : 'dark'
}

export function applyAppearanceChoice(choice: AppearanceChoice) {
  try {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    if (choice === 'system') delete root.dataset.appearance
    else root.dataset.appearance = choice
  } catch {}
}
