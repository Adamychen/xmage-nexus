import * as cmds from '../../net/commands'
import { useTranslation } from '../../i18n'
import { useStore } from '../../state/store'
import type { UseFeedbackForm } from '../useFeedbackForm'
import { DockPrompt, OrderPrompt, PromptAction } from '../GameDock'
import { PromptActionKey, PromptSecondKey } from './PromptKeys'
import './promptBars.css'

export default function CombatBar({ form }: { form: UseFeedbackForm }) {
  const { t } = useTranslation()
  const { prompt, busy, send } = form
  const chosen = useStore((s) => s.combat?.chosen) ?? []
  if (!prompt) return null
  const isAtk = prompt.isDeclaringAttackers === true
  const combatTitle = isAtk ? t('game', 'combat_attackers_title') : t('game', 'combat_blockers_title')
  const picked = chosen.length

  /** CMB-12: the declaration is over; the game moves on to blockers (or to damage). */
  const confirm = () => void send(() => cmds.sendPlayerBoolean(false, prompt.gameId), t('errors', 'send_failed_combat'))
  /** CMB-13: the special action, which declares every creature that can attack. */
  const attackAll = () => void send(() => cmds.sendPlayerString('special', prompt.gameId), t('errors', 'send_failed_combat'))
  /**
   * CMB-13: unmark what is marked and nothing else. Each click on a declared creature toggles it,
   * so taking them all back is one click each; the declaration itself stays open.
   */
  const clearPicks = () => void send(async () => {
    let last = { ok: true } as Awaited<ReturnType<typeof cmds.sendPlayerUUID>>
    for (const id of chosen) {
      last = await cmds.sendPlayerUUID(id, prompt.gameId)
      if (!last.ok) break
    }
    return last
  }, t('errors', 'send_failed_combat'))

  // Sin pluralización en `t()`: una clave para uno y otra para varios.
  const confirmMany = isAtk
    ? t('game', 'combat_confirm_attackers_count', { count: picked })
    : t('game', 'combat_confirm_blockers_count', { count: picked })
  const confirmOne = isAtk ? t('game', 'combat_confirm_attacker_one') : t('game', 'combat_confirm_blocker_one')
  const confirmLabel = picked === 0
    ? (isAtk ? t('game', 'combat_no_attacks') : t('game', 'combat_no_blocks'))
    : picked === 1 ? confirmOne : confirmMany
  const leaveLabel = isAtk ? t('game', 'combat_no_attacks') : t('game', 'combat_no_blocks')
  const clearLabel = isAtk ? t('game', 'combat_clear_attacks') : t('game', 'combat_clear_blocks')

  // CMB-13: going forward is the big button and stepping back is the small one above it, as every
  // other client of this game reads. With nothing declared, going forward is declaring everything.
  const goesAll = picked === 0 && prompt.special === true

  return (
    <>
    <OrderPrompt>
      <span className="board-order" data-testid="board-order">
        {combatTitle}
      </span>
    </OrderPrompt>
    <PromptAction>
      <PromptActionKey
        tone={goesAll ? 'go' : picked > 0 ? 'confirm' : 'leave'}
        label={goesAll ? t('game', 'combat_attack_all') : confirmLabel}
        disabled={busy}
        onClick={goesAll ? attackAll : confirm}
      />
    </PromptAction>
    <DockPrompt>
      <div className="action-prompt-bar combat-bar">
        <div className="action-prompt-actions">
          {picked > 0 ? (
            <PromptSecondKey label={clearLabel} disabled={busy} onClick={clearPicks} />
          ) : goesAll ? (
            <PromptSecondKey label={leaveLabel} disabled={busy} onClick={confirm} />
          ) : null}
        </div>
      </div>
    </DockPrompt>
    </>
  )
}
