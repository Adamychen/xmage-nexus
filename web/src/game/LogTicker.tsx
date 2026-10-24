import { useMemo, useState } from 'react'
import { useTranslation } from '../i18n'
import { clickableProps } from '../ui/clickable'
import IconButton from '../ui/IconButton'
import { useStore } from '../state/store'
import { loadLogTickerExpanded, saveLogTickerExpanded } from '../state/persistence'
import { seatColorVar, seatIndexOf } from '../board/seatColor'
import { useFeedItems } from './useFeedItems'
import { useChromeActions } from './chromeActions'
import { tickerLines } from './logTickerModel'
import './LogTicker.css'

export default function LogTicker() {
  const { t } = useTranslation()
  const items = useFeedItems()
  const players = useStore((s) => s.game?.players)
  const chrome = useChromeActions()
  const [expanded, setExpanded] = useState(loadLogTickerExpanded)
  const lines = useMemo(() => tickerLines(items, players ?? []), [items, players])
  if (lines.length === 0) return null
  const open = chrome ? () => chrome.openPanel('log') : undefined
  const shown = expanded ? lines : lines.slice(0, 1)
  const toggle = () => {
    setExpanded(!expanded)
    saveLogTickerExpanded(!expanded)
  }
  return (
    <div
      className={`log-ticker${expanded ? ' is-expanded' : ' is-collapsed'}`}
      data-testid="log-ticker"
      data-expanded={expanded ? '1' : '0'}
      title={t('game', 'tab_log')}
      aria-label={t('game', 'tab_log')}
      onClick={open}
      {...clickableProps(open)}
    >
      {expanded && (
        <div className="log-ticker-head">
          <span>{t('game', 'log_last_actions')}</span>
          <span>{t('game', 'log_open')}</span>
        </div>
      )}
      <div className="log-ticker-body">
        <div className="log-ticker-lines">
          {shown.map((line, i) => (
            <span key={line.id} className={`log-ticker-line age-${i}`} data-testid="log-ticker-line">
              <span
                className="log-ticker-dot"
                style={{ background: line.ownerId ? seatColorVar(seatIndexOf(players, line.ownerId)) : 'var(--fg-3)' }}
              />
              <span className="log-ticker-text">
                {line.segments.map((seg, j) => (seg.strong ? <b key={j}>{seg.text}</b> : <span key={j}>{seg.text}</span>))}
              </span>
            </span>
          ))}
        </div>
        <IconButton
          icon={expanded ? 'minus' : 'plus'}
          label={expanded ? t('game', 'log_collapse') : t('game', 'log_expand')}
          variant="ghost"
          size="sm"
          className="log-ticker-toggle"
          data-testid="log-ticker-toggle"
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation()
            toggle()
          }}
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  )
}
