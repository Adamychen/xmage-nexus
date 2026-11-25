import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import type { CardView, GameView, PlayerView } from '../net/types'
import { commanderDamageDealt, syncCommanderMemory, type MatrixCommander } from '../board/commanders'
import Icon from '../ui/Icon'
import { useTranslation } from '../i18n'
import './CommanderDamageDropdown.css'

export const COMMANDER_LETHAL = 21
export const COMMANDER_WARNING = 15

interface CommanderDamageEntry {
  commander: MatrixCommander
  dmg: number
}

interface CommanderDamageDropdownProps {
  game: GameView | null
  player: PlayerView
  side: 'opp' | 'my'
  onHoverCard?: (card: CardView | null, rect?: DOMRect) => void
}

const VIEWPORT_MARGIN = 10
const PANEL_WIDTH = 264

export default function CommanderDamageDropdown({
  game,
  player,
  side,
  onHoverCard,
}: CommanderDamageDropdownProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<CSSProperties | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const entries = useMemo((): CommanderDamageEntry[] => {
    if (!game) return []
    const commanders = syncCommanderMemory(game).filter(
      (c) => (!c.isCompanion || c.isCommander) && c.ownerId !== player.playerId,
    )
    return commanders.map((commander) => ({
      commander,
      dmg: commanderDamageDealt(game, commander, player),
    }))
  }, [game, player])

  const maxDmg = useMemo(
    () => entries.reduce((best, e) => Math.max(best, e.dmg), 0),
    [entries],
  )

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    const update = () => {
      const btn = triggerRef.current
      if (!btn) return
      const r = btn.getBoundingClientRect()
      const vw = window.innerWidth
      const left = Math.max(
        VIEWPORT_MARGIN,
        Math.min(r.left + r.width / 2 - PANEL_WIDTH / 2, vw - PANEL_WIDTH - VIEWPORT_MARGIN),
      )
      if (side === 'my') {
        setPos({ left, bottom: Math.max(VIEWPORT_MARGIN, window.innerHeight - r.top + 6) })
      } else {
        setPos({ left, top: Math.max(VIEWPORT_MARGIN, r.bottom + 6) })
      }
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, side])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (entries.length === 0) return null

  const tierClass =
    maxDmg >= COMMANDER_LETHAL ? ' is-lethal' : maxDmg >= COMMANDER_WARNING ? ' is-warning' : maxDmg > 0 ? ' has-damage' : ''

  const toggle = (e: MouseEvent) => {
    e.stopPropagation()
    setOpen((v) => !v)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`cmd-dmg-toggle${tierClass}${open ? ' is-open' : ''}`}
        data-testid={`cmd-dmg-toggle-${player.playerId}`}
        aria-expanded={open}
        aria-label={`${t('game', 'commander_damage')} — ${player.name}`}
        title={t('game', 'commander_damage')}
        onClick={toggle}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Icon name={open ? 'chevronUp' : 'chevronDown'} size={11} />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className={`cmd-dmg-dropdown is-${side}`}
            data-testid={`cmd-dmg-dropdown-${player.playerId}`}
            role="dialog"
            aria-label={`${t('game', 'commander_damage')} — ${player.name}`}
            style={pos ?? undefined}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="cmd-dmg-head">
              <span className="cmd-dmg-title">
                <Icon name="crown" size={12} /> {t('game', 'commander_damage')}
              </span>
              <span className="cmd-dmg-cap">
                {t('game', 'commander_lethal_label', { count: String(COMMANDER_LETHAL) })}
              </span>
            </div>

            <ul className="cmd-dmg-list">
              {entries.map(({ commander, dmg }) => {
                const isLethal = dmg >= COMMANDER_LETHAL
                const isWarn = !isLethal && dmg >= COMMANDER_WARNING
                const pct = Math.min(100, Math.round((dmg / COMMANDER_LETHAL) * 100))
                return (
                  <li
                    key={commander.id}
                    className={`cmd-dmg-row${isLethal ? ' is-lethal' : isWarn ? ' is-warning' : ''}`}
                    onMouseEnter={(e) =>
                      onHoverCard?.(
                        { name: commander.name, displayName: commander.name, manaValue: 0 } as CardView,
                        e.currentTarget.getBoundingClientRect(),
                      )
                    }
                    onMouseLeave={() => onHoverCard?.(null)}
                  >
                    <div className="cmd-dmg-row-main">
                      <div className="cmd-dmg-who">
                        <span className="cmd-dmg-owner">{commander.ownerName}</span>
                        <span className="cmd-dmg-name">{commander.name}</span>
                      </div>
                      <span className="cmd-dmg-val" title={t('game', 'commander_damage_dealt', { name: commander.name, damage: String(dmg), target: player.name })}>
                        {dmg}
                      </span>
                    </div>
                    <div className="cmd-dmg-bar" aria-hidden="true">
                      <div className="cmd-dmg-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>,
          document.body,
        )}
    </>
  )
}
