import { useTranslation } from '../i18n'

export default function Attribution() {
  const { t } = useTranslation()
  const parts = t('common', 'attribution_scryfall').split('Scryfall')
  return (
    <>
      {parts[0]}
      <a href="https://scryfall.com" target="_blank" rel="noopener noreferrer">Scryfall</a>
      {parts[1] ?? ' · Not affiliated with Wizards of the Coast'}
    </>
  )
}
