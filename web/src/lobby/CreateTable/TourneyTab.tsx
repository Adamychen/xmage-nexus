import Tabs from '../../ui/Tabs'
import { useTranslation } from '../../i18n'
import {
  DEFAULT_TOURNAMENT_TYPES,
  CONSTRUCTED_TOURNAMENT_TYPES,
  isConstructedTournamentType,
  tournamentTypeNameOf,
} from './constants'
import type { CreateTableForm } from './useCreateTableForm'
import Field from '../../ui/Field'
import ChipButton from '../../ui/ChipButton'

/** The tournament's format: category, draft type, rounds and players. Draft
 *  settings (boosters, sets, timers) live in `DraftTab`. */
export default function TourneyTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()

  const tournamentTypeName = typeof form.tournamentType === 'string'
    ? form.tournamentType
    : (form.tournamentType as { name?: string })?.name ?? ''

  const draftTypePool = form.tournamentTypes?.length ? form.tournamentTypes : DEFAULT_TOURNAMENT_TYPES
  const draftTypeOptions = form.tournamentCategory === 'constructed' && !form.useDraftTournament
    ? CONSTRUCTED_TOURNAMENT_TYPES
    : (() => {
        const filtered = draftTypePool.filter((tt) => !isConstructedTournamentType(tournamentTypeNameOf(tt)))
        return filtered.length > 0 ? filtered : draftTypePool
      })()

  return (
    <div className="tourney-section">
      <Tabs
        variant="segmented"
        size="sm"
        className="tourney-tabs"
        value={form.tournamentCategory}
        onChange={form.setTournamentCategory}
        items={[
          { id: 'limited', icon: 'layers', label: t('lobby', 'create_tourney_limited') },
          { id: 'constructed', icon: 'trophy', label: t('lobby', 'create_tourney_constructed') },
        ]}
      />

      <div className="create-grid-2col">
        <Field label={t('lobby','create_field_draft_type')}>
          <select value={tournamentTypeName} onChange={(e) => form.setTournamentType(e.target.value)}>
            {draftTypeOptions.map((tt) => {
              const name = typeof tt === 'string' ? tt : (tt as { name?: string })?.name ?? ''
              if (!name) return null
              return <option key={name} value={name}>{name}</option>
            })}
          </select>
        </Field>
        {tournamentTypeName.includes('Swiss') && (
          <Field label={t('lobby','create_field_number_rounds')}>
            <input
              type="number"
              min={0}
              max={10}
              value={form.numberRounds}
              onChange={(e) => form.setNumberRounds(Math.min(10, Math.max(0, parseInt(e.target.value, 10) || 0)))}
            />
          </Field>
        )}
      </div>

      <Field group label={t('lobby', 'create_tourney_players')}>
        <div className="chip-row">
          {[2, 4, 8, 16, 32].map((n) => (
            <ChipButton
              pill
              active={form.numPlayers === n}
              key={n}
              onClick={() => form.setNumPlayers(n)}
            >
              {t('lobby','staging_seats_count',{count:n})}
            </ChipButton>
          ))}
        </div>
      </Field>
    </div>
  )
}
