import { useTranslation } from '../i18n'
import './MechanicsGlossary.css'

const ENTRIES = [
  { name: 'mechanics_ring_title', text: 'mech_gloss_ring' },
  { name: 'mechanics_dungeon_title', text: 'mech_gloss_dungeon' },
  { name: 'mech_day_night', text: 'mech_gloss_daynight' },
  { name: 'mechanics_monarch', text: 'mech_gloss_monarch' },
  { name: 'mechanics_initiative', text: 'mech_gloss_initiative' },
  { name: 'mechanics_blessing', text: 'mech_gloss_blessing' },
  { name: 'mechanics_speed_title', text: 'mech_gloss_speed' },
] as const

export default function MechanicsGlossary() {
  const { t } = useTranslation()
  return (
    <div className="mech-glossary" data-testid="mechanics-glossary">
      <p className="mech-glossary-intro">{t('game', 'mech_glossary_intro')}</p>
      <dl className="mech-glossary-list">
        {ENTRIES.map((entry) => (
          <div key={entry.name} className="mech-glossary-item">
            <dt>{t('game', entry.name)}</dt>
            <dd>{t('game', entry.text)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
