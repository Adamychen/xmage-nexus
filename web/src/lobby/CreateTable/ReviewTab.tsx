import type { ReactNode } from 'react'
import { useTranslation } from '../../i18n'
import Icon from '../../ui/Icon'
import Button from '../../ui/Button'
import { deckRef } from '../decks'
import {
  BUFFER_TIME_OPTIONS,
  CONSTRUCTION_TIME_OPTIONS,
  DRAFT_TIMING_OPTIONS,
  TIME_LIMIT_OPTIONS,
  getBufferTimeLabel,
  getConstructionTimeLabel,
  getTimeLimitLabel,
  isHumanSeatType,
  parseLimitedSetCodes,
  seatTypeLabel,
} from './constants'
import type { CreateTab } from './constants'
import type { CreateTableForm } from './useCreateTableForm'

type Row = { label: string; value: ReactNode }

/** The last step: every choice of the wizard in one read-only list, so the
 *  table is checked before it is created. Create is also in the footer. */
export default function ReviewTab({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  const yesNo = (on: boolean) => (on ? t('common', 'yes') : t('common', 'no'))
  const none = '—'

  const tournamentTypeName = typeof form.tournamentType === 'string'
    ? form.tournamentType
    : (form.tournamentType as { name?: string })?.name ?? ''
  const skillLabel = form.skillLevel === 'BEGINNER' ? t('lobby','create_skill_beginner') : form.skillLevel === 'CASUAL' ? t('lobby','create_skill_casual') : t('lobby','create_skill_competitive')
  const timeLimit = TIME_LIMIT_OPTIONS.find((o) => o.value === form.timeLimit)
  const buffer = BUFFER_TIME_OPTIONS.find((o) => o.value === form.bufferTime)
  const construction = CONSTRUCTION_TIME_OPTIONS.find((o) => o.value === form.draftConstructionTime)
  const draftTiming = DRAFT_TIMING_OPTIONS.find((o) => o.value === form.draftTiming)
  const draftTimingLabel = form.draftTiming === 'BEGINNER' ? t('lobby','create_draft_timing_beginner') : form.draftTiming === 'REGULAR' ? t('lobby','create_draft_timing_regular') : t('lobby','create_draft_timing_professional')
  const setCodes = parseLimitedSetCodes(form.draftSetsRaw)

  const sections: { title: string; tab: CreateTab; rows: Row[] }[] = []
  const stepIds = new Set(form.wizardSteps.map((step) => step.id))

  sections.push({
    title: t('lobby', 'create_tab_general'),
    tab: 'general',
    rows: [
      { label: t('lobby', 'create_field_table_name'), value: form.name.trim() || none },
      { label: t('lobby', 'create_field_game_type'), value: form.gameType },
      { label: t('lobby', 'create_field_format'), value: form.isLimited && !form.isDraftLimited ? t('lobby', 'create_summary_limited') : form.deckType },
      { label: t('lobby', 'create_field_wins_needed'), value: `Bo${form.wins * 2 - 1}` },
      { label: t('lobby', 'create_field_skill'), value: skillLabel },
      { label: t('lobby', 'create_field_rated'), value: yesNo(form.rated) },
      ...(form.isTournament ? [
        { label: t('lobby', 'create_field_draft_type'), value: tournamentTypeName || none },
        { label: t('lobby', 'create_tourney_players'), value: t('lobby', 'staging_seats_count', { count: form.numPlayers }) },
      ] : []),
      ...(form.isTournament && tournamentTypeName.includes('Swiss') ? [
        { label: t('lobby', 'create_field_number_rounds'), value: String(form.numberRounds) },
      ] : []),
    ],
  })

  if (form.isDraftLimited) {
    sections.push({
      title: t('lobby', 'create_tab_draft'),
      tab: 'draft',
      rows: [
        { label: t('lobby', 'create_field_boosters'), value: String(form.draftBoosters) },
        { label: t('lobby', 'create_field_construction_time'), value: construction ? getConstructionTimeLabel(construction, t) : none },
        ...(tournamentTypeName.includes('Cube') ? [{ label: t('lobby', 'create_field_cube'), value: form.draftCubeName || t('lobby', 'create_cube_random', { all: t('common', 'all') }) }] : []),
        { label: t('lobby', 'create_field_draft_sets'), value: setCodes.join(', ') || none },
        ...(tournamentTypeName.includes('Draft') ? [{ label: t('lobby', 'create_field_draft_timing'), value: draftTiming ? draftTimingLabel : none }] : []),
        { label: t('lobby', 'create_field_single_game'), value: yesNo(form.singleGame) },
      ],
    })
  }

  sections.push({
    title: t('lobby', 'create_tab_timing'),
    tab: 'timing',
    rows: [
      { label: t('lobby', 'create_field_timing_limit'), value: timeLimit ? getTimeLimitLabel(timeLimit, t) : none },
      { label: t('lobby', 'create_field_buffer_time'), value: buffer ? getBufferTimeLabel(buffer, t) : none },
      { label: t('lobby', 'create_field_free_mulligans'), value: String(form.freeMulligans) },
      { label: t('lobby', 'create_field_mulligan_type'), value: form.mulliganType === 'GAME_DEFAULT' ? t('lobby', 'create_mulligan_format_default') : form.mulliganType },
      { label: t('lobby', 'create_field_custom_life'), value: form.customStartLifeEnabled ? String(form.customStartLife) : t('common', 'no') },
      { label: t('lobby', 'create_field_custom_hand'), value: form.customStartHandSizeEnabled ? String(form.customStartHandSize) : t('common', 'no') },
      { label: 'Planechase', value: yesNo(form.planeChase) },
    ],
  })

  sections.push({
    title: t('lobby', 'create_tab_restrictions'),
    tab: 'security',
    rows: [
      { label: t('lobby', 'create_field_password'), value: form.password.trim() ? t('lobby', 'tag_private') : t('common', 'no') },
      { label: t('lobby', 'create_field_min_rating'), value: form.minimumRating > 0 ? String(form.minimumRating) : t('common', 'all') },
      { label: t('lobby', 'create_field_quit_ratio'), value: form.quitRatio < 100 ? `${form.quitRatio}%` : t('common', 'all') },
      { label: t('lobby', 'create_field_banned_users'), value: form.bannedUsersRaw.trim() || none },
      { label: t('lobby', 'create_field_spectators'), value: yesNo(form.spectatorsAllowed) },
      { label: t('lobby', 'create_field_rollback'), value: yesNo(form.rollbackTurnsAllowed) },
    ],
  })

  const seatRows: Row[] = [
    { label: t('common', 'player'), value: form.humanSeat ? `${t('lobby', 'create_field_my_skill')} ${form.mySkill}` : t('lobby', 'spectators') },
    ...form.seatConfigs.map((cfg, idx) => {
      const label = t('lobby', 'create_seat_number', { num: idx + 2 })
      if (isHumanSeatType(cfg.type)) return { label, value: t('lobby', 'create_seat_human_waiting_label') }
      const deck = form.availableDecks.find((d) => deckRef(d) === cfg.deckName)
        ?? form.availableDecks.find((d) => d.name === cfg.deckName)
      return { label, value: `${seatTypeLabel(cfg.type, t)} · ${t('lobby', 'create_field_seat_skill')} ${cfg.skill ?? 2}${form.isDraftLimited ? '' : ` · ${deck?.name ?? none}`}` }
    }),
  ]
  sections.push({ title: t('lobby', 'create_tab_multi'), tab: 'seats', rows: seatRows })

  const compatibility = form.compatibilityError

  return (
    <div className="create-tab-content create-review">
      {compatibility && (
        <div className="wizard-hint-box wizard-hint-box--err"><Icon name="alert" size={13} /> {compatibility}</div>
      )}
      <div className="create-review-grid">
        {sections.map((section) => (
          <section key={section.title} className="create-review-section">
            <h4 className="create-review-title">
              {section.title}
              {stepIds.has(section.tab) && (
                <Button
                  variant="link"
                  size="sm"
                  aria-label={t('lobby', 'create_review_edit_section', { section: section.title })}
                  onClick={() => form.goToStep(section.tab)}
                >
                  {t('common', 'edit')}
                </Button>
              )}
            </h4>
            <dl className="create-review-list">
              {section.rows.map((row) => (
                <div key={row.label} className="create-review-row">
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  )
}
