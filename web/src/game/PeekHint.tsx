import { useLayoutEffect, useRef, useState } from 'react'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'

export function peekHintTop(hint: DOMRect, gap: number, obstacles: DOMRect[], panel: DOMRect | null, viewportHeight: number): number {
  let top = gap
  for (const r of obstacles) {
    if (r.width === 0 || r.right <= hint.left || r.left >= hint.right) continue
    if (r.top > viewportHeight / 2) continue
    top = Math.max(top, r.bottom + gap)
  }
  const overlapsPanel = panel && panel.right > hint.left && panel.left < hint.right && panel.top < top + hint.height + gap
  if (overlapsPanel) top = Math.max(gap, panel.top - hint.height - gap)
  return top
}

export default function PeekHint() {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const [top, setTop] = useState<number | null>(null)

  useLayoutEffect(() => {
    const place = () => {
      const hint = ref.current
      if (!hint) return
      const gap = parseFloat(getComputedStyle(hint).right) || 0
      const obstacles = Array.from(document.querySelectorAll('.resource-bar.opp'), (el) => el.getBoundingClientRect())
      const panel = hint.parentElement?.querySelector('.dlg-panel')?.getBoundingClientRect() ?? null
      setTop(peekHintTop(hint.getBoundingClientRect(), gap, obstacles, panel, window.innerHeight))
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [])

  return (
    <div
      ref={ref}
      className="card-grid-peek-hint"
      data-testid="card-grid-peek-hint"
      role="note"
      style={top === null ? undefined : { top }}
    >
      <Icon name="eye" size={14} />
      <span className="card-grid-peek-hint-idle">{t('dialogs','cardgrid_peek_hint')}</span>
      <span className="card-grid-peek-hint-active">{t('dialogs','cardgrid_peek_release')}</span>
    </div>
  )
}
