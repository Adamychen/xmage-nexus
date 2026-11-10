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
import Select from '../../ui/Select'

export function ConstructionTimeField({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <Field label={t('lobby', 'create_field_construction_time')}>
      <Select
        value={form.draftConstructionTime}
        onChange={form.setDraftConstructionTime}
        options={CONSTRUCTION_TIME_OPTIONS.map((o) => ({ value: o.value, label: getConstructionTimeLabel(o, t) }))}
      />
    </Field>
  )
}

/** The pick time of a booster draft: nothing for the other limited types. */
export function DraftTimingField({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  if (!isDraftTournamentType(form.tournamentType)) return null
  return (
    <Field label={t('lobby', 'create_field_draft_timing')}>
      <Select
        value={form.draftTiming}
        onChange={form.setDraftTiming}
        options={DRAFT_TIMING_OPTIONS.map((o) => ({
          value: o.value,
          label: o.value === 'BEGINNER' ? t('lobby', 'create_draft_timing_beginner') : o.value === 'REGULAR' ? t('lobby', 'create_draft_timing_regular') : t('lobby', 'create_draft_timing_professional'),
        }))}
      />
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
