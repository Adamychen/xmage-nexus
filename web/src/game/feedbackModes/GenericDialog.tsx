import * as cmds from '../../net/commands'
import type { FeedbackPrompt } from '../feedback'
import FormattedText from '../FormattedText'
import Modal from '../../ui/Modal'
import { useEffect, useState } from 'react'
import { useTranslation } from '../../i18n'
import { setSetting } from '../../state/store'
import { getState } from '../../state/state'
import { addAutoAnswer } from '../autoAnswers'
import { localizeOptionLabel, localizeServerMessage } from '../serverMessageTranslation'
import type { UseFeedbackForm } from '../useFeedbackForm'

function getFeedbackKicker(prompt: FeedbackPrompt, t: (ns: 'game' | 'dialogs' | 'common' | 'errors', key: string) => string): { icon: string; label: string } {
  if (prompt.isStartingPlayer) return { icon: '🎲', label: t('game', 'who_starts') }
  if (prompt.method === 'GAME_CHOOSE_MODE') return { icon: '✨', label: t('game', 'feedback_kicker_mode') }
  if (prompt.method === 'GAME_CHOOSE_ABILITY') return { icon: '⚡', label: t('game', 'feedback_kicker_ability') }
  if (prompt.method === 'GAME_CHOOSE_COLOR') return { icon: '🎨', label: t('game', 'feedback_kicker_color') }
  if (prompt.method === 'GAME_CHOOSE_STRING') return { icon: '🏷️', label: t('game', 'feedback_kicker_name') }
  if (prompt.method === 'GAME_CHOOSE_NUMBER' || prompt.method === 'GAME_GET_AMOUNT' || prompt.method === 'GAME_PLAY_XMANA') {
    return { icon: '🔢', label: t('game', 'feedback_kicker_amount') }
  }
  if (prompt.method === 'GAME_GET_MULTI_AMOUNT') return { icon: '📊', label: t('game', 'feedback_kicker_multi') }
  if (prompt.method === 'GAME_SELECT_PLAYER' || prompt.method === 'GAME_TARGET_PLAYER') return { icon: '👤', label: t('game', 'feedback_kicker_player') }
  if (prompt.method === 'GAME_CHOOSE_PILE') return { icon: '📦', label: t('game', 'feedback_kicker_pile') }
  if (prompt.method === 'GAME_CHOOSE_CHOICE') return { icon: '⚖️', label: t('game', 'feedback_kicker_choice') }
  if (prompt.method === 'GAME_ASK') return { icon: '❓', label: t('game', 'feedback_kicker_confirm') }
  return { icon: '⚔️', label: t('game', 'feedback_kicker_required') }
}

function getLocalizedTitle(prompt: FeedbackPrompt, t: (ns: 'game' | 'dialogs' | 'common' | 'errors', key: string) => string): string {
  if (prompt.isStartingPlayer) return t('game', 'who_starts')
  const isDiscard = /descart|discard/i.test(prompt.message)
  if (isDiscard) return t('game', 'choose_discard')

  switch (prompt.method) {
    case 'GAME_CHOOSE_MODE':
      return t('game', 'choose_mode')
    case 'GAME_CHOOSE_ABILITY':
      return t('game', 'choose_ability')
    case 'GAME_CHOOSE_COLOR':
      return t('game', 'choose_color')
    case 'GAME_CHOOSE_STRING':
      return t('game', 'choose_name')
    case 'GAME_CHOOSE_NUMBER':
      return t('game', 'choose_number')
    case 'GAME_GET_AMOUNT':
    case 'GAME_PLAY_XMANA':
      return t('game', 'amount_title')
    case 'GAME_GET_MULTI_AMOUNT':
      return t('game', 'multi_amount_title')
    case 'GAME_SELECT_PLAYER':
    case 'GAME_TARGET_PLAYER':
      return t('game', 'choose_player_title')
    case 'GAME_CHOOSE_PILE':
      return t('game', 'choose_pile')
    case 'GAME_CHOOSE_CHOICE':
      return t('game', 'choose_option')
    case 'GAME_CHOOSE_CARDS':
    case 'GAME_SELECT_CARDS':
    case 'GAME_SELECT_TARGETS':
      return t('game', 'choose_cards')
    case 'GAME_TARGET':
      return prompt.sourceName ?? t('game', 'choose_target')
    case 'GAME_ASK':
      return prompt.isMulligan ? t('dialogs', 'mulligan_title') : prompt.isVoting ? t('dialogs', 'voting_title') : (prompt.title ?? t('game', 'feedback_kicker_confirm'))
    default:
      if (prompt.mode === 'mana') return t('game', 'pay_mana')
      if (prompt.mode === 'combat') {
        const isAtk = prompt.title.toLowerCase().includes('atacan') || prompt.title.toLowerCase().includes('attack')
        return isAtk ? t('game', 'combat_attackers_title') : t('game', 'combat_blockers_title')
      }
      return prompt.title || t('game', 'choose_option')
  }
}

export default function GenericDialog({ form }: { form: UseFeedbackForm }) {
  const { t } = useTranslation()
  const {
    prompt, busy, amount, setAmount, selected, multiAmounts, setMultiAmounts,
    textValue, setTextValue, filteredStringOptions,
    send, cancel, finishOptionalTarget, selectOption, confirmSelected, confirmAmount, confirmMultiAmount,
  } = form
  const [rememberAnswer, setRememberAnswer] = useState(false)
  useEffect(() => {
    setRememberAnswer(false)
  }, [form.prompt?.method, form.prompt?.gameId, form.prompt?.message])
  if (!prompt) return null
  const kicker = getFeedbackKicker(prompt, t as any)
  const title = getLocalizedTitle(prompt, t as any)
  const autoAnswerable =
    prompt.method === 'GAME_ASK' &&
    prompt.mode === 'boolean' &&
    !prompt.isMulligan &&
    !prompt.isVoting &&
    !prompt.isStartingPlayer
  const chooseBoolean = (option: { value: string }) => {
    if (rememberAnswer && autoAnswerable) {
      const rules = getState().settings.autoAnswers ?? []
      setSetting('autoAnswers', addAutoAnswer(rules, prompt.message, option.value === 'true'))
    }
  }

  return (
    <Modal backdropClassName="feedback-backdrop" dialogClassName="feedback-dialog" labelledBy="feedback-title">
      <div className="feedback-kicker">
        <span className="kicker-icon">{kicker.icon}</span> {kicker.label}
      </div>
      <h2 id="feedback-title"><FormattedText text={title} /></h2>
      {prompt.sourceName && prompt.sourceName !== title && (
        <div className="feedback-source-subtitle">
          <FormattedText text={prompt.sourceName} />
        </div>
      )}
      <p className="feedback-prompt-message"><FormattedText text={localizeServerMessage(prompt.message, t as any)} /></p>

      {prompt.mode === 'string' && (
        <div className="feedback-string-wrap">
          <div className="feedback-input-box">
            <span className="feedback-input-icon">🏷️</span>
            <input
              aria-label={t('common', 'search')}
              type="text"
              value={textValue}
              placeholder={t('game', 'string_placeholder')}
              autoFocus
              onChange={(event) => setTextValue(event.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && textValue.trim() !== '' && !busy) {
                  void send(() => cmds.sendPlayerString(textValue.trim(), prompt.gameId), t('errors', 'send_failed_choice'))
                }
              }}
            />
          </div>
          {filteredStringOptions.length > 0 && (
            <div className="feedback-options feedback-options-wrap">
              <div className={`feedback-options-grid ${filteredStringOptions.length <= 4 ? 'compact-grid' : ''}`}>
                {filteredStringOptions.map((option, idx) => (
                  <button
                    key={option.id}
                    className="feedback-choice-card"
                    disabled={busy}
                    onClick={() => void send(() => cmds.sendPlayerString(option.value, prompt.gameId), t('errors', 'send_failed_choice'))}
                  >
                    <span className="choice-number">{idx + 1}</span>
                    <span className="choice-text"><FormattedText text={localizeOptionLabel(option.label, t as any)} /></span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="feedback-dialog-actions">
            <button
              className="primary send-btn"
              disabled={busy || textValue.trim() === ''}
              onClick={() => void send(() => cmds.sendPlayerString(textValue.trim(), prompt.gameId), t('errors', 'send_failed_choice'))}
            >
              {t('game', 'string_confirm')}
            </button>
            <button disabled={busy} onClick={cancel} className="cancel-btn">{t('game', 'string_cancel')}</button>
          </div>
        </div>
      )}

      {prompt.mode === 'integer' && (
        <div className="feedback-amount-wrap">
          <div className="feedback-amount-stepper">
            <button
              type="button"
              className="stepper-btn"
              disabled={busy || amount <= prompt.min}
              onClick={() => setAmount((v) => Math.max(prompt.min, v - 1))}
              aria-label="Disminuir"
            >
              −
            </button>
            <div className="stepper-display">
              <input
                aria-label="Cantidad"
                type="number"
                min={prompt.min}
                max={prompt.max}
                value={amount}
                onChange={(event) => setAmount(Number(event.target.value))}
                className="stepper-input"
              />
              <span className="stepper-range">({prompt.min} a {prompt.max})</span>
            </div>
            <button
              type="button"
              className="stepper-btn"
              disabled={busy || amount >= prompt.max}
              onClick={() => setAmount((v) => Math.min(prompt.max, v + 1))}
              aria-label="Aumentar"
            >
              +
            </button>
          </div>
          {prompt.min !== prompt.max && (
            <div className="stepper-quick-row">
              <button
                type="button"
                className="quick-val-btn"
                disabled={busy || amount === prompt.min}
                onClick={() => setAmount(prompt.min)}
              >
                Mín ({prompt.min})
              </button>
              <button
                type="button"
                className="quick-val-btn"
                disabled={busy || amount === prompt.max}
                onClick={() => setAmount(prompt.max)}
              >
                Máx ({prompt.max})
              </button>
            </div>
          )}
          <div className="feedback-dialog-actions">
            <button className="primary send-btn" disabled={busy} onClick={confirmAmount}>{t('game', 'integer_confirm')}</button>
            <button disabled={busy} onClick={cancel} className="cancel-btn">{t('game', 'string_cancel')}</button>
          </div>
        </div>
      )}

      {prompt.mode === 'multiString' && (
        <div className="feedback-multi-amount-wrap">
          <div className="feedback-multi-list">
            {(prompt.items ?? []).map((item) => {
              const cur = multiAmounts[item.id] ?? item.defaultValue ?? item.min
              return (
                <div key={item.id} className="multi-amount-row">
                  <span className="multi-amount-label"><FormattedText text={item.label} /></span>
                  <div className="multi-stepper">
                    <button
                      type="button"
                      className="stepper-btn mini"
                      disabled={busy || cur <= item.min}
                      onClick={() => setMultiAmounts((s) => ({ ...s, [item.id]: Math.max(item.min, cur - 1) }))}
                    >
                      −
                    </button>
                    <span className="multi-stepper-val">{cur}</span>
                    <button
                      type="button"
                      className="stepper-btn mini"
                      disabled={busy || cur >= item.max}
                      onClick={() => setMultiAmounts((s) => ({ ...s, [item.id]: Math.min(item.max, cur + 1) }))}
                    >
                      +
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="feedback-dialog-actions">
            <button className="primary send-btn" disabled={busy} onClick={confirmMultiAmount}>{t('game', 'multi_confirm')}</button>
            <button disabled={busy} onClick={cancel} className="cancel-btn">{t('game', 'string_cancel')}</button>
          </div>
        </div>
      )}

      {prompt.mode !== 'integer' && prompt.mode !== 'multiString' && prompt.mode !== 'string' && (
        <div className="feedback-options feedback-options-wrap">
          <div className={`feedback-options-grid ${prompt.options.length <= 4 ? 'compact-grid' : ''}`}>
            {prompt.options.map((option, idx) => {
              const isSel = selected.includes(option.value)
              return (
                <button
                  key={option.id}
                  className={`feedback-choice-card ${isSel ? 'selected' : ''}`}
                  disabled={busy}
                  onClick={() => {
                    if (autoAnswerable) chooseBoolean(option)
                    selectOption(option)
                  }}
                >
                  <span className="choice-number">{idx + 1}</span>
                  <span className="choice-text"><FormattedText text={localizeOptionLabel(option.label, t as any)} /></span>
                  {prompt.mode === 'uuid' && prompt.max > 1 && (
                    <span className="choice-checkbox">{isSel ? '✓' : ''}</span>
                  )}
                </button>
              )
            })}
          </div>
          {(prompt.mode === 'uuid' && prompt.max > 1 || prompt.required === false) && (
            <div className="feedback-dialog-actions">
              {prompt.mode === 'uuid' && prompt.max > 1 && (
                <button className="primary send-btn" disabled={busy || selected.length < prompt.min} onClick={confirmSelected}>
                  {t('game', 'selected_count', { count: selected.length })}
                </button>
              )}
              {prompt.required === false && (
                <button disabled={busy} onClick={finishOptionalTarget} className="cancel-btn">{t('game', 'targeting_finish')}</button>
              )}
            </div>
          )}
          {autoAnswerable && (
            <label className="feedback-remember-answer">
              <input
                type="checkbox"
                checked={rememberAnswer}
                disabled={busy}
                onChange={(event) => setRememberAnswer(event.target.checked)}
              />
              {t('game', 'auto_answer_remember')}
            </label>
          )}
        </div>
      )}
    </Modal>
  )
}
