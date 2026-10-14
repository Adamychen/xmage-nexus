import { useEffect, useState } from 'react'
import Icon from '../ui/Icon'
import Button from '../ui/Button'
import { useTranslation } from '../i18n'
import { PhaseName } from './PhaseBar'
import { stepRewind, viewRewind, viewedSnapshot, type RewindState } from './rewind'
import './RewindBar.css'

export default function RewindBar({ rewind }: { rewind: RewindState }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const viewed = viewedSnapshot(rewind)
  const count = rewind.snapshots.length
  const expanded = open || viewed != null

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

  if (count < 2) return null

  const index = viewed ? rewind.snapshots.findIndex((s) => s.key === viewed.key) : count - 1

  if (!expanded) {
    return (
      <Button
        size="sm"
        variant="soft"
        className="rewind-pill"
        data-testid="rewind-open"
        title={t('game', 'rewind_open_hint')}
        onClick={() => setOpen(true)}
      >
        <Icon name="history" size={14} /> {t('game', 'rewind_open')}
      </Button>
    )
  }

  return (
    <div className={`rewind-bar${viewed ? ' is-viewing' : ''}`} data-testid="rewind-bar" role="group" aria-label={t('game', 'rewind_title')}>
      <div className="rewind-status" data-testid="rewind-status" data-viewing={viewed ? 'true' : 'false'} aria-live="polite">
        {viewed ? (
          <>
            <span className="rewind-badge">{t('game', 'rewind_not_live')}</span>
            <span>{t('game', 'rewind_viewing', { turn: viewed.turn })}</span>
            <PhaseName step={viewed.step} />
          </>
        ) : (
          <span>{t('game', 'rewind_live')}</span>
        )}
      </div>
      <div className="rewind-controls">
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
          aria-label={t('game', 'rewind_title')}
          onChange={(e) => {
            const target = rewind.snapshots[Number(e.target.value)]
            if (!target) return
            viewRewind(target.key === rewind.snapshots[count - 1].key ? null : target.key)
          }}
        />
        <Button size="sm" variant="ghost" data-testid="rewind-next" disabled={index >= count - 1} onClick={() => stepRewind(1)}>
          <Icon name="play" size={12} />
        </Button>
        <Button
          size="sm"
          variant={viewed ? 'primary' : 'ghost'}
          data-testid="rewind-live"
          onClick={() => {
            viewRewind(null)
            setOpen(false)
          }}
        >
          {viewed ? t('game', 'rewind_back_live') : t('common', 'close')}
        </Button>
      </div>
    </div>
  )
}
