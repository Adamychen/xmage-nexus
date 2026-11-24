import { useEffect, useState } from 'react'
import Button from '../ui/Button'
import CardSlot from '../board/CardSlot'
import ArenaFan from './arena/ArenaFan'
import ArenaPromptShell from './arena/ArenaPromptShell'
import * as cmds from '../net/commands'
import type { CardView } from '../net/types'
import type { FeedbackPrompt } from './feedback'
import type { FeedbackCard } from './feedback/types'
import FormattedText from './FormattedText'
import { setState } from '../state/store'
import { useTranslation, dynamicT } from '../i18n'
import { localizeServerMessage } from './serverMessageTranslation'
import './PileDialog.css'

interface PileDialogProps {
  prompt: FeedbackPrompt
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
  busy: boolean
}

const DEAL_MS = 900

function noop() {}

export default function PileDialog({ prompt, send, busy }: PileDialogProps) {
  const { t } = useTranslation()
  const [dealing, setDealing] = useState(true)
  const piles = prompt.pileCards

  useEffect(() => {
    const timer = setTimeout(() => setDealing(false), DEAL_MS)
    return () => clearTimeout(timer)
  }, [])

  if (!piles) return null

  const choose = (pile1: boolean) => {
    void send(() => cmds.sendPlayerBoolean(pile1, prompt.gameId), t('errors', 'send_failed'))
  }

  const renderPileCard = (cards: FeedbackCard[]) => (cardView: CardView) => {
    const id = cardView.id as string
    const card = cards.find((c) => c.id === id) ?? (cardView as unknown as FeedbackCard)
    const label = card.displayName ?? card.name
    return (
      <div
        className="pile-card-item"
        onContextMenu={(e) => {
          e.preventDefault()
          setState({ inspectedCard: card as never })
        }}
      >
        <CardSlot card={card as never} cardId={id} />
        <span className="pile-sr-name">{label}</span>
      </div>
    )
  }

  const renderPile = (cards: FeedbackCard[], pile1: boolean, label: string, testId: string, zoneId: string) => (
    <section
      key={testId}
      className="arena-prompt-zone pile-column"
      data-testid={testId}
    >
      <h3 className="arena-prompt-zone-label pile-column-name">{label} ({cards.length})</h3>
      <ArenaFan
        zoneId={zoneId}
        cards={cards as unknown as CardView[]}
        gapIndex={null}
        dealing={dealing}
        onCardPointerDown={noop}
        renderCard={renderPileCard(cards)}
        laneRef={noop}
      />
      <div className="pile-column-action">
        <Button
          className="arena-pile-choose"
          data-testid="pile-choose-btn"
          disabled={busy}
          onClick={() => choose(pile1)}
        >
          {t('game', 'pile_choose')}
        </Button>
      </div>
    </section>
  )

  const title = prompt.sourceName && prompt.sourceName !== t('game', 'choose_pile')
    ? <FormattedText text={prompt.sourceName} />
    : t('game', 'choose_pile')

  return (
    <div className="arena-piles">
      <ArenaPromptShell
        testId="pile-dialog-prompt"
        backdropClassName="pile-backdrop"
        dialogClassName="pile-dialog"
        title={title}
        instruction={<FormattedText text={localizeServerMessage(prompt.message, dynamicT(t))} />}
      >
        <div className="pile-columns">
          {renderPile(piles.pile1, true, t('game', 'pile_1'), 'pile-column-1', 'pile-1')}
          <span className="pile-vs" aria-hidden="true">VS</span>
          {renderPile(piles.pile2, false, t('game', 'pile_2'), 'pile-column-2', 'pile-2')}
        </div>
      </ArenaPromptShell>
    </div>
  )
}
