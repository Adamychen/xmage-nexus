import { useTranslation } from '../i18n'
import { setSetting } from '../state/actions'
import { useSettings } from '../state/selectors'
import Button from '../ui/Button'
import { CUSTOM_PLAYMAT_ID, DEFAULT_PLAYMAT, PLAYMATS } from './playmats'
import { customPlaymatStore } from './customPlaymat'
import CustomImageTile from './CustomImageTile'
import './playmats.css'
import './AppearanceSettingsModal.css'
import './SleevePickerModal.css'

interface Props {
  testIdPrefix?: string
}

export default function PlaymatPicker({ testIdPrefix = 'playmat' }: Props) {
  const { t } = useTranslation()
  const { playmatId } = useSettings()
  return (
    <div className="appearance-playmat-grid">
      {PLAYMATS.map((m) => {
        const isSelected = playmatId === m.id
        const label = t('lobby', `playmat_${m.id}` as 'playmat_classic')
        return (
          <Button
            key={m.id}
            variant="ghost"
            className={`playmat-item ${isSelected ? 'selected' : ''}`}
            onClick={() => setSetting('playmatId', m.id)}
            data-testid={`${testIdPrefix}-${m.id}`}
            aria-pressed={isSelected}
            title={label}
          >
            <span className="playmat-layer playmat-swatch" data-playmat={m.id} aria-hidden="true">
              {isSelected && <span className="sleeve-check">✓</span>}
            </span>
            <span className="sleeve-name">{label}</span>
          </Button>
        )
      })}
      <CustomImageTile
        store={customPlaymatStore}
        variant="playmat"
        label={t('lobby', 'playmat_custom')}
        selected={playmatId === CUSTOM_PLAYMAT_ID}
        onSelect={() => setSetting('playmatId', CUSTOM_PLAYMAT_ID)}
        onRemoved={() => { if (playmatId === CUSTOM_PLAYMAT_ID) setSetting('playmatId', DEFAULT_PLAYMAT) }}
        testIdPrefix={testIdPrefix}
      />
    </div>
  )
}
