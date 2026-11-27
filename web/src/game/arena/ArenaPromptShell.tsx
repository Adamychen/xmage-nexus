import { useEffect, useId, useState, type ReactNode } from 'react'
import Modal from '../../ui/Modal'
import { useTranslation } from '../../i18n'
import './ArenaPromptShell.css'

interface ArenaPromptShellProps {
  title: ReactNode
  instruction?: ReactNode
  aside?: ReactNode
  children: ReactNode
  footer?: ReactNode
  testId: string
  backdropClassName?: string
  dialogClassName?: string
  onEscape?: () => void
  trailing?: ReactNode
  describedBy?: string
}

export default function ArenaPromptShell({
  title,
  instruction,
  aside,
  children,
  footer,
  testId,
  backdropClassName = '',
  dialogClassName = '',
  onEscape,
  trailing,
  describedBy,
}: ArenaPromptShellProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const [peek, setPeek] = useState(false)

  // DLG-14: while the question is set aside the board takes the pointer, so its cards answer a
  // hover and the stack can be read, but no click of that pass reaches the game: a look is a look.
  // Escape comes back to the question instead of reaching the prompt's own cancel.
  useEffect(() => {
    if (!peek) return
    const swallow = (e: Event) => {
      if ((e.target as HTMLElement | null)?.closest('.arena-prompt-peek')) return
      e.preventDefault()
      e.stopPropagation()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setPeek(false)
    }
    const types = ['pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu']
    for (const type of types) window.addEventListener(type, swallow, true)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      for (const type of types) window.removeEventListener(type, swallow, true)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [peek])

  return (
    <Modal
      backdropClassName={`arena-prompt board-surface${backdropClassName ? ` ${backdropClassName}` : ''}${peek ? ' is-peek' : ''}`}
      dialogClassName={`arena-prompt-dialog${dialogClassName ? ` ${dialogClassName}` : ''}`}
      labelledBy={titleId}
      testId={testId}
      onEscape={onEscape}
      trailing={trailing}
      sectionProps={describedBy ? { 'aria-describedby': describedBy } : undefined}
    >
      <header className="arena-prompt-head">
        <h2 id={titleId}>{title}</h2>
        {instruction != null && <p>{instruction}</p>}
      </header>
      <div className="arena-prompt-stage">
        {children}
        {footer != null && <div className="arena-prompt-footer">{footer}</div>}
        {aside != null && <aside className="arena-prompt-aside">{aside}</aside>}
      </div>
      <button
        type="button"
        className="arena-prompt-peek"
        data-testid="arena-prompt-peek"
        aria-pressed={peek}
        onClick={() => setPeek((on) => !on)}
      >
        {t('dialogs', peek ? 'arena_back_to_prompt' : 'arena_view_battlefield')}
      </button>
    </Modal>
  )
}
