import { useStore } from '../state/store'
import * as cmds from '../net/commands'
import type { FeedbackPrompt } from './feedback'
import FormattedText from './FormattedText'
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
    <div className="pw-backdrop" role="presentation">
      <section className="pw-dialog" role="dialog" aria-modal="true" aria-labelledby="pw-title">
        <div className="pw-kicker">✨ PLANESWALKER — ELIGE HABILIDAD</div>
        <h2 id="pw-title"><FormattedText text={prompt.title} /></h2>
        <p className="pw-msg"><FormattedText text={prompt.message} /></p>
        {pwLoyalty != null && (
          <div className="pw-loyalty-now">Lealtad actual: <span className="pw-loyalty-val">{pwLoyalty}</span></div>
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
                onClick={() => void send(() => cmds.sendPlayerUUID(opt.value, prompt.gameId), 'No se pudo activar la habilidad')}
              >
                <span className="pw-delta">{deltaLabel(d)}</span>
                <span className="pw-label"><FormattedText text={opt.label} /></span>
                {after != null && <span className="pw-after">→ {after}</span>}
              </button>
            )
          })}
        </div>
        <div className="pw-hint">Solo una habilidad de lealtad por turno. El coste se paga con contadores de lealtad.</div>
      </section>
    </div>
  )
}
