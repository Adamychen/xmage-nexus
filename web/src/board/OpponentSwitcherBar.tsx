import type { CombatGroupView, PlayerView } from '../net/types'
import { useTranslation } from '../i18n'
import './OpponentSwitcherBar.css'

interface OpponentSwitcherBarProps {
  /** Todos los jugadores en orden de turno (incluido yo): la secuencia de
   *  píldoras + flechas hace el orden implícito, sin reordenar nunca. */
  players: PlayerView[]
  controlledId?: string
  selectedOppId: string
  onSelectOpponent: (id: string) => void
  activePlayerId?: string
  targetIds?: Set<string>
  onTargetClick?: (id: string) => void
  combat?: CombatGroupView[]
}

function isOut(p: PlayerView): boolean {
  return p.hasLeft === true || p.life <= 0
}

export default function OpponentSwitcherBar({
  players,
  controlledId,
  selectedOppId,
  onSelectOpponent,
  activePlayerId,
  targetIds = new Set(),
  onTargetClick,
  combat = [],
}: OpponentSwitcherBarProps) {
  const { t } = useTranslation()
  // El servidor lista a los jugadores en orden de mapa (table added order),
  // pero los turnos avanzan en orden inverso: PlayerList se construye con
  // CircularList.add(), que inserta en cabeza e invierte la lista. La tira
  // muestra el orden real de turnos (inverso al recibido) y ‹ › navegan
  // sobre ese orden mostrado.
  const ordered = [...players].reverse()
  // Enfocables: rivales en juego. Yo y los derrotados/desconectados salen
  // como píldoras desactivadas y fuera del ciclo ‹ ›.
  const focusable = ordered.filter((p) => p.playerId !== controlledId && !isOut(p))
  if (focusable.length <= 1) return null

  const currentIndex = focusable.findIndex((p) => p.playerId === selectedOppId)
  const currentIdx = currentIndex >= 0 ? currentIndex : 0

  // Flecha de cierre circular (último → primero): el orden es cíclico,
  // igual que en el anillo de POD.
  const last = ordered[ordered.length - 1]
  const first = ordered[0]

  const handlePrev = () => {
    const nextIdx = (currentIdx - 1 + focusable.length) % focusable.length
    onSelectOpponent(focusable[nextIdx].playerId)
  }

  const handleNext = () => {
    const nextIdx = (currentIdx + 1) % focusable.length
    onSelectOpponent(focusable[nextIdx].playerId)
  }

  return (
    <div className="opponent-switcher-bar">
      <button
        type="button"
        className="opp-switch-btn prev"
        onClick={handlePrev}
        title={t('board', 'opp_prev')}
      >
        ‹
      </button>

      <div className="opp-pills-list">
        {ordered.map((opp, idx) => {
          const isSelected = opp.playerId === selectedOppId
          const isTurn = opp.playerId === activePlayerId || opp.isActive
          const isTargetable = targetIds.has(opp.playerId)
          const isSelf = opp.playerId === controlledId || !!opp.controlled

          const isDefeated = isOut(opp)

          // Check if this opponent is being attacked or has blockers in combat
          const isInvolvedInCombat = (combat ?? []).some((g) => {
            const defs = (g.defenders as unknown[]) ?? []
            return defs.includes(opp.playerId) || (g as any).defenderId === opp.playerId
          })

          const next = ordered[idx + 1]
          const isActiveEdge = opp.playerId === activePlayerId

          return (
            <span key={opp.playerId} className="opp-pill-group">
            <button
              type="button"
              disabled={isSelf}
              className={[
                'opp-pill',
                isSelected ? 'is-selected' : '',
                isTurn ? 'is-turn' : '',
                isTargetable && !isSelf ? 'is-targetable' : '',
                isDefeated ? 'is-defeated' : '',
                isSelf ? 'is-self' : '',
              ].filter(Boolean).join(' ')}
              onClick={isSelf ? undefined : () => {
                if (isTargetable && onTargetClick) {
                  onTargetClick(opp.playerId)
                }
                onSelectOpponent(opp.playerId)
              }}
              title={`${t('board', 'opp_view', { name: opp.name })}${isDefeated ? (opp.hasLeft ? t('board', 'opp_left_suffix') : t('board', 'opp_defeated_suffix')) : ''}${isTargetable && !isSelf ? t('board', 'opp_target_suffix') : ''}`}
            >
              <span>{opp.name}</span>
              <span className="opp-pill-life">
                {isDefeated ? (opp.hasLeft ? t('board', 'opp_out') : t('board', 'opp_dead')) : `${opp.life} ❤️`}
              </span>
              {isTurn && !isDefeated && <span className="opp-pill-tag turn-tag">{t('board', 'opp_turn_tag')}</span>}
              {isInvolvedInCombat && !isDefeated && (
                <span className="opp-pill-tag combat-tag">{t('board', 'opp_combat_tag')}</span>
              )}
            </button>
            {next && (
              <span
                className={`opp-arrow ${isActiveEdge ? 'is-active-edge' : ''}`}
                data-testid={`opp-arrow-${opp.playerId}-${next.playerId}`}
                aria-hidden
              >
                →
              </span>
            )}
            </span>
          )
        })}
        {last && first && last.playerId !== first.playerId && (
          <span
            className={`opp-arrow opp-arrow--wrap ${last.playerId === activePlayerId ? 'is-active-edge' : ''}`}
            data-testid={`opp-arrow-${last.playerId}-${first.playerId}`}
            aria-hidden
          >
            ↺
          </span>
        )}
      </div>

      <button
        type="button"
        className="opp-switch-btn next"
        onClick={handleNext}
        title={t('board', 'opp_next')}
      >
        ›
      </button>
    </div>
  )
}
