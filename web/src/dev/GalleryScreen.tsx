import { useEffect, useMemo, useRef, useState } from 'react'
import { getState, setState } from '../state/state'
import { getGateway, setGateway } from '../net/commands'
import type { Gateway } from '../net/Gateway'
import { buildGalleryEntries, type GalleryEntry } from './galleryFixtures'
import GameScreen from '../game/GameScreen'
import LoginScreen from '../lobby/LoginScreen'
import LobbyScreen from '../lobby/LobbyScreen'
import DecksGallery from '../decks/DecksGallery'
import DraftScreen from '../game/DraftScreen'
import ConstructScreen from '../game/ConstructScreen'
import TournamentBracketModal from '../lobby/TournamentBracketModal'
import './GalleryScreen.css'

function stageOf(entry: GalleryEntry | undefined) {
  if (!entry) return null
  if (entry.screen === 'lobby') return <LobbyScreen />
  if (entry.screen === 'decks') return <DecksGallery onEdit={() => {}} />
  if (entry.screen === 'draft') return <DraftScreen />
  if (entry.screen === 'construct') return <ConstructScreen />
  if (entry.screen === 'tournament' && entry.tournamentModal) {
    return (
      <TournamentBracketModal
        table={entry.tournamentModal.table}
        view={entry.tournamentModal.view}
        loading={false}
        error={null}
        onClose={() => {}}
        onRefresh={() => {}}
      />
    )
  }
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
    const phase = active.screen === 'lobby' ? 'lobby' : active.screen ? 'game' : (active.phase ?? 'game')
    setState({
      phase,
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
      lobby: active.lobby ?? null,
      conn: active.conn ?? getState().conn,
      draft: active.draft ?? null,
      construct: active.construct ?? null,
    })
  }, [active])

  useEffect(() => {
    const saved = savedState.current
    return () => setState(saved)
  }, [])

  // Lobby/draft/construct disparan comandos "fire-and-forget" al montarse
  // (p. ej. `setBoosterLoaded` de DraftScreen) que esperan un gateway real; en
  // la galería no hay ninguno conectado y `getGateway()` lanza sincrónicamente
  // dentro de una promesa sin capturar → unhandled rejection. Un gateway
  // stub que resuelve `ok:false` evita el pageerror sin tocar esas pantallas.
  useEffect(() => {
    let prevGateway: Gateway | null = null
    try {
      prevGateway = getGateway()
    } catch {
      prevGateway = null
    }
    const stubGateway = {
      send: async () => ({ type: 'result', action: '', ok: false, error: 'gallery: sin gateway real' }),
    } as unknown as Gateway
    setGateway(stubGateway)
    return () => setGateway(prevGateway)
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
