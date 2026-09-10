import { useEffect, useState } from 'react'
import { clearError, doConnect, useStore, loadConn, clearActiveGame } from '../state/store'
import CountryFlag from './CountryFlag'
import AvatarImage from './AvatarImage'
import AvatarPickerModal from './AvatarPickerModal'
import LanguageSelector from '../i18n/LanguageSelector'
import SettingsModal from '../settings/SettingsModal'
import AboutModal from '../system/AboutModal'
import { useNewsBadge } from '../system/useNewsBadge'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import { SETUP_CONN_EVENT, openSetupWizard } from '../setup/setupFlag'
import type { ConnectionInfo } from '../state/persistence'
import './LoginScreen.css'

function urlProxyPort(): number | null {
  const n = Number(new URLSearchParams(window.location.search).get('proxyPort'))
  return Number.isFinite(n) && n > 0 ? n : null
}

import { POPULAR_FLAGS, type ServerPreset } from './flags'

export default function LoginScreen() {
  const { t, tError } = useTranslation()
  const phase = useStore((s) => s.phase)
  const error = useStore((s) => s.error)
  const [proxyHost, setProxyHost] = useState(import.meta.env.VITE_DEFAULT_PROXY_HOST ?? 'localhost')
  const [proxyPort, setProxyPort] = useState(Number(import.meta.env.VITE_DEFAULT_PROXY_PORT) || 8787)
  const [serverHost, setServerHost] = useState(import.meta.env.VITE_DEFAULT_SERVER_HOST ?? 'localhost')
  const [port, setPort] = useState(import.meta.env.VITE_DEFAULT_SERVER_PORT ?? '17171')
  const [username, setUsername] = useState(import.meta.env.DEV ? 'player1' : '')
  const [password, setPassword] = useState(import.meta.env.DEV ? 'password' : '')
  const [flagName, setFlagName] = useState('es')
  const [avatarId, setAvatarId] = useState(10)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const { unseen: unseenNews, refresh: refreshNews } = useNewsBadge()
  const [preset, setPreset] = useState<ServerPreset>('local')
  const pendingDeepLink = useStore((s) => s.pendingDeepLink)

  useEffect(() => {
    const urlPort = urlProxyPort()
    const saved = loadConn()
    if (saved) {
      setProxyHost(saved.wsHost)
      setProxyPort(urlPort ?? saved.proxyPort)
      setServerHost(saved.serverHost)
      setPort(String(saved.port))
      setUsername(saved.username)
      setPassword(saved.password)
      if (saved.flagName) setFlagName(saved.flagName)
      if (saved.avatarId) setAvatarId(saved.avatarId)

      if (saved.serverHost === 'beta.xmage.today') {
        setPreset('official')
      } else if (saved.serverHost === 'localhost' || saved.serverHost === '127.0.0.1') {
        setPreset('local')
      } else {
        setPreset('custom')
      }
    } else if (urlPort !== null) {
      setProxyPort(urlPort)
    }
    const applySetupConn = (e: Event) => {
      const conn = (e as CustomEvent<ConnectionInfo>).detail
      if (!conn) return
      setProxyHost(conn.wsHost)
      setProxyPort(conn.proxyPort)
      setServerHost(conn.serverHost)
      setPort(String(conn.port))
      setUsername(conn.username)
      setPassword(conn.password)
      if (conn.flagName) setFlagName(conn.flagName)
      if (conn.avatarId) setAvatarId(conn.avatarId)
      if (conn.serverHost === 'beta.xmage.today') {
        setPreset('official')
      } else if (conn.serverHost === 'localhost' || conn.serverHost === '127.0.0.1') {
        setPreset('local')
      } else {
        setPreset('custom')
      }
    }
    window.addEventListener(SETUP_CONN_EVENT, applySetupConn)
    return () => window.removeEventListener(SETUP_CONN_EVENT, applySetupConn)
  }, [])

  const handleSelectPreset = (nextPreset: ServerPreset) => {
    setPreset(nextPreset)
    if (nextPreset === 'local') {
      setProxyHost('localhost')
      setProxyPort(8787)
      setServerHost('localhost')
      setPort('17171')
    } else if (nextPreset === 'official') {
      setProxyHost('localhost')
      setProxyPort(8787)
      setServerHost('beta.xmage.today')
      setPort('17171')
    }
  }

  const busy = phase === 'connecting'

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    clearActiveGame()
    void doConnect(
      proxyHost.trim(),
      proxyPort,
      serverHost.trim() || proxyHost.trim(),
      parseInt(port, 10) || 17171,
      username.trim(),
      password,
      flagName,
      avatarId,
    )
  }

  return (
    <div className="login-wrap">
      <div className="login-top-bar">
        <LanguageSelector showCardLangToggle={true} />
        <button
          type="button"
          className="login-settings-btn"
          onClick={() => setShowSettings(true)}
          title={t('common', 'settings')}
          aria-label={t('common', 'settings')}
          data-testid="open-settings"
        >
          <Icon name="settings" size={16} />
        </button>
        <button
          type="button"
          className="login-settings-btn"
          onClick={() => setShowAbout(true)}
          title={t('system', 'about_title')}
          aria-label={t('system', 'about_title')}
          data-testid="open-about"
        >
          <Icon name="info" size={16} />
          {unseenNews && (
            <span className="login-news-dot" data-testid="login-news-dot" aria-hidden="true">●</span>
          )}
        </button>
      </div>

      <div className="login-bg-glow login-bg-glow-1" />
      <div className="login-bg-glow login-bg-glow-2" />

      <form className="login-card panel" onSubmit={submit}>
        <div className="login-header">
          <img src="/logo.jpeg" alt="XMage Nexus" className="login-logo-img" />
          <p className="subtitle">{t('login.subtitle')}</p>
        </div>

        {pendingDeepLink && (
          <div className="login-invite-banner" data-testid="login-invite-banner">
            <span className="invite-icon"><Icon name="send" size={14} /></span>
            <span>{t('lobby', 'invite_login_hint')}</span>
          </div>
        )}

        {/* Server Preset Selector */}
        <div className="login-presets-container">
          <span className="login-presets-title">{t('login.server_target')}</span>
          <div className="login-presets-row">
            <button
              type="button"
              className={`preset-btn ${preset === 'local' ? 'active' : ''}`}
              onClick={() => handleSelectPreset('local')}
              title={t('login.server_local')}
            >
              <span className="preset-icon"><Icon name="home" size={15} /></span>
              <span>{t('login.server_local')}</span>
            </button>
            <button
              type="button"
              className={`preset-btn ${preset === 'official' ? 'active' : ''}`}
              onClick={() => handleSelectPreset('official')}
              title={t('login.server_official')}
            >
              <span className="preset-icon"><Icon name="globe" size={15} /></span>
              <span>{t('login.server_official')}</span>
            </button>
            <button
              type="button"
              className={`preset-btn ${preset === 'custom' ? 'active' : ''}`}
              onClick={() => handleSelectPreset('custom')}
              title={t('login.server_custom')}
            >
              <span className="preset-icon"><Icon name="settings" size={15} /></span>
              <span>{t('login.server_custom')}</span>
            </button>
          </div>
        </div>

        {/* User Identity Section */}
        <div className="login-user-section">
          <div
            className="user-avatar-preview"
            onClick={() => setShowAvatarPicker(true)}
            title={t('lobby', 'avatar_pick_title')}
            style={{ cursor: 'pointer' }}
          >
            <AvatarImage avatarId={avatarId} username={username} size="large" />
            <div className="user-avatar-flag-pill">
              <CountryFlag flagName={flagName} />
            </div>
            <span className="user-avatar-badge-edit"><Icon name="pencil" size={12} /></span>
          </div>
          <div className="user-inputs-col">
            <div className="user-name-and-flag-grid">
              <label className="login-field-username">
                {t('login.username')}
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={14}
                  placeholder={t('login.username')}
                  autoComplete="username"
                  required
                />
              </label>
              <label className="login-field-flag">
                {t('login.flag')}
                <select value={flagName} onChange={(e) => setFlagName(e.target.value)}>
                  {POPULAR_FLAGS.map((f) => (
                    <option key={f.code} value={f.code}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              {t('login.password')}
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                placeholder={t('login.password')}
                autoComplete="current-password"
              />
            </label>
          </div>
        </div>

        {/* Network Connection Configuration Box */}
        <details className="login-network-box">
          <summary className="login-network-header">
            <span className="network-box-title" title={t('login.network_config')}>{t('login.network_config')}</span>
            <span className="network-box-hint">{serverHost}:{port}</span>
          </summary>
          <div className="login-network-fields">
            <label className="network-field-proxy">
              {t('login.proxy')}
              <input
                value={proxyHost}
                onChange={(e) => {
                  setProxyHost(e.target.value)
                  setPreset('custom')
                }}
              />
            </label>
            <div className="network-field-row">
              <label className="network-field-host">
                {t('login.xmage_server')}
                <input
                  value={serverHost}
                  onChange={(e) => {
                    setServerHost(e.target.value)
                    setPreset('custom')
                  }}
                />
              </label>
              <label className="network-field-port">
                {t('login.port')}
                <input
                  value={port}
                  onChange={(e) => {
                    setPort(e.target.value)
                    setPreset('custom')
                  }}
                  type="number"
                />
              </label>
            </div>
          </div>
        </details>

        {error && (
          <div className="error-box">
            <span className="error-icon"><Icon name="alert" size={14} /></span>
            <span className="error-msg">{tError(error)}</span>
            <button type="button" onClick={clearError} title={t('common.close')}>
              ✕
            </button>
          </div>
        )}

        <button className="primary login-submit-btn" disabled={busy} type="submit">
          {busy ? (
            <span className="btn-connecting-wrap">
              <span className="btn-spinner" />
              <span>{t('login.connecting')}</span>
            </span>
          ) : (
            <span>{t('login.connect_btn')}</span>
          )}
        </button>
        <button type="button" className="login-firsttime" onClick={openSetupWizard} data-testid="login-open-setup">
          {t('setup', 'first_time')}
        </button>
        <div className="login-attribution">
          {t('login.attribution')}
        </div>
      </form>

      {showAvatarPicker && (
        <AvatarPickerModal
          selectedAvatarId={avatarId}
          onSelect={(id) => setAvatarId(id)}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
      {showAbout && (
        <AboutModal
          onClose={() => {
            setShowAbout(false)
            refreshNews()
          }}
        />
      )}
    </div>
  )
}
