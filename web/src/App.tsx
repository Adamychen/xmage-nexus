import { lazy, Suspense, useEffect, useState } from 'react'
import { usePhase, useStore, loadConn, doConnect } from './state/store'
import { linkBanner } from './system/linkBanner'
import { isGalleryHash } from './dev/galleryRoute'
import { setState } from './state/state'
import { parseDeepLink } from './lobby/deepLink'
import { setSetting } from './state/actions'
import { ZOOM_DEFAULT, stepZoom } from './appearance/zoom'
import { useTranslation } from './i18n'
import { soundManager } from './audio/soundManager'
import { loadAudioSettings, loadMusicSettings, loadAppearanceSettings, applyAppearanceToDocument } from './state/persistence'
import LoginScreen from './lobby/LoginScreen'
import LobbyScreen from './lobby/LobbyScreen'
import SpectatorStagingScreen from './lobby/SpectatorStagingScreen'
import DeckIssuesDialog from './lobby/DeckIssuesDialog'
import SetupWizard from './setup/SetupWizard'
import { isSetupDone, OPEN_SETUP_EVENT } from './setup/setupFlag'
import GameScreen from './game/GameScreen'
import GameEndDialog from './game/GameEndDialog'
import ConfirmHost from './ui/ConfirmHost'
import DraftScreen from './game/DraftScreen'
import ConstructScreen from './game/ConstructScreen'
import Attribution from './system/Attribution'
import LoginRetryHint from './system/LoginRetryHint'

// P3: galería de estados (solo dev). El import dinámico queda tras
// `import.meta.env.DEV`, así el build de producción no incluye los frames.
const GalleryScreen = import.meta.env.DEV ? lazy(() => import('./dev/GalleryScreen')) : null

export default function App() {
  const { t, lang } = useTranslation()
  const phase = usePhase()
  const connecting = useStore((s) => s.connecting)
  const wsAlive = useStore((s) => s.wsAlive)
  const link = useStore((s) => s.link)
  const linkAttempt = useStore((s) => s.linkAttempt)
  const loginRetry = useStore((s) => s.loginRetry)
  const settings = useStore((s) => s.settings)
  const [showSetup, setShowSetup] = useState(() => !isSetupDone())
  const [gallery, setGallery] = useState(() => Boolean(GalleryScreen) && isGalleryHash(window.location.hash))

  useEffect(() => {
    if (!GalleryScreen) return
    const sync = () => setGallery(isGalleryHash(window.location.hash))
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    const open = () => setShowSetup(true)
    window.addEventListener(OPEN_SETUP_EVENT, open)
    return () => window.removeEventListener(OPEN_SETUP_EVENT, open)
  }, [])

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
    const music = loadMusicSettings()
    soundManager.setMusicVolume(music.musicEnabled ? music.musicVolume : 0)
    // Reload: re-login with the saved session (logout clears it via reset()). The
    // login result resumes the active game/draft from storage.
    if (!isSetupDone()) return
    if (GalleryScreen && isGalleryHash(window.location.hash)) return
    const saved = loadConn()
    if (saved?.username && phase === 'idle') {
      void doConnect(saved.wsHost, saved.proxyPort, saved.serverHost, saved.port, saved.username, saved.password, saved.flagName, saved.avatarId)
    }
  }, [])

  useEffect(() => {
    applyAppearanceToDocument({ sleeveId: settings.sleeveId, boardLayout: settings.boardLayout, uiScale: settings.uiScale, cjkBoost: settings.cjkBoost, transparentDialogs: settings.transparentDialogs }, lang)
  }, [settings.sleeveId, settings.boardLayout, settings.uiScale, settings.cjkBoost, settings.transparentDialogs, lang])

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

  const banner = linkBanner({ connecting, wsAlive, link, linkAttempt })

  if (gallery && GalleryScreen) {
    return (
      <Suspense fallback={null}>
        <GalleryScreen />
      </Suspense>
    )
  }

  return (
    <>
      {banner && (
        <div className="reconnect-banner" role="status" data-testid="link-banner" data-link={link}>
          {t('common', banner.key, { n: banner.n })}
        </div>
      )}
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
            {loginRetry && <LoginRetryHint attempt={loginRetry.attempt} max={loginRetry.max} until={loginRetry.until} />}
          </div>
        </div>
      ) : (
        <LoginScreen />
      )}
      <DraftScreen />
      <ConstructScreen />
      <GameEndDialog />
      <ConfirmHost />
      <DeckIssuesDialog />
      {showSetup && <SetupWizard onClose={() => setShowSetup(false)} />}
      {phase !== 'game' && (
        <footer className="app-attribution">
          <Attribution />
        </footer>
      )}
    </>
  )
}
