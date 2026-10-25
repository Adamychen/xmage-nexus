import { lazy, Suspense, useEffect, useState } from 'react'
import { usePhase, useStore, loadConn, doConnect } from './state/store'
import { linkBanner } from './system/linkBanner'
import { isGalleryHash } from './dev/galleryRoute'
import { setState } from './state/state'
import { parseDeepLink } from './lobby/deepLink'
import { setSetting, watchAppearanceStorage } from './state/actions'
import { ZOOM_DEFAULT, stepZoom } from './appearance/zoom'
import { applyFxRoot } from './board/fx'
import { useTranslation } from './i18n'
import { soundManager } from './audio/soundManager'
import { useLobbyMusic } from './audio/useLobbyMusic'
import { installUiClickSound } from './audio/uiClickSound'
import { loadAudioSettings, loadMusicSettings, loadAppearanceSettings, applyAppearanceToDocument } from './state/persistence'
import { applyAppearanceChoice } from './appearance/appearanceChoice'
import './ui/screenMotion.css'
import LoginScreen from './lobby/LoginScreen'
import ManaPips from './lobby/ManaPips'
import LobbyScreen from './lobby/LobbyScreen'
import PublicRankingScreen from './lobby/PublicRankingScreen'
import { isPublicRankingHash } from './lobby/publicRankingRoute'
import SpectatorStagingScreen from './lobby/SpectatorStagingScreen'
import DeckIssuesDialog from './lobby/DeckIssuesDialog'
import SetupWizard from './setup/SetupWizard'
import { OPEN_SETUP_EVENT } from './setup/setupFlag'
import { bootPlanFromStorage } from './setup/bootRestore'
import GameEndDialog from './game/GameEndDialog'
import EliminatedDialog from './game/EliminatedDialog'
import ConfirmHost from './ui/ConfirmHost'
import DraftScreen from './game/DraftScreen'
import ConstructScreen from './game/ConstructScreen'
import Attribution from './system/Attribution'
import LoginRetryHint from './system/LoginRetryHint'
import DemoTour from './demo/DemoTour'

// P3: galería de estados (solo dev). El import dinámico queda tras
// `import.meta.env.DEV`, así el build de producción no incluye los frames.
const GalleryScreen = import.meta.env.DEV ? lazy(() => import('./dev/GalleryScreen')) : null
const GameScreen = lazy(() => import('./game/GameScreen'))

export default function App() {
  const { t, lang } = useTranslation()
  const phase = usePhase()
  const connecting = useStore((s) => s.connecting)
  const wsAlive = useStore((s) => s.wsAlive)
  const link = useStore((s) => s.link)
  const linkAttempt = useStore((s) => s.linkAttempt)
  const loginRetry = useStore((s) => s.loginRetry)
  const settings = useStore((s) => s.settings)

  useLobbyMusic(phase !== 'game', settings.musicEnabled)

  useEffect(() => installUiClickSound(), [])

  useEffect(() => {
    applyFxRoot()
  }, [settings.effects, settings.animationSpeed])

  const [showSetup, setShowSetup] = useState(() => bootPlanFromStorage().showWizard)
  const [gallery, setGallery] = useState(() => Boolean(GalleryScreen) && isGalleryHash(window.location.hash))
  const [publicRanking, setPublicRanking] = useState(() => isPublicRankingHash(window.location.hash))

  useEffect(() => {
    if (!GalleryScreen) return
    const sync = () => setGallery(isGalleryHash(window.location.hash))
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  useEffect(() => {
    const sync = () => setPublicRanking(isPublicRankingHash(window.location.hash))
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
    // login result resumes the active game/draft from storage. Whether the wizard has
    // been completed is not part of this decision: see setup/bootRestore.ts.
    if (!bootPlanFromStorage().restore) return
    if (GalleryScreen && isGalleryHash(window.location.hash)) return
    if (isPublicRankingHash(window.location.hash)) return
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
    applyAppearanceChoice(settings.appearance)
  }, [settings.appearance])

  useEffect(() => watchAppearanceStorage(), [])

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

  useEffect(() => {
    if (phase === 'lobby' || phase === 'staging' || phase === 'spectating_pending') void import('./game/GameScreen')
  }, [phase])

  const banner = linkBanner({ connecting, wsAlive, link, linkAttempt })

  if (gallery && GalleryScreen) {
    return (
      <Suspense fallback={null}>
        <GalleryScreen />
      </Suspense>
    )
  }

  if (publicRanking) {
    return <PublicRankingScreen />
  }

  const screenKey = phase === 'lobby'
    ? 'lobby'
    : phase === 'spectating_pending' || phase === 'staging'
    ? 'match-staging'
    : phase === 'game'
    ? 'game'
    : phase === 'connecting'
    ? 'connecting'
    : 'login'

  return (
    <>
      {banner && (
        <div className="reconnect-banner" role="status" data-testid="link-banner" data-link={link}>
          {t('common', banner.key, { n: banner.n })}
        </div>
      )}
      <div key={screenKey} className={screenKey === 'game' ? 'screen-root' : 'screen-root screen-enter'}>
        {phase === 'lobby' ? (
          <LobbyScreen />
        ) : phase === 'spectating_pending' ? (
          <SpectatorStagingScreen />
        ) : phase === 'staging' ? (
          <SpectatorStagingScreen mode="player" />
        ) : phase === 'game' ? (
          <Suspense fallback={null}>
            <GameScreen />
          </Suspense>
        ) : phase === 'connecting' ? (
          <div className="login-wrap">
            <div className="login-card panel connecting-splash">
              <div className="login-header">
                <img src="/logo.jpeg" alt="XMage Nexus" className="login-logo-img" />
                <p className="subtitle">{t('common', 'connecting_server')}</p>
              </div>
              <ManaPips />
              {loginRetry && <LoginRetryHint attempt={loginRetry.attempt} max={loginRetry.max} until={loginRetry.until} />}
            </div>
          </div>
        ) : (
          <LoginScreen />
        )}
      </div>
      <DraftScreen />
      <ConstructScreen />
      <GameEndDialog />
      <EliminatedDialog />
      <ConfirmHost />
      <DeckIssuesDialog />
      {__DEMO__ && <DemoTour />}
      {showSetup && <SetupWizard onClose={() => setShowSetup(false)} />}
      {phase !== 'game' && screenKey !== 'login' && (
        <footer className="app-attribution">
          <Attribution />
        </footer>
      )}
    </>
  )
}
