import { useLayoutEffect, useRef, useState } from 'react'
import { reset } from '../state/store'
import IconButton from '../ui/IconButton'
import DropdownMenu from '../ui/DropdownMenu'
import MenuItem from '../ui/MenuItem'
import Button from '../ui/Button'
import type { ConnectionInfo } from '../state/persistence'
import type { UsersView } from '../net/types'
import AvatarImage from './AvatarImage'
import PingBadge from './PingBadge'
import RankBadge from './RankBadge'
import Icon from '../ui/Icon'
import { useTranslation, plural } from '../i18n'
import type { LobbyTab } from './lobbyUtils'

interface Props {
  conn: ConnectionInfo | null
  myUser: UsersView | undefined
  onlineCount: number
  confirmDisconnect: boolean
  onConfirmDisconnect: (v: boolean) => void
  onOpenSettings: () => void
  onOpenReport: () => void
  onOpenProfile: (username: string) => void
  activeTab: LobbyTab
  onTabChange: (tab: LobbyTab) => void
  tableCount: number
  activeTableCount?: number
  onGoToActiveTable?: () => void
  onCreate: () => void
  onCreateTournament: () => void
  onOpenAbout: () => void
  onOpenWiki: () => void
  hasNews: boolean
}

export default function LobbyHeader({
  conn, myUser, onlineCount, confirmDisconnect, onConfirmDisconnect,
  onOpenSettings, onOpenReport, onOpenProfile, activeTab, onTabChange,
  tableCount, activeTableCount = 0, onGoToActiveTable, onCreate, onCreateTournament, onOpenAbout, onOpenWiki, hasNews,
}: Props) {
  const { t, lang } = useTranslation()
  const navRef = useRef<HTMLElement>(null)
  const [indicator, setIndicator] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  // The sliding pill tracks the active tab button. It is measured after layout
  // (labels change width with counts and language) and re-measured when the nav
  // itself resizes (wrapping at narrow widths).
  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const measure = () => {
      const active = nav.querySelector<HTMLElement>('.top-nav-btn.active')
      if (!active) {
        setIndicator(null)
        return
      }
      setIndicator({ x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight })
    }
    measure()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    ro?.observe(nav)
    void document.fonts?.ready.then(measure)
    return () => ro?.disconnect()
  }, [activeTab, tableCount, activeTableCount, lang])

  return (
    <header className="lobby-topstrip">
      <div className="lobby-brand-col">
        <img src="/logo.jpeg" alt="XMage Nexus" className="lobby-brand-logo" />
        <div className="lobby-brand-titles">
          <h1 className="lobby-main-heading">XMage Nexus</h1>
          <span className="conn-info">
            <span className="conn-status-dot" />
            {conn?.serverHost}:{conn?.port} · {onlineCount} {plural('lobby', 'online_count', onlineCount)}
          </span>
        </div>
      </div>

      <nav className="lobby-top-nav" aria-label="Main navigation" ref={navRef}>
        {indicator && (
          <span
            className="top-nav-indicator"
            aria-hidden="true"
            style={{ transform: `translate(${indicator.x}px, ${indicator.y}px)`, width: indicator.w, height: indicator.h }}
            data-testid="top-nav-indicator"
          />
        )}
        <button
          type="button"
          className="top-nav-btn top-nav-create"
          onClick={onCreate}
          title={t('lobby.nav_new')}
        >
          <Icon name="plus" size={14} />
          <span>{t('lobby.nav_new')}</span>
        </button>
        <Button
          variant="ghost"
          className="top-nav-btn"
          icon="trophy"
          onClick={onCreateTournament}
          title={t('lobby.nav_new_tournament')}
        >
          <span>{t('lobby.nav_new_tournament')}</span>
        </Button>
        {activeTableCount > 0 && (
          <button
            type="button"
            className="top-nav-btn top-nav-active-table"
            onClick={onGoToActiveTable}
            title={t('lobby', 'active_table_header_hint')}
          >
            <span className="top-nav-active-pulse" />
            <Icon name="chair" size={14} />
            <span>{t('lobby', 'active_table_header_btn')}{activeTableCount > 1 ? ` (${activeTableCount})` : ''}</span>
          </button>
        )}
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
          data-testid="top-nav-matches"
        >
          <Icon name="scrollText" size={14} />
          <span>{t('lobby.nav_history')}</span>
        </button>
        <button
          type="button"
          className={`top-nav-btn ${activeTab === 'ranking' ? 'active' : ''}`}
          onClick={() => onTabChange('ranking')}
          title={t('lobby.nav_ranking')}
          data-testid="top-nav-ranking"
        >
          <Icon name="trophy" size={14} />
          <span>{t('lobby.nav_ranking')}</span>
        </button>
      </nav>

      <div className="lobby-user-actions">
        <div
          className="lobby-user-badge"
          onClick={() => onOpenProfile(conn?.username ?? '')}
          title={`${t('lobby', 'view_profile_hint')} ${conn?.username ?? ''}`}
        >
          <AvatarImage avatarId={conn?.avatarId ?? 10} username={conn?.username} size="medium" />
          <div className="lobby-user-col">
            <div className="lobby-user-name-line">
              <span className="lobby-username">{conn?.username}</span>
              {myUser?.infoPing && <PingBadge infoPing={myUser.infoPing} compact />}
            </div>
            <RankBadge elo={myUser?.constructedRating ?? 1500} compact />
          </div>
        </div>
        <IconButton label={t('common', 'settings')} icon="settings" size="lg"
          className="lobby-appearance-btn"
          onClick={onOpenSettings}
          data-testid="open-settings" />
        <DropdownMenu
          label={<Icon name="ellipsis" size={16} />}
          hideChevron
          align="end"
          aria-label={t('lobby', 'more_options')}
          className="lobby-more-menu"
          data-testid="lobby-more-menu"
        >
          <MenuItem icon="bug" onClick={onOpenReport} data-testid="open-report">
            {t('system', 'report_title')}
          </MenuItem>
          <MenuItem icon="bookOpen" onClick={onOpenWiki} data-testid="open-wiki">
            {t('wiki', 'title')}
          </MenuItem>
          <MenuItem icon="info" onClick={onOpenAbout} data-testid="open-about">
            {t('system', 'about_title')}
            {hasNews && (
              <span className="lobby-news-dot" data-testid="lobby-news-dot" aria-hidden="true">●</span>
            )}
          </MenuItem>
          <MenuItem icon="logout" danger onClick={() => onConfirmDisconnect(true)}>
            {t('lobby', 'disconnect')}
          </MenuItem>
        </DropdownMenu>

        {confirmDisconnect ? (
          <div className="lobby-disconnect-confirm">
            <span className="lobby-disconnect-confirm-label">{t('lobby', 'disconnect_confirm')}</span>
            <Button variant="soft-danger" size="sm" onClick={reset}>{t('common', 'yes')}</Button>
            <Button variant="subtle" size="sm" onClick={() => onConfirmDisconnect(false)}>{t('common', 'no')}</Button>
          </div>
        ) : null}
      </div>
    </header>
  )
}
