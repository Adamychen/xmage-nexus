import type { CombatGroupView, PlayerView } from '../net/types'
import { useTranslation } from '../i18n'
import './OpponentSwitcherBar.css'

interface OpponentSwitcherBarProps {
  opponents: PlayerView[]
  selectedOppId: string
  onSelectOpponent: (id: string) => void
  activePlayerId?: string
  targetIds?: Set<string>
  onTargetClick?: (id: string) => void
  combat?: CombatGroupView[]
}

export default function OpponentSwitcherBar({
  opponents,
  selectedOppId,
  onSelectOpponent,
  activePlayerId,
  targetIds = new Set(),
  onTargetClick,
  combat = [],
}: OpponentSwitcherBarProps) {
  const { t } = useTranslation()
  if (opponents.length <= 1) return null

  const currentIndex = opponents.findIndex((p) => p.playerId === selectedOppId)
  const currentIdx = currentIndex >= 0 ? currentIndex : 0

  const handlePrev = () => {
    const nextIdx = (currentIdx - 1 + opponents.length) % opponents.length
    onSelectOpponent(opponents[nextIdx].playerId)
  }

  const handleNext = () => {
    const nextIdx = (currentIdx + 1) % opponents.length
    onSelectOpponent(opponents[nextIdx].playerId)
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
        {opponents.map((opp) => {
          const isSelected = opp.playerId === selectedOppId
          const isTurn = opp.playerId === activePlayerId || opp.isActive
          const isTargetable = targetIds.has(opp.playerId)

          const isDefeated = opp.hasLeft === true || opp.life <= 0

          // Check if this opponent is being attacked or has blockers in combat
          const isInvolvedInCombat = (combat ?? []).some((g) => {
            const defs = (g.defenders as unknown[]) ?? []
            return defs.includes(opp.playerId) || (g as any).defenderId === opp.playerId
          })

          return (
            <button
              key={opp.playerId}
              type="button"
              className={[
                'opp-pill',
                isSelected ? 'is-selected' : '',
                isTurn ? 'is-turn' : '',
                isTargetable ? 'is-targetable' : '',
                isDefeated ? 'is-defeated' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => {
                if (isTargetable && onTargetClick) {
                  onTargetClick(opp.playerId)
                }
                onSelectOpponent(opp.playerId)
              }}
              title={`${t('board', 'opp_view', { name: opp.name })}${isDefeated ? (opp.hasLeft ? t('board', 'opp_left_suffix') : t('board', 'opp_defeated_suffix')) : ''}${isTargetable ? t('board', 'opp_target_suffix') : ''}`}
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
          )
        })}
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
