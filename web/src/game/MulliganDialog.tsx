import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import Chip from '../ui/Chip'
import * as cmds from '../net/commands'
import type { CardView } from '../net/types'
import { useStore } from '../state/store'
import type { FeedbackPrompt } from './feedback'
import Modal from '../ui/Modal'
import Icon from '../ui/Icon'
import CardSlot from '../board/CardSlot'
import { PromptCardZoomable, usePromptCardPreview } from './promptCardPreview'
import { useTranslation, t as staticT } from '../i18n'
import { confirmDialog } from '../ui/confirmDialog'
import { ManaCost } from '../decks/ArenaManaSymbols'
import { computeMulliganEvaluation, type MulliganEvaluation } from './mulliganEvaluator'
import {
  claimMulliganPrompt,
  clearMulliganBottomPlan,
  getMulliganBottomPlan,
  setMulliganBottomPlan,
  takeNextMulliganPick,
} from './mulliganBottomPlan'
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

/**
 * BRD-58: how many mulligans this hand has already cost, as the London ask itself states it —
 * every mulligan taken puts one more card at the bottom, so the cards still to bottom plus the
 * ones already chosen is the count. The keep-or-mulligan ask carries no such number, and a count
 * guessed from the hand size would be a different number wearing the same label, so there is none.
 */
export function mulligansTaken(prompt: FeedbackPrompt): number {
  if (!prompt.isMulliganLondon) return 0
  const progress = prompt.progress
  if (!progress) return 0
  return (progress.selected ?? 0) + (progress.remaining ?? 0)
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
  sendNow: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => Promise<boolean>
  cancel: () => void
  busy: boolean
}

export default function MulliganDialog({ prompt, send, sendNow, cancel, busy }: MulliganDialogProps) {
  const { t } = useTranslation()
  const game = useStore((s) => s.game)
  const myDeck = useStore((s) => s.myDeck)
  const hand = (game?.myHand ?? {}) as Record<string, CardView>
  const handEntries = Object.entries(hand)
  const isLondon = prompt.isMulliganLondon === true
  const cardPreview = usePromptCardPreview()
  // BRD-58: the board is behind the screen and a look at it is one button away. The screen stays
  // mounted and keeps taking the clicks while it is transparent, so a peek cannot play the game.
  const [peeking, setPeeking] = useState(false)
  // PRM-2: the cards chosen for the bottom, until the player confirms them.
  const [picked, setPicked] = useState<string[]>([])
  const [, setPlanTick] = useState(0)

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

  const targetIds = new Set(prompt.options.map((option) => option.id))
  const cards = isLondon && targetIds.size > 0 ? handEntries.filter(([id]) => targetIds.has(id)) : handEntries
  const taken = mulligansTaken(prompt)
  // How many cards this mulligan costs, which the asks count down but the choice does not.
  const toBottom = Math.max(1, taken)
  const plan = getMulliganBottomPlan()
  const sending = Boolean(plan && plan.gameId === prompt.gameId)
  const chosen = sending ? plan!.picks : picked
  const ready = chosen.length === toBottom

  const togglePick = (id: string) => {
    if (busy || sending) return
    setPicked((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id)
      return current.length >= toBottom ? current : [...current, id]
    })
  }

  /** Answers the ask in front of us with the next card of the plan, exactly once per ask. */
  const sendNextPick = () => {
    if (!claimMulliganPrompt(prompt)) return
    const next = takeNextMulliganPick(prompt.gameId, prompt.options.map((option) => option.id))
    setPlanTick((tick) => tick + 1)
    if (!next) return
    void sendNow(() => cmds.sendPlayerUUID(next, prompt.gameId), t('errors', 'send_failed')).then((ok) => {
      if (!ok) clearMulliganBottomPlan()
      setPlanTick((tick) => tick + 1)
    })
  }

  const confirmBottom = () => {
    if (!ready || sending || busy) return
    setMulliganBottomPlan(prompt.gameId, picked)
    sendNextPick()
  }

  // Each further ask of this mulligan consumes the next card the player confirmed.
  useEffect(() => {
    if (!isLondon) return
    const active = getMulliganBottomPlan()
    if (!active || active.gameId !== prompt.gameId) return
    sendNextPick()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt])

  const starterId = game?.activePlayerId ?? null
  const starterName = starterId ? game?.players?.find((p) => p.playerId === starterId)?.name : undefined
  const starterLabel = !starterId
    ? null
    : starterId === game?.myPlayerId
      ? t('dialogs', 'mulligan_you_start')
      : starterName
        ? t('dialogs', 'mulligan_they_start', { name: starterName })
        : null

  const optionHint = mulliganOptionHint(prompt.message, t)

  return (
    <Modal
      backdropClassName={`mulligan-backdrop${peeking ? ' is-peeking' : ''}`}
      dialogClassName="mulligan-screen"
      labelledBy="mulligan-title"
      testId="mulligan-screen"
      sectionProps={{ 'aria-busy': busy || undefined } as Record<string, unknown>}
      trailing={
        <>
          {peeking && (
            <div className="mulligan-peek-bar" data-testid="mulligan-peek">
              <Button variant="primary" onClick={() => setPeeking(false)} data-testid="mulligan-peek-back">
                <Icon name="undo" size={13} /> {t('dialogs', 'mulligan_back_to_hand')}
              </Button>
            </div>
          )}
          {cardPreview.preview}
        </>
      }
    >
      <header className="mulligan-screen-head">
        <h2 id="mulligan-title" className="mulligan-screen-title" data-testid="mulligan-title">
          {isLondon
            ? t('dialogs', 'mulligan_london_remaining', { count: toBottom })
            : starterLabel ?? t('dialogs', 'mulligan_opening_hand')}
        </h2>
        <p className="mulligan-screen-sub" data-testid="mulligan-sub">
          {isLondon
            ? t('dialogs', 'mulligan_london_chosen', { count: chosen.length, total: toBottom })
            : t('dialogs', 'mulligan_cards', { count: handEntries.length })}
        </p>
        {taken > 0 && (
          <span className="mulligan-screen-count" data-testid="mulligan-count">
            {t('dialogs', 'mulligan_count', { count: taken })}
          </span>
        )}
      </header>

      {/* BRD-58: the opening hand reads as a hand — one fan of cards at the size of a card,
          not a grid of thumbnails, with the arc narrowing as the hand grows. */}
      <div
        className={`mulligan-fan${isLondon ? ' is-pickable' : ''}`}
        data-testid={isLondon ? 'mulligan-london-grid' : 'mulligan-fan'}
        data-count={cards.length}
      >
        {cards.map(([id, card], i) => (
          <PromptCardZoomable
            key={id}
            preview={cardPreview}
            previewKey={id}
            card={card}
            className={`mulligan-card-wrap${chosen.includes(id) ? ' is-chosen' : ''}`}
            style={{ '--fan-i': i, '--fan-mid': (cards.length - 1) / 2 } as CSSProperties}
          >
            <CardSlot
              cardId={id}
              card={card}
              isPlayable={isLondon && !busy && !sending}
              onClick={isLondon ? () => togglePick(id) : undefined}
            />
            {isLondon && chosen.includes(id) && (
              <span className="mulligan-card-mark" data-testid={`mulligan-chosen-${id}`} aria-hidden="true">
                <Icon name="chevronDown" size={14} />
              </span>
            )}
          </PromptCardZoomable>
        ))}
      </div>

      <MulliganHandEvaluator evaluation={evaluation} t={t} />

      <div className="mulligan-screen-actions" data-testid="mulligan-bar">
        <Button
          variant="subtle"
          className="mulligan-bar-peek"
          onClick={() => setPeeking(true)}
          data-testid="mulligan-peek-open"
        >
          <Icon name="eye" size={13} /> {t('dialogs', 'mulligan_view_board')}
        </Button>
        {!isLondon && (
          <button
            type="button"
            className="mulligan-bar-option"
            disabled={busy}
            onClick={mulligan}
            data-testid="mulligan-take"
          >
            <span className="mulligan-bar-option-label">{t('dialogs', 'mulligan_btn')}</span>
            {optionHint && <span className="mulligan-bar-option-hint">{optionHint}</span>}
          </button>
        )}
        {!isLondon && (
          <Button
            variant="primary"
            className="mulligan-bar-keep"
            disabled={busy}
            onClick={keep}
            data-testid="mulligan-keep"
          >
            {t('dialogs', 'mulligan_keep_hand')}
          </Button>
        )}
        {isLondon && (
          <Button
            variant="primary"
            className="mulligan-bar-keep"
            disabled={!ready || sending || busy}
            onClick={confirmBottom}
            data-testid="mulligan-keep"
          >
            {t('dialogs', 'mulligan_keep_hand')}
          </Button>
        )}
        {prompt.required === false && (
          <Button variant="subtle" disabled={busy} onClick={cancel} className="cancel-btn">
            {t('common', 'cancel')}
          </Button>
        )}
        <Button
          variant="ghost"
          className="mulligan-bar-concede"
          data-testid="mulligan-concede"
          disabled={busy}
          onClick={() => void concede()}
        >
          <Icon name="flag" size={13} /> {t('dialogs', 'mulligan_concede')}
        </Button>
      </div>
    </Modal>
  )
}
