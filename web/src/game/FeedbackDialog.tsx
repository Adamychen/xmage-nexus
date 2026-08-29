import { useEffect, useState } from 'react'
import * as cmds from '../net/commands'
import { clearFeedback, setStoreError, useStore } from '../state/store'
import type { FeedbackOption, FeedbackPrompt } from './feedback'
import CardGrid from './CardGrid'
import FormattedText from './FormattedText'
import LibraryOrderDialog from './LibraryOrderDialog'
import MulliganDialog from './MulliganDialog'
import VotingDialog from './VotingDialog'
import PlaneswalkerAbilityDialog from './PlaneswalkerAbilityDialog'

const POOL_COLORS = ['white', 'blue', 'black', 'red', 'green', 'colorless'] as const

function isResultOk(result: { ok: boolean; error?: string }, fallback: string) {
  if (result.ok) {
    clearFeedback()
    return true
  }
  setStoreError(result.error ?? fallback)
  return false
}

function getFeedbackKicker(prompt: FeedbackPrompt): { icon: string; label: string } {
  if (prompt.method === 'GAME_CHOOSE_MODE') return { icon: '✨', label: 'ELIGE MODO' }
  if (prompt.method === 'GAME_CHOOSE_ABILITY') return { icon: '⚡', label: 'ELIGE HABILIDAD' }
  if (prompt.method === 'GAME_CHOOSE_COLOR') return { icon: '🎨', label: 'SELECCIONA COLOR' }
  if (prompt.method === 'GAME_CHOOSE_STRING') return { icon: '🏷️', label: 'NOMBRA UNA CARTA O TIPO' }
  if (prompt.method === 'GAME_CHOOSE_NUMBER' || prompt.method === 'GAME_GET_AMOUNT' || prompt.method === 'GAME_PLAY_XMANA') {
    return { icon: '🔢', label: 'SELECCIONA CANTIDAD' }
  }
  if (prompt.method === 'GAME_GET_MULTI_AMOUNT') return { icon: '📊', label: 'DISTRIBUYE CANTIDADES' }
  if (prompt.method === 'GAME_SELECT_PLAYER' || prompt.method === 'GAME_TARGET_PLAYER') return { icon: '👤', label: 'SELECCIONA JUGADOR' }
  if (prompt.method === 'GAME_CHOOSE_PILE') return { icon: '📦', label: 'ELIGE UN MONTÓN' }
  if (prompt.method === 'GAME_CHOOSE_CHOICE') return { icon: '⚖️', label: 'TOMA UNA DECISIÓN' }
  if (prompt.method === 'GAME_ASK') return { icon: '❓', label: 'CONFIRMACIÓN' }
  return { icon: '⚔️', label: 'ACCIÓN REQUERIDA' }
}

export default function FeedbackDialog() {
  const prompt = useStore((s) => s.feedback)
  const game = useStore((s) => s.game)
  const [busy, setBusy] = useState(false)
  const [amount, setAmount] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [multiAmounts, setMultiAmounts] = useState<Record<string, number>>({})
  const [textValue, setTextValue] = useState('')

  useEffect(() => {
    setBusy(false)
    setAmount(prompt?.min ?? 0)
    setSelected([])
    setMultiAmounts(Object.fromEntries((prompt?.items ?? []).map((item) => [item.id, item.defaultValue ?? item.min])))
    setTextValue('')
  }, [prompt?.method, prompt?.gameId])

  if (!prompt) return null

  const send = async (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => {
    if (busy) return
    setBusy(true)
    try {
      isResultOk(await action(), fallback)
    } catch (error) {
      setStoreError(error instanceof Error ? error.message : fallback)
    } finally {
      setBusy(false)
    }
  }

  const cancel = () => {
    void send(() => cmds.sendPlayerBoolean(false, prompt.gameId), 'No se pudo cancelar la decisión')
  }

  const finishOptionalTarget = () => {
    void send(() => cmds.sendPlayerBoolean(false, prompt.gameId), 'No se pudo finalizar la selección')
  }

  // ── Scry / Surveil / Reorder dialog (GAME_CHOOSE_CARDS_ORDER or mode === 'order')
  if (prompt.mode === 'order' || prompt.method === 'GAME_CHOOSE_CARDS_ORDER') {
    return <LibraryOrderDialog prompt={prompt} send={send} cancel={cancel} busy={busy} />
  }

  // ── Mulligan: diálogo dedicado (Keep/Mulligan y London-bottom)
  if (prompt.isMulligan || prompt.isMulliganLondon) {
    return <MulliganDialog prompt={prompt} send={send} cancel={cancel} busy={busy} />
  }

  // ── Voting: diálogo dedicado
  if (prompt.isVoting) {
    return <VotingDialog prompt={prompt} send={send} busy={busy} />
  }

  // ── Planeswalker: diálogo dedicado
  if (prompt.isPlaneswalkerAbility) {
    return <PlaneswalkerAbilityDialog prompt={prompt} send={send} busy={busy} />
  }

  // ── Decisión de quién empieza: diálogo dedicado
  if (prompt.isStartingPlayer) {
    return (
      <div className="feedback-backdrop" role="presentation">
        <section className="feedback-dialog starting-player-dialog" role="dialog" aria-modal="true" aria-labelledby="sp-title">
          <div className="feedback-kicker">⚔️ INICIO DE PARTIDA</div>
          <h2 id="sp-title">¿Quién empieza?</h2>
          <p><FormattedText text={prompt.message} /></p>
          <div className="starting-player-options">
            {prompt.options.map((option) => (
              <button
                key={option.id}
                className="starting-player-btn"
                disabled={busy}
                onClick={() => void send(() => sendValue(prompt, option.value), 'No se pudo enviar la selección')}
              >
                <span className="sp-avatar">🧙</span>
                <span className="sp-name"><FormattedText text={option.label} /></span>
                <span className="sp-action">Empieza primero →</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    )
  }

  // ── GAME_TARGET con cardsView1: grid de cartas (tutores, scry, descarte, etc.)
  const hasCardGrid = prompt.cards && prompt.cards.length > 0
  if (prompt.method === 'GAME_TARGET' && hasCardGrid) {
    return <CardGrid prompt={prompt} selected={selected} setSelected={setSelected} send={send} cancel={cancel} busy={busy} />
  }

  // ── Selección de cartas (tutores, buscar en biblioteca, revelar mano): grid HD
  if ((prompt.method === 'GAME_CHOOSE_CARDS' || prompt.method === 'GAME_SELECT_CARDS' || prompt.method === 'GAME_SELECT_TARGETS') && hasCardGrid) {
    return <CardGrid prompt={prompt} selected={selected} setSelected={setSelected} send={send} cancel={cancel} busy={busy} />
  }

  // ── GAME_TARGET sin cardsView1: barra flotante no-modal
  if (prompt.method === 'GAME_TARGET') {
    const chosenCount = prompt.chosenTargets?.length ?? 0
    return (
      <div className="action-prompt-bar targeting-bar">
        <div className="action-prompt-info">
          <span className="action-prompt-title">
            <FormattedText text={prompt.sourceName ?? 'Objetivo'} />
          </span>
          <span className="action-prompt-hint">
            {chosenCount > 0
              ? `${chosenCount} seleccionado(s)`
              : 'Haz clic en el objetivo en el tablero'}
          </span>
        </div>
        <div className="action-prompt-actions">
          {prompt.required === false && (
            <button disabled={busy} onClick={finishOptionalTarget}>Terminar</button>
          )}
          <button disabled={busy} onClick={cancel} className="cancel-btn">Cancelar</button>
        </div>
      </div>
    )
  }

  // ── GAME_PLAY_MANA: barra flotante no-modal (el tablero maneja los clicks a las tierras)
  if (prompt.mode === 'mana') {
    return (
      <div className="action-prompt-bar mana-prompt-bar">
        <div className="action-prompt-info">
          <span className="action-prompt-title">Pagar maná:</span>
          <span className="action-prompt-msg">
            <FormattedText text={prompt.message} />
          </span>
          <span className="action-prompt-hint">Haz clic en tus fuentes de maná, criaturas (Convoke) o artefactos (Improvise)</span>
        </div>
        <div className="action-prompt-actions">
          {prompt.playerId && poolMana(game).map((mana) => (
            <button
              key={mana.color}
              className="mana-pool-btn"
              disabled={busy}
              onClick={() => void send(() => cmds.sendPlayerManaType(prompt.gameId, prompt.playerId as string, mana.color), 'No se pudo usar la reserva de maná')}
            >
              Pagar reserva: {mana.label}
            </button>
          ))}
          <button disabled={busy} onClick={() => void send(() => cmds.sendPlayerString('special', prompt.gameId), 'No se pudo activar el pago especial')}>
            Acción especial
          </button>
          <button disabled={busy} onClick={cancel} className="cancel-btn">
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  // ── Declaración de combate: barra flotante no-modal
  if (prompt.mode === 'combat') {
    return (
      <div className="action-prompt-bar combat-bar">
        <div className="action-prompt-info">
          <span className="action-prompt-title">{prompt.title}</span>
          <span className="action-prompt-hint">
            Haz clic en tus criaturas del tablero para declararlas
          </span>
        </div>
        <div className="action-prompt-actions">
          {prompt.special && (
            <button disabled={busy} onClick={() => void send(() => cmds.sendPlayerString('special', prompt.gameId), 'No se pudo declarar el ataque')}>
              Atacar con todos
            </button>
          )}
          <button
            className="primary"
            disabled={busy}
            onClick={() => void send(() => cmds.sendPlayerBoolean(false, prompt.gameId), 'No se pudo confirmar el combate')}
          >
            {prompt.title === 'Declara atacantes' ? 'Confirmar atacantes' : 'Confirmar bloqueadores'}
          </button>
        </div>
      </div>
    )
  }

  const selectOption = (option: FeedbackOption) => {
    if (prompt.mode === 'uuid' && prompt.max > 1) {
      setSelected((current) => current.includes(option.value)
        ? current.filter((value) => value !== option.value)
        : current.length < prompt.max ? [...current, option.value] : current)
      return
    }
    void send(() => sendValue(prompt, option.value), 'No se pudo enviar la selección')
  }

  const confirmSelected = () => {
    void send(async () => {
      let result: { ok: boolean; error?: string } = { ok: true }
      for (const value of selected) {
        result = await cmds.sendPlayerUUID(value, prompt.gameId)
        if (!result.ok) break
      }
      return result
    }, 'No se pudo enviar la selección')
  }

  const confirmAmount = () => {
    const value = Math.max(prompt.min, Math.min(prompt.max, amount))
    void send(() => cmds.sendPlayerInteger(value, prompt.gameId), 'No se pudo enviar la cantidad')
  }

  const confirmMultiAmount = () => {
    const values = (prompt.items ?? []).map((item) => {
      const value = Math.max(item.min, Math.min(item.max, multiAmounts[item.id] ?? item.min))
      return value
    })
    const total = values.reduce((sum, value) => sum + value, 0)
    if (total < prompt.min || total > prompt.max) {
      setStoreError(`La suma debe estar entre ${prompt.min} y ${prompt.max}`)
      return
    }
    void send(() => cmds.sendPlayerString(values.join(' '), prompt.gameId), 'No se pudieron enviar las cantidades')
  }

  const kicker = getFeedbackKicker(prompt)

  return (
    <div className="feedback-backdrop" role="presentation">
      <section className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <div className="feedback-kicker">
          <span className="kicker-icon">{kicker.icon}</span> {kicker.label}
        </div>
        <h2 id="feedback-title"><FormattedText text={prompt.title} /></h2>
        <p className="feedback-prompt-message"><FormattedText text={prompt.message} /></p>

        {prompt.mode === 'string' && (
          <div className="feedback-string-wrap">
            <div className="feedback-input-box">
              <span className="feedback-input-icon">🏷️</span>
              <input
                aria-label="Texto libre"
                type="text"
                value={textValue}
                placeholder="Escribe un nombre de carta o tipo…"
                autoFocus
                onChange={(event) => setTextValue(event.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && textValue.trim() !== '' && !busy) {
                    void send(() => cmds.sendPlayerString(textValue.trim(), prompt.gameId), 'No se pudo enviar el texto')
                  }
                }}
              />
            </div>
            <div className="feedback-dialog-actions">
              <button
                className="primary send-btn"
                disabled={busy || textValue.trim() === ''}
                onClick={() => void send(() => cmds.sendPlayerString(textValue.trim(), prompt.gameId), 'No se pudo enviar el texto')}
              >
                Confirmar
              </button>
              <button disabled={busy} onClick={cancel} className="cancel-btn">Cancelar</button>
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
              <button className="primary send-btn" disabled={busy} onClick={confirmAmount}>Enviar</button>
              <button disabled={busy} onClick={cancel} className="cancel-btn">Cancelar</button>
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
              <button className="primary send-btn" disabled={busy} onClick={confirmMultiAmount}>Confirmar</button>
              <button disabled={busy} onClick={cancel} className="cancel-btn">Cancelar</button>
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
                    onClick={() => selectOption(option)}
                  >
                    <span className="choice-number">{idx + 1}</span>
                    <span className="choice-text"><FormattedText text={option.label} /></span>
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
                    Confirmar ({selected.length} seleccionada{selected.length !== 1 ? 's' : ''})
                  </button>
                )}
                {prompt.required === false && (
                  <button disabled={busy} onClick={finishOptionalTarget} className="cancel-btn">Terminar selección</button>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

const COLOR_SYMBOLS: Record<string, string> = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G', colorless: 'C' }

/** Maná disponible en la reserva del jugador controlado para pagar desde el pool. */
function poolMana(game: { players?: unknown[] | null } | null) {
  const players = (game?.players ?? []) as { controlled?: boolean; manaPool?: Record<string, number> }[]
  const me = players.find((p) => p.controlled)
  const pool = (me?.manaPool ?? {}) as Record<string, number>
  return POOL_COLORS.filter((color) => (pool[color] ?? 0) > 0)
    .map((color) => ({ color: color.toUpperCase(), label: `${COLOR_SYMBOLS[color]}${pool[color] ?? 0}` }))
}

function sendValue(prompt: FeedbackPrompt, value: string) {
  switch (prompt.mode) {
    case 'boolean':
      return cmds.sendPlayerBoolean(value === 'true', prompt.gameId)
    case 'string':
      return cmds.sendPlayerString(value, prompt.gameId)
    case 'uuid':
      return cmds.sendPlayerUUID(value, prompt.gameId)
    case 'mana':
      if (!prompt.playerId) return Promise.resolve({ ok: false, error: 'No hay jugador de maná activo' })
      return cmds.sendPlayerManaType(prompt.gameId, prompt.playerId, value)
    default:
      return Promise.resolve({ ok: false, error: 'Tipo de feedback no soportado' })
  }
}
