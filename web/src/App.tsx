import { useEffect } from 'react'
import { usePhase, useStore, loadConn, doConnect } from './state/store'
import { setState } from './state/state'
import { parseDeepLink } from './lobby/deepLink'
import { setSetting } from './state/actions'
import { ZOOM_DEFAULT, stepZoom } from './appearance/zoom'
import { useTranslation } from './i18n'
import { soundManager } from './audio/soundManager'
import { loadAudioSettings, loadAppearanceSettings, applyAppearanceToDocument } from './state/persistence'
import LoginScreen from './lobby/LoginScreen'
import LobbyScreen from './lobby/LobbyScreen'
import SpectatorStagingScreen from './lobby/SpectatorStagingScreen'
import DeckIssuesDialog from './lobby/DeckIssuesDialog'
import GameScreen from './game/GameScreen'
import GameEndDialog from './game/GameEndDialog'
import DraftScreen from './game/DraftScreen'
import ConstructScreen from './game/ConstructScreen'

export default function App() {
  const { t, lang } = useTranslation()
  const phase = usePhase()
  const connecting = useStore((s) => s.connecting)
  const wsAlive = useStore((s) => s.wsAlive)
  const settings = useStore((s) => s.settings)

  useEffect(() => {
    const captureHash = () => {
      const link = parseDeepLink(window.location.hash)
      if (!link) return
      setState({ pendingDeepLink: link })
      try {
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
      } catch {}
    }
    captureHash()
    window.addEventListener('hashchange', captureHash)
    return () => window.removeEventListener('hashchange', captureHash)
  }, [])

  useEffect(() => {
    soundManager.init(loadAudioSettings())
    const saved = loadConn()
    if (saved && saved.username && phase === 'idle') {
      void doConnect(
        saved.wsHost,
        saved.proxyPort,
        saved.serverHost,
        saved.port,
        saved.username,
        saved.password,
      )
    }
  }, [])

  useEffect(() => {
    applyAppearanceToDocument({ sleeveId: settings.sleeveId, boardLayout: settings.boardLayout, uiScale: settings.uiScale, cjkBoost: settings.cjkBoost }, lang)
  }, [settings.sleeveId, settings.boardLayout, settings.uiScale, settings.cjkBoost, lang])

  useEffect(() => {
    applyAppearanceToDocument(loadAppearanceSettings(), lang)
  }, [lang])

  useEffect(() => {
    const onBeforeUnload = () => undefined
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => {
    const onZoomKeys = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        setSetting('uiScale', stepZoom(settings.uiScale, 1))
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        setSetting('uiScale', stepZoom(settings.uiScale, -1))
      } else if (e.key === '0') {
        e.preventDefault()
        setSetting('uiScale', ZOOM_DEFAULT)
      }
    }
    window.addEventListener('keydown', onZoomKeys)
    return () => window.removeEventListener('keydown', onZoomKeys)
  }, [settings.uiScale])

  const reconnecting = connecting && !wsAlive

  return (
    <>
      {reconnecting && <div className="reconnect-banner">{t('common', 'reconnecting')}</div>}
      {phase === 'lobby' ? (
        <LobbyScreen />
      ) : phase === 'spectating_pending' ? (
        <SpectatorStagingScreen />
      ) : phase === 'staging' ? (
        <SpectatorStagingScreen mode="player" />
      ) : phase === 'game' ? (
        <GameScreen />
      ) : phase === 'connecting' ? (
        <div className="login-wrap">
          <div className="login-card panel connecting-splash">
            <div className="login-header">
              <img src="/logo.jpeg" alt="XMage Nexus" className="login-logo-img" />
              <p className="subtitle">{t('common', 'connecting_server')}</p>
            </div>
            <div className="connecting-spinner" />
          </div>
        </div>
      ) : (
        <LoginScreen />
      )}
      <DraftScreen />
      <ConstructScreen />
      <GameEndDialog />
      <DeckIssuesDialog />
      <footer className="app-attribution">
        {(() => {
          const attr = t('common', 'attribution_scryfall')
          const parts = attr.split('Scryfall')
          return (
            <>
              {parts[0]}
              <a href="https://scryfall.com" target="_blank" rel="noopener noreferrer">Scryfall</a>
              {parts[1] ?? ' · Not affiliated with Wizards of the Coast'}
            </>
          )
        })()}
      </footer>
    </>
  )
}
