import { useTranslation } from '../../i18n'
import Icon from '../../ui/Icon'
import { isHumanSeatType, parseLimitedSetCodes, getConstructionTimeLabel } from './constants'
import type { CreateTableForm } from './useCreateTableForm'

export default function SummaryStrip({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  const humansWaiting = form.seatConfigs.filter((s) => isHumanSeatType(s.type)).length
  return (
    <div className="create-table-summary-strip">
      <span className="summary-pill">{form.gameType} · {form.numPlayers}p</span>
      {humansWaiting > 0 && <span className="summary-pill"><Icon name="user" size={11} /> {t('lobby','create_summary_waiting',{count:humansWaiting})}</span>}
      <span className="summary-pill">{form.deckType}</span>
      <span className="summary-pill">Bo{form.wins === 1 ? '1' : form.wins === 2 ? '3' : form.wins === 3 ? '5' : form.wins === 4 ? '7' : '9'} ({form.wins})</span>
      <span className="summary-pill">{form.timeLimit === 'NONE' ? t('lobby','create_summary_no_clock') : form.timeLimit.replace('MIN__', '') + 'm'}</span>
      <span className="summary-pill">{form.skillLevel === 'BEGINNER' ? t('lobby','create_skill_beginner') : form.skillLevel === 'CASUAL' ? t('lobby','create_skill_casual') : t('lobby','create_skill_competitive')}</span>
      {(form.mulliganType !== 'GAME_DEFAULT' || form.customStartLifeEnabled || form.customStartHandSizeEnabled || form.planeChase) && <span className="summary-pill" style={{ borderColor: 'rgba(124,92,255,0.4)' }}><Icon name="dice" size={11} /> {t('lobby','create_custom_options')} ({[form.mulliganType !== 'GAME_DEFAULT' ? form.mulliganType : null, form.customStartLifeEnabled ? t('lobby','create_custom_life_tag',{life:form.customStartLife}) : null, form.customStartHandSizeEnabled ? t('lobby','create_custom_hand_tag',{hand:form.customStartHandSize}) : null, form.planeChase ? 'Planechase' : null].filter(Boolean).join(' · ')})</span>}
      {form.compatibilityError && <span className="summary-pill security"><Icon name="alert" size={11} /> {form.compatibilityError.slice(0, 28)}</span>}
      {form.isDraftLimited && <span className="summary-pill"><Icon name="layers" size={11} /> Draft {form.draftBoosters}× {parseLimitedSetCodes(form.draftSetsRaw).join(', ') || 'sets'} · {getConstructionTimeLabel({ value: form.draftConstructionTime, label: '' }, t)}</span>}
      {form.isConstructedTournament && <span className="summary-pill" style={{ borderColor: 'rgba(255,193,7,0.4)', color: '#ffd54f' }}><Icon name="trophy" size={11} /> {form.tournamentType} · {form.numPlayers}p</span>}
      {form.isLimited && !form.isDraftLimited && <span className="summary-pill">{t('lobby','create_summary_limited')}</span>}
      {form.minimumRating > 0 && <span className="summary-pill"><Icon name="star" size={11} /> {t('lobby','create_field_min_rating')}: {form.minimumRating}</span>}
      {form.quitRatio < 100 && <span className="summary-pill"><Icon name="ban" size={11} /> {t('lobby','create_field_quit_ratio')}: {form.quitRatio}%</span>}
      {form.password.trim() && <span className="summary-pill security"><Icon name="lock" size={11} /> {t('lobby','tag_private')}</span>}
      {form.rated && <span className="summary-pill rated"><Icon name="star" size={11} /> {t('lobby','tag_rated')}</span>}
    </div>
  )
}
