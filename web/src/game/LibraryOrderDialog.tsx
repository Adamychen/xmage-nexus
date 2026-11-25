import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { useTranslation, dynamicT } from '../i18n'
import * as cmds from '../net/commands'
import type { CardView } from '../net/types'
import type { FeedbackCard, FeedbackOption, FeedbackPrompt } from './feedback'
import CardSlot from '../board/CardSlot'
import Button from '../ui/Button'
import FormattedText from './FormattedText'
import { localizeServerMessage } from './serverMessageTranslation'
import ArenaFan from './arena/ArenaFan'
import ArenaPromptShell from './arena/ArenaPromptShell'
import { useFanDrag } from './arena/useFanDrag'
import { setState } from '../state/state'
import './LibraryOrderDialog.css'

interface LibraryOrderDialogProps {
  prompt: FeedbackPrompt
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
  cancel: () => void
  busy: boolean
}

type Zone = 'top' | 'bottom'

const TWO_ZONES: Zone[] = ['bottom', 'top']
const ONE_ZONE: Zone[] = ['top']

interface OrderableCard {
  id: string
  option: FeedbackOption
  card: FeedbackCard
}

function noLane() {}

function nameOnlyCard(id: string, name: string): CardView {
  return { id, name, manaValue: 0, expansionSetCode: '', cardNumber: '0' } as unknown as CardView
}

export default function LibraryOrderDialog({ prompt, send, cancel, busy }: LibraryOrderDialogProps) {
  const { t, lang } = useTranslation()

  const initialCards = useMemo((): OrderableCard[] => {
    const feedbackCards = prompt.cards ?? []
    const options = prompt.options ?? []

    return options.map((opt) => {
      const matchedCard = feedbackCards.find((c) => c.id === opt.id)
      return {
        id: opt.id,
        option: opt,
        card: matchedCard ?? {
          id: opt.id,
          name: opt.label,
          manaValue: 0,
          expansionSetCode: '',
          cardNumber: '0',
        },
      }
    })
  }, [prompt.options, prompt.cards])

  const byId = useMemo(
    () => new Map(initialCards.map((item) => [item.id, item])),
    [initialCards],
  )

  const [zones, setZones] = useState<Record<Zone, string[]>>(() => ({
    top: initialCards.map((c) => c.id),
    bottom: [],
  }))

  useEffect(() => {
    setZones({ top: initialCards.map((c) => c.id), bottom: [] })
  }, [initialCards])

  const isSurveil = prompt.message.toLowerCase().includes('surveil') || prompt.title.toLowerCase().includes('surveil')
  const isBlockerOrder =
    prompt.message.toLowerCase().includes('blocker') ||
    prompt.message.toLowerCase().includes('bloqueador') ||
    prompt.message.toLowerCase().includes('damage order') ||
    prompt.title.toLowerCase().includes('bloqueador') ||
    prompt.title.toLowerCase().includes('blocker')

  const place = (id: string, zone: Zone, index: number) => {
    setZones((prev) => {
      const next: Record<Zone, string[]> = {
        top: prev.top.filter((c) => c !== id),
        bottom: prev.bottom.filter((c) => c !== id),
      }
      const at = Math.max(0, Math.min(index, next[zone].length))
      next[zone] = [...next[zone].slice(0, at), id, ...next[zone].slice(at)]
      return next
    })
  }

  const { drag, hover, bindRoot, startDrag, dragLayer } = useFanDrag({
    zones: isBlockerOrder ? ONE_ZONE : TWO_ZONES,
    canDrag: !busy,
    onDrop: (id, zone, index) => place(id, zone as Zone, index),
    onClick: (id, from) => {
      if (isBlockerOrder) return
      const to: Zone = from === 'top' ? 'bottom' : 'top'
      place(id, to, Number.MAX_SAFE_INTEGER)
    },
  })

  const allToTop = () => {
    setZones((prev) => ({ top: [...prev.top, ...prev.bottom], bottom: [] }))
  }

  const allToBottom = () => {
    setZones((prev) => ({ top: [], bottom: [...prev.bottom, ...prev.top] }))
  }

  const handleConfirm = () => {
    const finalOrder = [...zones.top, ...zones.bottom]
    void send(
      () => cmds.sendPlayerString(finalOrder.join(' '), prompt.gameId),
      t('errors', 'send_failed'),
    )
  }

  const inspectCard = (e: MouseEvent, id: string) => {
    e.preventDefault()
    const item = byId.get(id)
    if (item) setState({ inspectedCard: item.card as unknown as CardView })
  }

  const dialogTitle = isBlockerOrder
    ? t('dialogs', 'library_title_blocker')
    : isSurveil
      ? t('dialogs', 'library_title_surveil')
      : prompt.title || t('dialogs', 'library_title_scry')

  const source = useMemo(
    () => (prompt.sourceName ? nameOnlyCard('library-order-source', prompt.sourceName) : null),
    [prompt.sourceName],
  )

  const visibleCards = (zone: Zone): CardView[] =>
    zones[zone]
      .filter((id) => !(drag?.started && drag.id === id))
      .map((id) => byId.get(id)?.card as unknown as CardView | undefined)
      .filter((card): card is CardView => card != null)

  const renderOverlay = (card: CardView) => {
    const item = card.id ? byId.get(card.id) : undefined
    const label = item?.card.displayName || item?.card.name || item?.option.label || card.name
    return <span className="library-order-sr-name">{label}</span>
  }

  const dragged = drag?.started ? (byId.get(drag.id)?.card as unknown as CardView | undefined) ?? null : null

  const confirmLabel = isBlockerOrder
    ? t('dialogs', 'library_confirm_blockers', { count: zones.top.length })
    : t('dialogs', 'library_confirm_order', {
        top: zones.top.length,
        bottom: zones.bottom.length,
        zone: isSurveil ? t('game', 'pile_graveyard').toLowerCase() : (lang === 'es' ? 'fondo' : 'bottom'),
      })

  return (
    <div {...bindRoot} className={`arena-library-order${isBlockerOrder ? ' is-single' : ''}`}>
      <ArenaPromptShell
        title={dialogTitle}
        instruction={<FormattedText text={localizeServerMessage(prompt.message, dynamicT(t))} />}
        dialogClassName="library-order-dialog"
        aside={source && <CardSlot card={source} cardId="library-order-source" />}
        footer={
          <div className="library-order-footer">
            {!isBlockerOrder && (
              <div className="library-order-quick">
                <Button variant="subtle" type="button" disabled={busy || zones.bottom.length === 0} onClick={allToTop}>
                  {t('dialogs', 'library_all_to_top')}
                </Button>
                <Button variant="subtle" type="button" disabled={busy || zones.top.length === 0} onClick={allToBottom}>
                  {isSurveil ? t('dialogs', 'library_all_to_graveyard') : t('dialogs', 'library_all_to_bottom')}
                </Button>
              </div>
            )}
            <div className="library-order-actions">
              <Button className="library-order-confirm" type="button" disabled={busy} onClick={handleConfirm}>
                {confirmLabel}
              </Button>
              <Button variant="subtle" type="button" disabled={busy} onClick={cancel} className="library-order-cancel">
                {t('common', 'cancel')}
              </Button>
            </div>
          </div>
        }
        testId="library-order-prompt"
      >
        {isBlockerOrder ? (
          <section className="arena-prompt-zone library-order-single-zone">
            <ArenaFan
              zoneId="top"
              cards={visibleCards('top')}
              gapIndex={drag?.started && hover?.zone === 'top' ? hover.index : null}
              dealing={false}
              onCardPointerDown={(e, id) => startDrag(e, id, 'top')}
              onCardContextMenu={inspectCard}
              renderOverlay={renderOverlay}
              laneRef={noLane}
            />
            <div className="library-order-axis">
              <span className="library-order-axis-label">{t('dialogs', 'arena_trigger_first')}</span>
              <span className="library-order-axis-label">{t('dialogs', 'arena_trigger_last')}</span>
            </div>
          </section>
        ) : (
          <>
            <section className="arena-prompt-zone library-order-zone">
              <h3 className="arena-prompt-zone-label">
                {isSurveil
                  ? t('dialogs', 'library_graveyard_zone', { count: zones.bottom.length })
                  : t('dialogs', 'library_bottom_zone', { count: zones.bottom.length })}
              </h3>
              <ArenaFan
                zoneId="bottom"
                cards={visibleCards('bottom')}
                gapIndex={drag?.started && hover?.zone === 'bottom' ? hover.index : null}
                dealing={false}
                onCardPointerDown={(e, id) => startDrag(e, id, 'bottom')}
                onCardContextMenu={inspectCard}
                renderOverlay={renderOverlay}
                laneRef={noLane}
              />
            </section>
            <section className="arena-prompt-zone library-order-zone">
              <h3 className="arena-prompt-zone-label">
                {t('dialogs', 'library_top_zone', { count: zones.top.length })}
              </h3>
              <ArenaFan
                zoneId="top"
                cards={visibleCards('top')}
                gapIndex={drag?.started && hover?.zone === 'top' ? hover.index : null}
                dealing={false}
                onCardPointerDown={(e, id) => startDrag(e, id, 'top')}
                onCardContextMenu={inspectCard}
                renderOverlay={renderOverlay}
                laneRef={noLane}
              />
            </section>
          </>
        )}
        {dragLayer(dragged)}
      </ArenaPromptShell>
    </div>
  )
}
