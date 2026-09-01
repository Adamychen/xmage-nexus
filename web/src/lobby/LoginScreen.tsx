import { useEffect, useState } from 'react'
import { clearError, doConnect, useStore, loadConn, clearActiveGame } from '../state/store'
import CountryFlag from './CountryFlag'
import AvatarImage from './AvatarImage'
import AvatarPickerModal from './AvatarPickerModal'
import LanguageSelector from '../i18n/LanguageSelector'
import { useTranslation } from '../i18n'
import './LoginScreen.css'

function urlProxyPort(): number | null {
  const n = Number(new URLSearchParams(window.location.search).get('proxyPort'))
  return Number.isFinite(n) && n > 0 ? n : null
}

export type ServerPreset = 'local' | 'official' | 'custom'

export const POPULAR_FLAGS = [
  { code: 'world', name: '🌐 Global / Mundo' },
  { code: 'es', name: '🇪🇸 España' },
  { code: 'us', name: '🇺🇸 Estados Unidos' },
  { code: 'mx', name: '🇲🇽 México' },
  { code: 'ar', name: '🇦🇷 Argentina' },
  { code: 'cl', name: '🇨🇱 Chile' },
  { code: 'co', name: '🇨🇴 Colombia' },
  { code: 'de', name: '🇩🇪 Alemania' },
  { code: 'fr', name: '🇫🇷 Francia' },
  { code: 'gb', name: '🇬🇧 Reino Unido' },
  { code: 'it', name: '🇮🇹 Italia' },
  { code: 'jp', name: '🇯🇵 Japón' },
  { code: 'br', name: '🇧🇷 Brasil' },
  { code: 'ca', name: '🇨🇦 Canadá' },
  { code: 'au', name: '🇦🇺 Australia' },
]

export default function LoginScreen() {
  const { t, tError } = useTranslation()
  const phase = useStore((s) => s.phase)
  const error = useStore((s) => s.error)
  const [proxyHost, setProxyHost] = useState('localhost')
  const [proxyPort, setProxyPort] = useState(8787)
  const [serverHost, setServerHost] = useState('localhost')
  const [port, setPort] = useState('17171')
  const [username, setUsername] = useState('player1')
  const [password, setPassword] = useState('password')
  const [flagName, setFlagName] = useState('es')
  const [avatarId, setAvatarId] = useState(10)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [preset, setPreset] = useState<ServerPreset>('local')

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
      </div>

      <div className="login-bg-glow login-bg-glow-1" />
      <div className="login-bg-glow login-bg-glow-2" />

      <form className="login-card panel" onSubmit={submit}>
        <div className="login-header">
          <img src="/logo.jpeg" alt="XMage Nexus" className="login-logo-img" />
          <p className="subtitle">{t('login.subtitle')}</p>
        </div>

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
              <span className="preset-icon">🏠</span>
              <span>{t('login.server_local')}</span>
            </button>
            <button
              type="button"
              className={`preset-btn ${preset === 'official' ? 'active' : ''}`}
              onClick={() => handleSelectPreset('official')}
              title={t('login.server_official')}
            >
              <span className="preset-icon">🌐</span>
              <span>{t('login.server_official')}</span>
            </button>
            <button
              type="button"
              className={`preset-btn ${preset === 'custom' ? 'active' : ''}`}
              onClick={() => handleSelectPreset('custom')}
              title={t('login.server_custom')}
            >
              <span className="preset-icon">⚙️</span>
              <span>{t('login.server_custom')}</span>
            </button>
          </div>
        </div>

        {/* User Identity Section */}
        <div className="login-user-section">
          <div
            className="user-avatar-preview"
            onClick={() => setShowAvatarPicker(true)}
            title="Haz clic para elegir tu Avatar de Magic"
            style={{ cursor: 'pointer' }}
          >
            <AvatarImage avatarId={avatarId} username={username} size="large" />
            <div className="user-avatar-flag-pill">
              <CountryFlag flagName={flagName} />
            </div>
            <span className="user-avatar-badge-edit">✏️</span>
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
            <span className="error-icon">⚠️</span>
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
    </div>
  )
}
