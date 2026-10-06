import { useState, useMemo } from 'react'
import Chip from '../ui/Chip'
import ChipButton from '../ui/ChipButton'
import CloseButton from '../ui/CloseButton'
import EmptyState from '../ui/EmptyState'
import CardSlot from '../board/CardSlot'
import Icon, { type IconName } from '../ui/Icon'
import DialogShell from '../ui/DialogShell'
import { stripTargetProgress, targetProgressLabel, type FeedbackPrompt } from './feedback'
import { useTranslation, dynamicT } from '../i18n'
import { localizeServerMessage } from './serverMessageTranslation'
import './CardGrid.css'
import Button from '../ui/Button'

interface CardGridProps {
  prompt: FeedbackPrompt
  selected: string[]
  setSelected: React.Dispatch<React.SetStateAction<string[]>>
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
  busy: boolean
}

export default function CardGrid({ prompt, selected, setSelected, send, busy }: CardGridProps) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('')
  const [showAll, setShowAll] = useState(false)
  const cards = prompt.cards ?? []
  const serverDriven = prompt.method === 'GAME_TARGET'
  const isMulti = !serverDriven && prompt.max > 1
  const chosen = serverDriven ? (prompt.chosenTargets ?? []) : selected
  const selectable = new Set(prompt.options.map((option) => option.id))

  // Pre-filtro por la petición del servidor: en GAME_TARGET las cartas legales
  // llegan en options.possibleTargets (el filtro real del objetivo, p. ej.
  // "artifact card"); el resto de cardsView1 son candidatas no elegibles. Las
  // ya elegidas se mantienen visibles para poder deshacer la elección.
  const validCards = cards.filter((card) => selectable.has(card.id) || chosen.includes(card.id))
  const hiddenCount = cards.length - validCards.length
  const scoped = selectable.size > 0 && hiddenCount > 0 && !showAll ? validCards : cards

  const filtered = useMemo(() => {
    if (!filter.trim()) return scoped
    const q = filter.toLowerCase()
    return scoped.filter((c) => {
      const name = (c.displayName ?? c.name).toLowerCase()
      const types = (c.cardTypes ?? []).join(' ').toLowerCase()
      const rules = (c.rules ?? []).join(' ').toLowerCase()
      return name.includes(q) || types.includes(q) || rules.includes(q)
    })
  }, [scoped, filter])

  const toggle = (cardId: string) => {
    if (busy) return
    if (isMulti) {
      setSelected((current) => current.includes(cardId)
        ? current.filter((id) => id !== cardId)
        : current.length < prompt.max ? [...current, cardId] : current)
    } else {
      void send(() => sendSingle(prompt, cardId), t('errors','send_failed_choice'))
    }
  }

  const confirmMulti = () => {
    void send(async () => {
      let result: { ok: boolean; error?: string } = { ok: true }
      for (const value of selected) {
        result = await sendSingle(prompt, value)
        if (!result.ok) break
      }
      return result
    }, t('errors','send_failed_choice'))
  }

  const progressText = serverDriven && prompt.progress ? targetProgressLabel(prompt.progress, dynamicT(t)) : null
  const message = serverDriven ? stripTargetProgress(prompt.message) : prompt.message
  const isDiscard = /descart|discard/i.test(prompt.message)
  const cardGridTitle = prompt.isLibraryOrderPick
    ? t('game', 'library_order_title')
    : isDiscard
      ? t('game', 'choose_discard')
      : (prompt.sourceName ?? (prompt.method === 'GAME_TARGET' ? t('game', 'choose_target') : t('game', 'choose_cards')))
  const kickerIcon: IconName = prompt.method === 'GAME_TARGET' ? (isDiscard ? 'trash' : 'target') : 'layers'

  return (
    <DialogShell
      labelledBy="feedback-title"
      titleId="feedback-title"
      size="lg"
      legacyBackdropClass="feedback-backdrop"
      legacyPanelClass="feedback-dialog card-grid-dialog"
      kickerIcon={kickerIcon}
      kickerLabel={prompt.method === 'GAME_TARGET' ? t('dialogs','cardgrid_select_targets') : t('dialogs','cardgrid_select_cards')}
      title={<>{cardGridTitle} <Chip tone="brand" size="md">
        {filtered.length === cards.length
          ? t('dialogs','cardgrid_count', { count: cards.length })
          : `${filtered.length} / ${cards.length}`}
      </Chip></>}
      message={message ? localizeServerMessage(message, dynamicT(t)) : undefined}
      search={(
        <div className="card-grid-search">
          <div className="card-grid-search-wrap">
            <span className="card-grid-search-icon"><Icon name="search" size={14} /></span>
            <input
              className="card-grid-filter"
              type="text"
              aria-label={t('dialogs','cardgrid_search_placeholder')}
              placeholder={t('dialogs','cardgrid_search_placeholder')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              autoFocus
            />
            {filter && (
              <CloseButton variant="plain" size="sm" className="card-grid-clear-btn" label={t('common','clear')} onClick={() => setFilter('')} />
            )}
          </div>
          {selectable.size > 0 && hiddenCount > 0 && (
            <ChipButton
              size="sm"
              active={!showAll}
              icon={showAll ? 'eye' : 'filter'}
              className="card-grid-scope-toggle"
              onClick={() => setShowAll((value) => !value)}
            >
              {showAll
                ? t('dialogs','cardgrid_only_valid', { count: validCards.length })
                : t('dialogs','cardgrid_show_all', { count: cards.length })}
            </ChipButton>
          )}
        </div>
      )}
    >
        <div className="card-grid-scroll-area">
          <div className="card-grid">
            {filtered.map((card) => (
              <button type="button"
                key={card.id}
                className={`card-grid-cell ${chosen.includes(card.id) ? 'selected' : ''}`}
                disabled={busy || (serverDriven && selectable.size > 0 && !selectable.has(card.id) && !chosen.includes(card.id))}
                aria-pressed={serverDriven || isMulti ? chosen.includes(card.id) : undefined}
                onClick={() => toggle(card.id)}
                title={`${card.displayName ?? card.name}${card.power && card.toughness ? ` (${card.power}/${card.toughness})` : ''}`}
              >
                <CardSlot
                  card={card as never}
                  cardId={card.id}
                  isChosen={chosen.includes(card.id)}
                />
                <span className="card-grid-label">{card.displayName ?? card.name}</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 && (
            <EmptyState icon="search" iconSize={12}>{t('dialogs','cardgrid_empty', { filter })}</EmptyState>
          )}
        </div>

        <footer className="card-grid-actions">
          {progressText && (
            <span className="card-grid-progress" data-testid="card-grid-progress" role="status" aria-live="polite">{progressText}</span>
          )}
          {isMulti && (
            <Button variant="primary"
              disabled={busy || selected.length < prompt.min}
              onClick={confirmMulti}
            >
              {t('dialogs','cardgrid_confirm', { selected: selected.length, max: prompt.max })}
            </Button>
          )}
          {prompt.required === false && (
            <Button disabled={busy} onClick={() => {
              void send(() => sendSingle(prompt, ''), t('errors','send_failed'))
            }}>
              {serverDriven && chosen.length > 0 ? t('dialogs','cardgrid_done', { count: chosen.length }) : t('dialogs','cardgrid_finish')}
            </Button>
          )}
        </footer>
    </DialogShell>
  )
}

function sendSingle(prompt: FeedbackPrompt, value: string): Promise<{ ok: boolean; error?: string }> {
  if (prompt.mode === 'uuid') {
    return value
      ? import('../net/commands').then((m) => m.sendPlayerUUID(value, prompt.gameId))
      : import('../net/commands').then((m) => m.sendPlayerBoolean(false, prompt.gameId))
  }
  return import('../net/commands').then((m) => m.sendPlayerString(value, prompt.gameId))
}
