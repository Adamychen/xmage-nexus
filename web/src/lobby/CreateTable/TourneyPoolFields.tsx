import { useState } from 'react'
import Button from '../../ui/Button'
import Field from '../../ui/Field'
import { useTranslation } from '../../i18n'
import { composeTournamentType, type TournamentChoice } from '../tournament/tournamentType'
import { DEFAULT_DRAFT_CUBES } from './constants'
import RandomPacksSelector, { isRandomPacksType } from './RandomPacksSelector'
import TourneySetSlots from './TourneySetSlots'
import { isCubeBased, isSetBased } from './tourneyFormat'
import type { CreateTableForm } from './types'

/** What a limited pack pool needs beyond its modality: the set slots, a cube, or the random pool dialog. */
export default function TourneyPoolFields({ form, choice }: { form: CreateTableForm; choice: TournamentChoice }) {
  const { t } = useTranslation()
  const [showPacks, setShowPacks] = useState(false)
  const name = composeTournamentType(choice)
  const randomPool = isRandomPacksType(name)

  return (
    <>
      {isSetBased(choice) && <TourneySetSlots form={form} />}

      {isCubeBased(choice) && (
        <Field label={t('lobby', 'create_field_cube')}>
          <select value={form.draftCubeName} onChange={(e) => form.setDraftCubeName(e.target.value)}>
            <option value="">{t('lobby', 'create_cube_random', { all: t('common', 'all') })}</option>
            {(form.draftCubes.length ? form.draftCubes : DEFAULT_DRAFT_CUBES).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
      )}

      {randomPool && (
        <div>
          <Button onClick={() => setShowPacks(true)} data-testid="random-packs-open">
            {t('lobby', 'random_packs_open')}
          </Button>
        </div>
      )}

      {showPacks && (
        <RandomPacksSelector
          tournamentType={name}
          numPlayers={form.numPlayers}
          initialRaw={form.draftSetsRaw}
          onApply={(codes) => {
            form.setDraftSetsRaw(codes.join('; '))
            setShowPacks(false)
          }}
          onClose={() => setShowPacks(false)}
        />
      )}
    </>
  )
}
