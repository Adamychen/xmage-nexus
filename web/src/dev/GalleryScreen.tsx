import { useEffect, useMemo, useRef, useState } from 'react'
import { getState, setState } from '../state/state'
import { buildGalleryEntries, type GalleryEntry } from './galleryFixtures'
import GameScreen from '../game/GameScreen'
import LoginScreen from '../lobby/LoginScreen'
import './GalleryScreen.css'

function stageOf(entry: GalleryEntry | undefined) {
  if (!entry) return null
  if (entry.phase === 'idle') return <LoginScreen />
  return <GameScreen />
}

export default function GalleryScreen() {
  const entries = useMemo(() => buildGalleryEntries(), [])
  const [activeId, setActiveId] = useState(() => entries[0]?.id ?? '')
  const active = entries.find((e) => e.id === activeId) ?? entries[0]
  const savedState = useRef(getState())

  useEffect(() => {
    if (!active) return
    setState({
      phase: active.phase ?? 'game',
      game: active.game ?? null,
      gameId: active.gameId ?? null,
      feedback: active.feedback ?? null,
      playableIds: active.playableIds ?? [],
      combat: null,
      gameEnd: null,
      userRequest: null,
      viewer: null,
      sideboardScreen: null,
      rollbackDialogOpen: false,
      playerMenu: null,
      settings: { ...getState().settings, autoPass: false },
    })
  }, [active])

  useEffect(() => {
    const saved = savedState.current
    return () => setState(saved)
  }, [])

  const groups = [...new Set(entries.map((e) => e.group))]

  return (
    <div className="gallery" data-gallery>
      <aside className="gallery-sidebar">
        <div className="gallery-head">
          <strong>Galería de estados</strong>
          <span>{entries.length} estados · dev</span>
        </div>
        <nav className="gallery-nav">
          {groups.map((group) => (
            <section key={group} className="gallery-group">
              <h3>{group}</h3>
              {entries
                .filter((e) => e.group === group)
                .map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    data-gallery-entry={entry.id}
                    data-gallery-active={entry.id === active?.id ? '1' : undefined}
                    title={entry.description ?? entry.label}
                    onClick={() => setActiveId(entry.id)}
                  >
                    {entry.label}
                  </button>
                ))}
            </section>
          ))}
        </nav>
        <p className="gallery-hint">
          Solo disponible en dev. Cambia el estado del store; al salir se restaura el estado previo.
        </p>
      </aside>
      <main className="gallery-stage" data-gallery-stage={active?.id ?? ''}>
        {stageOf(active)}
      </main>
    </div>
  )
}
