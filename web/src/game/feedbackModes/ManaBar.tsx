import { useEffect, useRef, useState } from 'react'
import * as cmds from '../../net/commands'
import { setStoreError, useSettings, useStore } from '../../state/store'
import FormattedText from '../FormattedText'
import ManaPoolView, { type ManaPoolKey } from '../ManaPoolView'
import Icon from '../../ui/Icon'
import { useTranslation, dynamicT } from '../../i18n'
import { localizeServerMessage } from '../serverMessageTranslation'
import type { UseFeedbackForm } from '../useFeedbackForm'
import type { FeedbackPrompt } from '../feedback'
import { nextSmartManaAction, parseRemainingManaCost } from '../smartManaPayment'
import { DockPrompt, OrderPrompt, PromptAction } from '../GameDock'
import { usePromptCancelKey } from '../usePromptCancelKey'
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
  usePromptCancelKey(prompt && !busy ? cancel : null)

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
  const localizedManaMsg = localizeServerMessage(prompt.message, dynamicT(t))
  const hasFloating = Object.values(poolOf(game)).some((n) => n > 0)
  return (
    <>
    <OrderPrompt>
      <span className="board-order" data-testid="board-order">
        <FormattedText text={localizedManaMsg} />
      </span>
    </OrderPrompt>
    <PromptAction>
      {/* PRM-19: salir del pago es la acción que responde a este mensaje, y va donde el jugador ya
          mira para actuar: el sitio del botón de prioridad. */}
      <button
        type="button"
        className="prompt-action-btn is-leave"
        data-testid="prompt-action"
        disabled={busy}
        onClick={cancel}
        aria-keyshortcuts="Escape"
      >
        <span className="prompt-action-icon" aria-hidden="true"><Icon name="x" size={15} /></span>
        <span className="prompt-action-label">{t('game', 'targeting_cancel')}</span>
      </button>
    </PromptAction>
    <DockPrompt>
      <div className="action-prompt-bar mana-prompt-bar">
        <div className="action-prompt-actions">
          {/* PRM-19: la reserva solo aparece cuando hay maná flotante que gastar; vacía era un
              guion suelto encima de los botones. */}
          {prompt.playerId && hasFloating && (
            <ManaPoolView
              pool={poolOf(game)}
              size={18}
              canPay={!busy}
              onPay={(key) => void send(() => cmds.sendPlayerManaType(prompt.gameId, prompt.playerId as string, key.toUpperCase()), t('errors', 'send_failed_mana'))}
            />
          )}
          <button
            type="button"
            className="prompt-second-btn"
            data-testid="prompt-second"
            disabled={busy}
            onClick={() => void send(() => cmds.sendPlayerString('special', prompt.gameId), t('errors', 'send_failed_special'))}
          >
            {t('game', 'mana_special')}
          </button>
        </div>
      </div>
    </DockPrompt>
    </>
  )
}
