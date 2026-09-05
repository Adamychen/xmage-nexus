import { useTranslation } from '../../i18n'
import Icon from '../../ui/Icon'
import { parseLimitedSetCodes } from './constants'
import type { CreateTableForm } from './useCreateTableForm'

export default function SummaryStrip({ form }: { form: CreateTableForm }) {
  const { t } = useTranslation()
  return (
    <div className="create-table-summary-strip">
      <span className="summary-pill">{form.gameType} · {form.numPlayers}p</span>
      <span className="summary-pill">{form.deckType}</span>
      <span className="summary-pill">Bo{form.wins === 1 ? '1' : form.wins === 2 ? '3' : form.wins === 3 ? '5' : form.wins === 4 ? '7' : '9'} ({form.wins})</span>
      <span className="summary-pill">{form.timeLimit === 'NONE' ? t('lobby','create_summary_no_clock') : form.timeLimit.replace('MIN__', '') + 'm'}</span>
      <span className="summary-pill">{form.skillLevel === 'BEGINNER' ? t('lobby','create_skill_beginner') : form.skillLevel === 'CASUAL' ? t('lobby','create_skill_casual') : t('lobby','create_skill_competitive')}</span>
      {(form.mulliganType !== 'GAME_DEFAULT' || form.customStartLifeEnabled || form.customStartHandSizeEnabled || form.planeChase) && <span className="summary-pill" style={{ borderColor: 'rgba(124,92,255,0.4)' }}><Icon name="dice" size={11} /> Custom ({[form.mulliganType !== 'GAME_DEFAULT' ? form.mulliganType : null, form.customStartLifeEnabled ? `Vida ${form.customStartLife}` : null, form.customStartHandSizeEnabled ? `Mano ${form.customStartHandSize}` : null, form.planeChase ? 'Planechase' : null].filter(Boolean).join(' · ')})</span>}
      {form.compatibilityError && <span className="summary-pill security"><Icon name="alert" size={11} /> {form.compatibilityError.slice(0, 28)}</span>}
      {form.isDraftLimited && <span className="summary-pill"><Icon name="layers" size={11} /> Draft {form.draftBoosters}× {parseLimitedSetCodes(form.draftSetsRaw).join(', ') || 'sets'}</span>}
      {form.isLimited && !form.isDraftLimited && <span className="summary-pill">{t('lobby','create_summary_limited')}</span>}
      {form.minimumRating > 0 && <span className="summary-pill"><Icon name="star" size={11} /> {t('lobby','create_field_min_rating')}: {form.minimumRating}</span>}
      {form.quitRatio < 100 && <span className="summary-pill"><Icon name="ban" size={11} /> {t('lobby','create_field_quit_ratio')}: {form.quitRatio}%</span>}
      {form.password.trim() && <span className="summary-pill security"><Icon name="lock" size={11} /> {t('lobby','tag_private')}</span>}
      {form.rated && <span className="summary-pill rated"><Icon name="star" size={11} /> {t('lobby','tag_rated')}</span>}
    </div>
  )
}
