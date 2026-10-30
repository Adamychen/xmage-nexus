import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from '../i18n'
import IconButton from '../ui/IconButton'
import { DIAL_COMBAT_STEPS, DIAL_PHASES, activeCombatIndex, activeDialIndex, usePhaseStopToggles } from './phaseSteps'
import './PhaseDial.css'

export const DIAL_CORE = 164
const CORE_RING = 5
const PIP = 38
const PIP_REACH = 23
const PIP_GAP = 18
const RADIUS = DIAL_CORE / 2 + CORE_RING + PIP / 2 + PIP_GAP
const ARC_START = 192
const ARC_END = 348
const SAT = 26
const SAT_REACH = SAT / 2 + 4
const SAT_GAP = 8
const SAT_EDGE_GAP = 5
const SAT_RADIUS = RADIUS + PIP / 2 + SAT_GAP + SAT / 2
const SAT_STEP = 2 * Math.asin((SAT + SAT_EDGE_GAP) / (2 * SAT_RADIUS))
const COMBAT_PIP = DIAL_PHASES.findIndex((p) => p.key === 'COMBAT')

function pipAngle(index: number, count: number): number {
  return ((ARC_START + ((ARC_END - ARC_START) * index) / Math.max(1, count - 1)) * Math.PI) / 180
}

function satAngle(index: number): number {
  return pipAngle(COMBAT_PIP, DIAL_PHASES.length) + (index - (DIAL_COMBAT_STEPS.length - 1) / 2) * SAT_STEP
}

const PIP_ANGLES = DIAL_PHASES.map((_, i) => pipAngle(i, DIAL_PHASES.length))
const SAT_ANGLES = DIAL_COMBAT_STEPS.map((_, i) => satAngle(i))
const REACH = [
  ...PIP_ANGLES.map((a) => ({ x: RADIUS * Math.cos(a), y: RADIUS * Math.sin(a), reach: PIP_REACH })),
  ...SAT_ANGLES.map((a) => ({ x: SAT_RADIUS * Math.cos(a), y: SAT_RADIUS * Math.sin(a), reach: SAT_REACH })),
]
const CENTER_X = Math.ceil(Math.max(...REACH.map((r) => Math.abs(r.x) + r.reach)))
const CENTER_Y = Math.ceil(Math.max(...REACH.map((r) => -r.y + r.reach)))
const WIDTH = CENTER_X * 2
const HEIGHT = CENTER_Y + DIAL_CORE / 2 + CORE_RING

export function dialPipPoint(index: number, count: number): { x: number; y: number } {
  const angle = pipAngle(index, count)
  return { x: CENTER_X + RADIUS * Math.cos(angle), y: CENTER_Y + RADIUS * Math.sin(angle) }
}

export function dialSatPoint(index: number): { x: number; y: number } {
  const angle = satAngle(index)
  return { x: CENTER_X + SAT_RADIUS * Math.cos(angle), y: CENTER_Y + SAT_RADIUS * Math.sin(angle) }
}

interface PhaseDialProps {
  step: string
  action: ReactNode
  mine?: boolean
}

export default function PhaseDial({ step, action, mine = false }: PhaseDialProps) {
  const { t } = useTranslation()
  const activeIdx = activeDialIndex(step)
  const { phaseStops, toggleStop, toggleOpponentStop } = usePhaseStopToggles()
  const first = dialPipPoint(0, DIAL_PHASES.length)
  const last = dialPipPoint(DIAL_PHASES.length - 1, DIAL_PHASES.length)
  const combatIdx = activeCombatIndex(step)
  const onLabel = t('common', 'yes')
  const offLabel = t('common', 'no')
  const phaseName = combatIdx < 0
    ? t('game', DIAL_PHASES[activeIdx].nameKey)
    : `${t('game', 'phase_combat')} · ${t('game', DIAL_COMBAT_STEPS[combatIdx].nameKey)}`

  return (
    <div
      className={`phase-dial${mine ? ' is-mine' : ''}`}
      data-testid="phase-dial"
      style={{ '--dial-w': `${WIDTH}px`, '--dial-h': `${HEIGHT}px`, '--dial-cx': `${CENTER_X}px`, '--dial-cy': `${CENTER_Y}px`, '--dial-core': `${DIAL_CORE}px` } as CSSProperties}
      role="navigation"
      aria-label={t('game', 'phase')}
    >
      <span className="phase-dial-name" data-testid="phase-dial-name" aria-hidden="true">{phaseName}</span>
      <svg className="phase-dial-arc" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
        <path d={`M${first.x},${first.y} A${RADIUS},${RADIUS} 0 0 1 ${last.x},${last.y}`} />
      </svg>
      {DIAL_PHASES.map((s, i) => {
        const p = dialPipPoint(i, DIAL_PHASES.length)
        const hasYourStop = s.stopKeys.some((k) => !!phaseStops?.yourTurn?.[k])
        const hasOppStop = s.stopKeys.some((k) => !!phaseStops?.opponentTurn?.[k])
        const stateClass = i < activeIdx ? ' past' : i === activeIdx ? ' active' : ''
        const name = t('game', s.nameKey)
        return (
          <IconButton
            key={s.key}
            label={name}
            variant="ghost"
            size="xs"
            round
            className={`phase-dial-pip${stateClass}${hasYourStop || hasOppStop ? ' has-stop' : ''}`}
            style={{ left: p.x, top: p.y }}
            data-testid={`phase-bar-step-${s.key}`}
            data-active={i === activeIdx ? 'true' : undefined}
            title={`${name} (${t('game', 'you')}: ${hasYourStop ? onLabel : offLabel}, ${t('game', 'opponent')}: ${hasOppStop ? onLabel : offLabel})`}
            aria-current={i === activeIdx ? 'step' : undefined}
            onClick={(e) => toggleStop(s.stopKeys, e)}
            onContextMenu={(e) => {
              e.preventDefault()
              toggleOpponentStop(s.stopKeys)
            }}
          >
            {hasOppStop && <span className="stop-dot stop-dot-opp" />}
            <span className="phase-dial-pip-label">{s.label}</span>
            {hasYourStop && <span className="stop-dot stop-dot-you" />}
          </IconButton>
        )
      })}
      {DIAL_COMBAT_STEPS.map((s, i) => {
        const p = dialSatPoint(i)
        const name = t('game', s.nameKey)
        const stopKey = s.stopKey
        const hasYourStop = !!stopKey && !!phaseStops?.yourTurn?.[stopKey]
        const hasOppStop = !!stopKey && !!phaseStops?.opponentTurn?.[stopKey]
        const stateClass = combatIdx < 0
          ? activeIdx > COMBAT_PIP ? ' past' : ''
          : i === combatIdx ? ' active' : i < combatIdx ? ' past' : ''
        const className = `phase-dial-sat${stateClass}`
        const style = { left: p.x, top: p.y }
        const current = i === combatIdx ? 'step' : undefined
        if (!stopKey) {
          return (
            <span
              key={s.key}
              role="img"
              aria-label={name}
              title={name}
              aria-current={current}
              className={className}
              style={style}
              data-testid={`phase-dial-sat-${s.key}`}
            >
              <span className="phase-dial-sat-label">{s.label}</span>
            </span>
          )
        }
        return (
          <IconButton
            key={s.key}
            label={name}
            variant="ghost"
            size="xs"
            round
            title={`${name} (${t('game', 'you')}: ${hasYourStop ? onLabel : offLabel}, ${t('game', 'opponent')}: ${hasOppStop ? onLabel : offLabel})`}
            aria-current={current}
            className={className}
            style={style}
            data-testid={`phase-dial-sat-${s.key}`}
            onClick={(e) => toggleStop([stopKey], e)}
            onContextMenu={(e) => {
              e.preventDefault()
              toggleOpponentStop([stopKey])
            }}
          >
            <span className="phase-dial-sat-label">{s.label}</span>
            {hasOppStop && <span className="stop-dot stop-dot-opp" />}
            {hasYourStop && <span className="stop-dot stop-dot-you" />}
          </IconButton>
        )
      })}
      <div className="phase-dial-core">{action}</div>
    </div>
  )
}
