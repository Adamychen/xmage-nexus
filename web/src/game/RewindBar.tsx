import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Icon from '../ui/Icon'
import Button from '../ui/Button'
import IconButton from '../ui/IconButton'
import { useTranslation } from '../i18n'
import { PhaseName } from './PhaseBar'
import { stepRewind, viewRewind, viewedSnapshot, type RewindState } from './rewind'
import { leaveReplay, saveReplay } from './replayFile'
import './RewindBar.css'

export default function RewindBar({ rewind }: { rewind: RewindState }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const dockRef = useRef<HTMLDivElement>(null)
  const viewed = viewedSnapshot(rewind)
  const count = rewind.snapshots.length
  const expanded = open || viewed != null || rewind.replay

  useEffect(() => {
    if (viewed == null) return
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        viewRewind(null)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        stepRewind(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        stepRewind(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewed])

  useEffect(() => {
    if (!open || viewed != null || rewind.replay) return
    const onPointerDown = (e: PointerEvent) => {
      if (!dockRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [open, viewed, rewind.replay])

  if (count < 2 && !rewind.replay) return null

  const index = viewed ? rewind.snapshots.findIndex((s) => s.key === viewed.key) : count - 1

  const toggle = () => {
    if (viewed) {
      viewRewind(null)
      setOpen(false)
    } else {
      setOpen((o) => !o)
    }
  }

  return (
    <div className="rewind-dock" ref={dockRef}>
      {!rewind.replay && (
        <IconButton
          icon="undo"
          label={t('game', 'rewind_open')}
          title={t('game', 'rewind_open_hint')}
          variant="subtle"
          size="md"
          className={`rewind-toggle${viewed ? ' is-viewing' : ''}${expanded ? ' is-open' : ''}`}
          data-testid="rewind-open"
          aria-expanded={expanded}
          onClick={toggle}
        />
      )}
      {expanded && (
        <div className={`rewind-bar${viewed ? ' is-viewing' : ''}`} data-testid="rewind-bar" role="group" aria-label={t('game', 'rewind_title')}>
          <div className="rewind-status" data-testid="rewind-status" data-viewing={viewed ? 'true' : 'false'} aria-live="polite">
            {viewed ? (
              <>
                <span className="rewind-badge">{rewind.replay ? t('game', 'replay_badge') : t('game', 'rewind_not_live')}</span>
                <span className="rewind-viewing">{t('game', 'rewind_viewing', { turn: viewed.turn })}</span>
                <PhaseName step={viewed.step} />
              </>
            ) : (
              <span className="rewind-viewing">{t('game', 'rewind_live')}</span>
            )}
          </div>
          <div className="rewind-track">
            <Button size="sm" variant="ghost" data-testid="rewind-prev" disabled={index <= 0} onClick={() => stepRewind(-1)}>
              <Icon name="undo" size={12} />
            </Button>
            <input
              type="range"
              className="rewind-slider"
              data-testid="rewind-slider"
              min={0}
              max={count - 1}
              value={index}
              style={{ '--rewind-p': count > 1 ? String(index / (count - 1)) : '1' } as CSSProperties}
              aria-label={t('game', 'rewind_title')}
              onChange={(e) => {
                const target = rewind.snapshots[Number(e.target.value)]
                if (!target) return
                viewRewind(target.key === rewind.snapshots[count - 1].key && !rewind.replay ? null : target.key)
              }}
            />
            <Button size="sm" variant="ghost" data-testid="rewind-next" disabled={index >= count - 1} onClick={() => stepRewind(1)}>
              <Icon name="play" size={12} />
            </Button>
          </div>
          <div className={`rewind-actions${rewind.replay ? ' is-single' : ''}`}>
            {!rewind.replay && (
              <Button size="sm" variant="ghost" className="rewind-action" data-testid="rewind-save" title={t('game', 'rewind_save_hint')} onClick={() => void saveReplay()}>
                <Icon name="download" size={12} /> {t('game', 'rewind_save')}
              </Button>
            )}
            {rewind.replay ? (
              <Button size="sm" variant="primary" className="rewind-action" data-testid="replay-close" onClick={leaveReplay}>
                {t('game', 'replay_close')}
              </Button>
            ) : (
              <Button
                size="sm"
                variant={viewed ? 'primary' : 'ghost'}
                className="rewind-action"
                data-testid="rewind-live"
                onClick={() => {
                  viewRewind(null)
                  setOpen(false)
                }}
              >
                {viewed ? t('game', 'rewind_back_live') : t('common', 'close')}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
