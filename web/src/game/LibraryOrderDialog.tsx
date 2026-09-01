import { useTranslation } from '../i18n'
import { useState, useMemo, useEffect } from 'react'
import * as cmds from '../net/commands'
import type { FeedbackOption, FeedbackPrompt } from './feedback'
import CardSlot from '../board/CardSlot'
import FormattedText from './FormattedText'
import './LibraryOrderDialog.css'

interface LibraryOrderDialogProps {
  prompt: FeedbackPrompt
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
  cancel: () => void
  busy: boolean
}

interface OrderableCard {
  id: string
  option: FeedbackOption
  card: any
}

export default function LibraryOrderDialog({ prompt, send, cancel, busy }: LibraryOrderDialogProps) {
  const { t, lang } = useTranslation()
  const initialCards = useMemo((): OrderableCard[] => {
    const feedbackCards = prompt.cards ?? []
    const options = prompt.options ?? []

    return options.map((opt) => {
      const matchedCard = feedbackCards.find((c) => c.id === opt.id)
      return {
        id: opt.id,
        option: opt,
        card: matchedCard ?? {
          id: opt.id,
          name: opt.label,
          manaValue: 0,
          expansionSetCode: '',
          cardNumber: '0',
        },
      }
    })
  }, [prompt.options, prompt.cards])

  const [topCards, setTopCards] = useState<OrderableCard[]>(initialCards)
  const [bottomCards, setBottomCards] = useState<OrderableCard[]>([])

  useEffect(() => {
    setTopCards(initialCards)
    setBottomCards([])
  }, [initialCards])

  const isSurveil = prompt.message.toLowerCase().includes('surveil') || prompt.title.toLowerCase().includes('surveil')
  const isBlockerOrder =
    prompt.message.toLowerCase().includes('blocker') ||
    prompt.message.toLowerCase().includes('bloqueador') ||
    prompt.message.toLowerCase().includes('damage order') ||
    prompt.title.toLowerCase().includes('bloqueador') ||
    prompt.title.toLowerCase().includes('blocker')

  const moveUp = (index: number) => {
    if (index <= 0) return
    const next = [...topCards]
    const temp = next[index]
    next[index] = next[index - 1]
    next[index - 1] = temp
    setTopCards(next)
  }

  const moveDown = (index: number) => {
    if (index >= topCards.length - 1) return
    const next = [...topCards]
    const temp = next[index]
    next[index] = next[index + 1]
    next[index + 1] = temp
    setTopCards(next)
  }

  const moveToBottom = (index: number) => {
    const card = topCards[index]
    setTopCards(topCards.filter((_, i) => i !== index))
    setBottomCards([...bottomCards, card])
  }

  const moveToTop = (index: number) => {
    const card = bottomCards[index]
    setBottomCards(bottomCards.filter((_, i) => i !== index))
    setTopCards([...topCards, card])
  }

  const allToTop = () => {
    setTopCards([...topCards, ...bottomCards])
    setBottomCards([])
  }

  const allToBottom = () => {
    setBottomCards([...bottomCards, ...topCards])
    setTopCards([])
  }

  const handleConfirm = () => {
    const finalOrder = [...topCards.map((c) => c.id), ...bottomCards.map((c) => c.id)]
    void send(
      () => cmds.sendPlayerString(finalOrder.join(' '), prompt.gameId),
      t('errors','send_failed')
    )
  }

  return (
    <div className="feedback-overlay library-order-overlay" role="dialog" aria-modal="true">
      <section className="feedback-dialog library-order-dialog">
        <header className="feedback-header">
          <div className="dialog-title-wrap">
            <span className="dialog-icon">{isBlockerOrder ? '🛡️' : '🔮'}</span>
            <span className="dialog-title">
              {isBlockerOrder
                ? t('dialogs','library_title_blocker')
                : isSurveil
                ? t('dialogs','library_title_surveil')
                : prompt.title || t('dialogs','library_title_scry')}
            </span>
          </div>
          <div className="dialog-message">
            <FormattedText text={prompt.message} />
          </div>
        </header>

        <div className="library-order-body">
          <div className="order-zone top-zone">
            <div className="order-zone-header">
              <span className="zone-name">
                {isBlockerOrder
                  ? `${t('dialogs','library_title_blocker')} (${topCards.length})`
                  : `${t('dialogs','library_top_zone', { count: topCards.length })}`}
              </span>
              <span className="zone-hint">
                {isBlockerOrder
                  ? t('dialogs','library_title_blocker')
                  : t('dialogs','library_title_scry')}
              </span>
            </div>
            <div className={`order-cards-list ${topCards.length === 0 ? 'is-empty' : 'has-cards'}`}>
              {topCards.length === 0 ? (
                <div className="empty-zone-placeholder">
                  {t('dialogs','library_empty_top')}
                </div>
              ) : (
                topCards.map((item, idx) => (
                  <div key={item.id} className="order-card-card">
                    <div className="order-position-tag">#{idx + 1}</div>
                    <CardSlot card={item.card} className="order-card-slot" />
                    <div className="order-card-name">{item.card.displayName || item.card.name || item.option.label}</div>
                    <div className="order-card-controls">
                      <div className="order-arrows">
                        <button
                          type="button"
                          className="btn-arrow"
                          disabled={busy || idx === 0}
                          onClick={() => moveUp(idx)}
                          title={t('dialogs','library_to_top')}
                        >
                          ◀
                        </button>
                        <button
                          type="button"
                          className="btn-arrow"
                          disabled={busy || idx === topCards.length - 1}
                          onClick={() => moveDown(idx)}
                          title={t('dialogs','library_to_top')}
                        >
                          ▶
                        </button>
                      </div>
                      {!isBlockerOrder && (
                        <button
                          type="button"
                          className="btn-switch-zone btn-to-bottom"
                          disabled={busy}
                          onClick={() => moveToBottom(idx)}
                          title={isSurveil ? t('dialogs','library_to_graveyard') : t('dialogs','library_to_bottom')}
                        >
                          {isSurveil ? t('dialogs','library_to_graveyard') : t('dialogs','library_to_bottom')}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {!isBlockerOrder && (
            <div className="order-zone bottom-zone">
              <div className="order-zone-header">
                <span className="zone-name">
                  {isSurveil ? t('dialogs','library_graveyard_zone', { count: bottomCards.length }) : t('dialogs','library_bottom_zone', { count: bottomCards.length })} 
                </span>
                <span className="zone-hint">
                  {isSurveil ? t('dialogs','library_to_graveyard') : t('dialogs','library_to_bottom')}
                </span>
              </div>
              <div className={`order-cards-list ${bottomCards.length === 0 ? 'is-empty' : 'has-cards'}`}>
                {bottomCards.length === 0 ? (
                  <div className="empty-zone-placeholder">
                    {isSurveil
                      ? t('dialogs','library_empty_graveyard')
                      : t('dialogs','library_empty_bottom')}
                  </div>
                ) : (
                  bottomCards.map((item, idx) => (
                    <div key={item.id} className="order-card-card">
                      <div className="order-position-tag">#{idx + 1}</div>
                      <CardSlot card={item.card} className="order-card-slot" />
                      <div className="order-card-controls">
                        <div className="order-arrows">
                          <button
                            type="button"
                            className="btn-arrow"
                            disabled={busy || idx === 0}
                            onClick={() => {
                              if (idx <= 0) return
                              const next = [...bottomCards]
                              const temp = next[idx]
                              next[idx] = next[idx - 1]
                              next[idx - 1] = temp
                              setBottomCards(next)
                            }}
                            title={t('dialogs','library_to_top')}
                          >
                            ◀
                          </button>
                          <button
                            type="button"
                            className="btn-arrow"
                            disabled={busy || idx === bottomCards.length - 1}
                            onClick={() => {
                              if (idx >= bottomCards.length - 1) return
                              const next = [...bottomCards]
                              const temp = next[idx]
                              next[idx] = next[idx + 1]
                              next[idx + 1] = temp
                              setBottomCards(next)
                            }}
                            title={t('dialogs','library_to_top')}
                          >
                            ▶
                          </button>
                        </div>
                        <button
                          type="button"
                          className="btn-switch-zone btn-to-top"
                          disabled={busy}
                          onClick={() => moveToTop(idx)}
                          title={t('dialogs','library_to_top')}
                        >
                          {t('dialogs','library_to_top')}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="library-order-footer">
          {!isBlockerOrder && (
            <div className="quick-actions">
              <button type="button" disabled={busy || bottomCards.length === 0} onClick={allToTop}>
                {t('dialogs','library_all_to_top')}
              </button>
              <button type="button" disabled={busy || topCards.length === 0} onClick={allToBottom}>
                {isSurveil ? t('dialogs','library_all_to_graveyard') : t('dialogs','library_all_to_bottom')}
              </button>
            </div>
          )}
          <div className="dialog-confirm-actions">
            <button type="button" className="primary" disabled={busy} onClick={handleConfirm}>
              {isBlockerOrder
                ? t('dialogs','library_confirm_blockers', { count: topCards.length })
                : t('dialogs','library_confirm_order', { top: topCards.length, bottom: bottomCards.length, zone: isSurveil ? t('game','pile_graveyard').toLowerCase() : (lang === 'es' ? 'fondo' : 'bottom') })}
            </button>
            <button type="button" disabled={busy} onClick={cancel} className="cancel-btn">
              {t('common','cancel')}
            </button>
          </div>
        </footer>
      </section>
    </div>
  )
}
