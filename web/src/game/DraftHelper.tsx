import Button from '../ui/Button'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import type { AdviceReason, PickAdvice } from './draftAdvisor'
import './DraftHelper.css'

export interface DraftHelperProps {
  advice: PickAdvice[]
  names: Record<string, string>
  pending: boolean
  onHide: () => void
}

const REASON_KEYS = {
  rare: 'draft_reason_rare',
  mythic: 'draft_reason_mythic',
  on_colors: 'draft_reason_on_colors',
  colorless: 'draft_reason_colorless',
  curve: 'draft_reason_curve',
  creatures: 'draft_reason_creatures',
  splash: 'draft_reason_splash',
  off_colors: 'draft_reason_off_colors',
} as const satisfies Record<AdviceReason, string>

export default function DraftHelper({ advice, names, pending, onHide }: DraftHelperProps) {
  const { t } = useTranslation()
  const top = advice.slice(0, 3)
  return (
    <section className="draft-helper" data-testid="draft-helper" aria-label={t('game', 'draft_helper_title')}>
      <header className="draft-helper-head">
        <strong>
          <Icon name="wand" size={13} /> {t('game', 'draft_helper_title')}
        </strong>
        <Button size="sm" variant="ghost" data-testid="draft-helper-hide" onClick={onHide}>
          {t('game', 'draft_helper_hide')}
        </Button>
      </header>
      <p className="draft-helper-hint">{pending ? t('game', 'draft_helper_loading') : t('game', 'draft_helper_hint')}</p>
      <ol className="draft-helper-list">
        {top.map((item, index) => (
          <li key={item.id} data-testid="draft-helper-item" data-card-id={item.id}>
            <span className="draft-helper-rank">{index + 1}</span>
            <span className="draft-helper-name">{names[item.id] ?? item.id.slice(0, 8)}</span>
            <span className="draft-helper-reasons">
              {item.reasons.map((reason) => (
                <span key={reason} className={`draft-helper-chip is-${reason}`}>
                  {t('game', REASON_KEYS[reason])}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
