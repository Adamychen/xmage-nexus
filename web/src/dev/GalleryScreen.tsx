import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { getState, setState } from '../state/state'
import { getGateway, setGateway } from '../net/commands'
import type { Gateway } from '../net/Gateway'
import { buildGalleryEntries, type GalleryEntry } from './galleryFixtures'
import { getLanguage, setLanguage, t } from '../i18n'
import GameScreen from '../game/GameScreen'
import GameEndDialog from '../game/GameEndDialog'
import HelpWikiModal from '../game/HelpWikiModal'
import LoginScreen from '../lobby/LoginScreen'
import LobbyScreen from '../lobby/LobbyScreen'
import CreateTableDialog from '../lobby/CreateTableDialog'
import SpectatorStagingScreen from '../lobby/SpectatorStagingScreen'
import DecksGallery from '../decks/DecksGallery'
import DraftScreen from '../game/DraftScreen'
import ConstructScreen from '../game/ConstructScreen'
import TournamentBracketModal from '../lobby/TournamentBracketModal'
import SettingsModal from '../settings/SettingsModal'
import AppearanceSettingsModal from '../appearance/AppearanceSettingsModal'
import AboutModal from '../system/AboutModal'
import SetupWizard from '../setup/SetupWizard'
import './GalleryScreen.css'

// Layout reproducible: la escala de las zonas del tablero se mide contra la
// fila de estado (que contiene la mano rival, dimensionada a su vez por esa
// escala) y el ciclo tiene varios puntos fijos entre sesiones. La galería fija
// el alto de esa fila (`galleryPinnedStatusH`) para que los baselines de
// regresión visual sean deterministas; el resto de la app mide en vivo.
const GALLERY_STATUS_H = '116'
if (typeof document !== 'undefined') {
  document.documentElement.dataset.galleryStatusH = GALLERY_STATUS_H
}

function stageOf(entry: GalleryEntry | undefined) {
  if (!entry) return null
  if (entry.screen === 'lobby') return <LobbyScreen />
  if (entry.screen === 'decks') return <DecksGallery onEdit={() => {}} />
  if (entry.screen === 'draft') return <DraftScreen />
  if (entry.screen === 'construct') return <ConstructScreen />
  if (entry.screen === 'setup') return <SetupWizard onClose={() => {}} />
  if (entry.screen === 'wizard') return <CreateTableDialog onClose={() => {}} />
  if (entry.screen === 'staging') return <SpectatorStagingScreen table={entry.stagingTable ?? null} mode={entry.stagingMode ?? 'player'} />
  if (entry.screen === 'settings') return <SettingsModal onClose={() => {}} />
  if (entry.screen === 'appearance') return <AppearanceSettingsModal onClose={() => {}} />
  if (entry.screen === 'about') return <AboutModal onClose={() => {}} />
  if (entry.screen === 'help') return <HelpWikiModal onClose={() => {}} />
  if (entry.screen === 'gameend') {
    return (
      <>
        <GameScreen />
        <GameEndDialog />
      </>
    )
  }
  if (entry.screen === 'tournament' && entry.tournamentModal) {
    return (
      <TournamentBracketModal
        table={entry.tournamentModal.table}
        view={entry.tournamentModal.view}
        loading={entry.tournamentModal.loading ?? false}
        error={entry.tournamentModal.error ?? null}
        onClose={() => {}}
        onRefresh={() => {}}
      />
    )
  }
  if (entry.phase === 'idle' || entry.phase === 'connecting') return <LoginScreen />
  return <GameScreen />
}

/** Aplica la siembra de localStorage del estado y devuelve la restauración (si la hay). */
function seedStorage(seed: Record<string, string> | undefined): Record<string, string | null> | null {
  if (!seed) return null
  const previous: Record<string, string | null> = {}
  for (const [key, value] of Object.entries(seed)) {
    previous[key] = localStorage.getItem(key)
    localStorage.setItem(key, value)
  }
  return previous
}

function restoreStorage(previous: Record<string, string | null> | null): void {
  if (!previous) return
  for (const [key, value] of Object.entries(previous)) {
    if (value == null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  }
}

export default function GalleryScreen() {
  const entries = useMemo(() => buildGalleryEntries(), [])
  const [activeId, setActiveId] = useState(() => entries[0]?.id ?? '')
  const active = entries.find((e) => e.id === activeId) ?? entries[0]
  const savedState = useRef(getState())
  const savedLang = useRef(getLanguage())
  // El wizard de crear mesa lee localStorage al montar: la siembra va en el
  // click (antes del montaje) y se restaura al cambiar de estado o salir.
  const seededStorage = useRef<Record<string, string | null> | null>(null)

  const selectEntry = (id: string) => {
    restoreStorage(seededStorage.current)
    seededStorage.current = seedStorage(entries.find((e) => e.id === id)?.storageSeed)
    setActiveId(id)
  }

  useEffect(() => {
    if (!active) return
    const base = savedState.current
    const phase = active.phase ?? (active.screen === 'lobby' ? 'lobby' : 'game')
    setState({
      phase,
      game: active.game ?? null,
      gameId: active.gameId ?? null,
      feedback: active.feedback ?? null,
      playableIds: active.playableIds ?? [],
      combat: null,
      gameEnd: active.gameEnd ?? null,
      userRequest: null,
      viewer: null,
      sideboardScreen: null,
      rollbackDialogOpen: false,
      playerMenu: null,
      tournament: active.tournament ?? null,
      error: active.error ?? null,
      chatMessages: active.chatMessages ?? [],
      lastDraftEventAt: active.lastDraftEventAt ?? null,
      settings: {
        ...base.settings,
        autoPass: false,
        boardLayout: active.boardLayout ?? base.settings.boardLayout,
        uiScale: active.uiScale ?? base.settings.uiScale,
        cjkBoost: active.cjkBoost ?? base.settings.cjkBoost,
      },
      lobby: active.lobby ?? null,
      conn: active.conn ?? base.conn,
      draft: active.draft ?? null,
      construct: active.construct ?? null,
      ...(active.myDeck !== undefined ? { myDeck: active.myDeck } : null),
    })
    const lang = active.lang ?? savedLang.current
    if (lang !== getLanguage()) setLanguage(lang)
  }, [active])

  useEffect(() => {
    // Re-aplicado en el efecto (no solo al importar el módulo): StrictMode
    // monta/desmonta efectos y el cleanup lo borraría.
    document.documentElement.dataset.galleryStatusH = GALLERY_STATUS_H
    return () => {
      delete document.documentElement.dataset.galleryStatusH
    }
  }, [])

  useEffect(() => {
    const saved = savedState.current
    const lang = savedLang.current
    return () => {
      restoreStorage(seededStorage.current)
      setState(saved)
      if (lang !== getLanguage()) setLanguage(lang)
    }
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
                    onClick={() => selectEntry(entry.id)}
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
        {active?.connecting && <div className="reconnect-banner">{t('common', 'reconnecting')}</div>}
        <Fragment key={active?.id ?? ''}>{stageOf(active)}</Fragment>
      </main>
    </div>
  )
}
