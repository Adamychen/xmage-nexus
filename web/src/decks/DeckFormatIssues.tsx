import { useEffect, useState } from 'react'
import { useTranslation } from '../i18n'
import Icon from '../ui/Icon'
import CloseButton from '../ui/CloseButton'
import type { ValidationIssue } from './formatRules'

interface Props {
  issues: ValidationIssue[]
  validator?: string
}

/**
 * Banner con los errores del DeckValidator OFICIAL de XMage (validateDeckFormat
 * del proxy) a nivel de mazo (los errores ligados a una carta van como badge en
 * la propia carta). Solo aparece cuando el validador oficial rechaza el mazo.
 */
export default function DeckFormatIssues({ issues, validator }: Props) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => setDismissed(false), [issues])
  if (issues.length === 0 || dismissed) return null
  return (
    <div className="builder-server-issues" data-testid="builder-format-issues" role="status" aria-live="polite">
      <div className="bsi-title">
        <span><Icon name="alert" size={14} /> {t('decks', 'issues_xmage_title', { validator: validator || 'XMage' })}</span>
      </div>
      <CloseButton variant="plain" size="sm" className="bsi-close" onClick={() => setDismissed(true)} />
      <ul>
        {issues.map((it, i) => (
          <li key={`${it.message}-${i}`}>{it.message}</li>
        ))}
      </ul>
    </div>
  )
}