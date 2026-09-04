import { useTranslation } from '../i18n'
import type { LobbyTab } from './lobbyUtils'

interface SidebarProps {
  activeTab: LobbyTab
  onTabChange: (tab: LobbyTab) => void
  tableCount: number
  onCreate: () => void
  onDownloadImages: () => void
  onOpenRoomLeaderboard: () => void
}

export default function LobbySidebar({
  activeTab, onTabChange, tableCount, onCreate, onDownloadImages, onOpenRoomLeaderboard,
}: SidebarProps) {
  const { t } = useTranslation()
  return (
    <nav className="lobby-sidebar" aria-label="Main navigation">
      <button
        type="button"
        className="sidebar-btn hero-create-btn"
        onClick={onCreate}
        title={t('lobby.nav_new')}
      >
        <span className="sidebar-btn-icon">➕</span>
        <span className="sidebar-btn-label">{t('lobby.nav_new')}</span>
      </button>

      <div className="sidebar-divider" />

      <button
        type="button"
        className={`sidebar-btn ${activeTab === 'tables' ? 'active' : ''}`}
        onClick={() => onTabChange('tables')}
        title={`${t('lobby.nav_tables')} (${tableCount})`}
      >
        <span className="sidebar-btn-icon">⚔️</span>
        <span className="sidebar-btn-label">{t('lobby.nav_tables')}{tableCount > 0 ? ` (${tableCount})` : ''}</span>
      </button>

      <button
        type="button"
        className={`sidebar-btn ${activeTab === 'decks' ? 'active' : ''}`}
        onClick={() => onTabChange('decks')}
        title={t('lobby.nav_decks')}
      >
        <span className="sidebar-btn-icon">🃏</span>
        <span className="sidebar-btn-label">{t('lobby.nav_decks')}</span>
      </button>

      <button
        type="button"
        className={`sidebar-btn ${activeTab === 'matches' ? 'active' : ''}`}
        onClick={() => onTabChange('matches')}
        title={t('lobby.nav_history')}
      >
        <span className="sidebar-btn-icon">📜</span>
        <span className="sidebar-btn-label">{t('lobby.nav_history')}</span>
      </button>

      <button
        type="button"
        className="sidebar-btn sidebar-btn-leaderboard"
        onClick={onOpenRoomLeaderboard}
        title={t('lobby.nav_ranking')}
      >
        <span className="sidebar-btn-icon">🏆</span>
        <span className="sidebar-btn-label">{t('lobby.nav_ranking')}</span>
      </button>

      <div className="sidebar-divider" />

      <button
        type="button"
        className="sidebar-btn"
        onClick={onDownloadImages}
        title={t('dialogs','download_title')}
      >
        <span className="sidebar-btn-icon">📥</span>
        <span className="sidebar-btn-label">{t('lobby.nav_downloads')}</span>
      </button>
    </nav>
  )
}

interface MobileNavProps {
  activeTab: LobbyTab
  onTabChange: (tab: LobbyTab) => void
  onCreate: () => void
  mobileChatOpen: boolean
  onToggleChat: () => void
  onCloseChat: () => void
  unreadChat: number
}

export function LobbyMobileNav({
  activeTab, onTabChange, onCreate, mobileChatOpen, onToggleChat, onCloseChat, unreadChat,
}: MobileNavProps) {
  const { t } = useTranslation()
  return (
    <nav className="lobby-mobile-bottom-nav" aria-label="Mobile navigation">
      <button type="button" className={`mobile-nav-btn ${activeTab === 'tables' ? 'active' : ''}`} onClick={() => { onTabChange('tables'); onCloseChat() }}>
        <span className="mobile-nav-icon">⚔️</span><span>{t('lobby.nav_tables')}</span>
      </button>
      <button type="button" className={`mobile-nav-btn ${activeTab === 'decks' ? 'active' : ''}`} onClick={() => { onTabChange('decks'); onCloseChat() }}>
        <span className="mobile-nav-icon">🃏</span><span>{t('lobby.nav_decks')}</span>
      </button>
      <button type="button" className="mobile-nav-btn" onClick={onCreate}>
        <span className="mobile-nav-icon">➕</span><span>{t('lobby.nav_new')}</span>
      </button>
      <button type="button" className={`mobile-nav-btn ${activeTab === 'matches' ? 'active' : ''}`} onClick={() => { onTabChange('matches'); onCloseChat() }}>
        <span className="mobile-nav-icon">📜</span><span>{t('common.loading') === '読み込み中...' ? '履歴' : t('lobby.nav_history')}</span>
      </button>
      <button type="button" className={`mobile-nav-btn ${mobileChatOpen ? 'active' : ''}`} onClick={onToggleChat}>
        <span className="mobile-nav-icon">💬</span><span>Chat{unreadChat > 0 ? ` (${unreadChat})` : ''}</span>
      </button>
    </nav>
  )
}
