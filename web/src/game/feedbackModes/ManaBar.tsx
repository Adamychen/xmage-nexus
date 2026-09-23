import { useEffect, useRef, useState } from 'react'
import * as cmds from '../../net/commands'
import { setStoreError, useSettings, useStore } from '../../state/store'
import FormattedText from '../FormattedText'
import Icon from '../../ui/Icon'
import ManaPoolView, { type ManaPoolKey } from '../ManaPoolView'
import { useTranslation } from '../../i18n'
import { localizeServerMessage } from '../serverMessageTranslation'
import type { UseFeedbackForm } from '../useFeedbackForm'
import type { FeedbackPrompt } from '../feedback'
import { nextSmartManaAction, parseRemainingManaCost } from '../smartManaPayment'
import Button from '../../ui/Button'
import { DockPrompt } from '../GameDock'
import './promptBars.css'

const POOL_COLORS: ManaPoolKey[] = ['white', 'blue', 'black', 'red', 'green', 'colorless']

/** Maná disponible en la reserva del jugador controlado para pagar desde el pool. */
function poolOf(game: { players?: unknown[] | null } | null): Record<ManaPoolKey, number> {
  const players = (game?.players ?? []) as { controlled?: boolean; manaPool?: Record<string, number> }[]
  const me = players.find((p) => p.controlled)
  const pool = (me?.manaPool ?? {}) as Record<string, number>
  const res = {} as Record<ManaPoolKey, number>
  for (const color of POOL_COLORS) res[color] = pool[color] ?? 0
  return res
}

export default function ManaBar({ form }: { form: UseFeedbackForm }) {
  const { t } = useTranslation()
  const game = useStore((s) => s.game)
  const { prompt, busy, send, cancel } = form
  const smart = useSettings().manaPayment.smart
  const lastHandledRef = useRef<FeedbackPrompt | null>(null)
  const expectedUnitsRef = useRef<number | null>(null)
  const givenUpRef = useRef(false)
  const inFlightRef = useRef(false)
  const [autoTick, setAutoTick] = useState(0)

  useEffect(() => {
    if (!prompt || prompt.mode !== 'mana') {
      lastHandledRef.current = null
      expectedUnitsRef.current = null
      givenUpRef.current = false
      return
    }
    if (!smart || !game || busy || inFlightRef.current) return
    if (lastHandledRef.current === prompt || givenUpRef.current) return
    const cost = parseRemainingManaCost(prompt.message)
    const units = cost.generic + cost.pips.length
    if (expectedUnitsRef.current !== null && expectedUnitsRef.current !== units) {
      givenUpRef.current = true
      return
    }
    const action = nextSmartManaAction(game, prompt.message, poolOf(game))
    if (!action || (action.kind === 'payPool' && !prompt.playerId)) {
      givenUpRef.current = true
      return
    }
    lastHandledRef.current = prompt
    expectedUnitsRef.current = units - 1
    inFlightRef.current = true
    const fallback = t('errors', 'send_failed_mana')
    const request =
      action.kind === 'payPool'
        ? cmds.sendPlayerManaType(prompt.gameId, prompt.playerId as string, action.color.toUpperCase())
        : cmds.sendPlayerUUID(action.id, prompt.gameId)
    void request
      .then((result) => {
        if (result.ok) return
        givenUpRef.current = true
        setStoreError(result.error ?? fallback)
      })
      .catch((error) => {
        givenUpRef.current = true
        setStoreError(error instanceof Error ? error.message : fallback)
      })
      .finally(() => {
        inFlightRef.current = false
        setAutoTick((n) => n + 1)
      })
  }, [prompt, game, busy, smart, autoTick])

  if (!prompt) return null
  const localizedManaMsg = localizeServerMessage(prompt.message, t as any)
  return (
    <DockPrompt>
      <div className="action-prompt-bar mana-prompt-bar">
        <div className="action-prompt-info">
          <span className="action-prompt-title">
            <span className="action-prompt-icon" aria-hidden="true"><Icon name="zap" size={14} /></span>{' '}
            {t('game', 'pay_mana')}
          </span>
          <span className="action-prompt-msg">
            <FormattedText text={localizedManaMsg} />
          </span>
          <span className="action-prompt-hint" role="status" aria-live="polite">{t('game', 'mana_hint')}</span>
        </div>
        <div className="action-prompt-actions">
          {prompt.playerId && (
            <ManaPoolView
              pool={poolOf(game)}
              size={18}
              canPay={!busy}
              onPay={(key) => void send(() => cmds.sendPlayerManaType(prompt.gameId, prompt.playerId as string, key.toUpperCase()), t('errors', 'send_failed_mana'))}
            />
          )}
          <Button disabled={busy} onClick={() => void send(() => cmds.sendPlayerString('special', prompt.gameId), t('errors', 'send_failed_special'))}>
            {t('game', 'mana_special')}
          </Button>
          <Button variant="subtle" disabled={busy} onClick={cancel} className="cancel-btn">
            {t('game', 'targeting_cancel')}
          </Button>
        </div>
      </div>
    </DockPrompt>
  )
}
