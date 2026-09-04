import { useTranslation } from '../../i18n'
import {
  SKILL_LEVEL_OPTIONS,
  DEFAULT_TOURNAMENT_TYPES,
  DEFAULT_DRAFT_CUBES,
  CONSTRUCTION_TIME_OPTIONS,
} from './constants'
import type { CreateTableForm } from './useCreateTableForm'

export default function GeneralTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <div className="create-tab-content">
      <div className="wizard-step-heading">
        <h3>⚙️ {t('lobby','create_tab_general')}</h3>
        <p>Nombre, formato y estructura del match.</p>
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
            <button
              key={w.val}
              type="button"
              className={`chip ${form.wins === w.val ? 'on' : ''}`}
              onClick={() => form.setWins(w.val)}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {form.selectedGameTypeInfo && form.selectedGameTypeInfo.minPlayers !== form.selectedGameTypeInfo.maxPlayers && (
        <label>
          {t('lobby','create_field_num_players')}
          <select value={form.numPlayers} onChange={(e) => form.setNumPlayers(Number(e.target.value))}>
            {Array.from({ length: form.selectedGameTypeInfo.maxPlayers - form.selectedGameTypeInfo.minPlayers + 1 }, (_, i) => {
              const n = form.selectedGameTypeInfo!.minPlayers + i
              return <option key={n} value={n}>{n} {t('lobby','staging_seats_count').replace('{count}', String(n))}</option>
            })}
          </select>
          <span className="create-field-hint">Min {form.selectedGameTypeInfo.minPlayers} — Max {form.selectedGameTypeInfo.maxPlayers}</span>
        </label>
      )}

      {form.compatibilityError && (
        <div className="wizard-hint-box" style={{ borderColor: 'rgba(255,80,80,0.4)', color: '#ff9a9a' }}>⚠️ {form.compatibilityError}</div>
      )}

      <div className="field">
        <span>{t('lobby','create_field_skill')}</span>
        <div className="chip-row">
          {SKILL_LEVEL_OPTIONS.map((opt) => {
            const label = opt.value === 'BEGINNER' ? t('lobby','create_skill_beginner') : opt.value === 'CASUAL' ? t('lobby','create_skill_casual') : t('lobby','create_skill_competitive')
            return (
              <button
                key={opt.value}
                type="button"
                className={`chip ${form.skillLevel === opt.value ? 'on' : ''}`}
                onClick={() => form.setSkillLevel(opt.value as any)}
              >
                {opt.icon} {label}
              </button>
            )
          })}
        </div>
      </div>

      <label className="toggle-label-row">
        <input
          type="checkbox"
          checked={form.rated}
          onChange={(e) => form.setRated(e.target.checked)}
        />
        <div className="toggle-text-block">
          <span className="toggle-title">⭐ {t('lobby','create_field_rated')}</span>
          <span className="toggle-desc">Partida puntuada para ranking. Desactívalo para juego casual sin ELO.</span>
        </div>
      </label>

      {form.deckType === 'Limited' && (
        <div className="create-multiplayer-box" style={{ marginTop: 4 }}>
          <span className="multiplayer-box-title">🃏 {t('lobby','create_field_draft_type')}</span>
          <label className="toggle-label-row">
            <input
              type="checkbox"
              checked={form.useDraftTournament}
              onChange={(e) => form.setUseDraftTournament(e.target.checked)}
            />
            <div className="toggle-text-block">
              <span className="toggle-title">Crear como torneo Draft</span>
              <span className="toggle-desc">Si lo activas, se creará un torneo en lugar de una mesa normal.</span>
            </div>
          </label>
          {form.useDraftTournament && (
            <div style={{ marginTop: 10, display: 'grid', gap: 10 }}>
              <div className="create-grid-2col">
                <label>
                  {t('lobby','create_field_draft_type')}
                  <select value={form.tournamentType} onChange={(e) => form.setTournamentType(e.target.value)}>
                    {(form.tournamentTypes.length ? form.tournamentTypes : DEFAULT_TOURNAMENT_TYPES).map((tt) => (
                      <option key={tt} value={tt}>{tt}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('lobby', 'create_field_boosters')}
                  <select value={form.draftBoosters} onChange={(e) => form.setDraftBoosters(Number(e.target.value) as 3 | 6)}>
                    <option value={3}>{t('lobby', 'create_option_boosters_3')}</option>
                    <option value={6}>{t('lobby', 'create_option_boosters_6')}</option>
                  </select>
                </label>
              </div>
              {form.tournamentType.includes('Cube') && (
                <label>
                  Cube
                  <select value={form.draftCubeName} onChange={(e) => form.setDraftCubeName(e.target.value)}>
                    <option value="">— {t('common','all')} (aleatorio) —</option>
                    {(form.draftCubes.length ? form.draftCubes : DEFAULT_DRAFT_CUBES).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                {t('lobby','create_field_draft_sets')}
                <input
                  value={form.draftSetsRaw}
                  onChange={(e) => form.setDraftSetsRaw(e.target.value)}
                  placeholder={t('lobby','placeholder_draft_sets')}
                />
              </label>
              <label>
                Tiempo de construcción
                <select value={form.draftConstructionTime} onChange={(e) => form.setDraftConstructionTime(Number(e.target.value))}>
                  {CONSTRUCTION_TIME_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
