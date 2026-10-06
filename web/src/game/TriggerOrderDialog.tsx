import { useEffect, useMemo, useState } from 'react'
import Tabs from '../ui/Tabs'
import * as cmds from '../net/commands'
import type { FeedbackPrompt } from './feedback'
import type { FeedbackCard } from './feedback/types'
import CardSlot from '../board/CardSlot'
import FloatingCardPreview from '../board/FloatingCardPreview'
import FormattedText from './FormattedText'
import Icon from '../ui/Icon'
import DialogShell from '../ui/DialogShell'
import { useTranslation } from '../i18n'
import {
  gameObjectNames,
  triggerDisplayName,
  triggerExtraRules,
  triggerRuleText,
  type TriggerRuleScope,
} from './triggerOrder'
import {
  claimTriggerPrompt,
  clearTriggerOrderPlan,
  getTriggerOrderPlan,
  setTriggerOrderPlan,
  takeNextTriggerPick,
} from './triggerOrderPlan'
import { useStore } from '../state/store'
import { setStoreError } from '../state/actions'
import './TriggerOrderDialog.css'
import Button from '../ui/Button'

type SendFn = (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
type SendNowFn = (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => Promise<boolean>

interface TriggerOrderDialogProps {
  prompt: FeedbackPrompt
  send: SendFn
  sendNow: SendNowFn
  busy: boolean
}

export default function TriggerOrderDialog({ prompt, send, sendNow, busy }: TriggerOrderDialogProps) {
  const { t } = useTranslation()
  const game = useStore((s) => s.game)
  const [scope, setScope] = useState<TriggerRuleScope>('card')
  const [order, setOrder] = useState<string[]>(() => (prompt.cards ?? []).map((card) => card.id))
  const [hovered, setHovered] = useState<{ card: FeedbackCard; rect: DOMRect | null } | null>(null)
  const [saved, setSaved] = useState<Record<string, 'first' | 'last'>>({})
  const [dragId, setDragId] = useState<string | null>(null)
  const [, setPlanTick] = useState(0)

  const triggers = prompt.cards ?? []
  const cardsById = useMemo(() => new Map(triggers.map((card) => [card.id, card])), [triggers])
  const names = useMemo(() => gameObjectNames(game), [game])
  const plan = getTriggerOrderPlan()
  const planActive = Boolean(plan && plan.gameId === prompt.gameId && plan.order.length > 0)
  const remaining = Math.max(triggers.length, prompt.options.length, 1)

  // Arrangement is per prompt: a manual pick sends a new (smaller) prompt.
  useEffect(() => {
    setOrder((prompt.cards ?? []).map((card) => card.id))
  }, [prompt])

  // Chained answers: every new prompt consumes the next planned pick, exactly once.
  useEffect(() => {
    const active = getTriggerOrderPlan()
    if (!active || active.gameId !== prompt.gameId) return
    if (!claimTriggerPrompt(prompt)) return
    const next = takeNextTriggerPick(prompt.gameId, (prompt.cards ?? []).map((card) => card.id))
    setPlanTick((tick) => tick + 1)
    if (!next) return
    void sendNow(() => cmds.sendPlayerUUID(next, prompt.gameId), t('errors', 'send_failed')).then((ok) => {
      if (!ok) clearTriggerOrderPlan()
      setPlanTick((tick) => tick + 1)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt])

  const rows = planActive && plan
    ? plan.order
      .map((id) => plan.entries.get(id) ?? cardsById.get(id))
      .filter((card): card is FeedbackCard => Boolean(card))
      .map((card) => ({ card, sent: plan.sent.includes(card.id), nextUp: plan.picks[plan.sent.length] === card.id }))
    : order
      .map((id) => cardsById.get(id))
      .filter((card): card is FeedbackCard => Boolean(card))
      .map((card) => ({ card, sent: false, nextUp: false }))

  const choose = (cardId: string) => {
    clearTriggerOrderPlan()
    void send(() => cmds.sendPlayerUUID(cardId, prompt.gameId), t('errors', 'send_failed'))
  }

  const pin = (cardId: string, first: boolean) => {
    const kind = scope === 'card'
      ? first ? 'TRIGGER_AUTO_ORDER_ABILITY_FIRST' : 'TRIGGER_AUTO_ORDER_ABILITY_LAST'
      : first ? 'TRIGGER_AUTO_ORDER_NAME_FIRST' : 'TRIGGER_AUTO_ORDER_NAME_LAST'
    const card = cardsById.get(cardId)
    const rule = card ? triggerRuleText(card) : ''
    const name = card ? triggerDisplayName(card) : ''
    const realRule = rule.trim().toLowerCase() !== name.trim().toLowerCase()
    const effectiveScope = scope === 'name' && realRule ? 'name' : 'card'
    const data = effectiveScope === 'card' ? cardId : rule
    void remember(() => cmds.sendTriggerAutoOrder(kind, prompt.gameId, data)).then((ok) => {
      if (ok) setSaved((current) => ({ ...current, [cardId]: first ? 'first' : 'last' }))
    })
  }

  const remember = async (action: () => Promise<{ ok: boolean; error?: string }>) => {
    try {
      const result = await action()
      if (!result.ok) setStoreError(result.error ?? t('errors', 'send_failed'))
      return result.ok
    } catch (error) {
      setStoreError(error instanceof Error ? error.message : t('errors', 'send_failed'))
      return false
    }
  }

  const move = (cardId: string, delta: number) => {
    setOrder((current) => {
      const from = current.indexOf(cardId)
      const to = from + delta
      if (from < 0 || to < 0 || to >= current.length) return current
      const next = [...current]
      next.splice(from, 1)
      next.splice(to, 0, cardId)
      return next
    })
  }

  const moveBefore = (draggedId: string, targetId: string) => {
    setOrder((current) => {
      if (draggedId === targetId) return current
      const next = current.filter((id) => id !== draggedId)
      const at = next.indexOf(targetId)
      if (at < 0) return current
      next.splice(at, 0, draggedId)
      return next
    })
  }

  const apply = () => {
    if (!order.length) return
    setTriggerOrderPlan(prompt.gameId, order, triggers)
    const next = takeNextTriggerPick(prompt.gameId, order)
    claimTriggerPrompt(prompt)
    setPlanTick((tick) => tick + 1)
    if (!next) return
    void sendNow(() => cmds.sendPlayerUUID(next, prompt.gameId), t('errors', 'send_failed')).then((ok) => {
      if (!ok) clearTriggerOrderPlan()
      setPlanTick((tick) => tick + 1)
    })
  }

  const reset = () => {
    void remember(() => cmds.sendTriggerAutoOrder('TRIGGER_AUTO_ORDER_RESET_ALL', prompt.gameId))
  }

  const sentCount = planActive && plan ? plan.sent.length : 0
  const totalCount = planActive && plan ? plan.picks.length : 0

  return (
    <DialogShell
      labelledBy="trigger-title"
      titleId="trigger-title"
      legacyBackdropClass="trigger-backdrop"
      legacyPanelClass="trigger-dialog"
      kickerIcon="refresh"
      kickerLabel={t('game', 'trigger_title').toUpperCase()}
      title={planActive
        ? t('game', 'trigger_applying', { done: sentCount, total: totalCount })
        : t('game', 'trigger_remaining', { count: remaining })}
      message={t('game', 'trigger_hint')}
      trailing={<FloatingCardPreview card={(hovered?.card ?? null) as never} anchorRect={hovered?.rect ?? null} boardRect={null} inModal />}
    >
      <div className="trigger-scope">
        <span className="trigger-scope-label">{t('game', 'trigger_scope')}:</span>
        <Tabs
          variant="segmented"
          size="sm"
          label={t('game', 'trigger_scope')}
          value={scope}
          onChange={setScope}
          items={(['card', 'name'] as const).map((value) => ({
            id: value,
            label: t('game', value === 'card' ? 'trigger_scope_card' : 'trigger_scope_name'),
            disabled: busy || planActive,
          }))}
        />
      </div>
      <ul className={`trigger-list${planActive ? ' is-planning' : ''}`}>
        {rows.map(({ card, sent, nextUp }, index) => {
          const name = triggerDisplayName(card)
          const rule = triggerRuleText(card)
          const realRule = rule.trim().toLowerCase() !== name.trim().toLowerCase()
          const extras = triggerExtraRules(card)
          const targetNames = (card.targets ?? []).map((id) => names.get(id) ?? id.slice(0, 8))
          const savedKind = saved[card.id]
          return (
            <li
              key={card.id}
              className={[
                'trigger-row',
                sent ? 'is-sent' : '',
                nextUp ? 'is-next' : '',
                dragId === card.id ? 'is-dragging' : '',
              ].filter(Boolean).join(' ')}
              data-testid={`trigger-row-${card.id}`}
              draggable={!planActive}
              onDragStart={planActive ? undefined : (e) => { setDragId(card.id); e.dataTransfer.effectAllowed = 'move' }}
              onDragOver={planActive ? undefined : (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              onDrop={planActive ? undefined : (e) => { e.preventDefault(); if (dragId) moveBefore(dragId, card.id); setDragId(null) }}
              onDragEnd={() => setDragId(null)}
            >
              <span className="trigger-order-cell">
                <span className="trigger-index">{index + 1}</span>
                <span className="trigger-move">
                  <Button
                    size="sm"
                    disabled={busy || planActive || index === 0}
                    title={t('game', 'trigger_move_up')}
                    aria-label={`${t('game', 'trigger_move_up')}: ${name}`}
                    onClick={() => move(card.id, -1)}
                  >
                    <Icon name="chevronUp" size={12} />
                  </Button>
                  <Button
                    size="sm"
                    disabled={busy || planActive || index === rows.length - 1}
                    title={t('game', 'trigger_move_down')}
                    aria-label={`${t('game', 'trigger_move_down')}: ${name}`}
                    onClick={() => move(card.id, 1)}
                  >
                    <Icon name="chevronDown" size={12} />
                  </Button>
                </span>
              </span>
              <span className="trigger-art">
                <CardSlot
                  card={card as never}
                  cardId={card.id}
                  onHover={(c, rect) => setHovered(c ? { card: c as unknown as FeedbackCard, rect: rect ?? null } : null)}
                />
              </span>
              <span className="trigger-text">
                <span className="trigger-name">{name}</span>
                {realRule && <span className="trigger-rule" title={rule}>{rule}</span>}
                {extras.map((extra) => (
                  <span key={extra} className="trigger-related">{extra}</span>
                ))}
                {targetNames.length > 0 && (
                  <span className="trigger-targets">{t('game', 'trigger_targets', { names: targetNames.join(', ') })}</span>
                )}
                {savedKind && (
                  <span className="trigger-saved">
                    {t('game', savedKind === 'first' ? 'trigger_saved_first' : 'trigger_saved_last')}
                  </span>
                )}
              </span>
              <span className="trigger-actions">
                {planActive ? (
                  sent
                    ? <span className="trigger-state is-sent"><Icon name="check" size={12} /> {t('game', 'trigger_placed')}</span>
                    : nextUp
                      ? <span className="trigger-state is-next"><Icon name="hourglass" size={12} /> {t('game', 'trigger_sending')}</span>
                      : null
                ) : (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={busy}
                      onClick={() => choose(card.id)}
                    >
                      {t('game', 'trigger_choose')}
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      title={t('game', 'trigger_first')}
                      onClick={() => pin(card.id, true)}
                    >
                      <Icon name="chevronsUp" size={12} /> {t('game', 'trigger_first')}
                    </Button>
                    <Button
                      size="sm"
                      disabled={busy}
                      title={t('game', 'trigger_last')}
                      onClick={() => pin(card.id, false)}
                    >
                      <Icon name="chevronsDown" size={12} /> {t('game', 'trigger_last')}
                    </Button>
                  </>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      {triggers.length === 0 && (
        <p className="trigger-empty"><FormattedText text={prompt.message} /></p>
      )}
      <footer className="trigger-footer">
        <Button size="sm" disabled={busy || planActive} onClick={reset}>
          {t('game', 'trigger_reset')}
        </Button>
        {!planActive && (
          <Button
            variant="primary"
            size="sm"
            className="trigger-apply"
            disabled={busy || order.length === 0}
            onClick={apply}
          >
            <Icon name="check" size={12} /> {t('game', 'trigger_apply')}
          </Button>
        )}
      </footer>
    </DialogShell>
  )
}
