import { createContext, useContext } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { CardView } from '../net/types'
import HandBar from './HandBar'
import HandRail from './HandRail'
import HandRow from './HandRow'
import FloatingCardPreview from './FloatingCardPreview'
import FlyingCardOverlay from './FlyingCardOverlay'
import type { BoardPresenter } from './useBoardPresenter'
import { useStore, useSettings, isMulliganDecision } from '../state/store'
import { useChromeActions } from '../game/chromeActions'
import './BoardShell.css'

export interface BoardShellProps {
  /** Clase de layout del modo (game-board / pod-board / arena-board). */
  className: string
  testId?: string
  presenter: BoardPresenter
  /** Barra de mano flotante; null/undefined en espectador. */
  handBar?: {
    cards: Record<string, CardView>
    onCardClick?: (id: string) => void
    onHover?: (card: CardView | null, rect?: DOMRect) => void
    playableIds?: Set<string>
    targetIds?: Set<string>
  } | null
  style?: CSSProperties
  children: ReactNode
}

export const DividerSlotContext = createContext<((el: HTMLElement | null) => void) | null>(null)

/** Publishes the slot above the own hand where hand prompts (mulligan) are
 *  portaled; the game screen owns the element state. */
export const HandPromptSlotContext = createContext<((el: HTMLElement | null) => void) | null>(null)

/** Divisor horizontal unificado (diamante púrpura/dorado) compartido por los
 *  tres modos. `labels` añade las etiquetas flanking del pod. Si la pantalla de
 *  juego publica un hueco (`DividerSlotContext`), el divisor pasa a ser la
 *  franja de control (turno, fases, iconos) y se pinta ahí por portal. */
export function BoardDivider({ labels = false }: { labels?: boolean }) {
  const setSlot = useContext(DividerSlotContext)
  const cls = ['board-shell-divider', labels && !setSlot ? 'with-labels' : '', setSlot ? 'has-strip' : ''].filter(Boolean).join(' ')
  return (
    <div className={cls} ref={setSlot ?? undefined}>
      <span className="board-shell-divider-diamond">◆</span>
    </div>
  )
}

/** Separador vertical de columnas unificado. */
export function BoardColDivider() {
  return <div className="board-shell-col-divider" />
}

/** Marco común de los tableros: tapete, montaje de HandBar y de las capas
 *  flotantes (preview + vuelos). El layout específico va en `children`. */
export default function BoardShell({ className, testId, presenter, handBar = null, style, children }: BoardShellProps) {
  const setHandPromptSlot = useContext(HandPromptSlotContext)
  const raised = useStore((s) => isMulliganDecision(s.feedback))
  const { handRail, handRailWidth, handRow } = useSettings()
  const sidePanelOpen = useChromeActions()?.sidePanelOpen ?? false
  const railed = handRail && !!handBar && !raised && !sidePanelOpen
  const rowed = handRow && !handRail && !!handBar && !raised
  return (
    <div className={`board-shell board-surface ${className}${railed ? ' has-hand-rail' : ''}`} data-testid={testId} ref={presenter.boardRef} style={railed ? ({ ...style, '--hand-rail-w': `${handRailWidth}px` } as CSSProperties) : style}>
      {children}
      {railed && handBar && (
        <HandRail
          cards={handBar.cards}
          onCardClick={handBar.onCardClick}
          playableIds={handBar.playableIds}
          targetIds={handBar.targetIds}
        />
      )}
      {handBar && !railed && !rowed && (
        <HandBar
          cards={handBar.cards}
          onCardClick={handBar.onCardClick}
          onHover={handBar.onHover}
          playableIds={handBar.playableIds}
          targetIds={handBar.targetIds}
          raised={raised}
          promptSlotRef={setHandPromptSlot ?? undefined}
        />
      )}
      {rowed && handBar && (
        <HandRow
          cards={handBar.cards}
          onCardClick={handBar.onCardClick}
          playableIds={handBar.playableIds}
          targetIds={handBar.targetIds}
        />
      )}
      <FloatingCardPreview
        card={presenter.floatingCard}
        anchorRect={presenter.anchorRect}
        boardRect={presenter.boardRef.current?.getBoundingClientRect() ?? null}
        leaving={presenter.previewLeaving}
      />
      <FlyingCardOverlay />
    </div>
  )
}
