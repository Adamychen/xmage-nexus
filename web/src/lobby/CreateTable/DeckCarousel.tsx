import { useEffect, useRef, type KeyboardEvent } from 'react'
import { deckRef, type Deck } from '../decks'
import { useCardArtUrl } from '../../decks/useCardArtUrl'
import { deckInitials } from '../../decks/types'
import { useTranslation } from '../../i18n'
import Button from '../../ui/Button'
import { radioNavIndex } from './radioNav'

export default function DeckCarousel({
  decks,
  selected,
  onSelect,
  label,
  disabled,
}: {
  decks: Deck[]
  selected: string
  onSelect: (ref: string) => void
  label: string
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const track = trackRef.current
    const card = track?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (!track || !card) return
    track.scrollTo?.({ left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' })
  }, [selected])

  const scrollBy = (direction: 1 | -1) => {
    const track = trackRef.current
    track?.scrollBy?.({ left: direction * track.clientWidth * 0.8, behavior: 'smooth' })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const cards = Array.from(trackRef.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])
    const current = cards.indexOf(e.target as HTMLElement)
    const next = radioNavIndex(e.key, current, cards.length)
    if (next === null) return
    e.preventDefault()
    onSelect(deckRef(decks[next]))
    cards[next].focus()
  }

  if (decks.length === 0) return null

  return (
    <div className={`deck-carousel ${disabled ? 'is-disabled' : ''}`}>
      <Button variant="ghost" size="sm" className="deck-carousel-nav" aria-label={t('lobby', 'seats_carousel_prev')} onClick={() => scrollBy(-1)}>
        <span aria-hidden="true">‹</span>
      </Button>
      <div
        ref={trackRef}
        className="deck-carousel-track"
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
      >
        {decks.map((deck) => (
          <DeckCarouselCard
            key={deckRef(deck)}
            deck={deck}
            selected={deckRef(deck) === selected}
            disabled={disabled}
            onPick={() => onSelect(deckRef(deck))}
          />
        ))}
      </div>
      <Button variant="ghost" size="sm" className="deck-carousel-nav" aria-label={t('lobby', 'seats_carousel_next')} onClick={() => scrollBy(1)}>
        <span aria-hidden="true">›</span>
      </Button>
    </div>
  )
}

function DeckCarouselCard({ deck, selected, disabled, onPick }: { deck: Deck; selected: boolean; disabled?: boolean; onPick: () => void }) {
  const { t } = useTranslation()
  const artUrl = useCardArtUrl(deck.commanders?.[0] ?? deck.cards[0])
  const total = deck.cards.reduce((sum, c) => sum + c.amount, 0)
  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled || undefined}
      tabIndex={selected ? 0 : -1}
      className={`deck-carousel-card ${selected ? 'selected' : ''}`}
      onClick={() => { if (!disabled) onPick() }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        if (!disabled) onPick()
      }}
    >
      <span className="deck-carousel-art">
        {artUrl ? <img src={artUrl} alt="" loading="lazy" /> : <span className="deck-carousel-fallback">{deckInitials(deck.name)}</span>}
      </span>
      <span className="deck-carousel-name" title={deck.name}>{deck.name}</span>
      <span className="deck-carousel-count">{total} {t('decks', 'total_cards')}</span>
    </div>
  )
}
