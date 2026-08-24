import { useState } from 'react'
import * as cmds from '../net/commands'
import type { CardView } from '../net/types'
import { useStore } from '../state/store'
import type { FeedbackPrompt } from './feedback'
import FormattedText from './FormattedText'
import CardSlot from '../board/CardSlot'
import FloatingCardPreview from '../board/FloatingCardPreview'
import './MulliganDialog.css'

interface MulliganDialogProps {
  prompt: FeedbackPrompt
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
  cancel: () => void
  busy: boolean
}

export default function MulliganDialog({ prompt, send, cancel, busy }: MulliganDialogProps) {
  const game = useStore((s) => s.game)
  const hand = (game?.myHand ?? {}) as Record<string, CardView>
  const handEntries = Object.entries(hand)
  const isLondon = prompt.isMulliganLondon === true
  const [selected, setSelected] = useState<string[]>([])
  const [bottomCount, setBottomCount] = useState(0)
  const [hoveredCard, setHoveredCard] = useState<CardView | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const keep = () => void send(() => cmds.sendPlayerBoolean(false, prompt.gameId), 'No se pudo mantener la mano')
  const mulligan = () => void send(() => cmds.sendPlayerBoolean(true, prompt.gameId), 'No se pudo hacer mulligan')

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < prompt.max ? [...current, id] : current,
    )
  }

  const pickOne = (id: string) => {
    setBottomCount((count) => count + 1)
    void send(() => cmds.sendPlayerUUID(id, prompt.gameId), 'No se pudo poner la carta al fondo')
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
    setBottomCount((count) => count + selected.length)
  }

  const handleHover = (card: CardView | null, rect?: DOMRect) => {
    setHoveredCard(card)
    setAnchorRect(rect ?? null)
  }

  const cardCount = handEntries.length
  const needToBottom = isLondon
    ? prompt.max > 1
      ? `Selecciona ${prompt.min}–${prompt.max} cartas para poner al fondo`
      : `Haz clic en una carta para ponerla al fondo (${bottomCount} puestas)`
    : null

  if (isLondon) {
    const handleCardClick = prompt.max > 1 ? toggle : pickOne
    return (
      <div className="mulligan-backdrop" role="presentation">
        <section className="mulligan-dialog mulligan-london" role="dialog" aria-modal="true" aria-labelledby="mulligan-title">
          <div className="mulligan-kicker">MULLIGAN DE LONDRES</div>
          <h2 id="mulligan-title">Pon cartas al fondo de tu biblioteca</h2>
          <p className="mulligan-msg"><FormattedText text={prompt.message} /></p>

          {cardCount > 0 && (
            <div className="mulligan-hand-grid">
              {handEntries.map(([id, card]) => (
                <div
                  key={id}
                  className={`mulligan-card-wrap ${selected.includes(id) ? 'is-selected' : ''}`}
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
                Confirmar ({selected.length} / {prompt.min})
              </button>
            )}
            {prompt.required === false && (
              <button disabled={busy} onClick={cancel} className="cancel-btn">Cancelar</button>
            )}
          </div>
        </section>
        <FloatingCardPreview card={hoveredCard} anchorRect={anchorRect} boardRect={null} />
      </div>
    )
  }

  return (
    <div className="mulligan-backdrop" role="presentation">
      <section className="mulligan-dialog" role="dialog" aria-modal="true" aria-labelledby="mulligan-title">
        <div className="mulligan-kicker">MULLIGAN</div>
        <h2 id="mulligan-title"><FormattedText text={prompt.title} /></h2>
        <p className="mulligan-msg"><FormattedText text={prompt.message} /></p>

        {cardCount > 0 && (
          <div className="mulligan-hand-grid">
            {handEntries.map(([id, card]) => (
              <div key={id} className="mulligan-card-wrap">
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
            ✋ Mantener ({cardCount})
          </button>
          <button className="mulligan-mulligan" disabled={busy} onClick={mulligan}>
            🔄 Mulligan
          </button>
        </div>
      </section>
      <FloatingCardPreview card={hoveredCard} anchorRect={anchorRect} boardRect={null} />
    </div>
  )
}
