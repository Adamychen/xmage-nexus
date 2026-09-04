import { useSyncExternalStore } from 'react'
import type { Deck } from './decks'
import { fetchDeckIssues } from '../decks/deckIssues'
import type { DeckMismatchCard, DeckMissingCard, DeckValidationResult } from '../net/types'
import { useTranslation } from '../i18n'
import './DeckIssuesDialog.css'

/**
 * Diálogo modal pre-unión: muestra las cartas del mazo que el servidor XMage
 * rechazará ("Card not found") o cargará como otra carta, y ofrece repararlas
 * (impresión alternativa) o quitarlas y jugar con el mazo corregido.
 *
 * API por promesas: `requestDeckValidation(deck)` devuelve el mazo final
 * (posiblemente corregido) o null si el usuario cancela.
 */

interface ActiveRequest {
  deck: Deck
  report: DeckValidationResult
  resolve: (deck: Deck | null) => void
}

let active: ActiveRequest | null = null
let listener: (() => void) | null = null

function notify() {
  listener?.()
}

function subscribe(fn: () => void) {
  listener = fn
  return () => {
    listener = null
  }
}

function applySuggestion(deck: Deck, from: { cardName: string; setCode: string; cardNumber: string }, to: { cardName: string; setCode: string; cardNumber: string }): Deck {
  const swap = (cards: Deck['cards']) =>
    cards.map((c) =>
      c.cardName === from.cardName && c.setCode === from.setCode && c.cardNumber === from.cardNumber
        ? { ...c, cardName: to.cardName, setCode: to.setCode, cardNumber: to.cardNumber }
        : c,
    )
  return { ...deck, cards: swap(deck.cards), sideboard: swap(deck.sideboard) }
}

/**
 * Valida el mazo y, si el servidor lo rechazaría, muestra el diálogo.
 * Resuelve con el mazo (corregido si procede) o null si el usuario cancela.
 */
export function requestDeckValidation(deck: Deck): Promise<Deck | null> {
  return (async () => {
    const report = await fetchDeckIssues(deck)
    if (!report) {
      return deck
    }
    const hasMissing = report.missing.length > 0
    const hasMismatches = report.mismatches.length > 0
    if (!hasMissing && !hasMismatches) {
      return deck
    }
    return new Promise<Deck | null>((resolve) => {
      active = { deck, report, resolve }
      notify()
    })
  })()
}

function closeRequest(result: Deck | null) {
  active?.resolve(result)
  active = null
  notify()
}

export default function DeckIssuesDialog() {
  const req = useSyncExternalStore(subscribe, () => active, () => active)
  const { t } = useTranslation()
  if (!req) {
    return null
  }
  const { deck, report } = req
  const missing: DeckMissingCard[] = report.missing
  const mismatches: DeckMismatchCard[] = report.mismatches
  const removable = missing.reduce((acc, c) => acc + c.amount, 0)

  const retryWith = (next: Deck) => {
    // resolver la petición original con el resultado de la re-validación
    const originalResolve = active?.resolve
    active = null
    notify()
    void requestDeckValidation(next).then((result) => {
      originalResolve?.(result)
    })
  }

  return (
    <div className="modal-backdrop" data-testid="deck-issues-backdrop">
      <div className="deck-issues-modal panel" role="dialog" aria-modal="true" data-testid="deck-issues-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="deck-issues-header">
          <h2 data-testid="deck-issues-title">⚠️ {t('decks', 'issues_title')}</h2>
          <p className="deck-issues-intro">{t('decks', 'issues_intro')}</p>
        </div>

        <div className="deck-issues-body">
          {missing.length > 0 && (
            <section className="deck-issues-section">
              <h3>{t('decks', 'issues_missing_section')}</h3>
              <ul data-testid="deck-issues-missing-list">
                {missing.map((c) => (
                  <li key={`${c.cardName}|${c.setCode}|${c.cardNumber}`} className="deck-issue-row" data-testid="deck-issue-row">
                    <span className="deck-issue-card">
                      {c.amount}× <strong>{c.cardName}</strong>{' '}
                      <span className="deck-issue-printing">({c.setCode} #{c.cardNumber})</span>
                    </span>
                    <span className="deck-issue-reason">
                      {c.reason === 'OUTDATED_PRINTING'
                        ? t('decks', 'issues_reason_outdated')
                        : t('decks', 'issues_reason_unimplemented')}
                    </span>
                    {c.suggestions && c.suggestions.length > 0 && (
                      <span className="deck-issue-fixes">
                        {c.suggestions.slice(0, 3).map((s) => (
                          <button
                            key={`${s.setCode}:${s.cardNumber}`}
                            type="button"
                            className="deck-issue-suggestion-btn"
                            data-testid="deck-issue-suggestion"
                            onClick={() => retryWith(applySuggestion(deck, c, s))}
                          >
                            {t('decks', 'issues_use_suggestion', { set: s.setCode, num: s.cardNumber })}
                          </button>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {mismatches.length > 0 && (
            <section className="deck-issues-section">
              <h3>{t('decks', 'issues_mismatch_section')}</h3>
              <ul data-testid="deck-issues-mismatch-list">
                {mismatches.map((c) => (
                  <li key={`${c.cardName}|${c.setCode}|${c.cardNumber}`} className="deck-issue-row">
                    <span className="deck-issue-card">
                      {c.amount}× <strong>{c.cardName}</strong>{' '}
                      <span className="deck-issue-printing">({c.setCode} #{c.cardNumber})</span>
                    </span>
                    <span className="deck-issue-reason">{t('decks', 'issues_mismatch_resolved', { resolved: c.resolvedName })}</span>
                    {c.suggestions && c.suggestions.length > 0 && (
                      <span className="deck-issue-fixes">
                        {c.suggestions.slice(0, 3).map((s) => (
                          <button
                            key={`${s.setCode}:${s.cardNumber}`}
                            type="button"
                            className="deck-issue-suggestion-btn"
                            data-testid="deck-issue-suggestion"
                            onClick={() => retryWith(applySuggestion(deck, c, s))}
                          >
                            {t('decks', 'issues_use_suggestion', { set: s.setCode, num: s.cardNumber })}
                          </button>
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="deck-issues-footer">
          <button type="button" className="deck-issues-cancel-btn" data-testid="deck-issues-cancel" onClick={() => closeRequest(null)}>
            {t('decks', 'issues_cancel')}
          </button>
          {missing.length > 0 && report.fixedDeck && (
            <button
              type="button"
              className="primary deck-issues-play-btn"
              data-testid="deck-issues-remove-and-play"
              onClick={() => closeRequest({ name: deck.name, cards: report.fixedDeck!.cards, sideboard: report.fixedDeck!.sideboard })}
            >
              {t('decks', 'issues_remove_and_play', { count: removable })}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
