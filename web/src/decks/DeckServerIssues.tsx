import CloseButton from '../ui/CloseButton'
import Button from '../ui/Button'
import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import Icon from '../ui/Icon'
import type { ServerIssueItem } from './useDeckValidation'
import type { DeckFix } from './deckIssues'

interface Props {
  issues: ServerIssueItem[]
  onRepair: (fixes: DeckFix[]) => void
}

const itemKey = (it: ServerIssueItem) => `${it.kind}|${it.name}|${it.set}|${it.num}`

export default function DeckServerIssues({ issues, onRepair }: Props) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)
  const [accepted, setAccepted] = useState<Set<string>>(() => new Set())
  useEffect(() => setDismissed(false), [issues])
  const visible = issues.filter((it) => !accepted.has(itemKey(it)))
  if (visible.length === 0 || dismissed) return null
  const fixes = visible.flatMap((it) => it.fixes)
  const fixable = visible.filter((it) => it.fixes.length > 0).length
  const accept = (it: ServerIssueItem) => setAccepted((prev) => new Set(prev).add(itemKey(it)))
  return (
    <div className="builder-server-issues" data-testid="builder-server-issues" role="status" aria-live="polite">
      <div className="bsi-title">
        <span><Icon name="alert" size={14} /> {t('decks', 'issues_banner_title')}</span>
        {fixable > 0 && (
          <Button variant="success" size="sm" className="bsi-auto-btn"
            data-testid="builder-issue-auto-resolve"
            title={t('decks', 'issues_auto_resolve_hint')}
            onClick={() => onRepair(fixes)}>
            {t('decks', 'issues_auto_resolve', { count: fixable })}
          </Button>
        )}
      </div>
      <CloseButton variant="plain" size="sm" className="bsi-close" onClick={() => setDismissed(true)} />
      <ul>
        {visible.map((it, i) => (
          <li key={`${itemKey(it)}-${i}`}>
            <strong>{it.amount}× {it.name} ({it.set} #{it.num})</strong> — {it.message}
            {it.to && (
              <>
                <span className="bsi-sug"> · {t('decks', 'issues_banner_same_card', { set: it.to.setCode, num: it.to.cardNumber })}</span>{' '}
                <Button variant="success" size="sm" className="bsi-repair-btn"
                  data-testid="builder-issue-repair"
                  onClick={() => onRepair(it.fixes)}>
                  {t('decks', 'issues_use_suggestion', { set: it.to.setCode, num: it.to.cardNumber })}
                </Button>
              </>
            )}
            {it.kind === 'mismatch' && (
              <Button variant="subtle" size="sm" className="bsi-repair-btn"
                data-testid="builder-issue-accept"
                title={t('decks', 'issues_accept_hint')}
                onClick={() => accept(it)}>
                {t('decks', 'issues_accept')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
