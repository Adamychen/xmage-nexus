import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import Button from '../ui/Button'
import Icon, { type IconName } from '../ui/Icon'
import MenuItem from '../ui/MenuItem'
import { usePhase, useLobby } from '../state/store'
import * as cmds from '../net/commands'
import { AUTOSTART_KEY, demoGo, type DemoTarget } from './tourBus'
import { DEMO_SCENARIOS, scenarioIdFromSearch, type DemoScenarioDef } from './scenarios'
import type { TranslationSchema } from '../i18n'
import './DemoTour.css'

const AUTOSTART_DELAY_MS = 1200

interface ExploreItem {
  icon: IconName
  labelKey: keyof TranslationSchema['demo']
  hintKey: keyof TranslationSchema['demo']
  target: DemoTarget
}

const EXPLORE: ExploreItem[] = [
  { icon: 'castle', labelKey: 'explore_tables_label', hintKey: 'explore_tables_hint', target: { kind: 'tables' } },
  { icon: 'trophy', labelKey: 'explore_ranks_label', hintKey: 'explore_ranks_hint', target: { kind: 'ranking' } },
  { icon: 'layers', labelKey: 'explore_decks_label', hintKey: 'explore_decks_hint', target: { kind: 'decks' } },
  { icon: 'pencil', labelKey: 'explore_builder_label', hintKey: 'explore_builder_hint', target: { kind: 'builder' } },
  { icon: 'history', labelKey: 'explore_history_label', hintKey: 'explore_history_hint', target: { kind: 'history' } },
  { icon: 'settings', labelKey: 'explore_settings_label', hintKey: 'explore_settings_hint', target: { kind: 'settings' } },
]

function openScenario(def: DemoScenarioDef): void {
  try {
    if (def.autostart) sessionStorage.setItem(AUTOSTART_KEY, def.id)
    else sessionStorage.removeItem(AUTOSTART_KEY)
  } catch {}
  const url = new URL(window.location.href)
  url.searchParams.set('scenario', def.id)
  window.location.assign(url.toString())
}

export default function DemoTour() {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()
  const phase = usePhase()
  const lobby = useLobby()
  const active = scenarioIdFromSearch(window.location.search)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (started || (phase !== 'lobby' && phase !== 'staging') || !lobby) return
    let wanted: string | null = null
    try {
      wanted = sessionStorage.getItem(AUTOSTART_KEY)
    } catch {}
    if (wanted !== active) return
    const table = lobby.tables.find((t) => !t.tableId.startsWith('demo-table-') && t.tableState === 'READY_TO_START')
    if (!table) return
    setStarted(true)
    try {
      sessionStorage.removeItem(AUTOSTART_KEY)
    } catch {}
    window.setTimeout(() => void cmds.startMatch(table.tableId), AUTOSTART_DELAY_MS)
  }, [started, phase, lobby, active])

  const inLobby = phase === 'lobby'

  return (
    <aside className={`demo-tour ${open ? 'is-open' : ''} ${phase === 'game' ? 'in-game' : ''}`} data-testid="demo-tour" aria-label={t('demo', 'tour')}>
      {open ? (
        <div className="demo-tour-panel">
          <header className="demo-tour-head">
            <div>
              <span className="demo-tour-kicker">{t('demo', 'kicker')}</span>
              <h2>{t('demo', 'title')}</h2>
            </div>
            <Button variant="subtle" size="sm" onClick={() => setOpen(false)} aria-label={t('demo', 'close')}>
              <Icon name="x" size={14} />
            </Button>
          </header>
          <p className="demo-tour-note">{t('demo', 'note')}</p>

          <section>
            <h3>{t('demo', 'explore')}</h3>
            <ul className="demo-tour-list">
              {EXPLORE.map((item) => (
                <li key={item.labelKey}>
                  <MenuItem
                    icon={item.icon}
                    className="demo-tour-item"
                    disabled={!inLobby}
                    onClick={() => {
                      demoGo(item.target)
                      setOpen(false)
                    }}
                  >
                    <span className="demo-tour-text">
                      <strong>{t('demo', item.labelKey)}</strong>
                      <small>{t('demo', item.hintKey)}</small>
                    </span>
                  </MenuItem>
                </li>
              ))}
            </ul>
            {!inLobby && <p className="demo-tour-note">{t('demo', 'leaveGame')}</p>}
          </section>

          {(['play', 'format'] as const).map((group) => (
            <section key={group}>
              <h3>{group === 'play' ? t('demo', 'playScenario') : t('demo', 'formats')}</h3>
              <ul className="demo-tour-list">
                {DEMO_SCENARIOS.filter((s) => s.group === group).map((s) => (
                  <li key={s.id}>
                    <MenuItem icon="play" className="demo-tour-item" selected={s.id === active} onClick={() => openScenario(s)}>
                      <span className="demo-tour-text">
                        <strong>{t('demo', s.titleKey)}</strong>
                        <small>{t('demo', s.blurbKey)}</small>
                      </span>
                    </MenuItem>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <Button variant="primary" onClick={() => setOpen(true)} icon="map" data-testid="demo-tour-toggle">
          {t('demo', 'tour')}
        </Button>
      )}
    </aside>
  )
}
