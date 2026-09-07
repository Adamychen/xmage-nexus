import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import Icon from '../ui/Icon'
import DialogShell from '../ui/DialogShell'
import { APP_VERSION } from './version'
import { getNews, markNewsSeen, renderNewsMarkdown, type NewsRelease } from './news'
import './AboutModal.css'

interface AboutModalProps {
  onClose: () => void
  initialTab?: 'about' | 'news'
}

type TabType = 'about' | 'news'

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return ''
  }
}

export default function AboutModal({ onClose, initialTab = 'about' }: AboutModalProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  const [releases, setReleases] = useState<NewsRelease[]>([])
  const [offline, setOffline] = useState(false)
  const [loadingNews, setLoadingNews] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    if (activeTab !== 'news' || releases.length > 0 || loadingNews) return
    setLoadingNews(true)
    void getNews()
      .then(({ releases: list, offline: off }) => {
        setReleases(list)
        setOffline(off)
        markNewsSeen(list)
      })
      .finally(() => setLoadingNews(false))
  }, [activeTab, releases.length, loadingNews])

  const nexusReleases = releases.filter((r) => r.repo === 'nexus')
  const xmageReleases = releases.filter((r) => r.repo === 'xmage')

  const renderFeed = (list: NewsRelease[], title: string, testid: string) => (
    <div className="about-feed" data-testid={testid}>
      <h3>{title}</h3>
      {list.length === 0 && !loadingNews && <p className="about-empty">{t('system', 'news_empty')}</p>}
      {list.map((r) => (
        <article key={`${r.repo}-${r.tag}`} className="about-release">
          <header>
            <strong>{r.name}</strong>
            <span className="about-release-tag">{r.tag}</span>
            {r.publishedAt && <span className="about-release-date">{formatDate(r.publishedAt)}</span>}
          </header>
          {r.body && (
            <div
              className="about-release-body"
              dangerouslySetInnerHTML={{ __html: renderNewsMarkdown(r.body) }}
            />
          )}
          <a href={r.url} target="_blank" rel="noreferrer" className="about-release-link">
            {t('system', 'news_open')}
          </a>
        </article>
      ))}
    </div>
  )

  return (
    <DialogShell
      labelledBy="about-modal-title"
      titleId="about-modal-title"
      testId="about-modal"
      legacyBackdropClass="feedback-backdrop about-backdrop"
      legacyPanelClass="about-modal"
      kickerIcon="info"
      kickerLabel={`${t('system', 'app_version')}: ${APP_VERSION}`}
      title={activeTab === 'about' ? t('system', 'about_title') : t('system', 'news_tab')}
      message={activeTab === 'about' ? t('system', 'app_tagline') : undefined}
      topRight={(
        <button
          type="button"
          className="about-close-btn"
          aria-label={t('common', 'close')}
          data-testid="about-close"
          onClick={onClose}
        >
          ✕
        </button>
      )}
      onBackdropClick={onClose}
    >
        <div className="about-tabs">
          <button
            type="button"
            className={activeTab === 'about' ? 'is-active' : ''}
            data-testid="about-tab-about"
            onClick={() => setActiveTab('about')}
          >
            {t('system', 'about_tab')}
          </button>
          <button
            type="button"
            className={activeTab === 'news' ? 'is-active' : ''}
            data-testid="about-tab-news"
            onClick={() => setActiveTab('news')}
          >
            {t('system', 'news_tab')}
          </button>
        </div>

        {activeTab === 'about' ? (
          <div className="about-pane">
            <div className="about-links">
              <a
                href="https://github.com/Adamychen/xmage-nexus"
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="bookOpen" size={13} /> {t('system', 'nexus_link')}
              </a>
              <a href="https://github.com/magefree/mage" target="_blank" rel="noreferrer">
                <Icon name="bookOpen" size={13} /> {t('system', 'xmage_link')}
              </a>
            </div>
          </div>
        ) : (
          <div className="about-pane">
            {offline && <p className="about-offline">{t('system', 'news_offline')}</p>}
            {loadingNews && releases.length === 0 && <p>{t('common', 'loading')}</p>}
            {renderFeed(nexusReleases, t('system', 'news_nexus'), 'about-feed-nexus')}
            {renderFeed(xmageReleases, t('system', 'news_xmage'), 'about-feed-xmage')}
          </div>
        )}
    </DialogShell>
  )
}
