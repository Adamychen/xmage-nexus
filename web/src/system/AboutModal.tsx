import CloseButton from '../ui/CloseButton'
import Button from '../ui/Button'
import { useEscape } from '../ui/useEscape'
import EmptyState from '../ui/EmptyState'
import Tabs from '../ui/Tabs'
import { useEffect, useState } from 'react'
import { useTranslation, toBcp47Locale, type SupportedLanguage } from '../i18n'
import Icon from '../ui/Icon'
import DialogShell from '../ui/DialogShell'
import { APP_VERSION } from './version'
import { downloadDiagnostics } from './diagnostics'
import { getNews, markNewsSeen, renderNewsMarkdown, type NewsRelease } from './news'
import './AboutModal.css'

interface AboutModalProps {
  onClose: () => void
  initialTab?: 'about' | 'news'
}

type TabType = 'about' | 'news'

function formatDate(iso: string | null, lang: SupportedLanguage): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(toBcp47Locale(lang))
  } catch {
    return ''
  }
}

export default function AboutModal({ onClose, initialTab = 'about' }: AboutModalProps) {
  const { t, lang } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)
  const [releases, setReleases] = useState<NewsRelease[]>([])
  const [offline, setOffline] = useState(false)
  const [loadingNews, setLoadingNews] = useState(false)

  useEscape(onClose)

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
      {list.length === 0 && !loadingNews && <EmptyState size="sm">{t('system', 'news_empty')}</EmptyState>}
      {list.map((r) => (
        <article key={`${r.repo}-${r.tag}`} className="about-release">
          <header>
            <strong>{r.name}</strong>
            <span className="about-release-tag">{r.tag}</span>
            {r.publishedAt && <span className="about-release-date">{formatDate(r.publishedAt, lang)}</span>}
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
        <CloseButton variant="plain" size="md" className="about-close-btn" data-testid="about-close" onClick={onClose} />
      )}
      onBackdropClick={onClose}
    >
        <Tabs
          variant="underline"
          className="about-tabs"
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { id: 'about', label: t('system', 'about_tab'), testId: 'about-tab-about' },
            { id: 'news', label: t('system', 'news_tab'), testId: 'about-tab-news' },
          ]}
        />

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
            <div className="about-links">
              <Button
                data-testid="about-export-diag"
                title={t('system', 'diag_export_hint')}
                onClick={() => downloadDiagnostics()}>
                <Icon name="download" size={13} /> {t('system', 'diag_export')}
              </Button>
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
