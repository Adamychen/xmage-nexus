import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { overlayRoot } from '../board/overlayRoot'
import PileOverlay from '../board/PileOverlay'
import { t as tStatic, useTranslation } from '../i18n'
import Icon from '../ui/Icon'
import CloseButton from '../ui/CloseButton'
import { PromptCardThumb, usePromptCardPreview } from './promptCardPreview'
import { dismissInfoWindow, infoWindowTitle, useInfoWindows, type InfoWindow } from './infoWindowState'
import './InfoWindows.css'

/** How long a reveal notice stays up while nobody points at it (BRD-66). */
export const REVEAL_TOAST_MS = 8000

interface InfoWindowsProps {
  /** Playable object ids (store): the companion's {3} and any "you may play
   *  that card" from a looked-at/revealed entry click through `onPlayCard`,
   *  mirroring the desktop CardInfoWindowDialog (which marks its cards
   *  playable and sends the card UUID on click). */
  playableIds?: Set<string>
  onPlayCard?: (id: string) => void
  targetIds?: Set<string>
  onTargetClick?: (id: string) => void
}

function needsViewer(w: InfoWindow, playableIds?: Set<string>, targetIds?: Set<string>): boolean {
  if (w.kind === 'companion') return true
  return Object.keys(w.cards).some((id) => playableIds?.has(id) === true || targetIds?.has(id) === true)
}

function cardsSig(w: InfoWindow): string {
  return Object.keys(w.cards).sort().join(',')
}

/** Looked-at / revealed / companion viewers (parity with the desktop
 *  CardInfoWindowDialog). A look or a reveal that asks nothing of the player is a
 *  notice in the top-left corner that goes away on its own (BRD-66); one with a card
 *  to play or target, and every companion, opens the full viewer. While a prompt
 *  dialog shows the looked-at/revealed cards inline (`useClaimedInfoWindows`), only
 *  companion windows float here. */
export default function InfoWindows({ playableIds, onPlayCard, targetIds, onTargetClick }: InfoWindowsProps) {
  const { windows, claimed } = useInfoWindows()
  const [expanded, setExpanded] = useState<Record<string, string>>({})
  const visible = claimed ? windows.open.filter((w) => w.kind === 'companion') : windows.open

  const viewers = visible.filter((w) => needsViewer(w, playableIds, targetIds) || expanded[w.key] === cardsSig(w))
  const toasts = visible.filter((w) => !viewers.includes(w))

  const close = (key: string) => {
    setExpanded((current) => {
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key]
      return next
    })
    dismissInfoWindow(key)
  }

  if (visible.length === 0) return null
  return (
    <>
      {toasts.length > 0 && createPortal(
        <div className="reveal-toasts" data-testid="reveal-toasts">
          {toasts.map((w) => (
            <RevealToast
              key={`${w.key}|${cardsSig(w)}`}
              window={w}
              onExpand={() => setExpanded((current) => ({ ...current, [w.key]: cardsSig(w) }))}
              onClose={() => close(w.key)}
            />
          ))}
        </div>,
        overlayRoot(),
      )}
      {viewers.map((w) => (
        <PileOverlay
          key={w.key}
          title={infoWindowTitle(tStatic, w.kind, w.name)}
          cards={w.cards}
          onClose={() => close(w.key)}
          playableIds={playableIds}
          onPlayCard={onPlayCard}
          targetIds={targetIds}
          onTargetClick={onTargetClick}
          flipIn={w.kind !== 'companion'}
          listedFromTop
        />
      ))}
    </>
  )
}

interface RevealToastProps {
  window: InfoWindow
  onExpand: () => void
  onClose: () => void
}

function RevealToast({ window: w, onExpand, onClose }: RevealToastProps) {
  const { t } = useTranslation()
  const preview = usePromptCardPreview({ fixedSide: 'right' })
  const [held, setHeld] = useState(false)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const busy = held || preview.openKey != null

  useEffect(() => {
    if (busy) return
    const timer = setTimeout(() => closeRef.current(), REVEAL_TOAST_MS)
    return () => clearTimeout(timer)
  }, [busy])

  const title = infoWindowTitle(t, w.kind, w.name)
  return (
    <section
      className="reveal-toast"
      data-testid="reveal-toast"
      data-info-window={w.kind}
      aria-label={title}
      role="status"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <header className="reveal-toast-head">
        <Icon name="eye" size={12} />
        <span className="reveal-toast-title">{title}</span>
        <CloseButton variant="plain" size="sm" className="reveal-toast-close" onClick={onClose} />
      </header>
      <div className="reveal-toast-row">
        {Object.entries(w.cards).map(([id, card]) => (
          <PromptCardThumb key={id} preview={preview} previewKey={`${w.key}:${id}`} card={card} className="reveal-toast-card" />
        ))}
      </div>
      <button type="button" className="reveal-toast-expand" onClick={onExpand}>
        {t('game', 'reveal_toast_expand')}
      </button>
      {!busy && <span className="reveal-toast-timer" style={{ animationDuration: `${REVEAL_TOAST_MS}ms` }} aria-hidden="true" />}
      {preview.preview}
    </section>
  )
}
