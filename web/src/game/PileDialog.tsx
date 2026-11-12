import Button from '../ui/Button'
import * as cmds from '../net/commands'
import type { FeedbackPrompt } from './feedback'
import type { FeedbackCard } from './feedback/types'
import { PromptCardThumb, usePromptCardPreview } from './promptCardPreview'
import FormattedText from './FormattedText'
import DialogShell from '../ui/DialogShell'
import { useTranslation, dynamicT } from '../i18n'
import { localizeServerMessage } from './serverMessageTranslation'
import './PileDialog.css'

interface PileDialogProps {
  prompt: FeedbackPrompt
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
  busy: boolean
}

export default function PileDialog({ prompt, send, busy }: PileDialogProps) {
  const { t } = useTranslation()
  const cardPreview = usePromptCardPreview()
  const piles = prompt.pileCards
  if (!piles) return null

  const choose = (pile1: boolean) => {
    void send(() => cmds.sendPlayerBoolean(pile1, prompt.gameId), t('errors', 'send_failed'))
  }

  const renderPile = (cards: FeedbackCard[], pile1: boolean, label: string, testId: string) => (
    <div
      key={testId}
      className="pile-column"
      data-testid={testId}
    >
      <span className="pile-column-name">{label} ({cards.length})</span>
      <span className="pile-cards">
        {cards.map((card) => (
          <span key={card.id} className="pile-card-wrap">
            <PromptCardThumb preview={cardPreview} previewKey={card.id} card={card as never} />
          </span>
        ))}
      </span>
      <Button variant="soft" data-testid="pile-choose-btn"
        disabled={busy}
        onClick={() => choose(pile1)}>
        {t('game', 'pile_choose')}
      </Button>
    </div>
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
      sourceName={prompt.sourceName && prompt.sourceName !== t('game', 'choose_pile')
        ? <FormattedText text={prompt.sourceName} />
        : undefined}
      message={<FormattedText text={localizeServerMessage(prompt.message, dynamicT(t))} />}
      trailing={cardPreview.preview}
    >
      <div className="pile-columns">
        {renderPile(piles.pile1, true, t('game', 'pile_1'), 'pile-column-1')}
        <span className="pile-vs">VS</span>
        {renderPile(piles.pile2, false, t('game', 'pile_2'), 'pile-column-2')}
      </div>
    </DialogShell>
  )
}
