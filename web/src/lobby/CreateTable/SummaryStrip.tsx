import { useTranslation } from '../../i18n'
import Chip from '../../ui/Chip'
import { isHumanSeatType, parseLimitedSetCodes, getConstructionTimeLabel } from './constants'
import type { CreateTableForm } from './useCreateTableForm'

export default function SummaryStrip({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  const humansWaiting = form.seatConfigs.filter((s) => isHumanSeatType(s.type)).length
  return (
    <div className="create-table-summary-strip">
      <Chip size="xs">{form.gameType} · {form.numPlayers}p</Chip>
      {humansWaiting > 0 && <Chip size="xs" icon="user">{t('lobby','create_summary_waiting',{count:humansWaiting})}</Chip>}
      <Chip size="xs">{form.deckType}</Chip>
      <Chip size="xs">Bo{form.wins === 1 ? '1' : form.wins === 2 ? '3' : form.wins === 3 ? '5' : form.wins === 4 ? '7' : '9'} ({form.wins})</Chip>
      <Chip size="xs">{form.timeLimit === 'NONE' ? t('lobby','create_summary_no_clock') : t('lobby', 'create_time_min_short', { min: form.timeLimit.replace('MIN__', '') })}</Chip>
      <Chip size="xs">{form.skillLevel === 'BEGINNER' ? t('lobby','create_skill_beginner') : form.skillLevel === 'CASUAL' ? t('lobby','create_skill_casual') : t('lobby','create_skill_competitive')}</Chip>
      {(form.mulliganType !== 'GAME_DEFAULT' || form.customStartLifeEnabled || form.customStartHandSizeEnabled || form.planeChase) && <Chip size="xs" tone="brand" icon="dice">{t('lobby','create_custom_options')} ({[form.mulliganType !== 'GAME_DEFAULT' ? form.mulliganType : null, form.customStartLifeEnabled ? t('lobby','create_custom_life_tag',{life:form.customStartLife}) : null, form.customStartHandSizeEnabled ? t('lobby','create_custom_hand_tag',{hand:form.customStartHandSize}) : null, form.planeChase ? 'Planechase' : null].filter(Boolean).join(' · ')})</Chip>}
      {form.compatibilityError && <Chip size="xs" tone="err" icon="alert">{form.compatibilityError.slice(0, 28)}</Chip>}
      {form.isDraftLimited && <Chip size="xs" icon="layers">Draft {form.draftBoosters}× {parseLimitedSetCodes(form.draftSetsRaw).join(', ') || 'sets'} · {getConstructionTimeLabel({ value: form.draftConstructionTime, label: '' }, t)}</Chip>}
      {form.isConstructedTournament && <Chip size="xs" tone="gold" icon="trophy">{form.tournamentType} · {form.numPlayers}p</Chip>}
      {form.isLimited && !form.isDraftLimited && <Chip size="xs">{t('lobby','create_summary_limited')}</Chip>}
      {form.minimumRating > 0 && <Chip size="xs" icon="star">{t('lobby','create_field_min_rating')}: {form.minimumRating}</Chip>}
      {form.quitRatio < 100 && <Chip size="xs" icon="ban">{t('lobby','create_field_quit_ratio')}: {form.quitRatio}%</Chip>}
      {form.password.trim() && <Chip size="xs" tone="err" icon="lock">{t('lobby','tag_private')}</Chip>}
      {form.rated && <Chip size="xs" tone="gold" icon="star">{t('lobby','tag_rated')}</Chip>}
    </div>
  )
}
