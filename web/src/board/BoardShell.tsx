import { createContext, useContext } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { CardView } from '../net/types'
import HandBar from './HandBar'
import type { HandTrailingCard } from './handCommander'
import HandRail from './HandRail'
import HandRow from './HandRow'
import FloatingCardPreview from './FloatingCardPreview'
import FlyingCardOverlay from './FlyingCardOverlay'
import type { BoardPresenter } from './useBoardPresenter'
import { BoardLayoutProvider } from './layout/BoardLayoutProvider'
import { useOpeningHandHeld } from './openingHand'
import type { BoardLayoutKind } from './layout/solveBoardLayout'
import { useStore, useSettings, isMulliganDecision } from '../state/store'
import { useChromeActions } from '../game/chromeActions'
import './BoardShell.css'

export interface BoardShellProps {
  /** The mode's layout class (game-board / arena-board). */
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
    /** BRD-32: cards drawn apart at the end of the fan (the own commander). */
    trailing?: HandTrailingCard[]
    onTrailingClick?: (id: string) => void
  } | null
  style?: CSSProperties
  layout?: BoardLayoutKind
  /** BRD-3: no opponent's cards are larger than the own board's. */
  opponentsCappedByOwn?: boolean
  children: ReactNode
}

const NO_CARDS: Record<string, CardView> = {}
const NO_TRAILING: HandTrailingCard[] = []

export const DividerSlotContext = createContext<((el: HTMLElement | null) => void) | null>(null)

/** Publishes the slot above the own hand where hand prompts (mulligan) are
 *  portaled; the game screen owns the element state. */
export const HandPromptSlotContext = createContext<((el: HTMLElement | null) => void) | null>(null)

/** Floating top row that hosts the game control strip (turn badge, turn order
 *  ring, log/chat/drawer/menu) above every board without a divider line. */
export function BoardTopStrip() {
  const setSlot = useContext(DividerSlotContext)
  return (
    <div
      className={`board-shell-top-strip${setSlot ? ' has-strip' : ''}`}
      data-testid="board-top-strip"
      ref={setSlot ?? undefined}
    />
  )
}

/** Divisor horizontal unificado (diamante púrpura/dorado) entre rivales y tu
 *  lado. `labels` añade las etiquetas flanking del pod. */
export function BoardDivider({ labels = false }: { labels?: boolean }) {
  const cls = ['board-shell-divider', labels ? 'with-labels' : ''].filter(Boolean).join(' ')
  return (
    <div className={cls}>
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
export default function BoardShell({ className, testId, presenter, handBar = null, style, layout = 'standard', opponentsCappedByOwn = false, children }: BoardShellProps) {
  const setHandPromptSlot = useContext(HandPromptSlotContext)
  const raised = useStore((s) => isMulliganDecision(s.feedback))
  // HND-14: the pre-game deals the cards before it asks about them, so the bar holds them back
  // until the opening-hand decision is on screen.
  const held = useOpeningHandHeld()
  const hand = handBar && held ? { ...handBar, cards: NO_CARDS, trailing: NO_TRAILING } : handBar
  const { handRail, handRailWidth, handRow } = useSettings()
  const sidePanelOpen = useChromeActions()?.sidePanelOpen ?? false
  const railed = handRail && !!handBar && !raised && !sidePanelOpen
  const rowed = handRow && !handRail && !!handBar && !raised
  return (
    <BoardLayoutProvider boardRef={presenter.boardRef} layout={layout} opponentsCappedByOwn={opponentsCappedByOwn}>
    <div className={`board-shell board-surface ${className}${railed ? ' has-hand-rail' : ''}`} data-testid={testId} ref={presenter.boardRef} style={railed ? ({ ...style, '--hand-rail-w': `${handRailWidth}px` } as CSSProperties) : style}>
      {children}
      {railed && hand && (
        <HandRail
          cards={hand.cards}
          onCardClick={hand.onCardClick}
          onHover={hand.onHover}
          playableIds={hand.playableIds}
          targetIds={hand.targetIds}
          trailing={hand.trailing}
          onTrailingClick={hand.onTrailingClick}
        />
      )}
      {hand && !railed && !rowed && (
        <HandBar
          cards={hand.cards}
          onCardClick={hand.onCardClick}
          onHover={hand.onHover}
          playableIds={hand.playableIds}
          targetIds={hand.targetIds}
          trailing={hand.trailing}
          onTrailingClick={hand.onTrailingClick}
          raised={raised}
          promptSlotRef={setHandPromptSlot ?? undefined}
        />
      )}
      {rowed && hand && (
        <HandRow
          cards={hand.cards}
          onCardClick={hand.onCardClick}
          onHover={hand.onHover}
          playableIds={hand.playableIds}
          targetIds={hand.targetIds}
          trailing={hand.trailing}
          onTrailingClick={hand.onTrailingClick}
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
    </BoardLayoutProvider>
  )
}
