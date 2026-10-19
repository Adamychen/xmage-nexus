import { useState } from 'react'
import Button from '../../ui/Button'
import Checkbox from '../../ui/Checkbox'
import { useTranslation } from '../../i18n'
import RandomPacksSelector, { isRandomPacksType } from './RandomPacksSelector'
import DraftSetsSelector from './DraftSetsSelector'
import {
  DEFAULT_DRAFT_CUBES,
  CONSTRUCTION_TIME_OPTIONS,
  getConstructionTimeLabel,
  DRAFT_TIMING_OPTIONS,
} from './constants'
import type { CreateTableForm } from './useCreateTableForm'
import Field from '../../ui/Field'

export default function DraftTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  const [showPacks, setShowPacks] = useState(false)

  const tournamentTypeName = typeof form.tournamentType === 'string'
    ? form.tournamentType
    : (form.tournamentType as { name?: string })?.name ?? ''

  return (
    <div className="create-tab-content">
      <div className="create-grid-2col">
        <Field label={t('lobby', 'create_field_boosters')}>
          <select value={form.draftBoosters} onChange={(e) => form.setDraftBoosters(Number(e.target.value) as 3 | 6)}>
            <option value={3}>{t('lobby', 'create_option_boosters_3')}</option>
            <option value={6}>{t('lobby', 'create_option_boosters_6')}</option>
          </select>
        </Field>
        <Field label={t('lobby', 'create_field_construction_time')}>
          <select value={form.draftConstructionTime} onChange={(e) => form.setDraftConstructionTime(Number(e.target.value))}>
            {CONSTRUCTION_TIME_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{getConstructionTimeLabel(o, t)}</option>
            ))}
          </select>
        </Field>
      </div>

      {tournamentTypeName.includes('Cube') && (
        <Field label={t('lobby', 'create_field_cube')}>
          <select value={form.draftCubeName} onChange={(e) => form.setDraftCubeName(e.target.value)}>
            <option value="">{t('lobby', 'create_cube_random', { all: t('common', 'all') })}</option>
            {(form.draftCubes.length ? form.draftCubes : DEFAULT_DRAFT_CUBES).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      )}

      <DraftSetsSelector
        draftSetsRaw={form.draftSetsRaw}
        onChange={form.setDraftSetsRaw}
        numBoosters={form.draftBoosters}
      />

      {isRandomPacksType(tournamentTypeName) && (
        <div>
          <Button onClick={() => setShowPacks(true)} data-testid="random-packs-open">
            {t('lobby', 'random_packs_open')}
          </Button>
        </div>
      )}

      {showPacks && (
        <RandomPacksSelector
          tournamentType={tournamentTypeName}
          numPlayers={form.numPlayers}
          initialRaw={form.draftSetsRaw}
          onApply={(codes) => {
            form.setDraftSetsRaw(codes.join('; '))
            setShowPacks(false)
          }}
          onClose={() => setShowPacks(false)}
        />
      )}

      {tournamentTypeName.includes('Draft') && (
        <Field label={t('lobby', 'create_field_draft_timing')}>
          <select value={form.draftTiming} onChange={(e) => form.setDraftTiming(e.target.value as 'BEGINNER' | 'REGULAR' | 'PROFESSIONAL')}>
            {DRAFT_TIMING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.value === 'BEGINNER' ? t('lobby', 'create_draft_timing_beginner') : o.value === 'REGULAR' ? t('lobby', 'create_draft_timing_regular') : t('lobby', 'create_draft_timing_professional')}</option>
            ))}
          </select>
        </Field>
      )}

      <Checkbox
        card
        checked={form.singleGame}
        onChange={form.setSingleGame}
        label={t('lobby', 'create_field_single_game')}
        description={t('lobby', 'create_desc_single_game')}
      />
    </div>
  )
}
