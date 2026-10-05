import { useTranslation } from '../i18n'
import { setSetting } from '../state/actions'
import { CUSTOM_SLEEVE_ID } from './sleeves'
import { customSleeveStore } from './customSleeve'
import CustomImageTile from './CustomImageTile'

interface Props {
  selectedId: string
  testIdPrefix?: string
}

export default function CustomSleeveTile({ selectedId, testIdPrefix = 'sleeve' }: Props) {
  const { t } = useTranslation()
  return (
    <CustomImageTile
      store={customSleeveStore}
      variant="sleeve"
      label={t('lobby', 'sleeve_custom')}
      selected={selectedId === CUSTOM_SLEEVE_ID}
      onSelect={() => setSetting('sleeveId', CUSTOM_SLEEVE_ID)}
      onRemoved={() => { if (selectedId === CUSTOM_SLEEVE_ID) setSetting('sleeveId', 'classic') }}
      testIdPrefix={testIdPrefix}
    />
  )
}
