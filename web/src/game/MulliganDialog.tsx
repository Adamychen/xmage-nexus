import { useState } from 'react'
import * as cmds from '../net/commands'
import type { CardView } from '../net/types'
import { useStore, useSettings, setSetting } from '../state/store'
import type { FeedbackPrompt } from './feedback'
import FormattedText from './FormattedText'
import DialogShell from '../ui/DialogShell'
import Icon from '../ui/Icon'
import CardSlot from '../board/CardSlot'
import FloatingCardPreview from '../board/FloatingCardPreview'
import { useTranslation } from '../i18n'
import { localizeServerMessage } from './serverMessageTranslation'
import './MulliganDialog.css'

interface MulliganDialogProps {
  prompt: FeedbackPrompt
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
  cancel: () => void
  busy: boolean
}

export default function MulliganDialog({ prompt, send, cancel, busy }: MulliganDialogProps) {
  const { t } = useTranslation()
  const game = useStore((s) => s.game)
  const settings = useSettings()
  const hand = (game?.myHand ?? {}) as Record<string, CardView>
  const handEntries = Object.entries(hand)
  const isLondon = prompt.isMulliganLondon === true
  const [selected, setSelected] = useState<string[]>([])
  const [bottomCount, setBottomCount] = useState(0)
  const [hoveredCard, setHoveredCard] = useState<CardView | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const keep = () => void send(() => cmds.sendPlayerBoolean(false, prompt.gameId), t('errors', 'send_failed'))
  const mulligan = () => void send(() => cmds.sendPlayerBoolean(true, prompt.gameId), t('errors', 'send_failed_mulligan'))

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < prompt.max ? [...current, id] : current,
    )
  }

  const pickOne = (id: string) => {
    setBottomCount((count) => count + 1)
    void send(() => cmds.sendPlayerUUID(id, prompt.gameId), t('errors', 'send_failed'))
  }

  const confirmSelected = () => {
    void send(async () => {
      let result: { ok: boolean; error?: string } = { ok: true }
      for (const value of selected) {
        result = await cmds.sendPlayerUUID(value, prompt.gameId)
        if (!result.ok) break
      }
      return result
    }, t('errors', 'send_failed'))
    setBottomCount((count) => count + selected.length)
  }

  const handleHover = (card: CardView | null, rect?: DOMRect) => {
    setHoveredCard(card)
    setAnchorRect(rect ?? null)
  }

  const cardCount = handEntries.length
  const needToBottom = isLondon
    ? prompt.max > 1
      ? t('dialogs', 'mulligan_london_counter', { min: prompt.min, max: prompt.max })
      : `${t('game', 'targeting_hint')} (${bottomCount})`
    : null

  if (isLondon) {
    const handleCardClick = prompt.max > 1 ? toggle : pickOne
    return (
      <DialogShell
        labelledBy="mulligan-title"
        titleId="mulligan-title"
        size="lg"
        legacyBackdropClass="mulligan-backdrop"
        legacyPanelClass="mulligan-dialog mulligan-london"
        kickerIcon="layers"
        kickerLabel={t('dialogs', 'mulligan_london_title')}
        title={t('dialogs', 'mulligan_london_counter', { min: prompt.min, max: prompt.max })}
        message={<FormattedText text={localizeServerMessage(prompt.message, t as any)} />}
        trailing={<FloatingCardPreview card={hoveredCard} anchorRect={anchorRect} boardRect={null} inModal />}
      >
          {cardCount > 0 && (
            <div className="mulligan-hand-grid">
              {handEntries.map(([id, card], i) => (
                <div
                  key={id}
                  className={`mulligan-card-wrap ${selected.includes(id) ? 'is-selected' : ''}`}
                  style={{ animationDelay: `${i * 55}ms` }}
                  onClick={() => handleCardClick(id)}
                >
                  <CardSlot
                    cardId={id}
                    card={card}
                    isPlayable={false}
                    isTarget={selected.includes(id)}
                    onHover={handleHover}
                  />
                  {selected.includes(id) && (
                    <div className="mulligan-card-badge">#{selected.indexOf(id) + 1}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mulligan-counter">{needToBottom}</div>

          <div className="mulligan-actions">
            {prompt.max > 1 && (
              <button className="primary" disabled={busy || selected.length < prompt.min} onClick={confirmSelected}>
                {t('dialogs', 'mulligan_london_confirm', { selected: selected.length, min: prompt.min })}
              </button>
            )}
            {prompt.required === false && (
              <button disabled={busy} onClick={cancel} className="cancel-btn">{t('common', 'cancel')}</button>
            )}
          </div>
      </DialogShell>
    )
  }

  return (
    <DialogShell
      labelledBy="mulligan-title"
      titleId="mulligan-title"
      size="lg"
      legacyBackdropClass="mulligan-backdrop"
      legacyPanelClass="mulligan-dialog"
      kickerIcon="layers"
      kickerLabel={t('dialogs', 'mulligan_decision_title')}
      title={<FormattedText text={prompt.title === 'Mulligan' ? t('dialogs', 'mulligan_title') : prompt.title} />}
      message={<FormattedText text={localizeServerMessage(prompt.message, t as any)} />}
      trailing={<FloatingCardPreview card={hoveredCard} anchorRect={anchorRect} boardRect={null} inModal />}
      aside={
        <label className="toggle mulligan-auto-toggle">
          <input
            type="checkbox"
            checked={settings.autoKeepMulligan}
            onChange={(e) => setSetting('autoKeepMulligan', e.target.checked)}
          />
          {t('game', 'auto_mulligan')}
        </label>
      }
    >
        {cardCount > 0 && (
          <div className="mulligan-hand-grid">
            {handEntries.map(([id, card], i) => (
              <div key={id} className="mulligan-card-wrap" style={{ animationDelay: `${i * 55}ms` }}>
                <CardSlot
                  cardId={id}
                  card={card}
                  isPlayable={false}
                  onHover={handleHover}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mulligan-actions">
          <button className="mulligan-keep" disabled={busy} onClick={keep}>
            <Icon name="hand" size={13} /> {t('dialogs', 'mulligan_keep_btn', { count: cardCount })}
          </button>
          <button className="mulligan-mulligan" disabled={busy} onClick={mulligan}>
            <Icon name="refresh" size={13} /> {t('dialogs', 'mulligan_btn')}
          </button>
        </div>
    </DialogShell>
  )
}
