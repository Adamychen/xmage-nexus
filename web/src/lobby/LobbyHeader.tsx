import { reset, setSetting } from '../state/store'
import { useSettings } from '../state/selectors'
import type { ConnectionInfo } from '../state/persistence'
import type { UiScale } from '../state/persistence'
import type { UsersView } from '../net/types'
import AvatarImage from './AvatarImage'
import PingBadge from './PingBadge'
import RankBadge from './RankBadge'
import LanguageSelector from '../i18n/LanguageSelector'
import { useTranslation } from '../i18n'
import { useFullscreen } from '../utils/fullscreen'

export type LeaderboardTab = 'room' | 'profile' | 'tiers'

interface Props {
  conn: ConnectionInfo | null
  myUser: UsersView | undefined
  onlineCount: number
  unreadChat: number
  confirmDisconnect: boolean
  onConfirmDisconnect: (v: boolean) => void
  onToggleMobileChat: () => void
  onOpenAppearance: () => void
  onOpenLeaderboard: (target?: string, tab?: LeaderboardTab) => void
}

export default function LobbyHeader({
  conn, myUser, onlineCount, unreadChat, confirmDisconnect, onConfirmDisconnect,
  onToggleMobileChat, onOpenAppearance, onOpenLeaderboard,
}: Props) {
  const { t } = useTranslation()
  const settings = useSettings()
  const [isFullscreenActive, toggleFullscreen] = useFullscreen()

  return (
    <header className="lobby-topstrip">
      <div className="lobby-brand-col">
        <img src="/logo.jpeg" alt="XMage Nexus" className="lobby-brand-logo" />
        <div className="lobby-brand-titles">
          <h1 className="lobby-main-heading">XMage Nexus</h1>
          <span className="conn-info">
            <span className="conn-status-dot" />
            {conn?.serverHost}:{conn?.port} · {onlineCount} {t('lobby','online_count')}
          </span>
        </div>
      </div>

      <div className="lobby-user-actions">
        <LanguageSelector showCardLangToggle={true} />

        <div className="lobby-scale-quick" role="group" aria-label="UI scale">
          {( [1, 1.15, 1.5] as UiScale[]).map((s) => (
            <button
              key={s}
              type="button"
              className={settings.uiScale === s ? 'active' : ''}
              onClick={() => setSetting('uiScale', s)}
              title={`${Math.round(s*100)}%`}
              aria-pressed={settings.uiScale === s}
            >
              {s === 1 ? 'Aa' : s === 1.15 ? 'A+' : 'A++'}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="lobby-mobile-chat-toggle"
          onClick={onToggleMobileChat}
          aria-label={t('lobby','global_chat')}
          data-testid="toggle-mobile-chat"
        >
          💬
          {unreadChat > 0 && <span className="aside-unread-badge">{unreadChat > 9 ? '9+' : unreadChat}</span>}
        </button>

        <button
          type="button"
          className="lobby-appearance-btn"
          onClick={onOpenAppearance}
          title={t('lobby', 'appearance_title')}
          data-testid="open-appearance-settings"
        >
          🎨
        </button>

        <button
          type="button"
          className={`lobby-fullscreen-btn ${isFullscreenActive ? 'active' : ''}`}
          onClick={toggleFullscreen}
          title={isFullscreenActive ? t('game','exit_fullscreen') : t('game','enter_fullscreen')}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={isFullscreenActive ? 'M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3' : 'M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3'} />
          </svg>
        </button>

        <div
          className="lobby-user-badge"
          onClick={() => onOpenLeaderboard(conn?.username, 'profile')}
          title={`${t('lobby','view_profile_hint')} ${conn?.username ?? ''}`}
        >
          <AvatarImage avatarId={conn?.avatarId ?? 10} username={conn?.username} size="medium" />
          <div className="lobby-user-col">
            <div className="lobby-user-name-line" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="lobby-username">{conn?.username}</span>
              {myUser?.infoPing && <PingBadge infoPing={myUser.infoPing} compact />}
            </div>
            <RankBadge elo={myUser?.constructedRating ?? 1500} compact />
          </div>
        </div>
        {confirmDisconnect ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#ff9999', fontWeight: 700 }}>{t('lobby', 'disconnect_confirm')}</span>
            <button className="lobby-disconnect-btn" onClick={reset} style={{ padding: '4px 8px', fontSize: 11 }}>{t('common', 'yes')}</button>
            <button onClick={() => onConfirmDisconnect(false)} style={{ padding: '4px 8px', fontSize: 11, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#c4cae8', cursor: 'pointer' }}>{t('common', 'no')}</button>
          </div>
        ) : (
          <button className="lobby-disconnect-btn" onClick={() => onConfirmDisconnect(true)} title={t('lobby', 'disconnect')}>
            🚪
          </button>
        )}
      </div>
    </header>
  )
}
