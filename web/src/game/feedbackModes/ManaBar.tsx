import * as cmds from '../../net/commands'
import { useStore } from '../../state/store'
import FormattedText from '../FormattedText'
import Icon from '../../ui/Icon'
import { useTranslation } from '../../i18n'
import { localizeServerMessage } from '../serverMessageTranslation'
import type { UseFeedbackForm } from '../useFeedbackForm'

const POOL_COLORS = ['white', 'blue', 'black', 'red', 'green', 'colorless'] as const
const COLOR_SYMBOLS: Record<string, string> = { white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G', colorless: 'C' }

/** Maná disponible en la reserva del jugador controlado para pagar desde el pool. */
function poolMana(game: { players?: unknown[] | null } | null) {
  const players = (game?.players ?? []) as { controlled?: boolean; manaPool?: Record<string, number> }[]
  const me = players.find((p) => p.controlled)
  const pool = (me?.manaPool ?? {}) as Record<string, number>
  return POOL_COLORS.filter((color) => (pool[color] ?? 0) > 0)
    .map((color) => ({ color: color.toUpperCase(), label: `${COLOR_SYMBOLS[color]}${pool[color] ?? 0}` }))
}

export default function ManaBar({ form }: { form: UseFeedbackForm }) {
  const { t } = useTranslation()
  const game = useStore((s) => s.game)
  const { prompt, busy, send, cancel } = form
  if (!prompt) return null
  const localizedManaMsg = localizeServerMessage(prompt.message, t as any)
  return (
    <div className="action-prompt-bar mana-prompt-bar">
      <div className="action-prompt-info">
        <span className="action-prompt-title">
          <span className="action-prompt-icon" aria-hidden="true"><Icon name="zap" size={14} /></span>{' '}
          {t('game', 'pay_mana')}
        </span>
        <span className="action-prompt-msg">
          <FormattedText text={localizedManaMsg} />
        </span>
        <span className="action-prompt-hint">{t('game', 'mana_hint')}</span>
      </div>
      <div className="action-prompt-actions">
        {prompt.playerId && poolMana(game).map((mana) => (
          <button
            key={mana.color}
            className="mana-pool-btn"
            disabled={busy}
            onClick={() => void send(() => cmds.sendPlayerManaType(prompt.gameId, prompt.playerId as string, mana.color), t('errors', 'send_failed_mana'))}
          >
            {t('game', 'mana_pool_pay', { label: mana.label })}
          </button>
        ))}
        <button disabled={busy} onClick={() => void send(() => cmds.sendPlayerString('special', prompt.gameId), t('errors', 'send_failed_special'))}>
          {t('game', 'mana_special')}
        </button>
        <button disabled={busy} onClick={cancel} className="cancel-btn">
          {t('game', 'targeting_cancel')}
        </button>
      </div>
    </div>
  )
}
