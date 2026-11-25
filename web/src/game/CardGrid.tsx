import { useEffect, useMemo, useState } from 'react'
import Chip from '../ui/Chip'
import ChipButton from '../ui/ChipButton'
import CloseButton from '../ui/CloseButton'
import EmptyState from '../ui/EmptyState'
import CardSlot from '../board/CardSlot'
import PeekHint from './PeekHint'
import Icon from '../ui/Icon'
import Button from '../ui/Button'
import ArenaFan from './arena/ArenaFan'
import ArenaPromptShell from './arena/ArenaPromptShell'
import type { CardView } from '../net/types'
import { stripTargetProgress, targetProgressLabel, type FeedbackPrompt } from './feedback'
import { useTranslation, dynamicT } from '../i18n'
import { localizeServerMessage } from './serverMessageTranslation'
import { setState } from '../state/store'
import './CardGrid.css'

interface CardGridProps {
  prompt: FeedbackPrompt
  selected: string[]
  setSelected: React.Dispatch<React.SetStateAction<string[]>>
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
  busy: boolean
}

const DEAL_MS = 900

function noop() {}

export default function CardGrid({ prompt, selected, setSelected, send, busy }: CardGridProps) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [dealing, setDealing] = useState(true)
  const cards = useMemo(() => prompt.cards ?? [], [prompt.cards])
  const serverDriven = prompt.method === 'GAME_TARGET'
  const isMulti = !serverDriven && prompt.max > 1
  const chosen = useMemo(() => (serverDriven ? (prompt.chosenTargets ?? []) : selected), [serverDriven, prompt.chosenTargets, selected])
  const chosenSet = useMemo(() => new Set(chosen), [chosen])
  const selectable = useMemo(() => new Set(prompt.options.map((option) => option.id)), [prompt.options])

  useEffect(() => {
    const timer = setTimeout(() => setDealing(false), DEAL_MS)
    return () => clearTimeout(timer)
  }, [])

  // Pre-filter by the server's legal candidates (PRM-5); keep already chosen cards visible.
  const validCards = useMemo(
    () => cards.filter((card) => selectable.has(card.id) || chosenSet.has(card.id)),
    [cards, selectable, chosenSet],
  )
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
      void send(() => sendSingle(prompt, cardId), t('errors', 'send_failed_choice'))
    }
  }

  const confirmMulti = () => {
    if (selected.length === 0) return
    void send(async () => {
      let result: { ok: boolean; error?: string } = { ok: true }
      for (const value of selected) {
        result = await sendSingle(prompt, value)
        if (!result.ok) break
      }
      return result
    }, t('errors', 'send_failed_choice'))
  }

  const progressText = serverDriven && prompt.progress ? targetProgressLabel(prompt.progress, dynamicT(t)) : null
  const message = serverDriven ? stripTargetProgress(prompt.message) : prompt.message
  const isDiscard = /descart|discard/i.test(prompt.message)
  const cardGridTitle = prompt.isLibraryOrderPick
    ? t('game', 'library_order_title')
    : isDiscard
      ? t('game', 'choose_discard')
      : (prompt.sourceName ?? (prompt.method === 'GAME_TARGET' ? t('game', 'choose_target') : t('game', 'choose_cards')))

  const renderCard = (cardView: CardView) => {
    const id = cardView.id as string
    const card = filtered.find((c) => c.id === id) ?? (cardView as unknown as NonNullable<FeedbackPrompt['cards']>[number])
    const isChosen = chosenSet.has(id)
    const isDisabled = busy || (serverDriven && selectable.size > 0 && !selectable.has(id) && !isChosen)
    const label = card.displayName ?? card.name
    return (
      <div
        className="card-grid-item"
        onContextMenu={(e) => {
          e.preventDefault()
          setState({ inspectedCard: card as never })
        }}
      >
        <button
          type="button"
          className={`card-grid-cell${isChosen ? ' selected' : ''}`}
          disabled={isDisabled}
          aria-pressed={serverDriven || isMulti ? isChosen : undefined}
          onClick={() => toggle(id)}
          title={`${label}${card.power && card.toughness ? ` (${card.power}/${card.toughness})` : ''}`}
        >
          <CardSlot card={card as never} cardId={id} isChosen={isChosen} />
          {isChosen && (
            <span className="card-grid-chosen-mark" aria-hidden="true">
              <Icon name="check" size={13} />
            </span>
          )}
          <span className="card-grid-sr-name">{label}</span>
        </button>
      </div>
    )
  }

  return (
    <div className="arena-card-grid">
      <ArenaPromptShell
        testId="card-grid-prompt"
        backdropClassName="feedback-backdrop"
        dialogClassName="feedback-dialog card-grid-dialog"
        onEscape={prompt.cancelable && !busy ? () => void send(() => sendSingle(prompt, ''), t('errors', 'send_failed')) : undefined}
        trailing={<PeekHint />}
        title={(
          <span className="arena-card-grid-title">
            <span>{cardGridTitle}</span>
            <Chip tone="brand" size="md">
              {filtered.length === cards.length
                ? t('dialogs', 'cardgrid_count', { count: cards.length })
                : `${filtered.length} / ${cards.length}`}
            </Chip>
          </span>
        )}
        instruction={message ? localizeServerMessage(message, dynamicT(t)) : undefined}
        footer={(
          <footer className="card-grid-actions">
            {progressText && (
              <span className="card-grid-progress" data-testid="card-grid-progress" role="status" aria-live="polite">
                {progressText}
              </span>
            )}
            {isMulti && (
              <Button
                className="arena-card-grid-done"
                disabled={busy || selected.length < Math.max(prompt.min, 1)}
                onClick={confirmMulti}
              >
                {t('dialogs', 'cardgrid_confirm', { selected: selected.length, max: prompt.max })}
              </Button>
            )}
            {prompt.required === false && (
              <Button
                className="arena-card-grid-done"
                disabled={busy}
                onClick={() => {
                  void send(() => sendSingle(prompt, ''), t('errors', 'send_failed'))
                }}
              >
                {serverDriven && chosen.length > 0
                  ? t('dialogs', 'cardgrid_done', { count: chosen.length })
                  : prompt.cancelable ? t('game', 'targeting_cancel') : t('dialogs', 'cardgrid_finish')}
              </Button>
            )}
          </footer>
        )}
      >
        <section className="arena-prompt-zone arena-card-grid-zone">
          <div className="card-grid-search">
            <div className="card-grid-search-wrap">
              <span className="card-grid-search-icon"><Icon name="search" size={14} /></span>
              <input
                className="card-grid-filter"
                type="text"
                aria-label={t('dialogs', 'cardgrid_search_placeholder')}
                placeholder={t('dialogs', 'cardgrid_search_placeholder')}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                autoFocus
              />
              {filter && (
                <CloseButton variant="plain" size="sm" className="card-grid-clear-btn" label={t('common', 'clear')} onClick={() => setFilter('')} />
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
                  ? t('dialogs', 'cardgrid_only_valid', { count: validCards.length })
                  : t('dialogs', 'cardgrid_show_all', { count: cards.length })}
              </ChipButton>
            )}
          </div>

          {filtered.length > 0 ? (
            <div className="card-grid">
              <ArenaFan
                zoneId="card-grid"
                cards={filtered as unknown as CardView[]}
                gapIndex={null}
                dealing={dealing}
                onCardPointerDown={noop}
                renderCard={renderCard}
                laneRef={noop}
              />
            </div>
          ) : (
            <EmptyState icon="search" iconSize={12}>{t('dialogs', 'cardgrid_empty', { filter })}</EmptyState>
          )}
        </section>
      </ArenaPromptShell>
    </div>
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
