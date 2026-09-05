import * as cmds from '../../net/commands'
import Icon from '../../ui/Icon'
import { useTranslation } from '../../i18n'
import type { UseFeedbackForm } from '../useFeedbackForm'

export default function CombatBar({ form }: { form: UseFeedbackForm }) {
  const { t } = useTranslation()
  const { prompt, busy, send } = form
  if (!prompt) return null
  const isAtk = prompt.title.toLowerCase().includes('atacan') || prompt.title.toLowerCase().includes('attack')
  const combatTitle = isAtk ? t('game', 'combat_attackers_title') : t('game', 'combat_blockers_title')
  const confirmLabel = isAtk ? t('game', 'combat_confirm_attackers') : t('game', 'combat_confirm_blockers')

  return (
    <div className="action-prompt-bar combat-bar">
      <div className="action-prompt-info">
        <span className="action-prompt-title">
          <span className="action-prompt-icon" aria-hidden="true"><Icon name="swords" size={14} /></span>{' '}
          {combatTitle}
        </span>
        <span className="action-prompt-hint">
          {t('game', 'combat_hint')}
        </span>
      </div>
      <div className="action-prompt-actions">
        {prompt.special && (
          <button disabled={busy} onClick={() => void send(() => cmds.sendPlayerString('special', prompt.gameId), t('errors', 'send_failed_combat'))}>
            {t('game', 'combat_attack_all')}
          </button>
        )}
        <button
          className="primary"
          disabled={busy}
          onClick={() => void send(() => cmds.sendPlayerBoolean(false, prompt.gameId), t('errors', 'send_failed_combat'))}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
