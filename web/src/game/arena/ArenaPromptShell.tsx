import { useId, useState, type KeyboardEvent, type ReactNode } from 'react'
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

const PEEK_KEYS = new Set([' ', 'Enter'])

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

  const onPeekKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!PEEK_KEYS.has(e.key)) return
    e.preventDefault()
    setPeek(true)
  }

  const onPeekKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!PEEK_KEYS.has(e.key)) return
    e.preventDefault()
    setPeek(false)
  }

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
        onPointerDown={() => setPeek(true)}
        onPointerUp={() => setPeek(false)}
        onPointerLeave={() => setPeek(false)}
        onPointerCancel={() => setPeek(false)}
        onKeyDown={onPeekKeyDown}
        onKeyUp={onPeekKeyUp}
        onBlur={() => setPeek(false)}
      >
        {t('dialogs', 'arena_view_battlefield')}
      </button>
    </Modal>
  )
}
