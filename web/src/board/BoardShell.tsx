import { createContext, useContext } from 'react'
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
    onHover?: (card: CardView | null, rect?: DOMRect) => void
    playableIds?: Set<string>
    targetIds?: Set<string>
  } | null
  children: ReactNode
}

export const DividerSlotContext = createContext<((el: HTMLElement | null) => void) | null>(null)

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
export default function BoardShell({ className, testId, presenter, handBar = null, children }: BoardShellProps) {
  return (
    <div className={`board-shell ${className}`} data-testid={testId} ref={presenter.boardRef}>
      {children}
      {handBar && (
        <HandBar
          cards={handBar.cards}
          onCardClick={handBar.onCardClick}
          onHover={handBar.onHover}
          playableIds={handBar.playableIds}
          targetIds={handBar.targetIds}
        />
      )}
      <FloatingCardPreview
        card={presenter.floatingCard}
        anchorRect={presenter.anchorRect}
        boardRect={presenter.boardRef.current?.getBoundingClientRect() ?? null}
        leaving={presenter.previewLeaving}
        fromHand={presenter.previewFromHand}
      />
      <FlyingCardOverlay />
    </div>
  )
}
