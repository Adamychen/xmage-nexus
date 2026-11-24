import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import Tabs from '../ui/Tabs'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import * as cmds from '../net/commands'
import type { CardView } from '../net/types'
import type { FeedbackPrompt } from './feedback'
import type { FeedbackCard } from './feedback/types'
import FormattedText from './FormattedText'
import { PromptCardThumb, usePromptCardPreview, type PromptCardPreview } from './promptCardPreview'
import ArenaFan from './arena/ArenaFan'
import ArenaPromptShell from './arena/ArenaPromptShell'
import { useFanDrag } from './arena/useFanDrag'
import { useTranslation } from '../i18n'
import {
  gameObjectNames,
  triggerDisplayName,
  triggerExtraRules,
  triggerObjects,
  triggerRuleText,
  triggerSourceCard,
  triggerSourceKey,
  type TriggerObject,
  type TriggerRuleScope,
} from './triggerOrder'
import {
  claimTriggerPrompt,
  clearTriggerOrderPlan,
  getTriggerOrderPlan,
  setTriggerOrderPlan,
  takeNextTriggerPick,
} from './triggerOrderPlan'
import { setState, useStore } from '../state/store'
import { setStoreError } from '../state/actions'
import { seatColorVar, seatIndexOf } from '../board/seatColor'
import './TriggerOrderDialog.css'

type SendNowFn = (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => Promise<boolean>

interface TriggerOrderDialogProps {
  prompt: FeedbackPrompt
  sendNow: SendNowFn
  busy: boolean
}

const ZONES = ['triggers']
const DEAL_MS = 900

function noLane() {}

const ZONE_KEYS = {
  battlefield: 'trigger_zone_battlefield',
  graveyard: 'trigger_zone_graveyard',
  exile: 'trigger_zone_exile',
  hand: 'trigger_zone_hand',
  command: 'trigger_zone_command',
  stack: 'trigger_zone_stack',
} as const

export default function TriggerOrderDialog({ prompt, sendNow, busy }: TriggerOrderDialogProps) {
  const { t } = useTranslation()
  const game = useStore((s) => s.game)
  const [scope, setScope] = useState<TriggerRuleScope>('card')
  // Left → right = resolves Last → resolves First (matches StackViewer & MTG Arena).
  const [fanIds, setFanIds] = useState<string[]>(() => [...(prompt.cards ?? [])].reverse().map((card) => card.id))
  const [readId, setReadId] = useState<string | null>(null)
  const [dealing, setDealing] = useState(true)
  const [saved, setSaved] = useState<Record<string, 'first' | 'last'>>({})
  const [, setPlanTick] = useState(0)
  const cardPreview = usePromptCardPreview()

  const triggers = prompt.cards ?? []
  const cardsById = useMemo(() => new Map(triggers.map((card) => [card.id, card])), [triggers])
  const names = useMemo(() => gameObjectNames(game), [game])
  const sourceCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const card of prompt.cards ?? []) {
      counts.set(triggerSourceKey(card), (counts.get(triggerSourceKey(card)) ?? 0) + 1)
    }
    return counts
  }, [prompt.cards])

  const plan = getTriggerOrderPlan()
  const planActive = Boolean(plan && plan.gameId === prompt.gameId && plan.order.length > 0)

  useEffect(() => {
    const timer = setTimeout(() => setDealing(false), DEAL_MS)
    return () => clearTimeout(timer)
  }, [])

  // Arrangement resets per fresh manual prompt.
  useEffect(() => {
    setFanIds([...(prompt.cards ?? [])].reverse().map((card) => card.id))
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

  // Ordered left → right (Last → First).
  const displayEntries = useMemo(() => {
    const ids = planActive && plan ? [...plan.order].reverse() : fanIds
    return ids
      .map((id) => (planActive && plan ? plan.entries.get(id) ?? cardsById.get(id) : cardsById.get(id)))
      .filter((card): card is FeedbackCard => Boolean(card))
      .map((card) => ({
        card,
        sent: Boolean(planActive && plan && plan.sent.includes(card.id)),
        nextUp: Boolean(planActive && plan && plan.picks[plan.sent.length] === card.id),
      }))
  }, [planActive, plan, fanIds, cardsById])

  const entryById = useMemo(
    () => new Map(displayEntries.map((entry) => [entry.card.id, entry])),
    [displayEntries],
  )

  const displayCardById = useMemo(() => {
    const map = new Map<string, CardView>()
    for (const { card } of displayEntries) {
      const source = triggerSourceCard(card, game)
      // Keep the trigger's unique UUID on the fan card while drawing the live source card art.
      map.set(card.id, { ...source, id: card.id } as CardView)
    }
    return map
  }, [displayEntries, game])

  const place = (id: string, index: number) => {
    setFanIds((prev) => {
      const rest = prev.filter((c) => c !== id)
      const at = Math.max(0, Math.min(index, rest.length))
      return [...rest.slice(0, at), id, ...rest.slice(at)]
    })
    setReadId(id)
  }

  const move = (id: string, delta: number) => {
    setFanIds((prev) => {
      const from = prev.indexOf(id)
      const to = from + delta
      if (from < 0 || to < 0 || to >= prev.length) return prev
      const next = [...prev]
      next.splice(from, 1)
      next.splice(to, 0, id)
      return next
    })
  }

  const { drag, hover, bindRoot, startDrag, dragLayer } = useFanDrag({
    zones: ZONES,
    canDrag: !busy && !planActive,
    onDrop: (id, _zone, index) => place(id, index),
    onClick: (id) => setReadId(id),
  })

  const visibleCards = useMemo(
    () =>
      displayEntries
        .filter(({ card }) => !(drag?.started && drag.id === card.id))
        .map(({ card }) => displayCardById.get(card.id))
        .filter((card): card is CardView => card != null),
    [displayEntries, drag, displayCardById],
  )

  const dragged = drag?.started ? displayCardById.get(drag.id) ?? null : null

  const activeEntry = useMemo(() => {
    if (drag?.started) {
      const hit = entryById.get(drag.id)
      if (hit) return hit
    }
    if (readId) {
      const hit = entryById.get(readId)
      if (hit) return hit
    }
    return displayEntries[displayEntries.length - 1] ?? null
  }, [drag, readId, entryById, displayEntries])

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

  const pin = (cardId: string, first: boolean) => {
    const kind = scope === 'card'
      ? first ? 'TRIGGER_AUTO_ORDER_ABILITY_FIRST' : 'TRIGGER_AUTO_ORDER_ABILITY_LAST'
      : first ? 'TRIGGER_AUTO_ORDER_NAME_FIRST' : 'TRIGGER_AUTO_ORDER_NAME_LAST'
    const card = cardsById.get(cardId) ?? entryById.get(cardId)?.card
    const rule = card ? triggerRuleText(card) : ''
    const name = card ? triggerDisplayName(card) : ''
    const realRule = rule.trim().toLowerCase() !== name.trim().toLowerCase()
    const effectiveScope = scope === 'name' && realRule ? 'name' : 'card'
    const data = effectiveScope === 'card' ? cardId : rule
    void remember(() => cmds.sendTriggerAutoOrder(kind, prompt.gameId, data)).then((ok) => {
      if (ok) setSaved((current) => ({ ...current, [cardId]: first ? 'first' : 'last' }))
    })
  }

  const reset = () => {
    void remember(() => cmds.sendTriggerAutoOrder('TRIGGER_AUTO_ORDER_RESET_ALL', prompt.gameId))
  }

  const apply = () => {
    if (!fanIds.length || busy || planActive) return
    // Resolution order has index 0 resolving first (rightmost card in the fan).
    const resolutionOrder = [...fanIds].reverse()
    setTriggerOrderPlan(prompt.gameId, resolutionOrder, triggers)
    const next = takeNextTriggerPick(prompt.gameId, resolutionOrder)
    claimTriggerPrompt(prompt)
    setPlanTick((tick) => tick + 1)
    if (!next) return
    void sendNow(() => cmds.sendPlayerUUID(next, prompt.gameId), t('errors', 'send_failed')).then((ok) => {
      if (!ok) clearTriggerOrderPlan()
      setPlanTick((tick) => tick + 1)
    })
  }

  const onCardContextMenu = (e: MouseEvent, id: string) => {
    const entry = entryById.get(id)
    if (!entry) return
    e.preventDefault()
    setState({ inspectedCard: triggerSourceCard(entry.card, game) })
  }

  const sentCount = planActive && plan ? plan.sent.length : 0
  const totalCount = planActive && plan ? plan.picks.length : 0

  const renderOverlay = (card: CardView, order: number) => {
    const id = card.id as string
    const entry = entryById.get(id)
    if (!entry) return null
    const resolutionIndex = visibleCards.length - order
    const isFirst = resolutionIndex === 1
    const sibling = (sourceCounts.get(triggerSourceKey(entry.card)) ?? 0) > 1
    const objects = sibling ? triggerObjects(entry.card, game, names) : []
    const isActive = activeEntry?.card.id === id
    return (
      <>
        <span className={`trigger-fan-rank${isFirst ? ' is-first' : ''}${isActive ? ' is-active' : ''}${entry.sent ? ' is-sent' : ''}`}>
          {entry.sent ? <Icon name="check" size={11} /> : `#${resolutionIndex}`}
        </span>
        {sibling && objects.length > 0 && (
          <span className="trigger-fan-target" title={objects.map((o) => o.name).join(', ')}>
            → {objects[0].name}
          </span>
        )}
      </>
    )
  }

  const bubble = activeEntry ? (() => {
    const { card, sent, nextUp } = activeEntry
    const name = triggerDisplayName(card)
    const rule = triggerRuleText(card)
    const realRule = rule.trim().toLowerCase() !== name.trim().toLowerCase()
    const objects = triggerObjects(card, game, names)
    const extras = objects.length > 0 && objects.every((object) => object.card || object.isPlayer) ? [] : triggerExtraRules(card)
    const savedKind = saved[card.id]
    const activeFanIndex = displayEntries.findIndex((e) => e.card.id === card.id)
    const resolutionNumber = displayEntries.length - activeFanIndex
    const canMoveLeft = !busy && !planActive && activeFanIndex > 0
    const canMoveRight = !busy && !planActive && activeFanIndex >= 0 && activeFanIndex < displayEntries.length - 1

    return (
      <div className="trigger-aside-stack">
        <div className="trigger-bubble" data-testid="trigger-bubble">
          <div className="trigger-bubble-head">
            <span className="trigger-bubble-title">
              <Icon name="zap" size={12} aria-hidden />
              <span className="trigger-bubble-name">{name}</span>
              <span className={`trigger-bubble-rank${resolutionNumber === 1 ? ' is-first' : ''}`}>
                #{resolutionNumber}
              </span>
            </span>
            {planActive && (sent || nextUp) ? (
              <span className={`trigger-state${sent ? ' is-sent' : ' is-next'}`}>
                <Icon name={sent ? 'check' : 'hourglass'} size={12} />
                <span>{t('game', sent ? 'trigger_placed' : 'trigger_sending')}</span>
              </span>
            ) : (
              <span className="trigger-bubble-tools">
                <button
                  type="button"
                  className="trigger-tool-btn"
                  disabled={!canMoveLeft}
                  title={t('game', 'trigger_move_down')}
                  aria-label={`${t('game', 'trigger_move_down')}: ${name}`}
                  onClick={() => move(card.id, -1)}
                >
                  <Icon name="chevronLeft" size={13} />
                </button>
                <button
                  type="button"
                  className="trigger-tool-btn"
                  disabled={!canMoveRight}
                  title={t('game', 'trigger_move_up')}
                  aria-label={`${t('game', 'trigger_move_up')}: ${name}`}
                  onClick={() => move(card.id, 1)}
                >
                  <Icon name="chevronRight" size={13} />
                </button>
                <button
                  type="button"
                  className="trigger-tool-btn"
                  data-testid="trigger-pin-first"
                  disabled={busy || planActive}
                  title={t('game', 'trigger_first')}
                  aria-label={`${t('game', 'trigger_first')}: ${name}`}
                  onClick={() => pin(card.id, true)}
                >
                  <Icon name="chevronsUp" size={13} />
                </button>
                <button
                  type="button"
                  className="trigger-tool-btn"
                  data-testid="trigger-pin-last"
                  disabled={busy || planActive}
                  title={t('game', 'trigger_last')}
                  aria-label={`${t('game', 'trigger_last')}: ${name}`}
                  onClick={() => pin(card.id, false)}
                >
                  <Icon name="chevronsDown" size={13} />
                </button>
              </span>
            )}
          </div>

          <div className="trigger-bubble-body">
            {realRule && <p className="trigger-bubble-rule"><FormattedText text={rule} cardName={name} /></p>}
            {extras.map((extra) => (
              <p key={extra} className="trigger-related">{extra}</p>
            ))}
            {objects.length > 0 && (
              <div className="trigger-bubble-object-labels">
                {objects.map((object) => (
                  <TriggerObjectLabel
                    key={object.id}
                    object={object}
                    players={game?.players}
                    preview={cardPreview}
                    previewKey={`${card.id}:${object.id}:name`}
                  />
                ))}
              </div>
            )}
            {savedKind && (
              <span className="trigger-saved">
                {t('game', savedKind === 'first' ? 'trigger_saved_first' : 'trigger_saved_last')}
              </span>
            )}
          </div>
        </div>

        {objects.some((object) => object.card) && (
          <div className="trigger-target-cards">
            {objects.filter((object) => object.card).map((object) => (
              <PromptCardThumb
                key={object.id}
                preview={cardPreview}
                previewKey={`${card.id}:${object.id}`}
                card={object.card!}
                label={object.name}
                title={t('game', 'trigger_card_hint')}
                className="trigger-object-art"
              />
            ))}
          </div>
        )}
      </div>
    )
  })() : null

  return (
    <div {...bindRoot} className={`arena-triggers${planActive ? ' is-sending' : ''}`}>
      <ArenaPromptShell
        title={planActive
          ? t('game', 'trigger_applying', { done: sentCount, total: totalCount })
          : t('dialogs', 'arena_trigger_title')}
        instruction={t('dialogs', 'arena_trigger_hint')}
        aside={bubble}
        footer={
          <div className="arena-triggers-footer">
            <Button
              className="arena-triggers-done trigger-apply"
              data-testid="trigger-order-done"
              onClick={apply}
              disabled={busy || planActive || fanIds.length === 0}
            >
              {planActive ? t('dialogs', 'arena_sending') : t('dialogs', 'arena_done')}
            </Button>
            <div className="arena-triggers-rules">
              <span className="arena-triggers-rules-label">{t('game', 'trigger_scope')}:</span>
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
              <Button size="sm" disabled={busy || planActive} onClick={reset} className="trigger-reset-btn">
                {t('game', 'trigger_reset')}
              </Button>
            </div>
          </div>
        }
        testId="trigger-order-prompt"
      >
        <section className="arena-prompt-zone arena-triggers-zone">
          {displayEntries.length > 0 ? (
            <>
              <ArenaFan
                zoneId="triggers"
                cards={visibleCards}
                gapIndex={drag?.started && hover?.zone === 'triggers' ? hover.index : null}
                dealing={dealing}
                startAtEnd
                onCardPointerDown={(e, id) => startDrag(e, id, 'triggers')}
                onCardHover={(id) => setReadId(id)}
                onCardContextMenu={onCardContextMenu}
                renderOverlay={renderOverlay}
                laneRef={noLane}
              />
              <div className="arena-triggers-labels">
                <span className="arena-triggers-label">{t('dialogs', 'arena_trigger_last')}</span>
                <span className="arena-triggers-label">{t('dialogs', 'arena_trigger_first')}</span>
              </div>
            </>
          ) : (
            <p className="trigger-empty"><FormattedText text={prompt.message} /></p>
          )}
        </section>
        {dragLayer(dragged)}
      </ArenaPromptShell>
      {cardPreview.preview}
    </div>
  )
}

function TriggerObjectLabel({
  object,
  players,
  preview,
  previewKey,
}: {
  object: TriggerObject
  players?: Array<{ playerId?: string }>
  preview: PromptCardPreview
  previewKey: string
}) {
  const { t } = useTranslation()
  const zoneKey = object.zone && object.zone !== 'other' ? ZONE_KEYS[object.zone] : null
  const where = zoneKey ? t('game', zoneKey, { player: object.ownerName ?? '?' }) : null
  return (
    <span
      className={`trigger-object${object.isPlayer ? ' is-player' : ''}`}
      data-object-id={object.id}
      style={object.isPlayer ? { ['--seat' as string]: seatColorVar(seatIndexOf(players as never, object.id)) } : undefined}
    >
      <Icon name={object.isPlayer ? 'user' : 'target'} size={11} aria-hidden />
      {object.card ? (
        <span role="button" tabIndex={0} className="trigger-object-name is-previewable" {...preview.bind(previewKey, object.card)}>
          {object.name}
        </span>
      ) : (
        <span className="trigger-object-name">{object.name}</span>
      )}
      {where && <span className="trigger-object-zone"> · {where}</span>}
    </span>
  )
}
