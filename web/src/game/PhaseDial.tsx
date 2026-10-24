import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from '../i18n'
import IconButton from '../ui/IconButton'
import { DIAL_PHASES, activeDialIndex, usePhaseStopToggles } from './phaseSteps'
import './PhaseDial.css'

export const DIAL_CORE = 164
const CORE_RING = 5
const PIP = 38
const PIP_REACH = 23
const PIP_GAP = 18
const RADIUS = DIAL_CORE / 2 + CORE_RING + PIP / 2 + PIP_GAP
const ARC_START = 192
const ARC_END = 348

function pipAngle(index: number, count: number): number {
  return ((ARC_START + ((ARC_END - ARC_START) * index) / Math.max(1, count - 1)) * Math.PI) / 180
}

const PIP_ANGLES = DIAL_PHASES.map((_, i) => pipAngle(i, DIAL_PHASES.length))
const CENTER_X = Math.ceil(RADIUS * Math.max(...PIP_ANGLES.map((a) => Math.abs(Math.cos(a)))) + PIP_REACH)
const CENTER_Y = Math.ceil(RADIUS * Math.max(...PIP_ANGLES.map((a) => -Math.sin(a))) + PIP_REACH)
const WIDTH = CENTER_X * 2
const HEIGHT = CENTER_Y + DIAL_CORE / 2 + CORE_RING

export function dialPipPoint(index: number, count: number): { x: number; y: number } {
  const angle = pipAngle(index, count)
  return { x: CENTER_X + RADIUS * Math.cos(angle), y: CENTER_Y + RADIUS * Math.sin(angle) }
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

  return (
    <div
      className={`phase-dial${mine ? ' is-mine' : ''}`}
      data-testid="phase-dial"
      style={{ '--dial-w': `${WIDTH}px`, '--dial-h': `${HEIGHT}px`, '--dial-cx': `${CENTER_X}px`, '--dial-cy': `${CENTER_Y}px`, '--dial-core': `${DIAL_CORE}px` } as CSSProperties}
      role="navigation"
      aria-label={t('game', 'phase')}
    >
      <svg className="phase-dial-arc" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
        <path d={`M${first.x},${first.y} A${RADIUS},${RADIUS} 0 0 1 ${last.x},${last.y}`} />
      </svg>
      {DIAL_PHASES.map((s, i) => {
        const p = dialPipPoint(i, DIAL_PHASES.length)
        const hasYourStop = s.stopKeys.some((k) => !!phaseStops?.yourTurn?.[k])
        const hasOppStop = s.stopKeys.some((k) => !!phaseStops?.opponentTurn?.[k])
        const stateClass = i < activeIdx ? ' past' : i === activeIdx ? ' active' : ''
        const name = t('game', s.nameKey)
        const onLabel = t('common', 'yes')
        const offLabel = t('common', 'no')
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
      <div className="phase-dial-core">{action}</div>
    </div>
  )
}
