import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import type { GameView } from '../net/types'
import type { PhaseStops } from '../net/commands'
import { useTranslation } from '../i18n'
import { setSetting, useStore } from '../state/store'
import { seatColorVar, seatIndexOf } from '../board/seatColor'
import { LADDER, ladderIndex, shownTurn, type LadderStep } from './ladderSteps'
import { PhaseGlyph } from './PhaseGlyph'
import { togglePhaseStop, type PhaseTurn } from './phaseStops'
import { useChangeFlag } from './useChangeFlag'
import './PhaseLadder.css'

const BIG = 28
const SMALL = 20
const FLYOUT = 19
const LONG_PRESS_MS = 450

const COMBAT = LADDER.filter((s) => s.group === 'combat')
const COMBAT_STOP_KEYS = COMBAT.flatMap((s) => (s.stopKey ? [s.stopKey] : []))
const FIRST_COMBAT = LADDER.indexOf(COMBAT[0])
const LAST_COMBAT = LADDER.indexOf(COMBAT[COMBAT.length - 1])
const MAIN_SLOTS = LADDER.length - COMBAT.length + 1

function hasStop(stops: PhaseStops | undefined, turn: PhaseTurn | null, keys: string[]): boolean {
  return !!(turn && stops && keys.some((k) => stops[turn]?.[k]))
}

function mainSlotIndex(current: number): number {
  if (current < 0) return -1
  if (current < FIRST_COMBAT) return current
  if (current <= LAST_COMBAT) return FIRST_COMBAT
  return FIRST_COMBAT + (current - LAST_COMBAT)
}

function Marks({ shown, other }: { shown: boolean; other: boolean }) {
  return (
    <>
      {shown && <span className="ladder-stop-notch" aria-hidden="true" />}
      {other && <span className="ladder-stop-dot" aria-hidden="true" />}
    </>
  )
}

interface TipInfo {
  name: string
  keys: string[]
  configurable: boolean
  inFlyout: boolean
}

export default function PhaseLadder({ game }: { game: GameView | null }) {
  const { t } = useTranslation()
  const phaseStops = useStore((s) => s.settings.phaseStops)
  const smartStops = useStore((s) => s.settings.smartStops)
  const step = game?.step ?? ''
  const [sweeping, clearSweep] = useChangeFlag(step)
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [tip, setTip] = useState<TipInfo | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressed = useRef(false)

  useEffect(() => {
    if (!pinned) return
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPinned(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPinned(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [pinned])

  useEffect(() => () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current)
  }, [])

  if (!game) return null

  const current = ladderIndex(step)
  const slot = mainSlotIndex(current)
  const progressPct = slot < 0 ? 0 : (slot / (MAIN_SLOTS - 1)) * 100
  const turn = shownTurn(game)
  const other: PhaseTurn | null = turn === 'yourTurn' ? 'opponentTurn' : turn === 'opponentTurn' ? 'yourTurn' : null
  const activeSeat = seatIndexOf(game.players, game.activePlayerId ?? undefined)
  const tint = seatColorVar(activeSeat)
  const yourTint = seatColorVar(0)
  const oppSeat = activeSeat === 0 ? 1 : activeSeat
  const oppTint = seatColorVar(oppSeat)
  const otherTint = turn === 'yourTurn' ? oppTint : turn === 'opponentTurn' ? yourTint : 'var(--fg-2)'
  const inCombat = current >= FIRST_COMBAT && current <= LAST_COMBAT
  const combatOpen = hover || pinned || inCombat
  const combatDocked = inCombat || pinned

  const toggle = (which: PhaseTurn | null, stopKey: string | undefined, e?: MouseEvent) => {
    e?.preventDefault()
    if (!which || !stopKey || !phaseStops) return
    setSetting('phaseStops', togglePhaseStop(phaseStops, which, stopKey))
  }

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const startLongPress = (stopKey: string | undefined) => {
    cancelLongPress()
    longPressed.current = false
    if (!other || !stopKey || !phaseStops) return
    longPressTimer.current = setTimeout(() => {
      longPressed.current = true
      setSetting('phaseStops', togglePhaseStop(phaseStops, other, stopKey))
    }, LONG_PRESS_MS)
  }

  const yesNo = (on: boolean) => t('common', on ? 'yes' : 'no')

  const stepButton = (s: LadderStep, size: number, inFlyout = false) => {
    const index = LADDER.indexOf(s)
    const isCurrent = index === current
    const keys = s.stopKey ? [s.stopKey] : []
    const configurable = keys.length > 0
    const name = t('game', s.nameKey)
    const shownOn = hasStop(phaseStops, turn, keys)
    const otherOn = hasStop(phaseStops, other, keys)
    const label = configurable && phaseStops
      ? `${name} — ${t('game', 'your_turn')}: ${yesNo(!!phaseStops.yourTurn?.[s.stopKey!])}, ${t('game', 'opponent_turn')}: ${yesNo(!!phaseStops.opponentTurn?.[s.stopKey!])}`
      : name
    const cls = [
      'ladder-step',
      s.big ? 'is-big' : '',
      !configurable ? 'is-static' : '',
      current >= 0 && index < current ? 'is-past' : '',
      isCurrent ? 'is-current' : '',
      isCurrent && sweeping ? 'is-sweeping' : '',
    ].filter(Boolean).join(' ')
    const tipData: TipInfo = { name, keys, configurable, inFlyout }
    return (
      <button
        type="button"
        key={s.key}
        className={cls}
        data-testid={`phase-ladder-step-${s.key}`}
        aria-label={label}
        aria-current={isCurrent ? 'step' : undefined}
        aria-pressed={configurable && turn ? shownOn : undefined}
        aria-disabled={!configurable || !turn || undefined}
        disabled={!turn}
        onClick={(e) => {
          if (longPressed.current) {
            longPressed.current = false
            return
          }
          toggle(turn, s.stopKey, e)
        }}
        onContextMenu={(e) => toggle(other, s.stopKey, e)}
        onTouchStart={configurable ? () => startLongPress(s.stopKey) : undefined}
        onTouchEnd={configurable ? cancelLongPress : undefined}
        onTouchCancel={configurable ? cancelLongPress : undefined}
        onTouchMove={configurable ? cancelLongPress : undefined}
        onMouseEnter={() => setTip(tipData)}
        onMouseLeave={() => setTip((prev) => (prev?.name === name ? null : prev))}
        onFocus={() => setTip(tipData)}
        onBlur={() => setTip((prev) => (prev?.name === name ? null : prev))}
        onAnimationEnd={isCurrent && sweeping ? clearSweep : undefined}
      >
        <PhaseGlyph glyph={s.glyph} size={size} />
        <Marks shown={shownOn} other={otherOn} />
      </button>
    )
  }

  const combatName = t('game', 'phase_combat')
  const combatTip: TipInfo = { name: combatName, keys: COMBAT_STOP_KEYS, configurable: true, inFlyout: false }

  const tipYourOn = tip && tip.keys.length > 0 ? hasStop(phaseStops, 'yourTurn', tip.keys) : false
  const tipOppOn = tip && tip.keys.length > 0 ? hasStop(phaseStops, 'opponentTurn', tip.keys) : false

  return (
    <div
      ref={wrapRef}
      className={`phase-ladder-wrap${combatDocked ? ' has-combat-docked' : ''}`}
      style={{
        '--ladder-tint': tint,
        '--ladder-other-tint': otherTint,
        '--ladder-your-tint': yourTint,
        '--ladder-opp-tint': oppTint,
        '--ladder-progress': `${progressPct}%`,
      } as CSSProperties}
    >
      {tip && (
        <div
          className={`ladder-tooltip${combatOpen ? ' is-above-flyout' : ''}`}
          role="tooltip"
          data-testid="phase-ladder-tooltip"
        >
          <div className="ladder-tooltip-title">{tip.name}</div>
          {tip.configurable && turn ? (
            <>
              <div className="ladder-tooltip-stops">
                <span className={`ladder-tooltip-turn${tipYourOn ? ' is-on' : ''}`}>
                  <span className="ladder-tooltip-swatch is-yours" aria-hidden="true" />
                  {t('game', 'phase_you')}: {yesNo(tipYourOn)}
                </span>
                <span className={`ladder-tooltip-turn${tipOppOn ? ' is-on' : ''}`}>
                  <span className="ladder-tooltip-swatch is-opp" aria-hidden="true" />
                  {t('game', 'phase_opp')}: {yesNo(tipOppOn)}
                </span>
              </div>
              <div className="ladder-tooltip-hint">
                {smartStops ? t('game', 'phase_stop_smart_hint') : t('game', 'phase_stop_hint')}
              </div>
            </>
          ) : !tip.configurable ? (
            <div className="ladder-tooltip-hint">{t('game', 'phase_stop_auto')}</div>
          ) : null}
        </div>
      )}
      <div
        className="phase-ladder"
        data-testid="phase-ladder"
        data-shown-turn={turn ?? undefined}
        role="toolbar"
        aria-label={t('game', 'phase')}
      >
        <span className="ladder-rail" aria-hidden="true">
          <span className="ladder-rail-fill" />
        </span>
        {LADDER.slice(0, FIRST_COMBAT).map((s) => stepButton(s, s.big ? BIG : SMALL))}
        <span
          className={`ladder-combat${combatOpen ? ' is-open' : ''}${pinned ? ' is-pinned' : ''}`}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onFocus={() => setHover(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setHover(false)
          }}
        >
          <span className="ladder-flyout" data-testid="phase-ladder-combat-steps" role="group" aria-label={combatName}>
            {COMBAT.map((s) => stepButton(s, FLYOUT, true))}
          </span>
          <button
            type="button"
            className={[
              'ladder-step',
              'ladder-combat-toggle',
              current > LAST_COMBAT ? 'is-past' : '',
              inCombat ? 'is-current' : '',
              pinned ? 'is-pinned' : '',
            ].filter(Boolean).join(' ')}
            data-testid="phase-ladder-step-COMBAT"
            aria-label={combatName}
            aria-expanded={combatOpen}
            aria-pressed={pinned}
            disabled={!turn}
            onClick={() => setPinned((p) => !p)}
            onContextMenu={(e) => e.preventDefault()}
            onMouseEnter={() => setTip(combatTip)}
            onMouseLeave={() => setTip((prev) => (prev?.name === combatName ? null : prev))}
            onFocus={() => setTip(combatTip)}
            onBlur={() => setTip((prev) => (prev?.name === combatName ? null : prev))}
          >
            <PhaseGlyph glyph="combat" size={SMALL} />
            <Marks shown={hasStop(phaseStops, turn, COMBAT_STOP_KEYS)} other={hasStop(phaseStops, other, COMBAT_STOP_KEYS)} />
          </button>
        </span>
        {LADDER.slice(LAST_COMBAT + 1).map((s) => stepButton(s, s.big ? BIG : SMALL))}
      </div>
    </div>
  )
}
