import { useMemo } from 'react'
import { useTranslation } from '../i18n'
import type { CardCategory } from './cardCategory'

export function useTypeLabels(): Record<CardCategory, string> {
  const { t } = useTranslation()
  return useMemo(() => ({
    creatures: t('decks', 'creatures'),
    planeswalkers: t('game', 'category_planeswalkers'),
    instants: t('game', 'category_instants'),
    sorceries: t('game', 'category_sorceries'),
    enchantments: t('game', 'category_enchantments'),
    artifacts: t('game', 'category_artifacts'),
    lands: t('game', 'category_lands'),
    other: t('game', 'category_other'),
  }), [t])
}
