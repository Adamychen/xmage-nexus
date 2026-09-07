import { useStore } from '../state/store'
import * as cmds from '../net/commands'
import type { FeedbackPrompt } from './feedback'
import FormattedText from './FormattedText'
import DialogShell from '../ui/DialogShell'
import { useTranslation } from '../i18n'
import './PlaneswalkerAbilityDialog.css'

interface PlaneswalkerAbilityDialogProps {
  prompt: FeedbackPrompt
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
  busy: boolean
}

function deltaClass(delta: number | null): string {
  if (delta == null) return ''
  if (delta > 0) return 'delta-pos'
  if (delta < 0) return 'delta-neg'
  return 'delta-zero'
}

function deltaLabel(delta: number | null): string {
  if (delta == null) return ''
  if (delta > 0) return `+${delta}`
  if (delta < 0) return `${delta}`
  return '0'
}

export default function PlaneswalkerAbilityDialog({ prompt, send, busy }: PlaneswalkerAbilityDialogProps) {
  const { t } = useTranslation()
  const game = useStore((s) => s.game)
  const deltas = prompt.loyaltyDeltas ?? []

  const pwLoyalty = (() => {
    if (!game?.players) return null
    for (const p of game.players) {
      for (const zone of [p.battlefield, p.exile, p.commandList].filter(Boolean) as unknown as Record<string, unknown>[]) {
        for (const v of Object.values(zone)) {
          const c = v as Record<string, unknown>
          if (c && typeof c.loyalty === 'string' && c.loyalty !== '') return parseInt(String(c.loyalty), 10)
        }
      }
    }
    return null
  })()

  return (
    <DialogShell
      labelledBy="pw-title"
      titleId="pw-title"
      legacyBackdropClass="pw-backdrop"
      legacyPanelClass="pw-dialog"
      kickerIcon="sparkles"
      kickerLabel={t('game', 'planeswalker_choose')}
      title={<FormattedText text={prompt.title} />}
      message={<FormattedText text={prompt.message} />}
    >        {pwLoyalty != null && (
          <div className="pw-loyalty-now">{t('game', 'planeswalker_loyalty_now')} <span className="pw-loyalty-val">{pwLoyalty}</span></div>
        )}
        <div className="pw-options">
          {prompt.options.map((opt, idx) => {
            const d = deltas[idx] ?? null
            const after = pwLoyalty != null && d != null ? pwLoyalty + d : null
            return (
              <button
                key={opt.id}
                className={`pw-ability-btn ${deltaClass(d)}`}
                disabled={busy}
                onClick={() => void send(() => cmds.sendPlayerUUID(opt.value, prompt.gameId), t('errors', 'send_failed'))}
              >
                <span className="pw-delta">{deltaLabel(d)}</span>
                <span className="pw-label"><FormattedText text={opt.label} /></span>
                {after != null && <span className="pw-after">→ {after}</span>}
              </button>
            )
          })}
        </div>
        <div className="pw-hint">{t('game', 'planeswalker_hint')}</div>
    </DialogShell>
  )
}
