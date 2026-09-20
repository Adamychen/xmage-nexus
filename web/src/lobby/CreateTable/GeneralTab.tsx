import { useState } from 'react'
import Tabs from '../../ui/Tabs'
import Button from '../../ui/Button'
import ChipButton from '../../ui/ChipButton'
import Checkbox from '../../ui/Checkbox'
import { useTranslation } from '../../i18n'
import Icon from '../../ui/Icon'
import RandomPacksSelector, { isRandomPacksType } from './RandomPacksSelector'
import DraftSetsSelector from './DraftSetsSelector'
import {
  SKILL_LEVEL_OPTIONS,
  DEFAULT_TOURNAMENT_TYPES,
  DEFAULT_DRAFT_CUBES,
  CONSTRUCTION_TIME_OPTIONS,
  getConstructionTimeLabel,
  DRAFT_TIMING_OPTIONS,
  CONSTRUCTED_TOURNAMENT_TYPES,
  isConstructedTournamentType,
  tournamentTypeNameOf,
} from './constants'
import type { CreateTableForm } from './useCreateTableForm'

export default function GeneralTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  const [showPacks, setShowPacks] = useState(false)

  const isTourney = form.tableCategory === 'tourney'
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
    <div className="create-tab-content">
      <div className="wizard-step-heading">
        <h3><Icon name="settings" size={15} /> {t('lobby','create_tab_general')}</h3>
        <p>{t('lobby','create_step_desc_general')}</p>
      </div>

      <div className="create-mode-selector">
        <button
          type="button"
          className={`create-mode-card ${form.tableCategory === 'duel' ? 'active' : ''}`}
          onClick={() => form.applyMode('duel')}
        >
          <div className="create-mode-card-icon"><Icon name="swords" size={18} /></div>
          <div className="create-mode-card-content">
            <div className="create-mode-card-title">{t('lobby', 'create_mode_duel')}</div>
            <div className="create-mode-card-desc">{t('lobby', 'create_mode_duel_desc')}</div>
          </div>
        </button>

        <button
          type="button"
          className={`create-mode-card ${form.tableCategory === 'multi' ? 'active' : ''}`}
          onClick={() => form.applyMode('multi')}
        >
          <div className="create-mode-card-icon"><Icon name="users" size={18} /></div>
          <div className="create-mode-card-content">
            <div className="create-mode-card-title">{t('lobby', 'create_mode_multi')}</div>
            <div className="create-mode-card-desc">{t('lobby', 'create_mode_multi_desc')}</div>
          </div>
        </button>

        <button
          type="button"
          className={`create-mode-card ${form.tableCategory === 'tourney' ? 'active' : ''}`}
          onClick={() => form.applyMode('tourney')}
        >
          <div className="create-mode-card-icon"><Icon name="trophy" size={18} /></div>
          <div className="create-mode-card-content">
            <div className="create-mode-card-title">{t('lobby', 'create_mode_tourney')}</div>
            <div className="create-mode-card-desc">{t('lobby', 'create_mode_tourney_desc')}</div>
          </div>
        </button>
      </div>

      <div className="create-presets-strip">
        <span className="create-presets-label"><Icon name="zap" size={12} /> {t('lobby', 'create_presets_title')}:</span>
        <div className="create-presets-buttons">
          <ChipButton size="sm" onClick={() => form.applyPreset('modern_bo3')}>
            Modern Bo3
          </ChipButton>
          <ChipButton size="sm" onClick={() => form.applyPreset('commander_4p')}>
            Commander 4P
          </ChipButton>
          <ChipButton size="sm" onClick={() => form.applyPreset('draft_8p')}>
            Draft MH3 (8P)
          </ChipButton>
          <ChipButton size="sm" onClick={() => form.applyPreset('modern_swiss_8p')}>
            Modern Swiss (8P)
          </ChipButton>
        </div>
      </div>

      <label>
        {t('lobby','create_field_table_name')}
        <input
          value={form.name}
          onChange={(e) => form.setName(e.target.value)}
          placeholder={t('lobby','placeholder_table_name')}
        />
      </label>

      <div className="create-grid-2col">
        <label>
          {t('lobby','create_field_game_type')}
          <select value={form.gameType} onChange={(e) => form.setGameType(e.target.value)}>
            {form.effectiveGameTypes.map((g) => (
              <option key={g.name} value={g.name}>
                {g.name} ({g.minPlayers}-{g.maxPlayers})
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('lobby','create_field_format')}
          <select value={form.deckType} onChange={(e) => form.setDeckType(e.target.value)}>
            {form.effectiveDeckTypes.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(isTourney || form.deckType === 'Limited') && (
        <div className="tourney-box">
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

          <Checkbox
            card
            checked={form.useDraftTournament}
            onChange={form.setUseDraftTournament}
            label={t('lobby','create_field_as_draft_tourney')}
            description={t('lobby','create_desc_as_draft_tourney')}
          />
          {form.tableCategory !== 'tourney' && form.isLimited && !form.isDraftLimited && (
            <div className="wizard-hint-box" style={{ borderColor: 'rgba(255,193,7,0.4)', color: '#ffd54f', marginBottom: 8 }}>
              <Icon name="alert" size={13} /> {t('lobby', 'create_limited_match_hint')}
            </div>
          )}

          <div className="create-grid-2col">
            <label>
              {t('lobby','create_field_draft_type')}
              <select value={tournamentTypeName} onChange={(e) => form.setTournamentType(e.target.value)}>
                {draftTypeOptions.map((tt) => {
                  const name = typeof tt === 'string' ? tt : (tt as { name?: string })?.name ?? ''
                  if (!name) return null
                  return <option key={name} value={name}>{name}</option>
                })}
              </select>
            </label>
            {tournamentTypeName.includes('Swiss') && (
              <label>
                {t('lobby','create_field_number_rounds')}
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form.numberRounds}
                  onChange={(e) => form.setNumberRounds(Math.min(10, Math.max(0, parseInt(e.target.value, 10) || 0)))}
                />
              </label>
            )}
          </div>

          <div className="field">
            <span>{t('lobby', 'create_tourney_players')}</span>
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
          </div>

          {form.isDraftLimited && (
            <>
              <div className="create-grid-2col">
                <label>
                  {t('lobby', 'create_field_boosters')}
                  <select value={form.draftBoosters} onChange={(e) => form.setDraftBoosters(Number(e.target.value) as 3 | 6)}>
                    <option value={3}>{t('lobby', 'create_option_boosters_3')}</option>
                    <option value={6}>{t('lobby', 'create_option_boosters_6')}</option>
                  </select>
                </label>
                <label>
                  {t('lobby','create_field_construction_time')}
                  <select value={form.draftConstructionTime} onChange={(e) => form.setDraftConstructionTime(Number(e.target.value))}>
                    {CONSTRUCTION_TIME_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{getConstructionTimeLabel(o, t)}</option>
                    ))}
                  </select>
                </label>
              </div>

              {tournamentTypeName.includes('Cube') && (
                <label>
                  {t('lobby','create_field_cube')}
                  <select value={form.draftCubeName} onChange={(e) => form.setDraftCubeName(e.target.value)}>
                    <option value="">{t('lobby','create_cube_random', { all: t('common','all') })}</option>
                    {(form.draftCubes.length ? form.draftCubes : DEFAULT_DRAFT_CUBES).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              )}

              <DraftSetsSelector
                draftSetsRaw={form.draftSetsRaw}
                onChange={form.setDraftSetsRaw}
                numBoosters={form.draftBoosters}
              />

              {isRandomPacksType(tournamentTypeName) && (
                <div>
                  <Button onClick={() => setShowPacks(true)} data-testid="random-packs-open">
                    {t('lobby','random_packs_open')}
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
                <label>
                  {t('lobby','create_field_draft_timing')}
                  <select value={form.draftTiming} onChange={(e) => form.setDraftTiming(e.target.value as 'BEGINNER' | 'REGULAR' | 'PROFESSIONAL')}>
                    {DRAFT_TIMING_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.value === 'BEGINNER' ? t('lobby','create_draft_timing_beginner') : o.value === 'REGULAR' ? t('lobby','create_draft_timing_regular') : t('lobby','create_draft_timing_professional')}</option>
                    ))}
                  </select>
                </label>
              )}

              <Checkbox
                card
                checked={form.singleGame}
                onChange={form.setSingleGame}
                label={t('lobby','create_field_single_game')}
                description={t('lobby','create_desc_single_game')}
              />
            </>
          )}
        </div>
      )}

      <div className="field">
        <span>{t('lobby','create_field_wins_needed')}</span>
        <div className="chip-row">
          {[
            { label: t('lobby','create_option_wins_bo1'), val: 1 },
            { label: t('lobby','create_option_wins_bo3'), val: 2 },
            { label: t('lobby','create_option_wins_bo5'), val: 3 },
            { label: 'Bo7 (4)', val: 4 },
            { label: 'Bo9 (5)', val: 5 },
          ].map((w) => (
            <ChipButton
              pill
              active={form.wins === w.val}
              key={w.val}
              onClick={() => form.setWins(w.val)}
            >
              {w.label}
            </ChipButton>
          ))}
        </div>
      </div>

      {!isTourney && form.selectedGameTypeInfo && form.selectedGameTypeInfo.minPlayers !== form.selectedGameTypeInfo.maxPlayers && (
        <label>
          {t('lobby','create_field_num_players')}
          <select value={form.numPlayers} onChange={(e) => form.setNumPlayers(Number(e.target.value))}>
            {Array.from({ length: form.selectedGameTypeInfo.maxPlayers - form.selectedGameTypeInfo.minPlayers + 1 }, (_, i) => {
              const n = form.selectedGameTypeInfo!.minPlayers + i
              return <option key={n} value={n}>{t('lobby','staging_seats_count',{count:n})}</option>
            })}
          </select>
          <span className="create-field-hint">Min {form.selectedGameTypeInfo.minPlayers} — Max {form.selectedGameTypeInfo.maxPlayers}</span>
        </label>
      )}

      {form.compatibilityError && (
        <div className="wizard-hint-box" style={{ borderColor: 'rgba(255,80,80,0.4)', color: '#ff9a9a' }}><Icon name="alert" size={13} /> {form.compatibilityError}</div>
      )}

      <div className="field">
        <span>{t('lobby','create_field_skill')}</span>
        <div className="chip-row">
          {SKILL_LEVEL_OPTIONS.map((opt) => {
            const label = opt.value === 'BEGINNER' ? t('lobby','create_skill_beginner') : opt.value === 'CASUAL' ? t('lobby','create_skill_casual') : t('lobby','create_skill_competitive')
            return (
              <ChipButton
                pill
                active={form.skillLevel === opt.value}
                key={opt.value}
                onClick={() => form.setSkillLevel(opt.value as any)}
              >
                {Array.from({ length: opt.stars }, (_, i) => <Icon key={i} name="star" size={11} />)} {label}
              </ChipButton>
            )
          })}
        </div>
      </div>

      <Checkbox
        card
        checked={form.rated}
        onChange={form.setRated}
        icon="star"
        label={t('lobby','create_field_rated')}
        description={t('lobby','create_desc_rated')}
      />
    </div>
  )
}
