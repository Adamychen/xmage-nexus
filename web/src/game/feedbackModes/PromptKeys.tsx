import type { ReactNode } from 'react'
import Icon, { type IconName } from '../../ui/Icon'
import './promptBars.css'

/** The tone of the corner's key: what pressing it does to the game (GameDock.css paints each one). */
export type PromptKeyTone = 'leave' | 'done' | 'go' | 'confirm'

interface PromptActionKeyProps {
  tone: PromptKeyTone
  label: ReactNode
  onClick: () => void
  disabled?: boolean
  /** The key that does the same thing, announced to a screen reader (Escape on a cancel). */
  keyShortcut?: string
  icon?: IconName
}

/**
 * PRM-19 / CMB-13: the big key of the corner, the one that answers the prompt. Every bar drew it by
 * hand, which is how one copy came to carry an icon the other three did not; it is one control, with
 * a tone, a label and an icon only where the answer is not already in the words.
 */
export function PromptActionKey({ tone, label, onClick, disabled, keyShortcut, icon }: PromptActionKeyProps) {
  return (
    <button
      type="button"
      className={`prompt-action-btn is-${tone}`}
      data-testid="prompt-action"
      disabled={disabled}
      onClick={onClick}
      aria-keyshortcuts={keyShortcut}
    >
      {icon && <span className="prompt-action-icon" aria-hidden="true"><Icon name={icon} size={15} /></span>}
      <span className="prompt-action-label">{label}</span>
    </button>
  )
}

/** PRM-19 / CMB-13: the smaller key above it, the way back (never the one that advances the game). */
export function PromptSecondKey({ label, onClick, disabled }: { label: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="prompt-second-btn"
      data-testid="prompt-second"
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
