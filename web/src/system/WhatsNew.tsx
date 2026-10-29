import { useEffect, useRef, useState } from 'react'
import IconButton from '../ui/IconButton'
import Icon from '../ui/Icon'
import EmptyState from '../ui/EmptyState'
import { useEscape } from '../ui/useEscape'
import { useTranslation, toBcp47Locale, type SupportedLanguage } from '../i18n'
import { getNews, markNewsSeen, renderNewsMarkdown, NEXUS_REPO, type NewsRelease } from './news'
import './WhatsNew.css'

function formatDate(iso: string | null, lang: SupportedLanguage): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(toBcp47Locale(lang), { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

function ReleaseNotes({ release }: { release: NewsRelease }) {
  return release.body
    ? <div className="whats-new-notes" dangerouslySetInnerHTML={{ __html: renderNewsMarkdown(release.body) }} />
    : null
}

function OlderRelease({ release, lang }: { release: NewsRelease; lang: SupportedLanguage }) {
  return (
    <details className="whats-new-older" data-testid="whats-new-older-release">
      <summary>
        <span className="whats-new-tag">{release.tag}</span>
        <span className="whats-new-date">{formatDate(release.publishedAt, lang)}</span>
      </summary>
      <ReleaseNotes release={release} />
    </details>
  )
}

function WhatsNewPanel({ onClose, onSeen }: { onClose: () => void; onSeen: () => void }) {
  const { t, lang } = useTranslation()
  const [releases, setReleases] = useState<NewsRelease[] | null>(null)
  const [offline, setOffline] = useState(false)
  useEscape(onClose)

  useEffect(() => {
    let active = true
    void getNews().then(({ releases: list, offline: off }) => {
      if (!active) return
      setReleases(list)
      setOffline(off)
      markNewsSeen(list)
      onSeen()
    })
    return () => {
      active = false
    }
  }, [onSeen])

  const nexus = (releases ?? []).filter((r) => r.repo === 'nexus')
  const xmage = (releases ?? []).filter((r) => r.repo === 'xmage')
  const [latest, ...older] = nexus

  return (
    <div className="whats-new-panel" role="dialog" aria-label={t('system', 'news_tab')} data-testid="whats-new-panel">
      <header className="whats-new-head">
        <strong>{t('system', 'news_tab')}</strong>
        {latest && (
          <span className="whats-new-head-version">
            {latest.tag}
            {latest.publishedAt && ` · ${formatDate(latest.publishedAt, lang)}`}
          </span>
        )}
      </header>
      <div className="whats-new-body">
        {offline && <p className="whats-new-offline">{t('system', 'news_offline')}</p>}
        {releases === null && <p className="whats-new-loading">{t('common', 'loading')}</p>}
        {releases !== null && !latest && <EmptyState size="sm">{t('system', 'news_empty')}</EmptyState>}
        {latest && (
          <article className="whats-new-latest" data-testid="whats-new-latest">
            <ReleaseNotes release={latest} />
          </article>
        )}
        {older.length > 0 && (
          <details className="whats-new-section" data-testid="whats-new-previous">
            <summary>
              {t('system', 'news_previous')} <span className="whats-new-count">{older.length}</span>
            </summary>
            {older.map((r) => <OlderRelease key={r.tag} release={r} lang={lang} />)}
          </details>
        )}
        {xmage.length > 0 && (
          <details className="whats-new-section" data-testid="whats-new-xmage">
            <summary>{t('system', 'news_xmage')}</summary>
            {xmage.map((r) => <OlderRelease key={r.tag} release={r} lang={lang} />)}
          </details>
        )}
      </div>
      <footer className="whats-new-foot">
        <a href={`https://github.com/${NEXUS_REPO}/releases`} target="_blank" rel="noreferrer">
          <Icon name="bookOpen" size={13} /> {t('system', 'news_open')}
        </a>
      </footer>
    </div>
  )
}

export default function WhatsNewButton({ unseen, onSeen, className = '' }: { unseen: boolean; onSeen: () => void; className?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div className="whats-new" ref={rootRef}>
      <IconButton
        label={t('system', 'news_tab')}
        size="lg"
        className={`whats-new-btn ${className}`.trim()}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        data-testid="whats-new-button"
      >
        <Icon name="bell" size={16} />
        {unseen && <span className="whats-new-dot" data-testid="whats-new-dot" aria-hidden="true" />}
      </IconButton>
      {open && <WhatsNewPanel onClose={() => setOpen(false)} onSeen={onSeen} />}
    </div>
  )
}
