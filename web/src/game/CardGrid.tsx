import { useState, useMemo } from 'react'
import CardSlot from '../board/CardSlot'
import type { FeedbackPrompt } from './feedback'
import { useTranslation } from '../i18n'
import './CardGrid.css'

interface CardGridProps {
  prompt: FeedbackPrompt
  selected: string[]
  setSelected: React.Dispatch<React.SetStateAction<string[]>>
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
  cancel: () => void
  busy: boolean
}

export default function CardGrid({ prompt, selected, setSelected, send, cancel, busy }: CardGridProps) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('')
  const cards = prompt.cards ?? []
  const isMulti = prompt.max > 1

  const filtered = useMemo(() => {
    if (!filter.trim()) return cards
    const q = filter.toLowerCase()
    return cards.filter((c) => {
      const name = (c.displayName ?? c.name).toLowerCase()
      const types = (c.cardTypes ?? []).join(' ').toLowerCase()
      const rules = (c.rules ?? []).join(' ').toLowerCase()
      return name.includes(q) || types.includes(q) || rules.includes(q)
    })
  }, [cards, filter])

  const toggle = (cardId: string) => {
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

  return (
    <div className="feedback-backdrop" role="presentation">
      <section className="feedback-dialog card-grid-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <header className="card-grid-header">
          <div className="feedback-kicker">
            <span className="kicker-icon">{prompt.method === 'GAME_TARGET' ? '🎯' : '🃏'}</span>{' '}
            {prompt.method === 'GAME_TARGET' ? t('dialogs','cardgrid_select_targets') : t('dialogs','cardgrid_select_cards')}
          </div>
          <div className="card-grid-title-row">
            <h2 id="feedback-title">{prompt.title}</h2>
            <span className="card-grid-count-badge">
              {filtered.length === cards.length
                ? `${cards.length} ${t('board','zone_hand')}`
                : `${filtered.length} / ${cards.length}`}
            </span>
          </div>
          {prompt.message && <p className="card-grid-message">{prompt.message}</p>}

          <div className="card-grid-search-wrap">
            <span className="card-grid-search-icon">🔍</span>
            <input
              className="card-grid-filter"
              type="text"
              placeholder={t('dialogs','cardgrid_search_placeholder')}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              autoFocus
            />
            {filter && (
              <button
                type="button"
                className="card-grid-clear-btn"
                onClick={() => setFilter('')}
                title={t('common','clear')}
              >
                ✕
              </button>
            )}
          </div>
        </header>

        <div className="card-grid-scroll-area">
          <div className="card-grid">
            {filtered.map((card) => (
              <button
                key={card.id}
                className={`card-grid-cell ${selected.includes(card.id) ? 'selected' : ''}`}
                disabled={busy}
                onClick={() => toggle(card.id)}
                title={`${card.displayName ?? card.name}${card.power && card.toughness ? ` (${card.power}/${card.toughness})` : ''}`}
              >
                <CardSlot
                  card={card as never}
                  cardId={card.id}
                  isChosen={selected.includes(card.id)}
                />
                <span className="card-grid-label">{card.displayName ?? card.name}</span>
              </button>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="card-grid-empty">
              <span>🔍</span>
              <p>{t('dialogs','cardgrid_empty', { filter })}</p>
            </div>
          )}
        </div>

        <footer className="card-grid-actions">
          {isMulti && (
            <button
              className="primary"
              disabled={busy || selected.length < prompt.min}
              onClick={confirmMulti}
            >
              {t('dialogs','cardgrid_confirm', { selected: selected.length, max: prompt.max })}
            </button>
          )}
          {prompt.required === false && (
            <button disabled={busy} onClick={() => {
              void send(() => sendSingle(prompt, ''), t('errors','send_failed'))
            }}>
              {t('dialogs','cardgrid_finish')}
            </button>
          )}
          <button disabled={busy} onClick={cancel}>{t('dialogs','cardgrid_cancel')}</button>
        </footer>
      </section>
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
