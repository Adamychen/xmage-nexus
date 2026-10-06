import { useState } from 'react'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import { addStarterDecks, starterDeckItems } from './starterDecks'
import type { DeckV2 } from './types'
import './StarterDecksOffer.css'

export default function StarterDecksOffer({ onAdded }: { onAdded: (decks: DeckV2[]) => void }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const names = starterDeckItems().map((d) => d.name).join(', ')

  const add = async () => {
    setBusy(true)
    setFailed(false)
    try {
      onAdded(await addStarterDecks())
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="starter-decks-offer" data-testid="starter-decks-offer">
      <span className="starter-decks-offer-title"><Icon name="layers" size={13} /> {t('decks', 'starter_title')}</span>
      <span>{t('decks', 'starter_desc', { names })}</span>
      <Button variant="primary" size="sm" icon="plus" disabled={busy} onClick={() => void add()} data-testid="starter-decks-add">
        {t('decks', 'starter_add')}
      </Button>
      {failed && <span className="starter-decks-offer-error" role="alert">{t('decks', 'starter_failed')}</span>}
    </div>
  )
}
