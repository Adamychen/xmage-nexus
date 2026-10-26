import { useEffect, useRef, useState } from 'react'
import CloseButton from '../ui/CloseButton'
import Modal from '../ui/Modal'
import Icon, { type IconName } from '../ui/Icon'
import { useSettings } from '../state/store'
import { useTranslation } from '../i18n'
import { zoomPercent } from '../appearance/zoom'
import { LanguageSection, InterfaceSection, BoardSection, SoundSection, GameplaySection, LAYOUTS } from './sections'
import { boardLayoutChoiceOf } from './boardLayoutChoice'
import { GAMEPLAY_PRESETS } from './gameplayPresets'
import { SECTION_ORDER, searchSettings, sectionDescription, sectionTitle, type BoardTab, type SettingsSection } from './settingsIndex'
import '../ui/DialogShell.css'
import './SettingsModal.css'

interface Props {
  onClose: () => void
  initialSection?: SettingsSection
}

const SECTION_ICON: Record<SettingsSection, IconName> = {
  gameplay: 'swords',
  board: 'layoutGrid',
  interface: 'palette',
  language: 'globe',
  sound: 'volume',
}

const FLASH_MS = 1600

function useSectionValues(): Partial<Record<SettingsSection, string>> {
  const { t, lang, languages } = useTranslation()
  const settings = useSettings()
  const preset = GAMEPLAY_PRESETS.find((p) => p.id === settings.gameplayPreset)
  const layout = LAYOUTS.find((l) => l.id === boardLayoutChoiceOf(settings))
  return {
    gameplay: preset ? t('game', preset.labelKey) : undefined,
    board: layout ? t('lobby', layout.labelKey as 'board_standard') : undefined,
    interface: `${t('lobby', `scheme_${settings.appearance}`)} · ${zoomPercent(settings.uiScale)}%`,
    language: languages.find((l) => l.code === lang)?.name,
  }
}

export default function SettingsModal({ onClose, initialSection }: Props) {
  const { t } = useTranslation()
  const [section, setSection] = useState<SettingsSection>(initialSection ?? 'gameplay')
  const [boardTab, setBoardTab] = useState<BoardTab>('layout')
  const [query, setQuery] = useState('')
  const [phoneView, setPhoneView] = useState<'list' | 'section'>(initialSection ? 'section' : 'list')
  const [flashId, setFlashId] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const values = useSectionValues()
  const searching = query.trim() !== ''
  const hits = searching ? searchSettings(query, t) : []

  useEffect(() => {
    if (!flashId) return
    const el = contentRef.current?.querySelector<HTMLElement>(`[data-setting="${flashId}"]`)
    if (!el) return
    el.scrollIntoView?.({ block: 'center' })
    el.classList.add('settings-flash')
    const timer = window.setTimeout(() => {
      el.classList.remove('settings-flash')
      setFlashId(null)
    }, FLASH_MS)
    return () => {
      window.clearTimeout(timer)
      el.classList.remove('settings-flash')
    }
  }, [flashId, section, boardTab])

  const open = (id: SettingsSection) => {
    setSection(id)
    setQuery('')
    setPhoneView('section')
    contentRef.current?.scrollTo?.({ top: 0 })
  }

  const goTo = (id: string, target: SettingsSection, tab?: BoardTab) => {
    setSection(target)
    if (tab) setBoardTab(tab)
    setQuery('')
    setPhoneView('section')
    setFlashId(id)
  }

  const title = searching ? t('lobby', 'settings_search_title') : sectionTitle(t, section)
  const description = searching ? t('lobby', 'settings_search_desc') : sectionDescription(t, section)

  return (
    <Modal
      backdropClassName="dlg-backdrop settings-backdrop"
      dialogClassName="dlg-panel dlg-md settings-modal"
      labelledBy="settings-title"
      testId="settings-modal"
      onBackdropClick={onClose}
      onEscape={onClose}
    >
      <div className="settings-layout" data-view={searching ? 'section' : phoneView}>
        <aside className="settings-side">
          <div className="settings-side-head">
            <span className="settings-brand">{t('common', 'settings')}</span>
            <CloseButton variant="plain" size="md" className="settings-close settings-close-phone" onClick={onClose} />
          </div>
          <label className="settings-search">
            <Icon name="search" size={15} />
            <input
              type="search"
              value={query}
              placeholder={t('lobby', 'settings_search')}
              aria-label={t('lobby', 'settings_search')}
              onChange={(e) => setQuery(e.target.value)}
              data-testid="settings-search"
            />
          </label>
          <nav className="settings-nav" aria-label={t('common', 'settings')}>
            {SECTION_ORDER.map((group) => (
              <div key={group.group} className="settings-nav-group">
                <span className="settings-nav-group-label">{t('lobby', `settings_group_${group.group}`)}</span>
                {group.ids.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={`settings-nav-item ${!searching && section === id ? 'active' : ''}`}
                    aria-current={!searching && section === id ? 'page' : undefined}
                    onClick={() => open(id)}
                    data-testid={`settings-nav-${id}`}
                  >
                    <span className="settings-nav-icon"><Icon name={SECTION_ICON[id]} size={17} /></span>
                    <span className="settings-nav-label">{sectionTitle(t, id)}</span>
                    {values[id] && <span className="settings-nav-value">{values[id]}</span>}
                    <span className="settings-nav-chevron"><Icon name="chevronRight" size={16} /></span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <button
            type="button"
            className="settings-nav-item settings-review"
            onClick={() => window.dispatchEvent(new CustomEvent('nexus:open-setup'))}
            data-testid="settings-review-setup"
          >
            <span className="settings-nav-icon"><Icon name="history" size={17} /></span>
            <span className="settings-nav-label">{t('setup', 'review')}</span>
          </button>
        </aside>
        <main className="settings-main">
          <header className="settings-head">
            <button
              type="button"
              className="settings-back"
              onClick={() => {
                setQuery('')
                setPhoneView('list')
              }}
              aria-label={t('lobby', 'settings_back')}
              data-testid="settings-back"
            >
              <Icon name="chevronLeft" size={18} />
              <span>{t('common', 'settings')}</span>
            </button>
            <div className="settings-head-text">
              <h2 id="settings-title" className="settings-title">{title}</h2>
              <p className="settings-desc">{description}</p>
            </div>
            <CloseButton variant="plain" size="md" className="settings-close" onClick={onClose} data-testid="settings-close" />
          </header>
          <div
            ref={contentRef}
            className="settings-content"
            data-testid={searching ? 'settings-search-results' : `settings-section-${section}`}
          >
            {searching ? (
              hits.length > 0 ? (
                <section className="settings-group">
                  <h3 className="settings-group-title">{t('lobby', 'settings_search_results', { count: hits.length })}</h3>
                  <div className="settings-group-body">
                    {hits.map((hit) => (
                      <div key={hit.entry.id} className="settings-item settings-row settings-hit" data-testid={`settings-hit-${hit.entry.id}`}>
                        <div className="settings-row-text">
                          <span className="settings-hit-where">{hit.where}</span>
                          <span className="settings-row-label">{hit.label}</span>
                          {hit.hint && <span className="settings-row-hint">{hit.hint}</span>}
                        </div>
                        <div className="settings-row-control">
                          <button
                            type="button"
                            className="settings-hit-go"
                            onClick={() => goTo(hit.entry.id, hit.entry.section, hit.entry.tab)}
                            data-testid={`settings-go-${hit.entry.id}`}
                          >
                            {t('lobby', 'settings_search_go')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : (
                <p className="settings-search-none" data-testid="settings-search-none">
                  {t('lobby', 'settings_search_none', { query: query.trim() })}
                </p>
              )
            ) : (
              <>
                {section === 'gameplay' && <GameplaySection />}
                {section === 'board' && <BoardSection tab={boardTab} onTabChange={setBoardTab} />}
                {section === 'interface' && <InterfaceSection />}
                {section === 'language' && <LanguageSection />}
                {section === 'sound' && <SoundSection />}
              </>
            )}
          </div>
        </main>
      </div>
    </Modal>
  )
}
