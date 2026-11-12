import { useCallback, useEffect, useRef, useState } from 'react'
import type { FocusEvent, KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react'
import type { CardView, PermanentView } from '../net/types'
import CardSlot from '../board/CardSlot'
import FloatingCardPreview from '../board/FloatingCardPreview'
import { hiddenFaceDownName } from '../cards/cardImages'
import { setState } from '../state/store'

type PreviewCard = CardView | PermanentView

interface PreviewState {
  key: string
  card: PreviewCard
  rect: DOMRect
  /** Opened by a touch press: stays until the next touch press (ACC-9). */
  pinned: boolean
}

/** Marks the elements that own a preview, so a touch on them is not an "outside" touch. */
const PREVIEW_ATTR = 'data-prompt-preview'

export interface PromptCardPreviewBindings {
  [PREVIEW_ATTR]: string
  onMouseEnter: (e: MouseEvent<HTMLElement>) => void
  onMouseLeave: () => void
  onPointerDown: (e: PointerEvent<HTMLElement>) => void
  onFocus: (e: FocusEvent<HTMLElement>) => void
  onBlur: () => void
  onContextMenu: (e: MouseEvent<HTMLElement>) => void
  onKeyDown: (e: KeyboardEvent<HTMLElement>) => void
}

export interface PromptCardPreview {
  /** Spread on the element that shows `card`; `key` must be unique among the bound elements. */
  bind: (key: string, card: PreviewCard) => PromptCardPreviewBindings
  /** The floating preview: render it once inside the dialog (e.g. `DialogShell`'s `trailing`). */
  preview: ReactNode
  /** Key of the element whose preview is open, if any. */
  openKey: string | null
}

function inspectable(card: PreviewCard): boolean {
  return !card.faceDown || Boolean(hiddenFaceDownName(card as CardView))
}

export function openCardInspector(card: PreviewCard): void {
  if (inspectable(card)) setState({ inspectedCard: card })
}

/**
 * Card preview for cards shown inside a prompt dialog, with the same three ways in as the board:
 * pointing at the card (or focusing it) shows the floating preview, a touch press shows it without
 * answering the prompt and keeps it until the next touch press, and a right click, a long press or
 * Enter opens the card inspector. The element bound to a card must not answer the prompt itself,
 * so looking at a card never chooses it.
 */
export function usePromptCardPreview(): PromptCardPreview {
  const [state, setPreview] = useState<PreviewState | null>(null)
  const stateRef = useRef<PreviewState | null>(null)
  stateRef.current = state

  // A touch anywhere else releases a pinned preview; a real mouse movement unpins it so the
  // next mouse-leave closes it as usual.
  useEffect(() => {
    if (!state?.pinned) return
    const onPointerDown = (e: globalThis.PointerEvent) => {
      if (e.pointerType !== 'touch') return
      const owner = (e.target as Element | null)?.closest?.(`[${PREVIEW_ATTR}]`)
      if (!owner) setPreview(null)
    }
    const onPointerMove = (e: globalThis.PointerEvent) => {
      if (e.pointerType === 'mouse') setPreview((current) => (current ? { ...current, pinned: false } : current))
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('pointermove', onPointerMove, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointermove', onPointerMove, true)
    }
  }, [state?.pinned])

  const bind = useCallback((key: string, card: PreviewCard): PromptCardPreviewBindings => ({
    [PREVIEW_ATTR]: key,
    onMouseEnter: (e) => {
      if (stateRef.current?.pinned) return
      setPreview({ key, card, rect: e.currentTarget.getBoundingClientRect(), pinned: false })
    },
    onMouseLeave: () => {
      if (stateRef.current?.pinned) return
      setPreview((current) => (current?.key === key ? null : current))
    },
    onPointerDown: (e) => {
      if (e.pointerType !== 'touch') return
      const rect = e.currentTarget.getBoundingClientRect()
      setPreview((current) => (current?.key === key && current.pinned ? null : { key, card, rect, pinned: true }))
    },
    onFocus: (e) => {
      if (stateRef.current?.pinned) return
      setPreview({ key, card, rect: e.currentTarget.getBoundingClientRect(), pinned: false })
    },
    onBlur: () => {
      if (stateRef.current?.pinned) return
      setPreview((current) => (current?.key === key ? null : current))
    },
    onContextMenu: (e) => {
      e.preventDefault()
      e.stopPropagation()
      setPreview(null)
      openCardInspector(card)
    },
    onKeyDown: (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      setPreview(null)
      openCardInspector(card)
    },
  }), [])

  const preview = (
    <FloatingCardPreview card={state?.card ?? null} anchorRect={state?.rect ?? null} boardRect={null} inModal />
  )
  return { bind, preview, openKey: state?.key ?? null }
}

interface PromptCardThumbProps {
  preview: PromptCardPreview
  /** Unique among the thumbs bound to the same preview. */
  previewKey: string
  card: PreviewCard
  /** Accessible name; the card name when absent. */
  label?: string
  title?: string
  className?: string
}

/**
 * A card thumbnail inside a prompt that only shows the card (hover, focus or touch) and opens the
 * inspector (right click, long press, Enter); it never answers the prompt. The slot gets its own
 * id so the board's flight registry never mistakes the thumbnail for the card's last position.
 */
export function PromptCardThumb({ preview, previewKey, card, label, title, className }: PromptCardThumbProps) {
  const name = label ?? card.displayName ?? card.name
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={name}
      title={title}
      className={['prompt-card-thumb', preview.openKey === previewKey ? 'is-previewing' : '', className ?? ''].filter(Boolean).join(' ')}
      {...preview.bind(previewKey, card)}
    >
      <CardSlot card={card} cardId={`prompt-thumb:${previewKey}`} />
    </span>
  )
}
