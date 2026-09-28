import { useMemo, useState } from 'react'
import Chip from '../ui/Chip'
import * as cmds from '../net/commands'
import type { CardView } from '../net/types'
import { useStore } from '../state/store'
import type { FeedbackPrompt } from './feedback'
import DialogShell from '../ui/DialogShell'
import Icon from '../ui/Icon'
import CardSlot from '../board/CardSlot'
import FloatingCardPreview from '../board/FloatingCardPreview'
import { useTranslation, t as staticT } from '../i18n'
import { confirmDialog } from '../ui/confirmDialog'
import { ManaCost } from '../decks/ArenaManaSymbols'
import { computeMulliganEvaluation, type MulliganEvaluation } from './mulliganEvaluator'
import { HandPrompt } from './GameDock'
import './MulliganDialog.css'
import Button from '../ui/Button'

/** Short hint under the Mulligan option, from the server ask
 *  (`Mulligan down to 6 cards?` / `Mulligan for free, draw another 7 cards?`). */
export function mulliganOptionHint(message: string, t: typeof staticT): string | null {
  const plain = message.replace(/<[^>]*>/g, '')
  const free = plain.match(/for\s+free.*?(\d+)\s+cards?/i)
  if (free) return t('dialogs', 'mulligan_free_hint', { count: Number(free[1]) })
  const down = plain.match(/down\s+to\s+(\d+)\s+cards?/i)
  if (down) return t('dialogs', 'mulligan_down_hint', { count: Number(down[1]) })
  return null
}

function MulliganHandEvaluator({ evaluation, t }: { evaluation: MulliganEvaluation; t: typeof staticT }) {
  if (evaluation.cardCount === 0) return null
  const manaCostStr = evaluation.colorCodes.map((c) => `{${c}}`).join('')
  return (
    <div className="mulligan-evaluator" data-testid="mulligan-evaluator">
      <Chip tone="neutral" size="sm" icon="mountain">
        {t('game', 'tracker_lands')} {evaluation.landCount}/{evaluation.cardCount}
      </Chip>
      <Chip tone="neutral" size="sm" icon="sparkles">
        {t('game', 'tracker_spells')} {evaluation.spellCount}/{evaluation.cardCount}
      </Chip>
      {evaluation.colorCodes.length > 0 ? (
        <Chip tone="neutral" size="sm" className="mulligan-eval-colors">
          <span>{t('dialogs', 'mulligan_eval_colors_label')}</span>
          <ManaCost manaCost={manaCostStr} size={13} />
        </Chip>
      ) : (
        <Chip tone="warn" size="sm">{t('dialogs', 'mulligan_eval_no_color')}</Chip>
      )}
      {evaluation.thirdLandProbability !== null && (
        <Chip
          tone={evaluation.thirdLandProbability < 50 ? 'warn' : 'ok'}
          size="sm"
          icon="gauge"
          data-testid="mulligan-eval-third-land"
        >
          {t('dialogs', 'mulligan_eval_third_land', { pct: evaluation.thirdLandProbability })}
        </Chip>
      )}
    </div>
  )
}

interface MulliganDialogProps {
  prompt: FeedbackPrompt
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
  cancel: () => void
  busy: boolean
}

export default function MulliganDialog({ prompt, send, cancel, busy }: MulliganDialogProps) {
  const { t } = useTranslation()
  const game = useStore((s) => s.game)
  const myDeck = useStore((s) => s.myDeck)
  const hand = (game?.myHand ?? {}) as Record<string, CardView>
  const handEntries = Object.entries(hand)
  const isLondon = prompt.isMulliganLondon === true
  const [hoveredCard, setHoveredCard] = useState<CardView | null>(null)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const evaluation = useMemo(
    () => computeMulliganEvaluation(Object.values(hand), myDeck, game, game?.myPlayerId),
    [hand, myDeck, game],
  )

  const keep = () => void send(() => cmds.sendPlayerBoolean(false, prompt.gameId), t('errors', 'send_failed'))
  const mulligan = () => void send(() => cmds.sendPlayerBoolean(true, prompt.gameId), t('errors', 'send_failed_mulligan'))

  const concede = async () => {
    if (await confirmDialog(t('game', 'concede_confirm'), { danger: true })) {
      void send(() => cmds.sendPlayerAction('CONCEDE', prompt.gameId), t('errors', 'send_failed'))
    }
  }

  const pickOne = (id: string) => {
    if (busy) return
    void send(() => cmds.sendPlayerUUID(id, prompt.gameId), t('errors', 'send_failed'))
  }

  const handleHover = (card: CardView | null, rect?: DOMRect) => {
    setHoveredCard(card)
    setAnchorRect(rect ?? null)
  }

  const cardCount = handEntries.length

  if (isLondon) {
    const targetIds = new Set(prompt.options.map((option) => option.id))
    const pickable = targetIds.size > 0 ? handEntries.filter(([id]) => targetIds.has(id)) : handEntries
    const remaining = prompt.progress?.remaining ?? 1
    return (
      <DialogShell
        labelledBy="mulligan-title"
        titleId="mulligan-title"
        size="lg"
        legacyBackdropClass="mulligan-backdrop"
        legacyPanelClass="mulligan-dialog mulligan-london"
        kickerIcon="layers"
        kickerLabel={t('dialogs', 'mulligan_london_title')}
        title={(
          <span data-testid="mulligan-london-remaining" role="status" aria-live="polite">
            {t('dialogs', 'mulligan_london_remaining', { count: remaining })}
          </span>
        )}
        message={t('dialogs', 'mulligan_london_pick_hint')}
        trailing={<FloatingCardPreview card={hoveredCard} anchorRect={anchorRect} boardRect={null} inModal />}
      >
          {pickable.length > 0 && (
            <div className="mulligan-hand-grid" data-testid="mulligan-london-grid" aria-busy={busy}>
              {pickable.map(([id, card], i) => (
                <div
                  key={id}
                  className="mulligan-card-wrap"
                  style={{ animationDelay: `${i * 55}ms` }}
                >
                  <CardSlot
                    cardId={id}
                    card={card}
                    isPlayable={!busy}
                    onHover={handleHover}
                    onClick={() => pickOne(id)}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mulligan-actions">
            {prompt.required === false && (
              <Button variant="subtle" disabled={busy} onClick={cancel} className="cancel-btn">{t('common', 'cancel')}</Button>
            )}
            <Button variant="soft-danger"
              data-testid="mulligan-concede"
              disabled={busy}
              onClick={() => void concede()}>
              <Icon name="flag" size={13} /> {t('dialogs', 'mulligan_concede')}
            </Button>
          </div>
      </DialogShell>
    )
  }

  const optionHint = mulliganOptionHint(prompt.message, t)
  const starterId = game?.activePlayerId ?? null
  const starterName = starterId ? game?.players?.find((p) => p.playerId === starterId)?.name : undefined
  const starterLabel = !starterId
    ? null
    : starterId === game?.myPlayerId
      ? t('dialogs', 'mulligan_you_start')
      : starterName
        ? t('dialogs', 'mulligan_they_start', { name: starterName })
        : null

  return (
    <HandPrompt>
      <div className="mulligan-bar" role="group" aria-labelledby="mulligan-title" data-testid="mulligan-bar">
        <div className="mulligan-bar-row">
          <div className="mulligan-bar-info">
            <span id="mulligan-title" className="mulligan-bar-title">{t('dialogs', 'mulligan_opening_hand')}</span>
            <span className="mulligan-bar-count">{t('dialogs', 'mulligan_cards', { count: cardCount })}</span>
            {starterLabel && (
              <span className="mulligan-bar-starter" data-testid="mulligan-starter">
                <Icon name="play" size={11} /> {starterLabel}
              </span>
            )}
          </div>
          <button type="button" className="mulligan-bar-option" disabled={busy} onClick={mulligan}>
            <span className="mulligan-bar-option-label">{t('dialogs', 'mulligan_btn')}</span>
            {optionHint && <span className="mulligan-bar-option-hint">{optionHint}</span>}
          </button>
          <Button
            variant="ghost"
            className="mulligan-bar-concede"
            data-testid="mulligan-concede"
            disabled={busy}
            title={t('dialogs', 'mulligan_concede')}
            onClick={() => void concede()}
          >
            <Icon name="flag" size={13} /> {t('dialogs', 'mulligan_concede')}
          </Button>
          <Button variant="primary" className="mulligan-bar-keep" disabled={busy} onClick={keep}>
            {t('dialogs', 'mulligan_keep_hand')} <span aria-hidden="true">→</span>
          </Button>
        </div>
        <MulliganHandEvaluator evaluation={evaluation} t={t} />
      </div>
    </HandPrompt>
  )
}
