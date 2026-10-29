import { useId, useState } from 'react'
import { plural, useTranslation } from '../../i18n'
import type { CategoryT } from '../../i18n/types'
import Button from '../../ui/Button'
import Icon from '../../ui/Icon'
import {
  BUFFER_TIME_OPTIONS,
  CONSTRUCTION_TIME_OPTIONS,
  getBufferTimeLabel,
  getConstructionTimeLabel,
  isHumanSeatType,
  parseLimitedSetCodes,
  type DraftTiming,
} from './constants'
import {
  MODALITY_KEY,
  PACK_KEY,
  PAIRING_KEY,
  choiceOf,
  clockLabel,
  eliminationRoundLabels,
  isCubeBased,
  summariseSetCodes,
} from './tourneyFormat'
import { eliminationRoundCount, type TournamentChoice } from '../tournament/tournamentType'
import type { CreateTableForm } from './types'

type LobbyT = CategoryT<'lobby'>

const TIMING_KEY = {
  BEGINNER: 'trn_e_timing_beginner',
  REGULAR: 'trn_e_timing_regular',
  PROFESSIONAL: 'trn_e_timing_professional',
} as const satisfies Record<DraftTiming, 'trn_e_timing_beginner' | 'trn_e_timing_regular' | 'trn_e_timing_professional'>

export interface TourneySummaryFact {
  label: string
  value: string
}

export interface TourneySummaryModel {
  name: string
  format: string
  phases: string[]
  facts: TourneySummaryFact[]
  oneLine: string
  status: string
  ready: boolean
}

function poolOf(form: CreateTableForm, choice: TournamentChoice, t: LobbyT): string {
  if (isCubeBased(choice)) return form.draftCubeName.trim() || t('lobby', 'trn_e_pool_random_cube')
  if (choice.variant === 'random') return t('lobby', 'trn_e_pool_random_packs')
  const sets = summariseSetCodes(parseLimitedSetCodes(form.draftSetsRaw))
  return t('lobby', 'trn_e_pool_boosters', { count: form.draftBoosters, sets: sets || '—' })
}

function constructionLabelOf(seconds: number, t: LobbyT): string {
  const option = CONSTRUCTION_TIME_OPTIONS.find((o) => o.value === seconds)
  return getConstructionTimeLabel(option ?? { value: seconds, label: String(Math.round(seconds / 60)) }, t)
}

/** The "Your tournament" summary as text: what the tournament is, how it runs, its key facts and whether it can be created. */
export function tourneySummaryOf(form: CreateTableForm, t: LobbyT, yesNo: (on: boolean) => string, blocker: string | null): TourneySummaryModel {
  const choice = choiceOf(form.tournamentType)
  const limited = choice.modality !== 'constructed'
  const swiss = choice.pairing === 'swiss'
  const seats = form.numPlayers
  const bo = form.singleGame ? t('lobby', 'trn_e_bo_single') : `Bo${form.wins * 2 - 1}`
  const rounds = swiss ? form.numberRounds : eliminationRoundCount(seats)

  const phases: string[] = []
  if (!limited) {
    phases.push(t('lobby', 'trn_e_phase_registration', { format: form.deckType }))
  } else if (choice.modality === 'draft') {
    phases.push(t('lobby', 'trn_e_phase_draft', { pool: poolOf(form, choice, t), timing: t('lobby', TIMING_KEY[form.draftTiming]) }))
  } else if (choice.modality === 'sealed') {
    phases.push(t('lobby', 'trn_e_phase_sealed', { pool: poolOf(form, choice, t) }))
  } else {
    phases.push(t('lobby', 'trn_e_phase_jumpstart'))
  }
  if (limited) phases.push(t('lobby', 'trn_e_phase_construction', { time: constructionLabelOf(form.draftConstructionTime, t) }))
  phases.push(swiss
    ? t('lobby', 'trn_e_phase_rounds_swiss', { count: form.numberRounds, bo })
    : `${eliminationRoundLabels(seats, t)} · ${bo}`)
  phases.push(swiss ? t('lobby', 'trn_e_phase_final_points') : t('lobby', 'trn_e_phase_final_champion'))

  const format = [
    t('lobby', MODALITY_KEY[choice.modality]),
    t('lobby', PAIRING_KEY[choice.pairing]),
    limited ? (choice.variant === 'standard' ? null : t('lobby', PACK_KEY[choice.variant])) : form.deckType,
  ].filter((part): part is string => Boolean(part)).join(' · ')

  const bots = form.seatConfigs.filter((s) => !isHumanSeatType(s.type)).length
  const open = form.seatConfigs.length - bots
  const seatParts = [
    form.humanSeat ? t('lobby', 'trn_e_you') : null,
    open > 0 ? t('lobby', 'trn_d_counter_open', { count: open }) : null,
    bots > 0 ? plural('lobby', 'trn_d_counter_bots', bots, { count: bots }) : null,
  ].filter((part): part is string => Boolean(part))
  const bufferOption = BUFFER_TIME_OPTIONS.find((o) => o.value === form.bufferTime)
  const clock = [
    clockLabel(form.timeLimit, t),
    form.bufferTime !== 'NONE' && bufferOption ? getBufferTimeLabel(bufferOption, t) : null,
  ].filter((part): part is string => Boolean(part)).join(' · ')

  const facts: TourneySummaryFact[] = [
    { label: t('lobby', 'trn_e_fact_seats'), value: [`${seats}`, seatParts.join(' + ')].filter(Boolean).join(' · ') },
    {
      label: t('lobby', 'trn_e_fact_rounds'),
      value: swiss ? t('lobby', 'trn_e_rounds_swiss', { count: rounds }) : t('lobby', 'trn_e_rounds_elim', { count: rounds }),
    },
    { label: t('lobby', 'trn_e_fact_clock'), value: clock },
    {
      label: t('lobby', 'trn_e_fact_access'),
      value: [
        form.password.trim() ? t('lobby', 'trn_e_access_password') : t('lobby', 'trn_e_access_open'),
        form.spectatorsAllowed ? t('lobby', 'trn_e_spectators_yes') : t('lobby', 'trn_e_spectators_no'),
      ].join(' · '),
    },
    { label: t('lobby', 'trn_e_fact_rated'), value: yesNo(form.rated) },
  ]

  return {
    name: form.name.trim() || t('lobby', 'trn_e_untitled'),
    format,
    phases,
    facts,
    oneLine: [
      t('lobby', MODALITY_KEY[choice.modality]),
      t('lobby', PAIRING_KEY[choice.pairing]),
      t('lobby', 'trn_e_rounds_short', { count: rounds }),
      bo,
      t('lobby', 'staging_seats_count', { count: seats }),
    ].join(' · '),
    status: blocker ? t('lobby', 'trn_e_blocked', { reason: blocker }) : t('lobby', 'trn_e_ready'),
    ready: !blocker,
  }
}

function firstBlocker(form: CreateTableForm): string | null {
  for (const step of form.wizardSteps) {
    const message = form.validateStep(step.id)
    if (message) return message
  }
  return null
}

/** The tournament summary beside the steps (on a phone, a bar above the footer that expands). */
export default function TourneySummary({ form }: { form: CreateTableForm }) {
  const { t, tError } = useTranslation()
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const titleId = useId()
  const blocker = firstBlocker(form)
  const yesNo = (on: boolean) => (on ? t('common', 'yes') : t('common', 'no'))
  const model = tourneySummaryOf(form, t, yesNo, blocker ? tError(blocker) : null)

  return (
    <aside className={`trn-summary${open ? ' is-open' : ''}`} aria-labelledby={titleId} data-testid="trn-summary">
      <Button
        type="button"
        variant="ghost"
        className="trn-summary-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="trn-summary-line">{model.oneLine}</span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={13} />
      </Button>
      <div id={bodyId} className="trn-summary-body">
        <h3 id={titleId} className="trn-summary-title">{t('lobby', 'trn_e_summary_title')}</h3>
        <p className="trn-summary-name">{model.name}</p>
        <p className="trn-summary-format">{model.format}</p>
        <h4 className="trn-summary-sub">{t('lobby', 'trn_e_how_it_runs')}</h4>
        <ol className="trn-summary-phases">
          {model.phases.map((phase, index) => (
            <li key={index}>{phase}</li>
          ))}
        </ol>
        <dl className="trn-summary-facts">
          {model.facts.map((fact) => (
            <div key={fact.label} className="trn-summary-fact">
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
        <p className={`trn-summary-status ${model.ready ? 'is-ready' : 'is-blocked'}`}>
          <Icon name={model.ready ? 'check' : 'alert'} size={13} /> {model.status}
        </p>
      </div>
    </aside>
  )
}
