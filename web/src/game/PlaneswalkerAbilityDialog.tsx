import { useMemo } from 'react'
import { useStore } from '../state/store'
import * as cmds from '../net/commands'
import type { CardView } from '../net/types'
import type { FeedbackPrompt } from './feedback'
import CardSlot from '../board/CardSlot'
import FormattedText from './FormattedText'
import ArenaPromptShell from './arena/ArenaPromptShell'
import { useTranslation } from '../i18n'
import Button from '../ui/Button'
import { LoyaltyCostPlate, LoyaltyPlate } from '../board/StatPlate'
import './PlaneswalkerAbilityDialog.css'

interface PlaneswalkerAbilityDialogProps {
  prompt: FeedbackPrompt
  send: (action: () => Promise<{ ok: boolean; error?: string }>, fallback: string) => void
  cancel?: () => void
  busy: boolean
}

function deltaClass(delta: number | null): string {
  if (delta == null) return ''
  if (delta > 0) return 'delta-pos'
  if (delta < 0) return 'delta-neg'
  return 'delta-zero'
}

function nameOnlyCard(id: string, name: string): CardView {
  return { id, name, manaValue: 0, expansionSetCode: '', cardNumber: '0' } as unknown as CardView
}

export default function PlaneswalkerAbilityDialog({ prompt, send, cancel, busy }: PlaneswalkerAbilityDialogProps) {
  const { t } = useTranslation()
  const game = useStore((s) => s.game)
  const deltas = prompt.loyaltyDeltas ?? []

  const pwInfo = useMemo(() => {
    let loyalty: number | null = null
    let card: CardView | null = null
    if (game?.players) {
      for (const p of game.players) {
        for (const zone of [p.battlefield, p.exile, p.commandList].filter(Boolean) as unknown as Record<string, unknown>[]) {
          for (const v of Object.values(zone)) {
            const c = v as Record<string, unknown>
            if (c && typeof c.loyalty === 'string' && c.loyalty !== '') {
              loyalty = parseInt(String(c.loyalty), 10)
              if (!card && (!prompt.sourceName || c.name === prompt.sourceName)) {
                card = c as unknown as CardView
              }
            }
          }
        }
      }
    }
    if (!card && prompt.sourceName) card = nameOnlyCard('pw-source', prompt.sourceName)
    return { loyalty, card }
  }, [game, prompt.sourceName])

  return (
    <div className={`arena-pw${pwInfo.card ? ' has-source' : ''}`}>
      <ArenaPromptShell
        title={<FormattedText text={prompt.title} />}
        instruction={<FormattedText text={prompt.message} />}
        backdropClassName="pw-backdrop"
        dialogClassName="pw-dialog"
        onEscape={prompt.cancelable && !busy ? cancel : undefined}
        aside={pwInfo.card && <CardSlot card={pwInfo.card} cardId={pwInfo.card.id || 'pw-source'} />}
        testId="planeswalker-prompt"
        footer={
          prompt.cancelable && cancel ? (
            <div className="feedback-dialog-actions">
              <Button variant="subtle" disabled={busy} onClick={cancel} className="cancel-btn" aria-keyshortcuts="Escape">
                {t('game', 'targeting_cancel')}
              </Button>
            </div>
          ) : null
        }
      >
        <section className="arena-prompt-zone arena-pw-zone">
          {pwInfo.loyalty != null && (
            <div className="pw-loyalty-now">
              {t('game', 'planeswalker_loyalty_now')} <span className="pw-loyalty-val" aria-label={String(pwInfo.loyalty)}><LoyaltyPlate value={String(pwInfo.loyalty)} /></span>
            </div>
          )}
          <div className="pw-options">
            {prompt.options.map((opt, idx) => {
              const d = deltas[idx] ?? null
              const after = pwInfo.loyalty != null && d != null ? pwInfo.loyalty + d : null
              return (
                <button
                  type="button"
                  key={opt.id}
                  className={`pw-ability-btn ${deltaClass(d)}`}
                  disabled={busy}
                  onClick={() => void send(() => cmds.sendPlayerUUID(opt.value, prompt.gameId), t('errors', 'send_failed'))}
                >
                  {d != null && (
                    <span className="pw-delta" aria-label={d > 0 ? `+${d}` : String(d)}>
                      <LoyaltyCostPlate delta={d} />
                    </span>
                  )}
                  <span className="pw-label"><FormattedText text={opt.label} /></span>
                  {after != null && <span className="pw-after">→ {after}</span>}
                </button>
              )
            })}
          </div>
          <div className="pw-hint">{t('game', 'planeswalker_hint')}</div>
        </section>
      </ArenaPromptShell>
    </div>
  )
}
