import { useTranslation } from '../i18n'
import type { ServerIssueItem } from './useDeckValidation'

interface Props {
  issues: ServerIssueItem[]
  onRepair: (from: ServerIssueItem['from'], to: NonNullable<ServerIssueItem['to']>) => void
}

export default function DeckServerIssues({ issues, onRepair }: Props) {
  const { t } = useTranslation()
  if (issues.length === 0) return null
  return (
    <div className="builder-server-issues" data-testid="builder-server-issues">
      <div className="bsi-title">⚠️ {t('decks', 'issues_banner_title')}</div>
      <ul>
        {issues.map((it, i) => (
          <li key={`${it.name}-${it.set}-${it.num}-${i}`}>
            <strong>{it.amount}× {it.name} ({it.set} #{it.num})</strong> — {it.message}
            {it.to && (
              <>
                <span className="bsi-sug"> · {t('decks', 'issues_banner_same_card', { set: it.to.setCode, num: it.to.cardNumber })}</span>{' '}
                <button
                  type="button"
                  className="bsi-repair-btn"
                  data-testid="builder-issue-repair"
                  onClick={() => onRepair(it.from, it.to!)}
                >
                  {t('decks', 'issues_use_suggestion', { set: it.to.setCode, num: it.to.cardNumber })}
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
