import { useState } from 'react'
import { useTranslation } from '../i18n'
import DialogShell from '../ui/DialogShell'
import Icon from '../ui/Icon'
import { LanguageSection, InterfaceSection, BoardSection, SoundSection, GameplayQuickSection } from '../settings/sections'
import AvatarImage from '../lobby/AvatarImage'
import AvatarPickerModal from '../lobby/AvatarPickerModal'
import CountryFlag from '../lobby/CountryFlag'
import { guessDefaultFlag } from '../lobby/defaultFlag'
import { POPULAR_FLAGS, countryName, type ServerPreset } from '../lobby/flags'
import { loadConn, saveConn, type ConnectionInfo } from '../state/persistence'
import { markSetupDone, SETUP_CONN_EVENT } from './setupFlag'
import './SetupWizard.css'

type StepId = 'language' | 'identity' | 'server' | 'board' | 'soundplay' | 'done'

const STEPS: StepId[] = ['language', 'identity', 'server', 'board', 'soundplay', 'done']

interface ServerDraft {
  preset: ServerPreset
  proxyHost: string
  proxyPort: number
  serverHost: string
  port: string
}

function initialServerDraft(): ServerDraft {
  const saved = loadConn()
  const base: ServerDraft = {
    preset: 'local',
    proxyHost: import.meta.env.VITE_DEFAULT_PROXY_HOST ?? 'localhost',
    proxyPort: Number(import.meta.env.VITE_DEFAULT_PROXY_PORT) || 8787,
    serverHost: import.meta.env.VITE_DEFAULT_SERVER_HOST ?? 'localhost',
    port: import.meta.env.VITE_DEFAULT_SERVER_PORT ?? '17171',
  }
  if (!saved) return base
  const draft: ServerDraft = {
    preset: 'custom',
    proxyHost: saved.wsHost,
    proxyPort: saved.proxyPort,
    serverHost: saved.serverHost,
    port: String(saved.port),
  }
  if (saved.serverHost === 'beta.xmage.today') draft.preset = 'official'
  else if (saved.serverHost === 'localhost' || saved.serverHost === '127.0.0.1') draft.preset = 'local'
  return draft
}

function applyPreset(p: ServerPreset, prev: ServerDraft): ServerDraft {
  if (p === 'local') return { ...prev, preset: p, proxyHost: 'localhost', proxyPort: 8787, serverHost: 'localhost', port: '17171' }
  if (p === 'official') return { ...prev, preset: p, proxyHost: 'localhost', proxyPort: 8787, serverHost: 'beta.xmage.today', port: '17171' }
  return { ...prev, preset: p }
}

export default function SetupWizard({ onClose }: { onClose: () => void }) {
  const { t, lang } = useTranslation()
  const [step, setStep] = useState(0)
  const [username, setUsername] = useState(() => loadConn()?.username ?? (import.meta.env.DEV ? 'player1' : ''))
  const [password, setPassword] = useState(() => loadConn()?.password ?? (import.meta.env.DEV ? 'password' : ''))
  const [flagName, setFlagName] = useState(() => loadConn()?.flagName ?? guessDefaultFlag())
  const [avatarId, setAvatarId] = useState(() => loadConn()?.avatarId ?? 10)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [server, setServer] = useState<ServerDraft>(initialServerDraft)

  const stepId = STEPS[step]
  const isLast = stepId === 'done'

  const buildConn = (): ConnectionInfo => ({
    wsHost: server.proxyHost.trim() || 'localhost',
    proxyPort: server.proxyPort,
    serverHost: server.serverHost.trim() || server.proxyHost.trim() || 'localhost',
    port: parseInt(server.port, 10) || 17171,
    username: username.trim(),
    password,
    flagName,
    avatarId,
  })

  const finish = () => {
    const conn = buildConn()
    saveConn(conn)
    window.dispatchEvent(new CustomEvent(SETUP_CONN_EVENT, { detail: conn }))
    markSetupDone()
    onClose()
  }

  const skip = () => {
    const conn = buildConn()
    saveConn(conn)
    window.dispatchEvent(new CustomEvent(SETUP_CONN_EVENT, { detail: conn }))
    markSetupDone()
    onClose()
  }

  const serverLabel = server.preset === 'official'
    ? t('login', 'server_official')
    : server.preset === 'local' ? t('login', 'server_local') : `${server.serverHost}:${server.port}`

  return (
    <DialogShell
      labelledBy="setup-title"
      titleId="setup-title"
      size="lg"
      testId="setup-wizard"
      legacyPanelClass="setup-wizard"
      onClose={onClose}
      kickerIcon="sparkles"
      kickerLabel={t('setup', 'title')}
      title={t('setup', stepId === 'language' ? 'welcome_title' : stepId === 'done' ? 'done_title' : `step_${stepId}` as 'step_language')}
      topRight={<span className="setup-counter" data-testid="setup-counter">{t('setup', 'step_of', { current: step + 1, total: STEPS.length })}</span>}
    >
      <div className="setup-body">
        {stepId === 'language' && (
          <>
            <p className="setup-lead">{t('setup', 'welcome_desc')}</p>
            <LanguageSection />
          </>
        )}
        {stepId === 'identity' && (
          <>
            <p className="setup-lead">{t('setup', 'step_identity_desc')}</p>
            <div className="setup-identity">
              <button
                type="button"
                className="setup-avatar"
                onClick={() => setShowAvatarPicker(true)}
                data-testid="setup-avatar"
                title={t('setup', 'avatar_change')}
              >
                <AvatarImage avatarId={avatarId} username={username} size="large" />
                <span className="setup-avatar-flag"><CountryFlag flagName={flagName} /></span>
              </button>
              <div className="setup-identity-fields">
                <label className="setup-field">
                  {t('login', 'username')}
                  <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={14} data-testid="setup-username" autoComplete="username" />
                </label>
                <label className="setup-field">
                  {t('login', 'password')}
                  <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password" />
                </label>
                <label className="setup-field">
                  {t('login', 'flag')}
                  <select value={flagName} onChange={(e) => setFlagName(e.target.value)} data-testid="setup-flag">
                    {POPULAR_FLAGS.map((f) => (
                      <option key={f.code} value={f.code}>{f.emoji} {countryName(f.code, lang)}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </>
        )}
        {stepId === 'server' && (
          <>
            <p className="setup-lead">{t('setup', 'step_server_desc')}</p>
            <div className="setup-presets" role="group" aria-label={t('login', 'server_target')}>
              {(['local', 'official', 'custom'] as ServerPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`setup-preset ${server.preset === p ? 'selected' : ''}`}
                  aria-pressed={server.preset === p}
                  onClick={() => setServer((s) => applyPreset(p, s))}
                  data-testid={`setup-preset-${p}`}
                >
                  <Icon name={p === 'local' ? 'home' : p === 'official' ? 'globe' : 'settings'} size={15} />
                  <span>{t('login', p === 'local' ? 'server_local' : p === 'official' ? 'server_official' : 'server_custom')}</span>
                </button>
              ))}
            </div>
            {server.preset === 'custom' && (
              <div className="setup-network">
                <label className="setup-field">
                  {t('login', 'proxy')}
                  <input value={server.proxyHost} onChange={(e) => setServer((s) => ({ ...s, proxyHost: e.target.value }))} data-testid="setup-proxy-host" />
                </label>
                <div className="setup-network-row">
                  <label className="setup-field">
                    {t('login', 'xmage_server')}
                    <input value={server.serverHost} onChange={(e) => setServer((s) => ({ ...s, serverHost: e.target.value }))} data-testid="setup-server-host" />
                  </label>
                  <label className="setup-field setup-field-port">
                    {t('login', 'port')}
                    <input value={server.port} onChange={(e) => setServer((s) => ({ ...s, port: e.target.value }))} type="number" data-testid="setup-port" />
                  </label>
                </div>
              </div>
            )}
          </>
        )}
        {stepId === 'board' && (
          <>
            <p className="setup-lead">{t('setup', 'step_board_desc')}</p>
            <InterfaceSection />
            <BoardSection />
          </>
        )}
        {stepId === 'soundplay' && (
          <>
            <p className="setup-lead">{t('setup', 'step_soundplay_desc')}</p>
            <SoundSection />
            <GameplayQuickSection />
          </>
        )}
        {stepId === 'done' && (
          <>
            <p className="setup-lead">{t('setup', 'done_desc')}</p>
            <ul className="setup-summary">
              <li><strong>{t('login', 'username')}:</strong> {username || '—'}</li>
              <li><strong>{t('login', 'server_target')}:</strong> {serverLabel}</li>
            </ul>
          </>
        )}
      </div>
      <div className="setup-footer">
        {!isLast
          ? <button type="button" className="settings-link-btn" onClick={skip} data-testid="setup-skip">{t('setup', 'skip')}</button>
          : <span />}
        <div className="setup-nav">
          {step > 0 && (
            <button type="button" className="setup-btn-secondary" onClick={() => setStep(step - 1)} data-testid="setup-back">
              {t('lobby', 'wizard_back')}
            </button>
          )}
          {!isLast && (
            <button type="button" className="setup-btn-primary" onClick={() => setStep(step + 1)} data-testid="setup-next">
              {t('lobby', 'wizard_next')}
            </button>
          )}
          {isLast && (
            <button type="button" className="setup-btn-primary" onClick={finish} data-testid="setup-enter">
              {t('setup', 'enter')}
            </button>
          )}
        </div>
      </div>
      {showAvatarPicker && (
        <AvatarPickerModal
          selectedAvatarId={avatarId}
          onSelect={(id) => setAvatarId(id)}
          onClose={() => setShowAvatarPicker(false)}
        />
      )}
    </DialogShell>
  )
}
