import { reset, setSetting, useSettings } from '../state/store'
import type { ConnectionInfo } from '../state/persistence'
import type { UsersView } from '../net/types'
import AvatarImage from './AvatarImage'
import PingBadge from './PingBadge'
import RankBadge from './RankBadge'
import Icon from '../ui/Icon'
import LanguageSelector from '../i18n/LanguageSelector'
import { ZOOM_DEFAULT, zoomPercent } from '../appearance/zoom'
import { useTranslation } from '../i18n'
import type { LobbyTab } from './lobbyUtils'

export type LeaderboardTab = 'room' | 'profile' | 'tiers'

interface Props {
  conn: ConnectionInfo | null
  myUser: UsersView | undefined
  onlineCount: number
  confirmDisconnect: boolean
  onConfirmDisconnect: (v: boolean) => void
  onOpenSettings: () => void
  onOpenLeaderboard: (target?: string, tab?: LeaderboardTab) => void
  activeTab: LobbyTab
  onTabChange: (tab: LobbyTab) => void
  tableCount: number
  onCreate: () => void
  onDownloadImages: () => void
}

export default function LobbyHeader({
  conn, myUser, onlineCount, confirmDisconnect, onConfirmDisconnect,
  onOpenSettings, onOpenLeaderboard, activeTab, onTabChange,
  tableCount, onCreate, onDownloadImages,
}: Props) {
  const { t } = useTranslation()
  const settings = useSettings()

  return (
    <header className="lobby-topstrip">
      <div className="lobby-brand-col">
        <img src="/logo.jpeg" alt="XMage Nexus" className="lobby-brand-logo" />
        <div className="lobby-brand-titles">
          <h1 className="lobby-main-heading">XMage Nexus</h1>
          <span className="conn-info">
            <span className="conn-status-dot" />
            {conn?.serverHost}:{conn?.port} · {onlineCount} {t('lobby', 'online_count')}
          </span>
        </div>
      </div>

      <nav className="lobby-top-nav" aria-label="Main navigation">
        <button
          type="button"
          className="top-nav-btn top-nav-create"
          onClick={onCreate}
          title={t('lobby.nav_new')}
        >
          <Icon name="plus" size={14} />
          <span>{t('lobby.nav_new')}</span>
        </button>
        <button
          type="button"
          className={`top-nav-btn ${activeTab === 'tables' ? 'active' : ''}`}
          onClick={() => onTabChange('tables')}
          title={`${t('lobby.nav_tables')} (${tableCount})`}
        >
          <Icon name="swords" size={14} />
          <span>{t('lobby.nav_tables')}{tableCount > 0 ? ` (${tableCount})` : ''}</span>
        </button>
        <button
          type="button"
          className={`top-nav-btn ${activeTab === 'decks' ? 'active' : ''}`}
          onClick={() => onTabChange('decks')}
          title={t('lobby.nav_decks')}
        >
          <Icon name="layers" size={14} />
          <span>{t('lobby.nav_decks')}</span>
        </button>
        <button
          type="button"
          className={`top-nav-btn ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => onTabChange('matches')}
          title={t('lobby.nav_history')}
        >
          <Icon name="scrollText" size={14} />
          <span>{t('lobby.nav_history')}</span>
        </button>
        <button
          type="button"
          className="top-nav-btn"
          onClick={() => onOpenLeaderboard(conn?.username, 'room')}
          title={t('lobby.nav_ranking')}
        >
          <Icon name="trophy" size={14} />
          <span>{t('lobby.nav_ranking')}</span>
        </button>
        <button
          type="button"
          className="top-nav-btn"
          onClick={onDownloadImages}
          title={t('dialogs', 'download_title')}
        >
          <Icon name="download" size={14} />
          <span>{t('lobby.nav_downloads')}</span>
        </button>
      </nav>

      <div className="lobby-user-actions">
        <LanguageSelector compact />
        <div
          className="lobby-user-badge"
          onClick={() => onOpenLeaderboard(conn?.username, 'profile')}
          title={`${t('lobby', 'view_profile_hint')} ${conn?.username ?? ''}`}
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
        <button
          type="button"
          className="lobby-scale-readout"
          onClick={() => setSetting('uiScale', ZOOM_DEFAULT)}
          title={t('lobby', 'zoom_reset')}
        >
          {zoomPercent(settings.uiScale)}%
        </button>
        <button
          type="button"
          className="lobby-appearance-btn"
          onClick={onOpenSettings}
          title={t('common', 'settings')}
          data-testid="open-settings"
        >
          <Icon name="settings" size={16} />
        </button>

        {confirmDisconnect ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#ff9999', fontWeight: 700 }}>{t('lobby', 'disconnect_confirm')}</span>
            <button className="lobby-disconnect-btn" onClick={reset} style={{ padding: '4px 8px', fontSize: 11 }}>{t('common', 'yes')}</button>
            <button onClick={() => onConfirmDisconnect(false)} style={{ padding: '4px 8px', fontSize: 11, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#c4cae8', cursor: 'pointer' }}>{t('common', 'no')}</button>
          </div>
        ) : (
          <button className="lobby-disconnect-btn" onClick={() => onConfirmDisconnect(true)} title={t('lobby', 'disconnect')}>
            <Icon name="logout" size={15} />
          </button>
        )}
      </div>
    </header>
  )
}
