import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import CardSlot from '../board/CardSlot'
import Button from '../ui/Button'
import type { CardView } from '../net/types'
import { useTranslation } from '../i18n'
import type { FeedbackPrompt } from './feedback'
import type { LibraryPlanMode } from './feedback/libraryPlan'
import ArenaFan from './arena/ArenaFan'
import ArenaPromptShell from './arena/ArenaPromptShell'
import { useFanDrag } from './arena/useFanDrag'
import { startLibraryPlan } from '../state/libraryPlanRunner'
import { setState } from '../state/state'
import './ArenaLibraryPrompt.css'

type Zone = 'top' | 'away'

interface ArenaLibraryPromptProps {
  prompt: FeedbackPrompt
  sending: boolean
}

const ZONES: Zone[] = ['away', 'top']
const ORDER_ZONES: Zone[] = ['top']
const DEAL_MS = 900

function nameOnlyCard(id: string, name: string): CardView {
  return { id, name, manaValue: 0, expansionSetCode: '', cardNumber: '0' } as unknown as CardView
}

function noLane() {}

function promptMode(prompt: FeedbackPrompt): LibraryPlanMode {
  switch (prompt.libraryStep) {
    case 'scry-pick':
      return 'scry'
    case 'top-order':
    case 'bottom-order':
    case 'grave-order':
      return prompt.libraryStep
    default:
      return 'surveil'
  }
}

const TITLE_KEY = {
  surveil: 'arena_surveil_title',
  scry: 'arena_scry_title',
  'top-order': 'arena_order_top_title',
  'bottom-order': 'arena_order_bottom_title',
  'grave-order': 'arena_order_grave_title',
} as const satisfies Record<LibraryPlanMode, string>

const HINT_KEY = {
  surveil: 'arena_surveil_hint',
  scry: 'arena_scry_hint',
  'top-order': 'arena_order_top_hint',
  'bottom-order': 'arena_order_bottom_hint',
  'grave-order': 'arena_order_grave_hint',
} as const satisfies Record<LibraryPlanMode, string>

export default function ArenaLibraryPrompt({ prompt, sending }: ArenaLibraryPromptProps) {
  const { t } = useTranslation()
  const mode = promptMode(prompt)
  const isOrderOnly = mode === 'top-order' || mode === 'bottom-order' || mode === 'grave-order'
  const cards = useMemo(() => (prompt.cards ?? []) as unknown as CardView[], [prompt.cards])
  const byId = useMemo(() => new Map(cards.map((card) => [card.id as string, card])), [cards])
  const [zones, setZones] = useState<Record<Zone, string[]>>(() => {
    const ids = cards.map((card) => card.id as string)
    if (isOrderOnly) return { top: ids, away: [] }
    const chosen = new Set(prompt.chosenTargets ?? [])
    return { top: ids.filter((id) => !chosen.has(id)), away: ids.filter((id) => chosen.has(id)) }
  })
  const [dealing, setDealing] = useState(true)
  const back = useMemo(() => nameOnlyCard('arena-library-back', ''), [])
  const source = useMemo(() => (prompt.sourceName ? nameOnlyCard('arena-library-source', prompt.sourceName) : null), [prompt.sourceName])

  useEffect(() => {
    const timer = setTimeout(() => setDealing(false), DEAL_MS)
    return () => clearTimeout(timer)
  }, [])

  const place = (id: string, zone: Zone, index: number) => {
    setZones((prev) => {
      const next: Record<Zone, string[]> = { top: prev.top.filter((c) => c !== id), away: prev.away.filter((c) => c !== id) }
      const at = Math.max(0, Math.min(index, next[zone].length))
      next[zone] = [...next[zone].slice(0, at), id, ...next[zone].slice(at)]
      return next
    })
  }

  const { drag, hover, bindRoot, startDrag, dragLayer } = useFanDrag({
    zones: isOrderOnly ? ORDER_ZONES : ZONES,
    canDrag: !sending,
    onDrop: (id, zone, index) => place(id, zone as Zone, index),
    onClick: (id, from) => {
      if (isOrderOnly) return
      const to: Zone = from === 'top' ? 'away' : 'top'
      place(id, to, Number.MAX_SAFE_INTEGER)
    },
  })

  const inspectCard = (e: MouseEvent, id: string) => {
    e.preventDefault()
    const card = byId.get(id)
    if (card) setState({ inspectedCard: card })
  }

  const submit = () => {
    if (sending) return
    switch (mode) {
      case 'scry':
        startLibraryPlan(prompt, { mode: 'scry', top: [...zones.top].reverse(), away: [...zones.away].reverse() })
        break
      case 'surveil':
        startLibraryPlan(prompt, { mode: 'surveil', top: [...zones.top], away: [...zones.away] })
        break
      case 'top-order':
        startLibraryPlan(prompt, { mode: 'top-order', top: [...zones.top].reverse(), away: [] })
        break
      case 'bottom-order':
        startLibraryPlan(prompt, { mode: 'bottom-order', top: [], away: [...zones.top].reverse() })
        break
      case 'grave-order':
        startLibraryPlan(prompt, { mode: 'grave-order', top: [], away: [...zones.top] })
        break
    }
  }

  const labels: Record<Zone, string> = mode === 'surveil'
    ? { top: t('dialogs', 'arena_zone_library'), away: t('dialogs', 'arena_zone_graveyard') }
    : { top: t('dialogs', 'arena_zone_top'), away: t('dialogs', 'arena_zone_bottom') }

  const visible = (zone: Zone) =>
    zones[zone]
      .filter((id) => !(drag?.started && drag.id === id))
      .map((id) => byId.get(id))
      .filter((card): card is CardView => card != null)

  const renderZone = (zone: Zone) => (
    <section className="arena-prompt-zone arena-library-zone">
      <h3 className="arena-prompt-zone-label">{labels[zone]}</h3>
      <ArenaFan
        zoneId={zone}
        cards={visible(zone)}
        leadingBack={zone === 'top' ? back : undefined}
        gapIndex={drag?.started && hover?.zone === zone ? hover.index : null}
        dealing={dealing}
        onCardPointerDown={(e, id) => startDrag(e, id, zone)}
        onCardContextMenu={inspectCard}
        laneRef={noLane}
      />
    </section>
  )

  const renderScry = () => (
    <section className="arena-prompt-zone arena-library-zone arena-library-scry-zone">
      <ArenaFan
        zoneId="top"
        splitZoneId="away"
        underCards={visible('away')}
        cards={visible('top')}
        leadingBack={back}
        underGapIndex={drag?.started && hover?.zone === 'away' ? hover.index : null}
        gapIndex={drag?.started && hover?.zone === 'top' ? hover.index : null}
        dealing={dealing}
        onCardPointerDown={(e, id) => startDrag(e, id, 'top')}
        onUnderCardPointerDown={(e, id) => startDrag(e, id, 'away')}
        onCardContextMenu={inspectCard}
        laneRef={noLane}
      />
      <div className="arena-scry-labels">
        <span className="arena-scry-label">{labels.away}</span>
        <span className="arena-scry-label">{labels.top}</span>
      </div>
    </section>
  )

  const renderOrderOnly = () => (
    <section className="arena-prompt-zone arena-library-zone arena-library-order-zone">
      <ArenaFan
        zoneId="top"
        cards={visible('top')}
        gapIndex={drag?.started && hover?.zone === 'top' ? hover.index : null}
        dealing={dealing}
        onCardPointerDown={(e, id) => startDrag(e, id, 'top')}
        onCardContextMenu={inspectCard}
        laneRef={noLane}
      />
      <div className="arena-scry-labels">
        <span className="arena-scry-label">{t('dialogs', 'arena_zone_bottom')}</span>
        <span className="arena-scry-label">{t('dialogs', 'arena_zone_top')}</span>
      </div>
    </section>
  )

  const dragged = drag?.started ? byId.get(drag.id) ?? null : null
  const rootClass = `arena-library${mode === 'scry' ? ' is-scry' : ''}${isOrderOnly ? ' is-order' : ''}${sending ? ' is-sending' : ''}`

  return (
    <div {...bindRoot} className={rootClass}>
      <ArenaPromptShell
        title={t('dialogs', TITLE_KEY[mode])}
        instruction={t('dialogs', HINT_KEY[mode])}
        aside={source && <CardSlot card={source} cardId="arena-library-source" />}
        footer={
          <Button className="arena-library-done" data-testid="arena-library-done" onClick={submit} disabled={sending}>
            {t('dialogs', sending ? 'arena_sending' : 'arena_done')}
          </Button>
        }
        testId="arena-library-prompt"
      >
        {isOrderOnly ? (
          renderOrderOnly()
        ) : mode === 'scry' ? (
          renderScry()
        ) : (
          <>
            {renderZone('away')}
            {renderZone('top')}
          </>
        )}
        {dragLayer(dragged)}
      </ArenaPromptShell>
    </div>
  )
}
