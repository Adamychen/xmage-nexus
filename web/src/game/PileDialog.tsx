import { useState } from 'react'
import * as cmds from '../net/commands'
import type { FeedbackPrompt } from './feedback'
import type { FeedbackCard } from './feedback/types'
import CardSlot from '../board/CardSlot'
import FloatingCardPreview from '../board/FloatingCardPreview'
import FormattedText from './FormattedText'
import DialogShell from '../ui/DialogShell'
import { useTranslation } from '../i18n'
import { localizeServerMessage } from './serverMessageTranslation'
import './PileDialog.css'

interface PileDialogProps {
  prompt: FeedbackPrompt
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
  busy: boolean
}

export default function PileDialog({ prompt, send, busy }: PileDialogProps) {
  const { t } = useTranslation()
  const [hoveredCard, setHoveredCard] = useState<FeedbackCard | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const piles = prompt.pileCards
  if (!piles) return null

  const choose = (pile1: boolean) => {
    void send(() => cmds.sendPlayerBoolean(pile1, prompt.gameId), t('errors', 'send_failed'))
  }

  const handleHover = (card: FeedbackCard | null, rect?: DOMRect) => {
    setHoveredCard(card)
    setAnchorRect(rect ?? null)
  }

  const renderPile = (cards: FeedbackCard[], pile1: boolean, label: string, testId: string) => (
    <button
      key={testId}
      type="button"
      className="pile-column"
      data-testid={testId}
      disabled={busy}
      onClick={() => choose(pile1)}
    >
      <span className="pile-column-name">{label} ({cards.length})</span>
      <span className="pile-cards">
        {cards.map((card) => (
          <span key={card.id} className="pile-card-wrap">
            <CardSlot
              card={card as never}
              cardId={card.id}
              isPlayable={false}
              onHover={(c, rect) => handleHover(c as unknown as FeedbackCard, rect)}
            />
          </span>
        ))}
      </span>
    </button>
  )

  return (
    <DialogShell
      labelledBy="pile-title"
      titleId="pile-title"
      size="lg"
      legacyBackdropClass="pile-backdrop"
      legacyPanelClass="pile-dialog"
      kickerIcon="package"
      kickerLabel={t('game', 'choose_pile')}
      title={t('game', 'choose_pile')}
      message={<FormattedText text={localizeServerMessage(prompt.message, t as any)} />}
      trailing={<FloatingCardPreview card={hoveredCard as never} anchorRect={anchorRect} boardRect={null} inModal />}
    >
      <div className="pile-columns">
        {renderPile(piles.pile1, true, t('game', 'pile_1'), 'pile-column-1')}
        <span className="pile-vs">VS</span>
        {renderPile(piles.pile2, false, t('game', 'pile_2'), 'pile-column-2')}
      </div>
    </DialogShell>
  )
}
