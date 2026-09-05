import { useState } from 'react'
import * as cmds from '../net/commands'
import type { FeedbackPrompt } from './feedback'
import CardSlot from '../board/CardSlot'
import FormattedText from './FormattedText'
import Icon from '../ui/Icon'
import Modal from '../ui/Modal'
import { useTranslation } from '../i18n'
import { triggerDisplayName, triggerRuleText, type TriggerRuleScope } from './triggerOrder'
import './TriggerOrderDialog.css'

interface TriggerOrderDialogProps {
  prompt: FeedbackPrompt
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
  cancel: () => void
  busy: boolean
}

export default function TriggerOrderDialog({ prompt, send, cancel, busy }: TriggerOrderDialogProps) {
  const { t } = useTranslation()
  const [scope, setScope] = useState<TriggerRuleScope>('card')
  const triggers = prompt.cards ?? []
  const remaining = Math.max(triggers.length, prompt.options.length, 1)

  const choose = (cardId: string) => {
    void send(() => cmds.sendPlayerUUID(cardId, prompt.gameId), t('errors', 'send_failed'))
  }

  const remember = (cardId: string, rule: string, first: boolean) => {
    const kind = scope === 'card'
      ? first ? 'TRIGGER_AUTO_ORDER_ABILITY_FIRST' : 'TRIGGER_AUTO_ORDER_ABILITY_LAST'
      : first ? 'TRIGGER_AUTO_ORDER_NAME_FIRST' : 'TRIGGER_AUTO_ORDER_NAME_LAST'
    const data = scope === 'card' ? cardId : rule
    void send(async () => {
      const action = await cmds.sendTriggerAutoOrder(kind, prompt.gameId, data)
      if (!action.ok) return action
      return cmds.sendPlayerUUID(first ? cardId : null, prompt.gameId)
    }, t('errors', 'send_failed'))
  }

  const reset = () => {
    void send(() => cmds.sendTriggerAutoOrder('TRIGGER_AUTO_ORDER_RESET_ALL', prompt.gameId), t('errors', 'send_failed'))
  }

  return (
    <Modal backdropClassName="trigger-backdrop" dialogClassName="trigger-dialog" labelledBy="trigger-title">
      <div className="trigger-kicker"><Icon name="refresh" size={12} /> {t('game', 'trigger_title').toUpperCase()}</div>
      <h2 id="trigger-title">{t('game', 'trigger_remaining', { count: remaining })}</h2>
      <p className="trigger-hint">{t('game', 'trigger_hint')}</p>
      <div className="trigger-scope" role="group" aria-label={t('game', 'trigger_scope')}>
        <span className="trigger-scope-label">{t('game', 'trigger_scope')}:</span>
        {(['card', 'name'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`trigger-scope-btn ${scope === value ? 'is-active' : ''}`}
            aria-pressed={scope === value}
            disabled={busy}
            onClick={() => setScope(value)}
          >
            {t('game', value === 'card' ? 'trigger_scope_card' : 'trigger_scope_name')}
          </button>
        ))}
      </div>
      <ul className="trigger-list">
        {triggers.map((card) => {
          const rule = triggerRuleText(card)
          return (
            <li key={card.id} className="trigger-row" data-testid={`trigger-row-${card.id}`}>
              <span className="trigger-art">
                <CardSlot card={card as never} cardId={card.id} />
              </span>
              <span className="trigger-text">
                <span className="trigger-name">{triggerDisplayName(card)}</span>
                <span className="trigger-rule" title={rule}>{rule}</span>
              </span>
              <span className="trigger-actions">
                <button
                  type="button"
                  className="trigger-btn primary"
                  disabled={busy}
                  onClick={() => choose(card.id)}
                >
                  {t('game', 'trigger_choose')}
                </button>
                <button
                  type="button"
                  className="trigger-btn"
                  disabled={busy}
                  title={t('game', 'trigger_first')}
                  onClick={() => remember(card.id, rule, true)}
                >
                  <Icon name="chevronsUp" size={12} /> {t('game', 'trigger_first')}
                </button>
                <button
                  type="button"
                  className="trigger-btn"
                  disabled={busy}
                  title={t('game', 'trigger_last')}
                  onClick={() => remember(card.id, rule, false)}
                >
                  <Icon name="chevronsDown" size={12} /> {t('game', 'trigger_last')}
                </button>
              </span>
            </li>
          )
        })}
      </ul>
      {triggers.length === 0 && (
        <p className="trigger-empty"><FormattedText text={prompt.message} /></p>
      )}
      <footer className="trigger-footer">
        <button type="button" className="trigger-btn" disabled={busy} onClick={reset}>
          {t('game', 'trigger_reset')}
        </button>
        <button type="button" className="trigger-btn cancel-btn" disabled={busy} onClick={cancel}>
          {t('game', 'targeting_cancel')}
        </button>
      </footer>
    </Modal>
  )
}
