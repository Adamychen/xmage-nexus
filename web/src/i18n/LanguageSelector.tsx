import Select from '../ui/Select'
import { useTranslation, type SupportedLanguage } from './index'
import Icon from '../ui/Icon'
import './LanguageSelector.css'

export interface LanguageSelectorProps {
  compact?: boolean
  showCardLangToggle?: boolean
}

const UI_PREFIX = 'ui:'
const CARD_PREFIX = 'card:'

export default function LanguageSelector({ compact = false, showCardLangToggle = false }: LanguageSelectorProps) {
  const { lang, setLanguage, languages, cardLang, setCardLanguage, cardLanguages, t } = useTranslation()
  const currentLangInfo = languages.find((l) => l.code === lang) ?? languages[0]
  const uiGroup = <><Icon name="globe" size={13} /> {t('common.language')}</>
  const cardGroup = <><Icon name="layers" size={13} /> {t('common.card_language')}</>
  const optionLabel = (flag: string, name: string) => <><span className="option-flag">{flag}</span><span className="option-name">{name}</span></>

  const options = [
    ...languages.map((l) => ({ value: UI_PREFIX + l.code, label: optionLabel(l.flag, l.name), text: l.name, group: uiGroup })),
    ...(showCardLangToggle
      ? cardLanguages.map((cl) => ({ value: CARD_PREFIX + cl.code, label: optionLabel(cl.flag, cl.name), text: cl.name, group: cardGroup }))
      : []),
  ]

  return (
    <div className="language-selector-wrapper">
      <Select
        className={`language-selector-btn${compact ? ' compact' : ''}`}
        aria-label={t('common.language')}
        title={t('common.language')}
        searchable={false}
        selectedValues={[UI_PREFIX + lang, ...(showCardLangToggle ? [CARD_PREFIX + cardLang] : [])]}
        keepOpen={(value) => value.startsWith(CARD_PREFIX)}
        onChange={(value) => {
          if (value.startsWith(UI_PREFIX)) setLanguage(value.slice(UI_PREFIX.length) as SupportedLanguage)
          else setCardLanguage(value.slice(CARD_PREFIX.length))
        }}
        summary={<><span className="lang-flag">{currentLangInfo.flag}</span>{!compact && <span className="lang-name">{currentLangInfo.name}</span>}</>}
        options={options}
      />
    </div>
  )
}
