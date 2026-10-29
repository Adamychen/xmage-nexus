import Icon from '../../ui/Icon'
import { useTranslation } from '../../i18n'
import FormatField from './FormatField'
import { deckTypeFamily, groupGameTypes, visualOf } from './formatFamily'
import type { CreateTableForm } from './types'
import type { GalleryFamily, GalleryItem } from './FormatGallery'

function useFormatItems(form: CreateTableForm) {
  const { t } = useTranslation()
  const gameFamilies: GalleryFamily[] = [
    { id: 'classic', label: t('lobby', 'family_classic'), icon: 'swords' },
    { id: 'variant', label: t('lobby', 'family_variant'), icon: 'crown' },
  ]
  const deckFamilies: GalleryFamily[] = [
    { id: 'constructed', label: t('lobby', 'family_constructed'), icon: 'shield' },
    { id: 'block', label: t('lobby', 'family_block'), icon: 'book' },
    { id: 'variant', label: t('lobby', 'family_variant'), icon: 'crown' },
    { id: 'limited', label: t('lobby', 'family_limited'), icon: 'layers' },
  ]
  const gameItems: GalleryItem[] = groupGameTypes(form.effectiveGameTypes).map((base) => ({
    value: base.id,
    label: base.label || t('lobby', 'family_classic'),
    family: base.family,
    visual: base.visual,
    modes: base.modes.map((m) => ({
      value: m.value,
      label: m.mode === 'duel' ? t('lobby', 'family_duel') : m.mode === 'multi' ? t('lobby', 'family_multi') : '',
      meta: m.meta,
    })),
  }))
  const deckItems: GalleryItem[] = form.effectiveDeckTypes.map((d) => ({
    value: d,
    label: d,
    family: deckTypeFamily(d),
    visual: visualOf(d),
  }))
  return { t, gameFamilies, deckFamilies, gameItems, deckItems }
}

/** The game type of a match or of a constructed tournament. */
export function GameTypeField({ form }: { form: CreateTableForm }) {
  const { t, gameFamilies, gameItems } = useFormatItems(form)
  return (
    <FormatField
      testId="format-game-type"
      label={t('lobby', 'create_field_game_type')}
      galleryTitle={t('lobby', 'gallery_title_game')}
      value={form.gameType}
      items={gameItems}
      families={gameFamilies}
      onSelect={form.setGameType}
    />
  )
}

/** The deck format of a match or of a constructed tournament. */
export function DeckTypeField({ form }: { form: CreateTableForm }) {
  const { t, deckFamilies, deckItems } = useFormatItems(form)
  return (
    <FormatField
      testId="format-deck-type"
      label={t('lobby', 'create_field_format')}
      galleryTitle={t('lobby', 'gallery_title_deck')}
      value={form.deckType}
      items={deckItems}
      families={deckFamilies}
      onSelect={form.setDeckType}
    />
  )
}

/** The game type and the deck format of a match or a constructed tournament. */
export default function TypeFields({ form, className }: { form: CreateTableForm; className: string }) {
  return (
    <>
      <div className={className}>
        <GameTypeField form={form} />
        <DeckTypeField form={form} />
      </div>
      <CompatibilityHint form={form} />
    </>
  )
}

export function CompatibilityHint({ form }: { form: CreateTableForm }) {
  if (!form.compatibilityError) return null
  return (
    <div className="wizard-hint-box wizard-hint-box--err"><Icon name="alert" size={13} /> {form.compatibilityError}</div>
  )
}
