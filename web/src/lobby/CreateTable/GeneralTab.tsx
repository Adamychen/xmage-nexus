import ChipButton from '../../ui/ChipButton'
import Tabs from '../../ui/Tabs'
import Checkbox from '../../ui/Checkbox'
import { useTranslation } from '../../i18n'
import Icon from '../../ui/Icon'
import { SKILL_LEVEL_OPTIONS } from './constants'
import TourneyTab from './TourneyTab'
import type { CreateTableForm } from './useCreateTableForm'
import Field from '../../ui/Field'

export default function GeneralTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  const isTourney = form.kind === 'tourney'

  return (
    <div className="create-tab-content">
      <div className="create-general-grid">
        <div className="create-general-col">
          {!isTourney && (
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
            </div>
          )}

          <div className="create-presets-strip">
            <span className="create-presets-label"><Icon name="zap" size={12} /> {t('lobby', 'create_presets_title')}:</span>
            <div className="create-presets-buttons">
              {isTourney ? (
                <>
                  <ChipButton size="sm" onClick={() => form.applyPreset('draft_8p')}>
                    Draft MH3 (8P)
                  </ChipButton>
                  <ChipButton size="sm" onClick={() => form.applyPreset('modern_swiss_8p')}>
                    Modern Swiss (8P)
                  </ChipButton>
                </>
              ) : (
                <>
                  <ChipButton size="sm" onClick={() => form.applyPreset('modern_bo3')}>
                    Modern Bo3
                  </ChipButton>
                  <ChipButton size="sm" onClick={() => form.applyPreset('commander_4p')}>
                    Commander 4P
                  </ChipButton>
                </>
              )}
            </div>
          </div>

          <Field label={t('lobby','create_field_table_name')}>
            <input
              value={form.name}
              onChange={(e) => form.setName(e.target.value)}
              placeholder={t('lobby','placeholder_table_name')}
            />
          </Field>

          {isTourney && <TourneyTab form={form} />}

          {!isTourney && form.isLimited && (
            <div className="wizard-hint-box wizard-hint-box--warn wizard-hint-box--spaced">
              <Icon name="alert" size={13} /> {t('lobby', 'create_limited_match_hint')}
            </div>
          )}
        </div>

        <div className="create-general-col">
          <div className="create-grid-2col">
            <Field label={t('lobby','create_field_game_type')}>
              <select value={form.gameType} onChange={(e) => form.setGameType(e.target.value)}>
                {form.effectiveGameTypes.map((g) => (
                  <option key={g.name} value={g.name}>
                    {g.name} ({g.minPlayers}-{g.maxPlayers})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('lobby','create_field_format')}>
              <select value={form.deckType} onChange={(e) => form.setDeckType(e.target.value)}>
                {form.effectiveDeckTypes.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field group label={t('lobby','create_field_wins_needed')}>
            <Tabs
              variant="segmented"
              size="sm"
              label={t('lobby','create_field_wins_needed')}
              value={String(form.wins)}
              onChange={(id) => form.setWins(Number(id))}
              items={[1, 2, 3, 4, 5].map((wins) => ({ id: String(wins), label: `Bo${wins * 2 - 1}` }))}
            />
          </Field>

          {!isTourney && form.selectedGameTypeInfo && form.selectedGameTypeInfo.minPlayers !== form.selectedGameTypeInfo.maxPlayers && (
            <Field label={t('lobby','create_field_num_players')} hint={<>Min {form.selectedGameTypeInfo.minPlayers} — Max {form.selectedGameTypeInfo.maxPlayers}</>}>
              <select value={form.numPlayers} onChange={(e) => form.setNumPlayers(Number(e.target.value))}>
                {Array.from({ length: form.selectedGameTypeInfo.maxPlayers - form.selectedGameTypeInfo.minPlayers + 1 }, (_, i) => {
                  const n = form.selectedGameTypeInfo!.minPlayers + i
                  return <option key={n} value={n}>{t('lobby','staging_seats_count',{count:n})}</option>
                })}
              </select>
            </Field>
          )}

          {form.compatibilityError && (
            <div className="wizard-hint-box wizard-hint-box--err"><Icon name="alert" size={13} /> {form.compatibilityError}</div>
          )}

          <Field group label={t('lobby','create_field_skill')}>
            <div className="chip-row">
              {SKILL_LEVEL_OPTIONS.map((opt) => {
                const label = opt.value === 'BEGINNER' ? t('lobby','create_skill_beginner') : opt.value === 'CASUAL' ? t('lobby','create_skill_casual') : t('lobby','create_skill_competitive')
                return (
                  <ChipButton
                    pill
                    active={form.skillLevel === opt.value}
                    key={opt.value}
                    onClick={() => form.setSkillLevel(opt.value)}
                  >
                    {Array.from({ length: opt.stars }, (_, i) => <Icon key={i} name="star" size={11} />)} {label}
                  </ChipButton>
                )
              })}
            </div>
          </Field>

          <Checkbox
            card
            checked={form.rated}
            onChange={form.setRated}
            icon="star"
            label={t('lobby','create_field_rated')}
            description={t('lobby','create_desc_rated')}
          />
        </div>
      </div>
    </div>
  )
}
