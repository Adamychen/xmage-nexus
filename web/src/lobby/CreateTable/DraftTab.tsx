import Checkbox from '../../ui/Checkbox'
import { useTranslation } from '../../i18n'
import {
  CONSTRUCTION_TIME_OPTIONS,
  DRAFT_TIMING_OPTIONS,
  getConstructionTimeLabel,
  isDraftTournamentType,
} from './constants'
import type { CreateTableForm } from './types'
import Field from '../../ui/Field'

export function ConstructionTimeField({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <Field label={t('lobby', 'create_field_construction_time')}>
      <select value={form.draftConstructionTime} onChange={(e) => form.setDraftConstructionTime(Number(e.target.value))}>
        {CONSTRUCTION_TIME_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{getConstructionTimeLabel(o, t)}</option>
        ))}
      </select>
    </Field>
  )
}

/** The pick time of a booster draft: nothing for the other limited types. */
export function DraftTimingField({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  if (!isDraftTournamentType(form.tournamentType)) return null
  return (
    <Field label={t('lobby', 'create_field_draft_timing')}>
      <select value={form.draftTiming} onChange={(e) => form.setDraftTiming(e.target.value as 'BEGINNER' | 'REGULAR' | 'PROFESSIONAL')}>
        {DRAFT_TIMING_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.value === 'BEGINNER' ? t('lobby', 'create_draft_timing_beginner') : o.value === 'REGULAR' ? t('lobby', 'create_draft_timing_regular') : t('lobby', 'create_draft_timing_professional')}</option>
        ))}
      </select>
    </Field>
  )
}

export function SingleGameField({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <Checkbox
      card
      checked={form.singleGame}
      onChange={form.setSingleGame}
      label={t('lobby', 'trn_e_single_game')}
      description={t('lobby', 'trn_e_single_game_desc')}
    />
  )
}
