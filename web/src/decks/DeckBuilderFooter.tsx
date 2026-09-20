import Button from '../ui/Button'
import type { DeckV2 } from './types'
import { useTranslation } from '../i18n'
import { downloadDeckFile } from './exportDeckFile'
import Icon from '../ui/Icon'

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
        <button
          type="button"
          className="builder-act"
          title={`${t('decks', 'export_deck')} .dck`}
          onClick={() => void downloadDeckFile(deck, 'dck', `✓ ${t('common', 'copied')}`)}
        >
          {t('decks', 'export_dck')}
        </button>
        <button
          type="button"
          className="builder-act"
          title={`${t('decks', 'export_deck')} Arena`}
          onClick={() => void downloadDeckFile(deck, 'arena', `✓ ${t('common', 'copied')}`)}
        >
          {t('decks', 'export_arena')}
        </button>
        <button
          type="button"
          className="builder-act"
          title={`${t('decks', 'export_deck')} Plain`}
          onClick={() => void downloadDeckFile(deck, 'txt', `✓ ${t('common', 'copied')}`)}
        >
          {t('decks', 'export_plain')}
        </button>
        <button
          type="button"
          className="builder-act"
          title={`${t('decks', 'export_deck')} MTGO .dek`}
          onClick={() => void downloadDeckFile(deck, 'dek', `✓ ${t('common', 'copied')}`)}
        >
          {t('decks', 'export_dek')}
        </button>
        <button
          type="button"
          className="builder-act"
          onClick={onImport}
          title={t('decks', 'import_hint')}
        >
          <Icon name="download" size={12} /> {t('decks', 'import_deck')}
        </button>
        <button
          type="button"
          className="builder-act"
          onClick={onSample}
          title={t('decks', 'sample_london')}
        >
          <Icon name="hand" size={12} /> {t('decks', 'builder_sample')}
        </button>
        <Button
          variant="primary"
          className={`builder-act ${isEquipped ? 'is-equipped' : ''}`}
          onClick={onEquip}
          disabled={isEquipped}
          title={isEquipped ? t('decks', 'builder_equipped') : t('decks', 'builder_equip')}
        >
          {isEquipped ? `✓ ${t('decks', 'builder_equipped')}` : t('decks', 'builder_equip')}
        </Button>
      </div>

      {/* Glowing Signature Done Button */}
      <button type="button" className="builder-done" onClick={onClose}>
        {t('common', 'save')}
      </button>
    </div>
  )
}
