import type { ReactNode } from 'react'
import type { CardView } from '../net/types'
import HandBar from './HandBar'
import FloatingCardPreview from './FloatingCardPreview'
import FlyingCardOverlay from './FlyingCardOverlay'
import type { BoardPresenter } from './useBoardPresenter'
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
    playableIds?: Set<string>
    targetIds?: Set<string>
  } | null
  children: ReactNode
}

/** Divisor horizontal unificado (diamante púrpura/dorado) compartido por los
 *  tres modos. `labels` añade las etiquetas flanking del pod. */
export function BoardDivider({ labels = false }: { labels?: boolean }) {
  return (
    <div className={`board-shell-divider ${labels ? 'with-labels' : ''}`}>
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
export default function BoardShell({ className, testId, presenter, handBar = null, children }: BoardShellProps) {
  return (
    <div className={`board-shell ${className}`} data-testid={testId} ref={presenter.boardRef}>
      {children}
      {handBar && (
        <HandBar
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
      />
      <FlyingCardOverlay />
    </div>
  )
}
