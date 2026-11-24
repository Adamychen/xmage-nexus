import { useEffect, useMemo, useState } from 'react'
import CardSlot from '../board/CardSlot'
import Button from '../ui/Button'
import type { CardView } from '../net/types'
import { useTranslation } from '../i18n'
import type { FeedbackPrompt } from './feedback'
import ArenaFan from './arena/ArenaFan'
import ArenaPromptShell from './arena/ArenaPromptShell'
import { useFanDrag } from './arena/useFanDrag'
import { startLibraryPlan } from '../state/libraryPlanRunner'
import './ArenaLibraryPrompt.css'

type Zone = 'top' | 'away'

interface ArenaLibraryPromptProps {
  prompt: FeedbackPrompt
  sending: boolean
}

const ZONES: Zone[] = ['away', 'top']
const DEAL_MS = 900

function nameOnlyCard(id: string, name: string): CardView {
  return { id, name, manaValue: 0, expansionSetCode: '', cardNumber: '0' } as unknown as CardView
}

function noLane() {}

export default function ArenaLibraryPrompt({ prompt, sending }: ArenaLibraryPromptProps) {
  const { t } = useTranslation()
  const mode = prompt.libraryStep === 'scry-pick' ? 'scry' : 'surveil'
  const cards = useMemo(() => (prompt.cards ?? []) as unknown as CardView[], [prompt.cards])
  const byId = useMemo(() => new Map(cards.map((card) => [card.id as string, card])), [cards])
  const [zones, setZones] = useState<Record<Zone, string[]>>(() => ({ top: cards.map((card) => card.id as string), away: [] }))
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
    zones: ZONES,
    canDrag: !sending,
    onDrop: (id, zone, index) => place(id, zone as Zone, index),
    onClick: (id, from) => {
      const to: Zone = from === 'top' ? 'away' : 'top'
      place(id, to, Number.MAX_SAFE_INTEGER)
    },
  })

  const submit = () => {
    if (sending) return
    startLibraryPlan(prompt, { mode, top: [...zones.top], away: [...zones.away] })
  }

  const labels: Record<Zone, string> = mode === 'surveil'
    ? { top: t('dialogs', 'arena_zone_library'), away: t('dialogs', 'arena_zone_graveyard') }
    : { top: t('dialogs', 'arena_zone_top'), away: t('dialogs', 'arena_zone_bottom') }

  const renderZone = (zone: Zone) => {
    const shown = zones[zone]
      .filter((id) => !(drag?.started && drag.id === id))
      .map((id) => byId.get(id))
      .filter((card): card is CardView => card != null)
    return (
      <section className="arena-prompt-zone arena-library-zone">
        <h3 className="arena-prompt-zone-label">{labels[zone]}</h3>
        <ArenaFan
          zoneId={zone}
          cards={shown}
          leadingBack={zone === 'top' ? back : undefined}
          gapIndex={drag?.started && hover?.zone === zone ? hover.index : null}
          dealing={dealing}
          onCardPointerDown={(e, id) => startDrag(e, id, zone)}
          laneRef={noLane}
        />
      </section>
    )
  }

  const dragged = drag?.started ? byId.get(drag.id) ?? null : null

  return (
    <div {...bindRoot} className={`arena-library${sending ? ' is-sending' : ''}`}>
      <ArenaPromptShell
        title={t('dialogs', mode === 'surveil' ? 'arena_surveil_title' : 'arena_scry_title')}
        instruction={t('dialogs', mode === 'surveil' ? 'arena_surveil_hint' : 'arena_scry_hint')}
        aside={source && <CardSlot card={source} cardId="arena-library-source" />}
        footer={
          <Button className="arena-library-done" data-testid="arena-library-done" onClick={submit} disabled={sending}>
            {t('dialogs', sending ? 'arena_sending' : 'arena_done')}
          </Button>
        }
        testId="arena-library-prompt"
      >
        {renderZone('away')}
        {renderZone('top')}
        {dragLayer(dragged)}
      </ArenaPromptShell>
    </div>
  )
}
