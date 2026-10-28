import { useTranslation } from '../i18n'
import type { StackLabels } from './stackColumns'
import { useTypeLabels } from './useTypeLabels'

export function useStackLabels(): StackLabels {
  const { t } = useTranslation()
  const type = useTypeLabels()
  return {
    type,
    cmc: (n: number) => (n >= 6 ? t('decks', 'pile_cmc_max') : t('decks', 'pile_cmc', { n })),
    edh: (n: number) => t('decks', 'pile_edh', { n }),
    lands: t('decks', 'pile_lands'),
    color: {
      W: t('decks', 'color_W'),
      U: t('decks', 'color_U'),
      B: t('decks', 'color_B'),
      R: t('decks', 'color_R'),
      G: t('decks', 'color_G'),
      multi: t('decks', 'color_multi'),
      colorless: t('decks', 'color_colorless'),
    },
    rarity: {
      mythic: t('decks', 'rarity_mythic'),
      rare: t('decks', 'rarity_rare'),
      uncommon: t('decks', 'rarity_uncommon'),
      common: t('decks', 'rarity_common'),
      other: t('decks', 'rarity_other'),
    },
    loading: t('decks', 'pile_loading'),
    unsorted: t('decks', 'pile_unsorted'),
    commander: t('decks', 'pile_commander'),
  }
}
