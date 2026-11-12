import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, FocusEvent, KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from 'react'
import type { CardView, PermanentView } from '../net/types'
import CardSlot from '../board/CardSlot'
import FloatingCardPreview from '../board/FloatingCardPreview'
import { hiddenFaceDownName } from '../cards/cardImages'
import { setState } from '../state/store'
import IconButton from '../ui/IconButton'
import { useTranslation } from '../i18n'
import './promptCardPreview.css'

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

export interface PromptCardHoverBindings {
  onPointerEnter: (e: PointerEvent<HTMLElement>) => void
  onPointerLeave: (e: PointerEvent<HTMLElement>) => void
  onFocus: (e: FocusEvent<HTMLElement>) => void
  onBlur: (e: FocusEvent<HTMLElement>) => void
}

export interface PromptCardZoomBindings {
  [PREVIEW_ATTR]: string
  onPointerDown: (e: PointerEvent<HTMLElement>) => void
  onClick: () => void
  onContextMenu: (e: MouseEvent<HTMLElement>) => void
}

export interface PromptCardPreview {
  /** Spread on the element that shows `card`; `key` must be unique among the bound elements. */
  bind: (key: string, card: PreviewCard) => PromptCardPreviewBindings
  /**
   * For a card that answers the prompt when clicked: spread on the element wrapping it. A mouse
   * pointing at it, or keyboard focus inside it, shows the preview; a touch does not, so a tap
   * keeps choosing the card. Pair it with a `PromptCardZoomButton` inside the same wrapper.
   */
  hover: (key: string, card: PreviewCard) => PromptCardHoverBindings
  /** For the zoom button inside a `hover` wrapper; see `PromptCardZoomButton`. */
  zoom: (key: string, card: PreviewCard) => PromptCardZoomBindings
  /** The floating preview: render it once inside the dialog (e.g. `DialogShell`'s `trailing`). */
  preview: ReactNode
  /** Key of the element whose preview is open, if any. */
  openKey: string | null
}

export function inspectable(card: PreviewCard): boolean {
  return !card.faceDown || Boolean(hiddenFaceDownName(card as CardView))
}

export function openCardInspector(card: PreviewCard): void {
  if (inspectable(card)) setState({ inspectedCard: card })
}

/** A focus that came from the keyboard; a tap or click on a button focuses it too, without the ring. */
function keyboardFocus(target: EventTarget): boolean {
  try {
    return (target as Element).matches(':focus-visible')
  } catch {
    return true
  }
}

/**
 * Card preview for cards shown inside a prompt dialog, with the same three ways in as the board:
 * pointing at the card (or focusing it) shows the floating preview, a touch press shows it without
 * answering the prompt and keeps it until the next touch press, and a right click, a long press or
 * Enter opens the card inspector. The element bound to a card must not answer the prompt itself,
 * so looking at a card never chooses it.
 */
export function usePromptCardPreview(options: { fixedSide?: 'left' | 'right' | 'auto' } = {}): PromptCardPreview {
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

  const hover = useCallback((key: string, card: PreviewCard): PromptCardHoverBindings => ({
    onPointerEnter: (e) => {
      if (e.pointerType === 'touch' || stateRef.current?.pinned) return
      setPreview({ key, card, rect: e.currentTarget.getBoundingClientRect(), pinned: false })
    },
    onPointerLeave: (e) => {
      if (e.pointerType === 'touch' || stateRef.current?.pinned) return
      setPreview((current) => (current?.key === key ? null : current))
    },
    onFocus: (e) => {
      if (stateRef.current?.pinned || !keyboardFocus(e.target)) return
      setPreview({ key, card, rect: e.currentTarget.getBoundingClientRect(), pinned: false })
    },
    onBlur: (e) => {
      if (stateRef.current?.pinned) return
      // Focus moving between the card and its zoom button stays on the same card.
      if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return
      setPreview((current) => (current?.key === key ? null : current))
    },
  }), [])

  // A touch press on a zoom button is followed by a click; that click must not open the inspector.
  const touchPressRef = useRef(false)
  const zoom = useCallback((key: string, card: PreviewCard): PromptCardZoomBindings => ({
    [PREVIEW_ATTR]: key,
    onPointerDown: (e) => {
      touchPressRef.current = e.pointerType === 'touch'
      if (!touchPressRef.current) return
      const anchor = e.currentTarget.parentElement ?? e.currentTarget
      const rect = anchor.getBoundingClientRect()
      setPreview((current) => (current?.key === key && current.pinned ? null : { key, card, rect, pinned: true }))
    },
    onClick: () => {
      if (touchPressRef.current) {
        touchPressRef.current = false
        return
      }
      setPreview(null)
      openCardInspector(card)
    },
    onContextMenu: (e) => {
      e.preventDefault()
      e.stopPropagation()
      setPreview(null)
      openCardInspector(card)
    },
  }), [])

  const preview = (
    <FloatingCardPreview card={state?.card ?? null} anchorRect={state?.rect ?? null} boardRect={null} fixedSide={options.fixedSide} inModal />
  )
  return { bind, hover, zoom, preview, openKey: state?.key ?? null }
}

interface PromptCardZoomButtonProps {
  preview: PromptCardPreview
  /** Same key as the `hover` wrapper it sits in. */
  previewKey: string
  card: PreviewCard
  className?: string
}

/**
 * The way to look at a card that answers the prompt when clicked, without choosing it. It sits
 * inside the card's `hover` wrapper, which is its anchor: a touch shows the preview and keeps it
 * until the next touch, a click, Enter or Space opens the card inspector. It is a sibling of the
 * element that chooses the card, never inside it.
 */
export function PromptCardZoomButton({ preview, previewKey, card, className }: PromptCardZoomButtonProps) {
  const { t } = useTranslation()
  const name = card.displayName ?? card.name
  return (
    <IconButton
      icon="zoomIn"
      size="sm"
      variant="ghost"
      round
      label={t('dialogs', 'card_zoom', { name })}
      className={['prompt-card-zoom', className ?? ''].filter(Boolean).join(' ')}
      {...preview.zoom(previewKey, card)}
    />
  )
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
  /** Class of the card slot inside the thumb. */
  slotClassName?: string
}

/**
 * A card thumbnail inside a prompt that only shows the card (hover, focus or touch) and opens the
 * inspector (right click, long press, Enter); it never answers the prompt. The slot gets its own
 * id so the board's flight registry never mistakes the thumbnail for the card's last position.
 */
export function PromptCardThumb({ preview, previewKey, card, label, title, className, slotClassName }: PromptCardThumbProps) {
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
      <CardSlot card={card} cardId={`prompt-thumb:${previewKey}`} className={slotClassName} />
    </span>
  )
}

interface PromptCardZoomableProps {
  preview: PromptCardPreview
  /** Unique among the cards bound to the same preview. */
  previewKey: string
  card: PreviewCard
  className?: string
  style?: CSSProperties
  /** The element that chooses or plays the card; it keeps its own click. */
  children: ReactNode
}

/**
 * Wraps a card that answers the prompt when clicked: pointing at it or focusing it with the keyboard
 * shows the preview, and a zoom button in its corner shows it on a touch screen or opens the
 * inspector, so looking at the card never chooses it. A card nobody can look at (face down and
 * unknown) gets no zoom button.
 */
export function PromptCardZoomable({ preview, previewKey, card, className, style, children }: PromptCardZoomableProps) {
  return (
    <div
      className={['prompt-card-zoomable', preview.openKey === previewKey ? 'is-previewing' : '', className ?? ''].filter(Boolean).join(' ')}
      style={style}
      {...preview.hover(previewKey, card)}
    >
      {children}
      {inspectable(card) && <PromptCardZoomButton preview={preview} previewKey={previewKey} card={card} />}
    </div>
  )
}
