import { useState, useRef, useEffect } from 'react'
import { useTranslation, type SupportedLanguage } from './index'
import './LanguageSelector.css'

export interface LanguageSelectorProps {
  compact?: boolean
  showCardLangToggle?: boolean
}

export default function LanguageSelector({ compact = false, showCardLangToggle = false }: LanguageSelectorProps) {
  const { lang, setLanguage, languages, cardLang, setCardLanguage, cardLanguages, t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const currentLangInfo = languages.find((l) => l.code === lang) ?? languages[0]

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="language-selector-wrapper" ref={menuRef}>
      <button
        type="button"
        className={`language-selector-btn ${compact ? 'compact' : ''} ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title={t('common.language')}
        aria-label="Seleccionar idioma"
        aria-expanded={isOpen}
      >
        <span className="lang-flag">{currentLangInfo.flag}</span>
        {!compact && <span className="lang-name">{currentLangInfo.name}</span>}
        <span className="lang-arrow">▾</span>
      </button>

      {isOpen && (
        <div className="language-dropdown-menu panel" role="menu">
          <div className="dropdown-section-header">
            <span>🌐 {t('common.language')}</span>
          </div>

          <div className="dropdown-options-list">
            {languages.map((l) => (
              <button
                key={l.code}
                type="button"
                className={`dropdown-option-item ${l.code === lang ? 'selected' : ''}`}
                onClick={() => {
                  setLanguage(l.code as SupportedLanguage)
                  setIsOpen(false)
                }}
              >
                <span className="option-flag">{l.flag}</span>
                <span className="option-name">{l.name}</span>
                {l.code === lang && <span className="option-check">✓</span>}
              </button>
            ))}
          </div>

          {showCardLangToggle && (
            <>
              <div className="dropdown-divider" />
              <div className="dropdown-section-header">
                <span>🃏 {t('common.card_language')}</span>
              </div>
              <div className="dropdown-options-list card-lang-list">
                {cardLanguages.map((cl) => (
                  <button
                    key={cl.code}
                    type="button"
                    className={`dropdown-option-item ${cl.code === cardLang ? 'selected' : ''}`}
                    onClick={() => {
                      setCardLanguage(cl.code)
                    }}
                  >
                    <span className="option-flag">{cl.flag}</span>
                    <span className="option-name">{cl.name}</span>
                    {cl.code === cardLang && <span className="option-check">✓</span>}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
