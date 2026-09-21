import Button from '../ui/Button'
import type { DeckV2 } from './types'
import { useTranslation } from '../i18n'
import { downloadDeckFile } from './exportDeckFile'
import Icon from '../ui/Icon'
import DropdownMenu from '../ui/DropdownMenu'
import MenuItem from '../ui/MenuItem'

interface Props {
  deck: DeckV2
  isEquipped?: boolean
  onImport: () => void
  onSample: () => void
  onEquip: () => void
  onClose: () => void
}

export default function DeckBuilderFooter({ deck, isEquipped, onImport, onSample, onEquip, onClose }: Props) {
  const { t } = useTranslation()
  return (
    <div className="builder-deck-footer">
      <div className="builder-action-btns-row builder-actions">
        <DropdownMenu label={t('decks', 'export_deck')} icon="download" direction="up" align="start" className="builder-act" data-testid="builder-export-menu">
          <MenuItem role="menuitem" icon="save" onClick={() => void downloadDeckFile(deck, 'dck', `✓ ${t('common', 'copied')}`)}>.dck</MenuItem>
          <MenuItem role="menuitem" icon="clipboard" onClick={() => void downloadDeckFile(deck, 'arena', `✓ ${t('common', 'copied')}`)}>Arena</MenuItem>
          <MenuItem role="menuitem" icon="file" onClick={() => void downloadDeckFile(deck, 'txt', `✓ ${t('common', 'copied')}`)}>Plain</MenuItem>
          <MenuItem role="menuitem" icon="file" onClick={() => void downloadDeckFile(deck, 'dek', `✓ ${t('common', 'copied')}`)}>.dek</MenuItem>
        </DropdownMenu>
        <Button variant="subtle" size="sm" className="builder-act"
          onClick={onImport}
          title={t('decks', 'import_hint')}>
          <Icon name="download" size={12} /> {t('decks', 'import_deck')}
        </Button>
        <Button variant="subtle" size="sm" className="builder-act"
          onClick={onSample}
          title={t('decks', 'sample_london')}>
          <Icon name="hand" size={12} /> {t('decks', 'builder_sample')}
        </Button>
        <Button
          variant={isEquipped ? 'success' : 'primary'}
          size="sm"
          className="builder-act"
          onClick={onEquip}
          disabled={isEquipped}
          title={isEquipped ? t('decks', 'builder_equipped') : t('decks', 'builder_equip')}
        >
          {isEquipped ? `✓ ${t('decks', 'builder_equipped')}` : t('decks', 'builder_equip')}
        </Button>
      </div>

      {/* Glowing Signature Done Button */}
      <Button variant="primary" size="lg" block data-testid="builder-done" onClick={onClose}>
        {t('common', 'save')}
      </Button>
    </div>
  )
}
