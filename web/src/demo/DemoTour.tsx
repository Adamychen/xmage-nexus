import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import Icon, { type IconName } from '../ui/Icon'
import MenuItem from '../ui/MenuItem'
import { usePhase, useLobby } from '../state/store'
import * as cmds from '../net/commands'
import { AUTOSTART_KEY, demoGo, type DemoTarget } from './tourBus'
import { DEMO_SCENARIOS, scenarioIdFromSearch, type DemoScenarioDef } from './scenarios'
import './DemoTour.css'

const AUTOSTART_DELAY_MS = 1200

interface ExploreItem {
  icon: IconName
  label: string
  hint: string
  target: DemoTarget
}

const EXPLORE: ExploreItem[] = [
  { icon: 'castle', label: 'Lobby and tables', hint: 'Open tables, a live match and a Commander pod', target: { kind: 'tables' } },
  { icon: 'trophy', label: 'Ranks and ratings', hint: 'Tier ladder and the room ranking', target: { kind: 'ranking' } },
  { icon: 'layers', label: 'Deck gallery', hint: 'Your decks, formats and colours', target: { kind: 'decks' } },
  { icon: 'pencil', label: 'Deck builder and EDHREC', hint: 'Opens the Krenko deck: curve, mana, sample hand, EDHREC suggestions', target: { kind: 'builder' } },
  { icon: 'history', label: 'Match history', hint: 'Finished matches and replays', target: { kind: 'history' } },
  { icon: 'settings', label: 'Settings', hint: 'Automation presets, playmats, sounds and layout', target: { kind: 'settings' } },
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
    <aside className={`demo-tour ${open ? 'is-open' : ''} ${phase === 'game' ? 'in-game' : ''}`} data-testid="demo-tour" aria-label="Demo tour">
      {open ? (
        <div className="demo-tour-panel">
          <header className="demo-tour-head">
            <div>
              <span className="demo-tour-kicker">Interactive demo</span>
              <h2>Tour the client</h2>
            </div>
            <Button variant="subtle" size="sm" onClick={() => setOpen(false)} aria-label="Close tour">
              <Icon name="x" size={14} />
            </Button>
          </header>
          <p className="demo-tour-note">
            The real client running on scripted data. Games follow a fixed script; pick any scenario to play it.
          </p>

          <section>
            <h3>Explore</h3>
            <ul className="demo-tour-list">
              {EXPLORE.map((item) => (
                <li key={item.label}>
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
                      <strong>{item.label}</strong>
                      <small>{item.hint}</small>
                    </span>
                  </MenuItem>
                </li>
              ))}
            </ul>
            {!inLobby && <p className="demo-tour-note">Leave the game to explore the lobby.</p>}
          </section>

          {(['play', 'format'] as const).map((group) => (
            <section key={group}>
              <h3>{group === 'play' ? 'Play a scenario' : 'Formats'}</h3>
              <ul className="demo-tour-list">
                {DEMO_SCENARIOS.filter((s) => s.group === group).map((s) => (
                  <li key={s.id}>
                    <MenuItem icon="play" className="demo-tour-item" selected={s.id === active} onClick={() => openScenario(s)}>
                      <span className="demo-tour-text">
                        <strong>{s.title}</strong>
                        <small>{s.blurb}</small>
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
          Demo tour
        </Button>
      )}
    </aside>
  )
}
