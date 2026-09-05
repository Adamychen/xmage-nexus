import type { DeckV2 } from './types'
import { useTranslation } from '../i18n'
import { downloadDeckFile } from './exportDeckFile'
import Icon from '../ui/Icon'

interface Props {
  deck: DeckV2
  equippedName?: string
  onImport: () => void
  onSample: () => void
  onEquip: () => void
  onClose: () => void
}

export default function DeckBuilderFooter({ deck, equippedName, onImport, onSample, onEquip, onClose }: Props) {
  const { t } = useTranslation()
  return (
    <div className="builder-deck-footer">
      <div className="builder-action-btns-row builder-actions">
        <button
          type="button"
          className="builder-act"
          title={`${t('decks', 'export_deck')} .dck — ${t('common', 'copied')}`}
          onClick={() => void downloadDeckFile(deck, 'dck', `✓ ${t('common', 'copied')}`)}
        >
          Export .DCK
        </button>
        <button
          type="button"
          className="builder-act"
          title={`${t('decks', 'export_deck')} Arena — ${t('common', 'copied')}`}
          onClick={() => void downloadDeckFile(deck, 'arena', `✓ ${t('common', 'copied')}`)}
        >
          Export Arena
        </button>
        <button
          type="button"
          className="builder-act"
          title={`${t('decks', 'export_deck')} Plain — ${t('common', 'copied')}`}
          onClick={() => void downloadDeckFile(deck, 'txt', `✓ ${t('common', 'copied')}`)}
        >
          Export Plain
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
        <button
          type="button"
          className={`builder-act primary ${equippedName === deck.name ? 'is-equipped' : ''}`}
          onClick={onEquip}
        >
          {equippedName === deck.name ? `✓ ${t('common', 'done')}` : t('common', 'confirm')}
        </button>
      </div>

      {/* Glowing Signature Done Button */}
      <button type="button" className="builder-done" onClick={onClose}>
        {t('common', 'save')}
      </button>
    </div>
  )
}
