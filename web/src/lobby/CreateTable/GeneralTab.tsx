import ChipButton from '../../ui/ChipButton'
import Tabs from '../../ui/Tabs'
import Checkbox from '../../ui/Checkbox'
import { useTranslation } from '../../i18n'
import Icon from '../../ui/Icon'
import { SKILL_LEVEL_OPTIONS } from './constants'
import TourneyTab from './TourneyTab'
import FormatField from './FormatField'
import { deckTypeFamily, groupGameTypes, visualOf } from './formatFamily'
import type { CreateTableForm } from './useCreateTableForm'
import Field from '../../ui/Field'
import type { GalleryFamily, GalleryItem } from './FormatGallery'

export default function GeneralTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  const isTourney = form.kind === 'tourney'

  const nameField = (
    <Field label={t('lobby','create_field_table_name')}>
      <input
        value={form.name}
        onChange={(e) => form.setName(e.target.value)}
        maxLength={64}
        placeholder={t('lobby','placeholder_table_name')}
      />
    </Field>
  )

  const gameFamilies: GalleryFamily[] = [
    { id: 'classic', label: t('lobby', 'family_classic'), icon: 'swords' },
    { id: 'variant', label: t('lobby', 'family_variant'), icon: 'crown' },
  ]
  const deckFamilies: GalleryFamily[] = [
    { id: 'constructed', label: t('lobby', 'family_constructed'), icon: 'shield' },
    { id: 'block', label: t('lobby', 'family_block'), icon: 'book' },
    { id: 'variant', label: t('lobby', 'family_variant'), icon: 'crown' },
    { id: 'limited', label: t('lobby', 'family_limited'), icon: 'layers' },
  ]
  const gameItems: GalleryItem[] = groupGameTypes(form.effectiveGameTypes).map((base) => ({
    value: base.id,
    label: base.label || t('lobby', 'family_classic'),
    family: base.family,
    visual: base.visual,
    modes: base.modes.map((m) => ({
      value: m.value,
      label: m.mode === 'duel' ? t('lobby', 'family_duel') : m.mode === 'multi' ? t('lobby', 'family_multi') : '',
      meta: m.meta,
    })),
  }))
  const deckItems: GalleryItem[] = form.effectiveDeckTypes.map((d) => ({
    value: d,
    label: d,
    family: deckTypeFamily(d),
    visual: visualOf(d),
  }))

  const typeFields = (
    <>
      <div className={isTourney ? 'format-fields' : 'format-fields format-fields--stack'}>
        <FormatField
          testId="format-game-type"
          label={t('lobby','create_field_game_type')}
          galleryTitle={t('lobby', 'gallery_title_game')}
          value={form.gameType}
          items={gameItems}
          families={gameFamilies}
          onSelect={form.setGameType}
        />
        <FormatField
          testId="format-deck-type"
          label={t('lobby','create_field_format')}
          galleryTitle={t('lobby', 'gallery_title_deck')}
          value={form.deckType}
          items={deckItems}
          families={deckFamilies}
          onSelect={form.setDeckType}
        />
      </div>
      {form.compatibilityError && (
        <div className="wizard-hint-box wizard-hint-box--err"><Icon name="alert" size={13} /> {form.compatibilityError}</div>
      )}
    </>
  )

  const winsField = (
    <>
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

    </>
  )

  const playersField = (
    <>
      {!isTourney && form.selectedGameTypeInfo && form.selectedGameTypeInfo.minPlayers !== form.selectedGameTypeInfo.maxPlayers && (
        <Field label={t('lobby','create_field_num_players')} hint={t('lobby', 'create_hint_min_max', { min: form.selectedGameTypeInfo.minPlayers, max: form.selectedGameTypeInfo.maxPlayers })}>
          <select value={form.numPlayers} onChange={(e) => form.setNumPlayers(Number(e.target.value))}>
            {Array.from({ length: form.selectedGameTypeInfo.maxPlayers - form.selectedGameTypeInfo.minPlayers + 1 }, (_, i) => {
              const n = form.selectedGameTypeInfo!.minPlayers + i
              return <option key={n} value={n}>{t('lobby','staging_seats_count',{count:n})}</option>
            })}
          </select>
        </Field>
      )}

    </>
  )

  const skillField = (
    <>
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

    </>
  )

  const ratedField = (
    <>
      <Checkbox
        card
        checked={form.rated}
        onChange={form.setRated}
        icon="star"
        label={t('lobby','create_field_rated')}
        description={t('lobby','create_desc_rated')}
      />
    </>
  )

  const ruleFields = (
    <>
      {winsField}
      {playersField}
      {skillField}
      {ratedField}
    </>
  )

  if (isTourney) {
    return (
      <div className="create-tab-content">
        <div className="create-general-grid">
          <div className="create-general-col">
            <div className="create-presets-strip">
              <span className="create-presets-label"><Icon name="zap" size={12} /> {t('lobby', 'create_presets_title')}:</span>
              <div className="create-presets-buttons">
                <ChipButton size="sm" onClick={() => form.applyPreset('draft_8p')}>
                  {t('lobby', 'create_preset_draft_mh3')}
                </ChipButton>
                <ChipButton size="sm" onClick={() => form.applyPreset('modern_swiss_8p')}>
                  {t('lobby', 'create_preset_modern_swiss')}
                </ChipButton>
              </div>
            </div>
            {nameField}
            <TourneyTab form={form} />
          </div>
          <div className="create-general-col">
            {typeFields}
            {ruleFields}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="create-tab-content">
      <div className="create-general-col">
        {nameField}
        {typeFields}
        {form.isLimited && (
          <div className="wizard-hint-box wizard-hint-box--warn wizard-hint-box--spaced">
            <Icon name="alert" size={13} /> {t('lobby', 'create_limited_match_hint')}
          </div>
        )}
        {ruleFields}
      </div>
    </div>
  )
}
