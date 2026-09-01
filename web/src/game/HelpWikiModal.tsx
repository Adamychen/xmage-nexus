import { useState, useMemo, useEffect } from 'react'
import { MTG_KEYWORDS } from '../data/mtgKeywords'
import FormattedText from './FormattedText'
import { useTranslation } from '../i18n'
import './HelpWikiModal.css'

interface HelpWikiModalProps {
  onClose: () => void
}

type TabType = 'glossary' | 'phases' | 'shortcuts'

export default function HelpWikiModal({ onClose }: HelpWikiModalProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<TabType>('glossary')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const categoryLabels: Record<string, string> = useMemo(() => ({
    all: `✨ ${t('wiki', 'cat_all')}`,
    combat: `⚔️ ${t('wiki', 'cat_combat')}`,
    evasion: `🦅 ${t('wiki', 'cat_evasion')}`,
    protection: `🛡️ ${t('wiki', 'cat_protection')}`,
    cards: `🔮 ${t('wiki', 'cat_cards')}`,
    counters: `🧪 ${t('wiki', 'cat_counters')}`,
    mana: `⚡ ${t('wiki', 'cat_mana')}`,
    graveyard: `☠️ ${t('wiki', 'cat_graveyard')}`,
    mechanic: `✨ ${t('wiki', 'cat_mechanic')}`,
  }), [t])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const filteredKeywords = useMemo(() => {
    let list = MTG_KEYWORDS

    if (selectedCategory !== 'all') {
      list = list.filter((k) => k.category === selectedCategory)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((k) =>
        k.name.toLowerCase().includes(q) ||
        k.nameEs.toLowerCase().includes(q) ||
        k.summary.toLowerCase().includes(q) ||
        (k.ruleSnippet && k.ruleSnippet.toLowerCase().includes(q))
      )
    }

    return list
  }, [searchQuery, selectedCategory])

  return (
    <div className="feedback-backdrop wiki-backdrop" role="presentation" onClick={onClose}>
      <section
        className="feedback-dialog wiki-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wiki-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="wiki-header">
          <div className="wiki-title-group">
            <span className="wiki-icon">📖</span>
            <div>
              <h2 id="wiki-modal-title">{t('wiki', 'title')}</h2>
              <p className="wiki-subtitle">{t('wiki', 'subtitle')}</p>
            </div>
          </div>
          <button type="button" className="wiki-close-btn" onClick={onClose} title={`${t('common', 'close')} (Esc)`}>
            ✕
          </button>
        </header>

        <nav className="wiki-nav-tabs">
          <button
            type="button"
            className={`wiki-tab-btn ${activeTab === 'glossary' ? 'active' : ''}`}
            onClick={() => setActiveTab('glossary')}
          >
            📚 {t('wiki', 'tab_keywords')} ({MTG_KEYWORDS.length})
          </button>
          <button
            type="button"
            className={`wiki-tab-btn ${activeTab === 'phases' ? 'active' : ''}`}
            onClick={() => setActiveTab('phases')}
          >
            ⏱️ {t('wiki', 'tab_phases')}
          </button>
          <button
            type="button"
            className={`wiki-tab-btn ${activeTab === 'shortcuts' ? 'active' : ''}`}
            onClick={() => setActiveTab('shortcuts')}
          >
            ⌨️ {t('wiki', 'tab_shortcuts')}
          </button>
        </nav>

        <div className="wiki-content">
          {activeTab === 'glossary' && (
            <div className="wiki-glossary-tab">
              <div className="wiki-search-bar-wrap">
                <span className="wiki-search-icon">🔍</span>
                <input
                  type="text"
                  className="wiki-search-input"
                  placeholder={t('wiki', 'search_placeholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                {searchQuery && (
                  <button type="button" className="wiki-clear-search" onClick={() => setSearchQuery('')}>
                    ✕
                  </button>
                )}
              </div>

              <div className="wiki-category-pills">
                {Object.entries(categoryLabels).map(([catKey, catLabel]) => (
                  <button
                    key={catKey}
                    type="button"
                    className={`wiki-pill ${selectedCategory === catKey ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(catKey)}
                  >
                    {catLabel}
                  </button>
                ))}
              </div>

              <div className="wiki-keywords-grid">
                {filteredKeywords.map((kw) => (
                  <article key={kw.id} className={`wiki-kw-card cat-${kw.category}`}>
                    <div className="wiki-kw-card-header">
                      <div className="wiki-kw-card-title">
                        <span className="wiki-kw-icon">{kw.icon}</span>
                        <strong className="wiki-kw-name-en">{kw.name}</strong>
                        <span className="wiki-kw-name-es">({kw.nameEs})</span>
                      </div>
                      <span className="wiki-kw-type-badge">{categoryLabels[kw.category] ?? kw.category}</span>
                    </div>
                    <p className="wiki-kw-summary">
                      <FormattedText text={kw.summary} />
                    </p>
                    {kw.ruleSnippet && (
                      <div className="wiki-kw-rule-ref">
                        <FormattedText text={kw.ruleSnippet} />
                      </div>
                    )}
                  </article>
                ))}

                {filteredKeywords.length === 0 && (
                  <div className="wiki-empty">
                    <span>🔍</span>
                    <p>{t('dialogs', 'cardgrid_empty', { filter: searchQuery })}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'phases' && (
            <div className="wiki-phases-tab">
              <section className="wiki-section">
                <h3>🔄 {t('wiki', 'tab_phases')}</h3>
                <div className="wiki-phases-timeline">
                  <div className="phase-block phase-beginning">
                    <div className="phase-title">1. {t('wiki', 'phases_untap')}</div>
                    <div className="phase-steps">
                      <div className="phase-step">{t('wiki', 'phases_untap')}</div>
                      <div className="phase-step">{t('wiki', 'phases_upkeep')}</div>
                      <div className="phase-step">{t('wiki', 'phases_draw')}</div>
                    </div>
                  </div>

                  <div className="phase-block phase-main">
                    <div className="phase-title">2. {t('wiki', 'phases_main1')}</div>
                    <div className="phase-steps">
                      <div className="phase-step">{t('wiki', 'phases_main1')}</div>
                    </div>
                  </div>

                  <div className="phase-block phase-combat">
                    <div className="phase-title">3. {t('wiki', 'phases_combat')}</div>
                    <div className="phase-steps">
                      <div className="phase-step">{t('game', 'declare_attackers')}</div>
                      <div className="phase-step">{t('game', 'declare_blockers')}</div>
                      <div className="phase-step">{t('game', 'damage')}</div>
                      <div className="phase-step">{t('wiki', 'phases_combat')}</div>
                    </div>
                  </div>

                  <div className="phase-block phase-main">
                    <div className="phase-title">4. {t('wiki', 'phases_main2')}</div>
                    <div className="phase-steps">
                      <div className="phase-step">{t('wiki', 'phases_main2')}</div>
                    </div>
                  </div>

                  <div className="phase-block phase-ending">
                    <div className="phase-title">5. {t('wiki', 'phases_end')}</div>
                    <div className="phase-steps">
                      <div className="phase-step">{t('wiki', 'phases_end')}</div>
                      <div className="phase-step">{t('wiki', 'phases_priority')}</div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="wiki-section">
                <h3>⚡ {t('wiki', 'phases_stack')}</h3>
                <div className="wiki-stack-card">
                  <p>
                    <strong>{t('wiki', 'phases_stack')}:</strong> {t('wiki', 'phases_priority')}
                  </p>
                  <p>
                    {t('wiki', 'phases_priority')}
                  </p>
                  <p>
                    <strong>{t('wiki', 'shortcuts_ctrl')}:</strong> {t('game', 'hold_priority_title')}
                  </p>
                  <p>
                    {t('wiki', 'phases_priority')}
                  </p>
                  <p>
                    {t('wiki', 'phases_stack')}
                  </p>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="wiki-shortcuts-tab">
              <div className="wiki-shortcuts-grid">
                <div className="shortcut-card">
                  <span className="shortcut-key">{t('wiki', 'shortcuts_space').split(':')[0]}</span>
                  <div className="shortcut-info">
                    <strong>{t('wiki', 'shortcuts_space')}</strong>
                    <p>{t('game', 'pass_priority')}</p>
                  </div>
                </div>

                <div className="shortcut-card">
                  <span className="shortcut-key">Ctrl / Cmd + Click</span>
                  <div className="shortcut-info">
                    <strong>{t('wiki', 'shortcuts_ctrl')}</strong>
                    <p>{t('game', 'hold_priority_title')}</p>
                  </div>
                </div>

                <div className="shortcut-card">
                  <span className="shortcut-key">Shift / F</span>
                  <div className="shortcut-info">
                    <strong>{t('wiki', 'shortcuts_shift_f')}</strong>
                    <p>{t('wiki', 'flip_hint')}</p>
                  </div>
                </div>

                <div className="shortcut-card">
                  <span className="shortcut-key">Click</span>
                  <div className="shortcut-info">
                    <strong>{t('game', 'tap_mana')}</strong>
                    <p>{t('game', 'choose_target')}</p>
                  </div>
                </div>

                <div className="shortcut-card">
                  <span className="shortcut-key">Hover</span>
                  <div className="shortcut-info">
                    <strong>{t('wiki', 'flip_hint')}</strong>
                    <p>{t('game', 'search_placeholder')}</p>
                  </div>
                </div>

                <div className="shortcut-card">
                  <span className="shortcut-key">Esc</span>
                  <div className="shortcut-info">
                    <strong>{t('common', 'close')}</strong>
                    <p>{t('common', 'close')}</p>
                  </div>
                </div>

                <div className="shortcut-card">
                  <span className="shortcut-key">Auto-Pass</span>
                  <div className="shortcut-info">
                    <strong>{t('game', 'auto_pass')}</strong>
                    <p>{t('game', 'auto_pass')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="wiki-footer">
          <button type="button" className="primary" onClick={onClose}>
            {t('common', 'done')}
          </button>
        </footer>
      </section>
    </div>
  )
}
